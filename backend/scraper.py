import requests
import json
from bs4 import BeautifulSoup
from typing import List, Dict
from opencc import OpenCC

BIBLE_VERSIONS = {
    "CUNP": "46",
    "RCUV": "139",
    "CCB": "36"
}

# 每卷書的總章數清單 (USFM ID: 總章數)
BIBLE_CHAPTERS = {
    "GEN": 50, "EXO": 40, "LEV": 27, "NUM": 36, "DEU": 34, "JOS": 24, "JDG": 21, "RUT": 4,
    "1SA": 31, "2SA": 24, "1KI": 22, "2KI": 25, "1CH": 29, "2CH": 36, "EZR": 10, "NEH": 13,
    "EST": 10, "JOB": 42, "PSA": 150, "PRO": 31, "ECC": 12, "SNG": 8, "ISA": 66, "JER": 52,
    "LAM": 5, "EZK": 48, "DAN": 12, "HOS": 14, "JOL": 3, "AMO": 9, "OBA": 1, "JON": 4,
    "MIC": 7, "NAM": 3, "HAB": 3, "ZEP": 3, "HAG": 2, "ZEC": 14, "MAL": 4, "MAT": 28,
    "MRK": 16, "LUK": 24, "JHN": 21, "ACT": 28, "ROM": 16, "1CO": 16, "2CO": 13, "GAL": 6,
    "EPH": 6, "PHP": 4, "COL": 4, "1TH": 5, "2TH": 3, "1TI": 6, "2TI": 4, "TIT": 3,
    "PHM": 1, "HEB": 13, "JAS": 5, "1PE": 5, "2PE": 3, "1JN": 5, "2JN": 1, "3JN": 1,
    "JUD": 1, "REV": 22
}

def get_bible_chapter(version: str, book: str, chapter: int) -> List[Dict]:
    version_id = BIBLE_VERSIONS.get(version.upper(), "46")
    url = f"https://www.bible.com/bible/{version_id}/{book}.{chapter}.{version.upper()}"
    headers = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"}
    res = requests.get(url, headers=headers)
    
    if res.status_code != 200:
        raise Exception(f"Failed to fetch {url}, status code {res.status_code}")
        
    soup = BeautifulSoup(res.text, "lxml")
    next_data = soup.find("script", id="__NEXT_DATA__")
    if not next_data:
        raise Exception("Could not find __NEXT_DATA__ in HTML")
        
    data = json.loads(next_data.string)
    content_html = data.get("props", {}).get("pageProps", {}).get("chapterInfo", {}).get("content", "")
    
    content_soup = BeautifulSoup(content_html, "lxml")
    
    # 移除所有註解與導覽標籤，避免文字污染
    for note in content_soup.find_all(class_=lambda x: x and ("note" in x or "label" in x)):
        note.decompose()

    # 找出所有具備 data-usfm 屬性的 span (經文片段)
    verse_segments = content_soup.find_all("span", attrs={"data-usfm": True})
    
    merged_verses = {}
    
    for seg in verse_segments:
        usfm = seg.get("data-usfm")
        v_num = usfm.split(".")[-1]
        
        # 遞迴取得清乾淨後的純文字
        text = seg.get_text().strip()
        if not text:
            continue
            
        if v_num not in merged_verses:
            merged_verses[v_num] = text
        else:
            # 如果該節已經存在，則直接拼接（自動處理跨段落問題）
            merged_verses[v_num] += text

    # 轉換回原本的列表格式
    converter = OpenCC('s2t')
    results = []
    for num, text in merged_verses.items():
        results.append({
            "num": num,
            "text": converter.convert(text)
        })
            
    # 按節數排序
    results.sort(key=lambda x: int(x['num']) if x['num'].isdigit() else 999)
    return results

def get_chapter_count(book: str) -> int:
    """取得特定書卷的總章數。"""
    return BIBLE_CHAPTERS.get(book.upper(), 50)

def get_verse_count(version: str, book: str, chapter: int) -> int:
    """取得特定章節的總節數。"""
    verses = get_bible_chapter(version, book, chapter)
    if not verses:
        return 0
    # 取得最後一節的數字
    try:
        return int(verses[-1]['num'])
    except (ValueError, IndexError):
        return len(verses)
