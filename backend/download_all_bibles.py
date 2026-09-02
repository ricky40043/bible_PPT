"""
聖經全量批次下載器 (Batch Bible Downloader)
批次爬取 CUNP（新標點和合本）、RCUV（和合本修訂版）、CCB（當代譯本）全量經文，
並自動存入 SQLite 資料庫 (data/bible.db)。
支援斷點續傳、多執行緒下載、防被封鎖延遲控制。
"""
import os
import sys
import time
import random
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed

# 確保載入同目錄模組
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bible_db
from constants import BIBLE_BOOKS, BIBLE_CHAPTERS, VERSIONS
from scraper import fetch_bible_chapter_from_web

def get_all_tasks(versions):
    tasks = []
    for version in versions:
        for book_info in BIBLE_BOOKS:
            book_id = book_info["id"]
            total_chapters = BIBLE_CHAPTERS.get(book_id, 1)
            for chap in range(1, total_chapters + 1):
                tasks.append((version, book_id, chap))
    return tasks

def download_task(task_tuple):
    version, book, chapter = task_tuple
    
    # 檢查是否已在資料庫
    if bible_db.is_chapter_cached(version, book, chapter):
        return {"status": "skipped", "task": task_tuple, "verses": 0}
        
    try:
        verses = fetch_bible_chapter_from_web(version, book, chapter, retries=3)
        if verses:
            bible_db.save_chapter_verses(version, book, chapter, verses)
            # 微小休眠避免被限速
            time.sleep(0.05 + random.random() * 0.05)
            return {"status": "success", "task": task_tuple, "verses": len(verses)}
        else:
            return {"status": "empty", "task": task_tuple, "verses": 0}
    except Exception as e:
        return {"status": "error", "task": task_tuple, "error": str(e), "verses": 0}

def run_batch_download(versions=None, max_workers=5):
    if not versions:
        versions = ["CUNP", "RCUV", "CCB"]
        
    data_dir = os.getenv('DATA_DIR', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data'))
    os.makedirs(data_dir, exist_ok=True)
    db_path = bible_db.init_bible_db(os.path.join(data_dir, 'bible.db'))
    print(f"📖 經文資料庫位置: {db_path}")
    print(f"🚀 開始準備下載版本: {versions}，最大並行數: {max_workers}")
    
    tasks = get_all_tasks(versions)
    total_tasks = len(tasks)
    print(f"📊 總計任務數: {total_tasks} 個章節 (約 {len(versions)} x 1,189 章)")
    
    # 先統計已有的數量
    skipped = 0
    pending_tasks = []
    for t in tasks:
        if bible_db.is_chapter_cached(t[0], t[1], t[2]):
            skipped += 1
        else:
            pending_tasks.append(t)
            
    print(f"⚡ 已存在於資料庫: {skipped} 章節，待下載: {len(pending_tasks)} 章節")
    
    if not pending_tasks:
        print("🎉 所有版本的經文都已下載完成！")
        print("資料庫現有統計:")
        print(bible_db.get_db_stats())
        return
        
    success_count = 0
    error_count = 0
    start_time = time.time()
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(download_task, task): task for task in pending_tasks}
        completed = 0
        total_to_run = len(pending_tasks)
        
        for future in as_completed(futures):
            completed += 1
            res = future.result()
            task = res["task"]
            v, b, c = task
            
            if res["status"] == "success":
                success_count += 1
                status_str = f"✅ [{completed}/{total_to_run}] {v} {b} {c} 章 下載成功 ({res['verses']} 節)"
            elif res["status"] == "skipped":
                status_str = f"⏩ [{completed}/{total_to_run}] {v} {b} {c} 章 已存在"
            else:
                error_count += 1
                status_str = f"❌ [{completed}/{total_to_run}] {v} {b} {c} 章 失敗: {res.get('error', '未知錯誤')}"
                
            if completed % 10 == 0 or completed == total_to_run or res["status"] == "error":
                elapsed = time.time() - start_time
                rate = completed / elapsed if elapsed > 0 else 0
                print(f"{status_str} | 進度: {completed*100//total_to_run}% ({rate:.1f} 章/秒)")

    total_time = time.time() - start_time
    print("\n" + "="*50)
    print(f"🏁 下載任務結束！耗時: {total_time:.1f} 秒")
    print(f"✅ 成功: {success_count} | ⏩ 跳過: {skipped} | ❌ 失敗: {error_count}")
    print("📊 最終資料庫統計:")
    print(bible_db.get_db_stats())
    print("="*50)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="聖經全量批次下載器")
    parser.add_argument("--versions", type=str, default="CUNP,RCUV,CCB", help="以逗號分隔的版本清單，例如 CUNP,RCUV,CCB")
    parser.add_argument("--workers", type=int, default=6, help="並行下載執行緒數")
    args = parser.parse_args()
    
    target_versions = [v.strip().upper() for v in args.versions.split(",") if v.strip()]
    run_batch_download(target_versions, max_workers=args.workers)
