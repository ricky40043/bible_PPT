from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import urllib.parse
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

    async def connect(self, websocket: WebSocket, room_id: str):
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = []
        self.active_connections[room_id].append(websocket)

    def disconnect(self, websocket: WebSocket, room_id: str):
        if room_id in self.active_connections:
            self.active_connections[room_id].remove(websocket)
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]

    async def broadcast(self, message: dict, room_id: str):
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
            verse_end=req.verse_end
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
