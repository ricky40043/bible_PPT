"""
聖經經文資料庫管理模組 (SQLite，零外部依賴)
負責提供經文讀取、批次儲存、統計與離線緩存功能。
"""
import sqlite3
import os
import threading
from typing import List, Dict, Optional
from constants import BIBLE_BOOKS, BIBLE_CHAPTERS, VERSIONS

_db_path = None
_lock = threading.Lock()

_SCHEMA = """
CREATE TABLE IF NOT EXISTS bible_verses (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    version     TEXT NOT NULL,
    book        TEXT NOT NULL,
    chapter     INTEGER NOT NULL,
    verse_num   INTEGER NOT NULL,
    verse_label TEXT NOT NULL,
    text        TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bible_verse_unique 
ON bible_verses(version, book, chapter, verse_num);

CREATE INDEX IF NOT EXISTS idx_bible_chapter_lookup 
ON bible_verses(version, book, chapter);
"""

def init_bible_db(path: Optional[str] = None):
    global _db_path
    if path is None:
        data_dir = os.getenv('DATA_DIR', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data'))
        path = os.path.join(data_dir, 'bible.db')
    
    _db_path = path
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with _lock:
        conn = sqlite3.connect(_db_path)
        conn.executescript(_SCHEMA)
        conn.commit()
        conn.close()
    return _db_path

def get_db_connection():
    if not _db_path:
        init_bible_db()
    conn = sqlite3.connect(_db_path, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn

def is_chapter_cached(version: str, book: str, chapter: int) -> bool:
    """檢查特定版本/書卷/章節是否已存在於資料庫"""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT 1 FROM bible_verses WHERE version = ? AND book = ? AND chapter = ? LIMIT 1",
            (version.upper(), book.upper(), int(chapter))
        )
        return cur.fetchone() is not None
    finally:
        conn.close()

def get_bible_chapter(version: str, book: str, chapter: int) -> List[Dict]:
    """
    從資料庫讀取特定版本、書卷、章節的所有經文。
    回傳格式：[{"num": "1", "text": "起初，神創造天地。"}, ...]
    """
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """SELECT verse_label, text FROM bible_verses 
               WHERE version = ? AND book = ? AND chapter = ? 
               ORDER BY verse_num ASC""",
            (version.upper(), book.upper(), int(chapter))
        )
        rows = cur.fetchall()
        if not rows:
            return []
        return [{"num": str(row["verse_label"]), "text": row["text"]} for row in rows]
    finally:
        conn.close()

def save_chapter_verses(version: str, book: str, chapter: int, verses: List[Dict]):
    """
    將爬取或下載到的經文寫入資料庫（若已存在則覆蓋）。
    verses 格式：[{"num": "1", "text": "..."}, ...]
    """
    if not verses:
        return
        
    conn = get_db_connection()
    with _lock:
        try:
            cur = conn.cursor()
            records = []
            for v in verses:
                label = str(v.get("num", "")).strip()
                # 處理可能是 "1-2" 或非純數字的情況
                num_val = int(label) if label.isdigit() else 999
                records.append((
                    version.upper(),
                    book.upper(),
                    int(chapter),
                    num_val,
                    label,
                    v.get("text", "").strip()
                ))
            
            cur.executemany(
                """INSERT OR REPLACE INTO bible_verses 
                   (version, book, chapter, verse_num, verse_label, text) 
                   VALUES (?, ?, ?, ?, ?, ?)""",
                records
            )
            conn.commit()
        finally:
            conn.close()

def get_chapter_count(book: str) -> int:
    """取得特定書卷的總章數"""
    return BIBLE_CHAPTERS.get(book.upper(), 50)

def get_verse_count(version: str, book: str, chapter: int) -> int:
    """取得特定版本、書卷、章節的總節數"""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT COUNT(*), MAX(verse_num) FROM bible_verses WHERE version = ? AND book = ? AND chapter = ?",
            (version.upper(), book.upper(), int(chapter))
        )
        row = cur.fetchone()
        if row and row[0] > 0:
            return row[1] or row[0]
        return 0
    finally:
        conn.close()

def get_db_stats() -> Dict:
    """取得資料庫各版本的收錄統計"""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """SELECT version, COUNT(DISTINCT book || '-' || chapter) as chapters_count, COUNT(*) as verses_count 
               FROM bible_verses GROUP BY version"""
        )
        stats = {}
        for row in cur.fetchall():
            stats[row["version"]] = {
                "chapters": row["chapters_count"],
                "verses": row["verses_count"]
            }
        return stats
    finally:
        conn.close()
