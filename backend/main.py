from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Request, Depends
from fastapi.responses import StreamingResponse, FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import urllib.parse
import os
import time
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any

from constants import BIBLE_BOOKS, VERSIONS
from scraper import get_bible_chapter, get_chapter_count, get_verse_count
import bible_db
import user_db
import usage_db
import auth
from ppt_generator import generate_bible_ppt

app = FastAPI(title="Bible PPT & Reader API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────── 資料庫初始化 ──────────────────────────────
DATA_DIR = os.getenv('DATA_DIR', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data'))
os.makedirs(DATA_DIR, exist_ok=True)
usage_db.init_db(os.path.join(DATA_DIR, 'usage.db'))
bible_db.init_bible_db(os.path.join(DATA_DIR, 'bible.db'))
user_db.init_user_db(os.path.join(DATA_DIR, 'users.db'))

ADMIN_TOKEN = os.getenv('ADMIN_TOKEN', '')

def client_ip(request: Request):
    return (request.headers.get('cf-connecting-ip')
            or request.headers.get('x-forwarded-for', '').split(',')[0].strip()
            or (request.client.host if request.client else '') or '')

def _admin_ok(request: Request):
    if not ADMIN_TOKEN:
        return False
    got = request.headers.get('x-admin-token') or request.query_params.get('token', '')
    if not got:
        a = request.headers.get('authorization', '')
        if a.startswith('Bearer '):
            got = a[7:]
    return got == ADMIN_TOKEN

# ─────────────────────────── WebSocket 投影同步 ──────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}
        self.room_state: dict[str, dict] = {}

    async def connect(self, websocket: WebSocket, room_id: str):
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = []
        self.active_connections[room_id].append(websocket)
        if room_id in self.room_state:
            await websocket.send_json(self.room_state[room_id])

    def disconnect(self, websocket: WebSocket, room_id: str):
        if room_id in self.active_connections:
            self.active_connections[room_id].remove(websocket)
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]
                self.room_state.pop(room_id, None)

    async def broadcast(self, message: dict, room_id: str):
        if message.get('type') == 'SYNC':
            self.room_state[room_id] = message
        if room_id in self.active_connections:
            for connection in self.active_connections[room_id]:
                await connection.send_json(message)

manager = ConnectionManager()

# ─────────────────────────── 經文讀取 API ──────────────────────────────
class GenerateRequest(BaseModel):
    version: str
    book: str
    chapter: int
    verse_start: Optional[int] = None
    verse_end: Optional[int] = None
    include_version: bool = True

@app.get("/api/versions")
def get_versions():
    return VERSIONS

@app.get("/api/books")
def get_books():
    return BIBLE_BOOKS

@app.get("/api/chapters/{book}")
def get_chapters(book: str):
    count = get_chapter_count(book)
    return {"count": count}

@app.get("/api/verses/{version}/{book}/{chapter}")
def get_verses(version: str, book: str, chapter: int):
    try:
        count = get_verse_count(version, book, chapter)
        return {"count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/verses_list/{version}/{book}/{chapter}")
def get_verses_list(version: str, book: str, chapter: int, start: Optional[int] = None, end: Optional[int] = None):
    try:
        verses = get_bible_chapter(version, book, chapter)
        if start is not None and end is not None:
            return [v for v in verses if v['num'].isdigit() and start <= int(v['num']) <= end]
        return verses
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/bible/stats")
def get_bible_stats():
    return bible_db.get_db_stats()

# ─────────────────────────── 使用者認證 API ──────────────────────────────
class RegisterRequest(BaseModel):
    email: str
    username: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class GoogleLoginRequest(BaseModel):
    credential: Optional[str] = None
    email: Optional[str] = None
    name: Optional[str] = None
    google_id: Optional[str] = None
    avatar_url: Optional[str] = None

@app.post("/api/auth/register")
def register_user(req: RegisterRequest):
    if not req.email or '@' not in req.email:
        raise HTTPException(status_code=400, detail="請輸入有效的 Email")
    if not req.password or len(req.password) < 6:
        raise HTTPException(status_code=400, detail="密碼長度至少需要 6 個字元")
    
    existing = user_db.get_user_by_email(req.email)
    if existing:
        raise HTTPException(status_code=400, detail="此 Email 已被註冊")
        
    pwd_hash = auth.hash_password(req.password)
    user = user_db.create_user(
        email=req.email,
        username=req.username or req.email.split('@')[0],
        password_hash=pwd_hash,
        auth_provider='local'
    )
    token = auth.create_access_token(user["id"], user["email"], user["username"])
    return {"token": token, "user": user}

@app.post("/api/auth/login")
def login_user(req: LoginRequest):
    user = user_db.get_user_by_email(req.email)
    if not user:
        raise HTTPException(status_code=400, detail="帳號或密碼錯誤")
        
    if not user.get("password_hash") or not auth.verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="帳號或密碼錯誤")
        
    token = auth.create_access_token(user["id"], user["email"], user["username"])
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "username": user["username"],
            "avatar_url": user.get("avatar_url", ""),
            "auth_provider": user.get("auth_provider", "local")
        }
    }

@app.post("/api/auth/google")
def google_auth(req: GoogleLoginRequest):
    email = req.email
    name = req.name or ""
    google_id = req.google_id or ""
    avatar_url = req.avatar_url or ""
    
    if req.credential:
        verified = auth.verify_google_id_token(req.credential)
        if verified:
            email = verified.get("email") or email
            name = verified.get("name") or name
            google_id = verified.get("google_id") or google_id
            avatar_url = verified.get("avatar_url") or avatar_url
            
    if not email:
        raise HTTPException(status_code=400, detail="Google 認證失敗，未能取得信箱")
        
    user = user_db.get_or_create_google_user(
        email=email,
        name=name or email.split('@')[0],
        google_id=google_id,
        avatar_url=avatar_url
    )
    token = auth.create_access_token(user["id"], user["email"], user["username"])
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "username": user["username"],
            "avatar_url": user.get("avatar_url", ""),
            "auth_provider": "google"
        }
    }

@app.get("/api/auth/me")
def get_me(user: Dict = Depends(auth.get_current_user)):
    progress = user_db.get_user_progress(user["id"])
    return {
        "user": {
            "id": user["id"],
            "email": user["email"],
            "username": user["username"],
            "avatar_url": user.get("avatar_url", ""),
            "auth_provider": user.get("auth_provider", "local")
        },
        "progress": progress
    }

# ─────────────────────────── 讀經進度 API ──────────────────────────────
class ProgressRequest(BaseModel):
    version: str
    book: str
    chapter: int
    verse_num: Optional[int] = 1

@app.get("/api/progress")
def get_progress(user: Dict = Depends(auth.get_current_user)):
    progress = user_db.get_user_progress(user["id"])
    return {"progress": progress}

@app.post("/api/progress")
def update_progress(req: ProgressRequest, user: Dict = Depends(auth.get_current_user)):
    result = user_db.save_user_progress(
        user_id=user["id"],
        version=req.version,
        book=req.book,
        chapter=req.chapter,
        verse_num=req.verse_num or 1
    )
    return {"status": "ok", "progress": result}

# ─────────────────────────── 經文畫線標註 (Highlight) API ──────────────────────────────
class HighlightRequest(BaseModel):
    version: str
    book: str
    chapter: int
    verse_num: int
    color: str # 例如 '#fef08a'
    note: Optional[str] = ''

@app.get("/api/highlights")
def get_chapter_highlights(
    version: str, book: str, chapter: int,
    user: Optional[Dict] = Depends(auth.get_current_user_optional)
):
    if not user:
        return {"highlights": []}
    items = user_db.get_chapter_highlights(user["id"], version, book, chapter)
    return {"highlights": items}

@app.post("/api/highlights")
def add_or_update_highlight(req: HighlightRequest, user: Dict = Depends(auth.get_current_user)):
    res = user_db.save_highlight(
        user_id=user["id"],
        version=req.version,
        book=req.book,
        chapter=req.chapter,
        verse_num=req.verse_num,
        color=req.color,
        note=req.note or ''
    )
    return {"status": "ok", "highlight": res}

@app.delete("/api/highlights")
def delete_highlight(
    version: str, book: str, chapter: int, verse_num: int,
    user: Dict = Depends(auth.get_current_user)
):
    success = user_db.remove_highlight(user["id"], version, book, chapter, verse_num)
    return {"status": "ok" if success else "not_found"}

@app.get("/api/highlights/all")
def get_all_highlights(user: Dict = Depends(auth.get_current_user)):
    items = user_db.get_all_user_highlights(user["id"])
    return {"highlights": items}

# ─────────────────────────── 經文 PPT 產出與 WebSocket ──────────────────────────────
@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    await manager.connect(websocket, room_id)
    ws_ip = (websocket.headers.get('cf-connecting-ip')
             or websocket.headers.get('x-forwarded-for', '').split(',')[0].strip()
             or (websocket.client.host if websocket.client else ''))
    usage_db.log_usage(ws_ip, '/ws（投影連線）', summary=f"投影房間 {room_id}",
        detail={'room': room_id}, status='ok',
        user_agent=websocket.headers.get('user-agent', ''))
    try:
        while True:
            data = await websocket.receive_json()
            if data.get('type') == 'PING':
                await websocket.send_json({'type': 'PONG'})
                continue
            await manager.broadcast(data, room_id)
    except WebSocketDisconnect:
        manager.disconnect(websocket, room_id)

@app.post("/api/generate")
def generate_ppt(req: GenerateRequest, request: Request):
    t0 = time.time()
    book_zh = next((b["name"] for b in BIBLE_BOOKS if b["id"] == req.book), req.book)

    try:
        verses = get_bible_chapter(req.version, req.book, req.chapter)
        if not verses:
            raise HTTPException(status_code=404, detail="No verses found")

        version_obj = next((v for v in VERSIONS if v["id"] == req.version), {"name": req.version, "id": req.version})
        full_version_id_name = f"{version_obj['name']}{version_obj['id']}"

        ppt_stream = generate_bible_ppt(
            full_version_id_name, book_zh, req.chapter, verses,
            verse_start=req.verse_start,
            verse_end=req.verse_end,
            include_version=req.include_version
        )

        if req.verse_start and req.verse_end:
            range_str = f"{req.verse_start}-{req.verse_end}"
        elif req.verse_start:
            range_str = f"{req.verse_start}"
        else:
            range_str = ""
            
        final_range = f":{range_str}" if range_str else ""
        filename = f"{book_zh} {req.chapter}{final_range}.pptx"
        encoded_filename = urllib.parse.quote(filename, encoding='utf-8')

        usage_db.log_usage(client_ip(request), '/api/generate（產出經文 PPT）',
            summary=f"{book_zh} {req.chapter}{final_range}（{req.version}）",
            detail={'version': req.version, 'book': req.book, 'chapter': req.chapter,
                    'verse_start': req.verse_start, 'verse_end': req.verse_end, 'num_verses': len(verses)},
            status='ok', duration_ms=(time.time()-t0)*1000,
            user_agent=request.headers.get('user-agent', ''))

        return StreamingResponse(
            ppt_stream,
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
            headers={
                "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}",
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )
    except Exception as e:
        usage_db.log_usage(client_ip(request), '/api/generate（產出經文 PPT）',
            summary=f"{book_zh} {req.chapter}（{req.version}）", status='error', error=str(e),
            duration_ms=(time.time()-t0)*1000, user_agent=request.headers.get('user-agent', ''))
        raise HTTPException(status_code=500, detail=str(e))

# ─────────────────────────── 後台管理 ────────────────────────────
@app.get("/admin")
def admin_page():
    return FileResponse(os.path.join(os.path.dirname(os.path.abspath(__file__)), "admin.html"))

@app.get("/api/admin/usage")
def admin_usage(request: Request, limit: int = 100, offset: int = 0):
    if not _admin_ok(request):
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    return {"items": usage_db.list_usage(min(limit, 500), offset), "total": usage_db.count_usage()}

@app.get("/api/admin/stats")
def admin_stats(request: Request):
    if not _admin_ok(request):
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    stats = usage_db.get_stats()
    stats["bible_db"] = bible_db.get_db_stats()
    return stats

# ─────────────────────────── 靜態前端資源託管 ────────────────────────────
base_dir = os.path.dirname(os.path.abspath(__file__))
frontend_path = os.path.join(base_dir, "frontend", "dist")

if not os.path.exists(frontend_path):
    frontend_path = os.path.join(os.getcwd(), "frontend", "dist")

if os.path.exists(frontend_path):
    assets_dir = os.path.join(frontend_path, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str, request: Request):
        if full_path.startswith("api") or full_path.startswith("ws"):
            return None
        if request.headers.get('host', '').startswith('admin'):
            return FileResponse(os.path.join(os.path.dirname(os.path.abspath(__file__)), "admin.html"))
        file_path = os.path.join(frontend_path, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_path, "index.html"))

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 5001))
    print(f">>> 伺服器啟動中，監聽埠號: {port}")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
