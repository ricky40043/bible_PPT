import requests
import time
import random
from bs4 import BeautifulSoup
from typing import List, Dict, Optional
from opencc import OpenCC
import bible_db

BIBLE_VERSIONS = {
    "CUNP": "46",
    "RCUV": "139",
    "CCB": "36"
}

_converter = OpenCC('s2t')

def fetch_bible_chapter_from_web(version: str, book: str, chapter: int, retries: int = 3) -> List[Dict]:
    """從 Bible.com 即時爬取單一章節經文"""
    version_id = BIBLE_VERSIONS.get(version.upper(), "46")
    url = f"https://www.bible.com/bible/{version_id}/{book}.{chapter}.{version.upper()}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7",
    }
    
    last_err = None
    for attempt in range(retries):
        try:
            res = requests.get(url, headers=headers, timeout=12)
            if res.status_code == 200:
                soup = BeautifulSoup(res.text, "lxml")
                
                # 移除所有註解、標題與導覽標籤，避免數字或小標題污染經文內容
                for note in soup.find_all(class_=lambda x: x and ("note" in x or "label" in x or "heading" in x or "ft" in x or "fk" in x or "yiy" in x)):
                    note.decompose()

                # 找出所有具備 data-usfm 屬性的元素 (經文片段)
                verse_segments = soup.find_all(attrs={"data-usfm": True})
                merged_verses = {}
                
                for seg in verse_segments:
                    usfm = seg.get("data-usfm")
                    parts = usfm.split(".")
                    if len(parts) < 3:
                        continue
                    v_num = parts[2].split("+")[0]
                    
                    text = seg.get_text().strip()
                    if not text:
                        continue
                        
                    if v_num not in merged_verses:
                        merged_verses[v_num] = text
                    else:
                        merged_verses[v_num] += text

                results = []
                for num, text in merged_verses.items():
                    results.append({
                        "num": num,
                        "text": _converter.convert(text)
                    })
                        
                results.sort(key=lambda x: int(x['num']) if x['num'].isdigit() else 999)
                return results
            else:
                last_err = Exception(f"HTTP {res.status_code} for {url}")
        except Exception as e:
            last_err = e
            
        time.sleep(1 + attempt * 1.5 + random.random())
        
    raise last_err or Exception(f"Failed to fetch {url}")

def get_bible_chapter(version: str, book: str, chapter: int) -> List[Dict]:
    """
    獲取經文首選從本地資料庫讀取；
    若本地尚無，則即時爬取並寫入資料庫緩存。
    """
    cached = bible_db.get_bible_chapter(version, book, chapter)
    if cached:
        return cached
    
    # 本地無資料，嘗試從網路爬取並存庫
    verses = fetch_bible_chapter_from_web(version, book, chapter)
    if verses:
        bible_db.save_chapter_verses(version, book, chapter, verses)
    return verses

def get_chapter_count(book: str) -> int:
    return bible_db.get_chapter_count(book)

def get_verse_count(version: str, book: str, chapter: int) -> int:
    # 優先查資料庫
    count = bible_db.get_verse_count(version, book, chapter)
    if count > 0:
        return count
    # 查無則載入該章
    verses = get_bible_chapter(version, book, chapter)
    if not verses:
        return 0
    try:
        return int(verses[-1]['num'])
    except (ValueError, IndexError):
        return len(verses)
