from scraper import get_bible_chapter

tests = [
    ("CUNP", "GEN", 1),
    ("RCUV", "PSA", 23),
    ("CCB", "JHN", 3)
]

for version, book, chapter in tests:
    print(f"Testing {version} {book} {chapter}...")
    try:
        verses = get_bible_chapter(version, book, chapter)
        print(f"Success! Total verses fetched: {len(verses)}")
        print("First verse:", verses[0] if verses else "None")
        print("Last verse:", verses[-1] if verses else "None")
    except Exception as e:
        print(f"Failed to fetch {version} {book} {chapter}: {e}")
    print("-" * 40)

