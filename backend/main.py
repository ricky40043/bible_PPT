from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse, FileResponse
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
    try:
        while True:
            # 接收來自控制端的訊息 (JSON)
            data = await websocket.receive_json()
            # 廣播給同一個 Room 的所有人 (包含投影端)
            await manager.broadcast(data, room_id)
    except WebSocketDisconnect:
        manager.disconnect(websocket, room_id)

@app.post("/api/generate")
def generate_ppt(req: GenerateRequest):
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

        return StreamingResponse(
            ppt_stream,
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
            headers={
                "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}",
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
    async def serve_frontend(full_path: str):
        # 排除 API 與 WebSocket 請求
        if full_path.startswith("api") or full_path.startswith("ws"):
            return None
        
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
