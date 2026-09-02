"""
使用者、讀經進度與經文標註資料庫管理模組 (SQLite，零外部依賴)
"""
import sqlite3
import os
import threading
from datetime import datetime
from typing import Optional, Dict, List, Any

_db_path = None
_lock = threading.Lock()

_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT UNIQUE NOT NULL,
    username      TEXT NOT NULL,
    password_hash TEXT,
    auth_provider TEXT DEFAULT 'local', -- 'local' or 'google'
    google_id     TEXT,
    avatar_url    TEXT DEFAULT '',
    created_at    TEXT,
    updated_at    TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google ON users(google_id);

CREATE TABLE IF NOT EXISTS user_progress (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL UNIQUE,
    version     TEXT NOT NULL,
    book        TEXT NOT NULL,
    chapter     INTEGER NOT NULL,
    verse_num   INTEGER DEFAULT 1,
    updated_at  TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_highlights (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    version     TEXT NOT NULL,
    book        TEXT NOT NULL,
    chapter     INTEGER NOT NULL,
    verse_num   INTEGER NOT NULL,
    color       TEXT NOT NULL, -- e.g. '#fef08a'
    note        TEXT DEFAULT '',
    created_at  TEXT,
    updated_at  TEXT,
    UNIQUE(user_id, version, book, chapter, verse_num),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_hl_user_chapter ON user_highlights(user_id, version, book, chapter);
"""

def init_user_db(path: Optional[str] = None):
    global _db_path
    if path is None:
        data_dir = os.getenv('DATA_DIR', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data'))
        path = os.path.join(data_dir, 'users.db')
        
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
        init_user_db()
    conn = sqlite3.connect(_db_path, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn

# ─────────────────────────── 使用者管理 ──────────────────────────────

def create_user(email: str, username: str, password_hash: str, auth_provider: str = 'local', google_id: Optional[str] = None, avatar_url: str = '') -> Dict[str, Any]:
    now = datetime.now().isoformat()
    conn = get_db_connection()
    with _lock:
        try:
            cur = conn.cursor()
            cur.execute(
                """INSERT INTO users (email, username, password_hash, auth_provider, google_id, avatar_url, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (email.lower().strip(), username.strip(), password_hash, auth_provider, google_id, avatar_url, now, now)
            )
            user_id = cur.lastrowid
            conn.commit()
            return {
                "id": user_id,
                "email": email.lower().strip(),
                "username": username.strip(),
                "avatar_url": avatar_url,
                "auth_provider": auth_provider
            }
        finally:
            conn.close()

def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM users WHERE email = ?", (email.lower().strip(),))
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()

def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()

def get_or_create_google_user(email: str, name: str, google_id: str, avatar_url: str = '') -> Dict[str, Any]:
    user = get_user_by_email(email)
    now = datetime.now().isoformat()
    conn = get_db_connection()
    with _lock:
        try:
            cur = conn.cursor()
            if user:
                # 更新 google_id 與 avatar
                cur.execute(
                    """UPDATE users SET google_id = ?, avatar_url = COALESCE(NULLIF(?, ''), avatar_url), updated_at = ?
                       WHERE id = ?""",
                    (google_id, avatar_url, now, user["id"])
                )
                conn.commit()
                return get_user_by_id(user["id"])
            else:
                # 新增 Google 使用者
                cur.execute(
                    """INSERT INTO users (email, username, password_hash, auth_provider, google_id, avatar_url, created_at, updated_at)
                       VALUES (?, ?, ?, 'google', ?, ?, ?, ?)""",
                    (email.lower().strip(), name.strip() or email.split('@')[0], '', google_id, avatar_url, now, now)
                )
                user_id = cur.lastrowid
                conn.commit()
                return get_user_by_id(user_id)
        finally:
            conn.close()

# ─────────────────────────── 讀經進度 ──────────────────────────────

def get_user_progress(user_id: int) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM user_progress WHERE user_id = ?", (user_id,))
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()

def save_user_progress(user_id: int, version: str, book: str, chapter: int, verse_num: int = 1) -> Dict[str, Any]:
    now = datetime.now().isoformat()
    conn = get_db_connection()
    with _lock:
        try:
            cur = conn.cursor()
            cur.execute(
                """INSERT INTO user_progress (user_id, version, book, chapter, verse_num, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?)
                   ON CONFLICT(user_id) DO UPDATE SET
                     version = excluded.version,
                     book = excluded.book,
                     chapter = excluded.chapter,
                     verse_num = excluded.verse_num,
                     updated_at = excluded.updated_at""",
                (user_id, version.upper(), book.upper(), int(chapter), int(verse_num), now)
            )
            conn.commit()
            return {
                "user_id": user_id,
                "version": version.upper(),
                "book": book.upper(),
                "chapter": int(chapter),
                "verse_num": int(verse_num),
                "updated_at": now
            }
        finally:
            conn.close()

# ─────────────────────────── 經文畫線標註 ──────────────────────────────

def get_chapter_highlights(user_id: int, version: str, book: str, chapter: int) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """SELECT verse_num, color, note, updated_at FROM user_highlights 
               WHERE user_id = ? AND version = ? AND book = ? AND chapter = ?
               ORDER BY verse_num ASC""",
            (user_id, version.upper(), book.upper(), int(chapter))
        )
        rows = cur.fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()

def save_highlight(user_id: int, version: str, book: str, chapter: int, verse_num: int, color: str, note: str = '') -> Dict[str, Any]:
    now = datetime.now().isoformat()
    conn = get_db_connection()
    with _lock:
        try:
            cur = conn.cursor()
            cur.execute(
                """INSERT INTO user_highlights (user_id, version, book, chapter, verse_num, color, note, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT(user_id, version, book, chapter, verse_num) DO UPDATE SET
                     color = excluded.color,
                     note = excluded.note,
                     updated_at = excluded.updated_at""",
                (user_id, version.upper(), book.upper(), int(chapter), int(verse_num), color, note, now, now)
            )
            conn.commit()
            return {
                "user_id": user_id,
                "version": version.upper(),
                "book": book.upper(),
                "chapter": int(chapter),
                "verse_num": int(verse_num),
                "color": color,
                "note": note,
                "updated_at": now
            }
        finally:
            conn.close()

def remove_highlight(user_id: int, version: str, book: str, chapter: int, verse_num: int) -> bool:
    conn = get_db_connection()
    with _lock:
        try:
            cur = conn.cursor()
            cur.execute(
                """DELETE FROM user_highlights 
                   WHERE user_id = ? AND version = ? AND book = ? AND chapter = ? AND verse_num = ?""",
                (user_id, version.upper(), book.upper(), int(chapter), int(verse_num))
            )
            conn.commit()
            return cur.rowcount > 0
        finally:
            conn.close()

def get_all_user_highlights(user_id: int) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """SELECT version, book, chapter, verse_num, color, note, updated_at 
               FROM user_highlights WHERE user_id = ? 
               ORDER BY updated_at DESC""",
            (user_id,)
        )
        return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()
