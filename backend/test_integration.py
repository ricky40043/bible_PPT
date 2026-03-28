import traceback
from scraper import get_bible_chapter
from ppt_generator import generate_bible_ppt

try:
    print("Testing scraper for CUNP Genesis 1")
    verses = get_bible_chapter("CUNP", "GEN", 1)
    print("Scraped verses count:", len(verses))
    if verses:
        print("First verse:", verses[0])
    
    print("Testing PPT generator...")
    ppt_stream = generate_bible_ppt("CUNP", "創世記", 1, verses)
    with open("test_gen_1.pptx", "wb") as f:
        f.write(ppt_stream.read())
    print("Successfully wrote PPTX, size:", len(ppt_stream.getvalue()), "bytes")
except Exception as e:
    print("Error during integration test:")
    traceback.print_exc()
