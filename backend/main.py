from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import StreamingResponse, FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import urllib.parse
import os
from pydantic import BaseModel
from typing import Optional

from constants import BIBLE_BOOKS, VERSIONS
from scraper import get_bible_chapter, get_chapter_count, get_verse_count
from ppt_generator import generate_bible_ppt

app = FastAPI(title="Bible PPT Generator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────── 使用紀錄 DB ──────────────────────────────
import time
import usage_db
DATA_DIR = os.getenv('DATA_DIR', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data'))
usage_db.init_db(os.path.join(DATA_DIR, 'usage.db'))
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

class ConnectionManager:
    def __init__(self):
        # { room_id: [websocket1, websocket2, ...] }
        self.active_connections: dict[str, list[WebSocket]] = {}
        # { room_id: last_sync_payload } — so new clients see the current slide immediately
        self.room_state: dict[str, dict] = {}

    async def connect(self, websocket: WebSocket, room_id: str):
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = []
        self.active_connections[room_id].append(websocket)
        # Send the current slide to the new client immediately (if any state exists)
        if room_id in self.room_state:
            await websocket.send_json(self.room_state[room_id])

    def disconnect(self, websocket: WebSocket, room_id: str):
        if room_id in self.active_connections:
            self.active_connections[room_id].remove(websocket)
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]
                self.room_state.pop(room_id, None)

    async def broadcast(self, message: dict, room_id: str):
        # Cache the latest SYNC so new clients can receive it on connect
        if message.get('type') == 'SYNC':
            self.room_state[room_id] = message
        if room_id in self.active_connections:
            for connection in self.active_connections[room_id]:
                await connection.send_json(message)

manager = ConnectionManager()

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
            # 只取範圍內的經文
            return [v for v in verses if v['num'].isdigit() and start <= int(v['num']) <= end]
        return verses
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    await manager.connect(websocket, room_id)
    # 記錄投影連線（誰連進投影房間，含 IP）
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

        # 取得完整版本名稱 (包含 ID)
        version_obj = next((v for v in VERSIONS if v["id"] == req.version), {"name": req.version, "id": req.version})
        full_version_id_name = f"{version_obj['name']}{version_obj['id']}"

        ppt_stream = generate_bible_ppt(
            full_version_id_name, book_zh, req.chapter, verses,
            verse_start=req.verse_start,
            verse_end=req.verse_end,
            include_version=req.include_version
        )

        # 建立簡潔的輸出檔名，與標題一致
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

# ─────────────────────────── 後台：使用紀錄 ────────────────────────────
# 必須在前端 catch-all 路由之前註冊，否則會被 /{full_path} 吃掉。
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
    return usage_db.get_stats()

# --- 啟動與診斷日誌 (用於 Cloud Run) ---
import sys
print(f"Python version: {sys.version}")
print(f"Current working directory: {os.getcwd()}")

# 修正：確保我們能找到前端編譯產物
base_dir = os.path.dirname(os.path.abspath(__file__))
# 考慮到 Dockerfile 映射路徑，檢查 /app/frontend/dist
frontend_path = os.path.join(base_dir, "frontend", "dist")

if not os.path.exists(frontend_path):
    # 最後嘗試檢查當前目錄下的 frontend/dist
    frontend_path = os.path.join(os.getcwd(), "frontend", "dist")

print(f"Targeting frontend path: {frontend_path}")

if os.path.exists(frontend_path):
    print(">>> 成功定位前端資源，正在掛載靜態路由...")
    # 掛載資產目錄 (Vite 編譯後的 assets)
    assets_dir = os.path.join(frontend_path, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
        print(f"Mounted /assets from {assets_dir}")

    # 退回路由：確保 React Router 的所有路徑都能正確載入 index.html
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str, request: Request):
        # 排除 API 與 WebSocket 請求
        if full_path.startswith("api") or full_path.startswith("ws"):
            return None

        # admin-bible 子網域：任何路徑都顯示後台
        if request.headers.get('host', '').startswith('admin'):
            return FileResponse(os.path.join(os.path.dirname(os.path.abspath(__file__)), "admin.html"))

        file_path = os.path.join(frontend_path, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)

        # 預設返回 index.html (SPA)
        return FileResponse(os.path.join(frontend_path, "index.html"))
    print(">>> 前端託管配置完成。")
else:
    print(">>> 警告: 未能找到前端靜態目錄。")

# 注意：Cloud Run 偏好直接透過環境變數 PORT 監聽，這裏設為內建啟動模式
if __name__ == "__main__":
    import uvicorn
    # 直接讀取容器提供的 PORT
    port = int(os.environ.get("PORT", 8080))
    print(f">>> 伺服器啟動中，監聽埠號: {port}")
    uvicorn.run("main:app", host="0.0.0.0", port=port)
