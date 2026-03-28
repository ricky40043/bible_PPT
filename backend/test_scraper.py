import requests
from bs4 import BeautifulSoup
import json

urls = [
    "https://www.bible.com/bible/46/GEN.1.CUNP",
    "https://www.bible.com/bible/139/GEN.1.RCUV",
    "https://www.bible.com/bible/36/GEN.1.CCB"
]
headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
}

for url in urls:
    print(f"Testing {url}")
    res = requests.get(url, headers=headers)
    print("Status:", res.status_code)
    if res.status_code != 200:
        continue
    
    soup = BeautifulSoup(res.text, "lxml")
    
    # Try finding __NEXT_DATA__
    next_data = soup.find("script", id="__NEXT_DATA__")
    if next_data:
        print("Found __NEXT_DATA__ script!")
        try:
            data = json.loads(next_data.string)
            print("Extracted some JSON data keys:", list(data.keys()))
            # the text might be in data['props']['pageProps']['chapter'] or similar
        except Exception as e:
            print("JSON parse error", e)
    
    # Also try to find elements with class starting with 'verse' or 'ChapterContent_verse'
    divs = soup.find_all("div", class_=lambda x: x and "verse" in x.lower())
    spans = soup.find_all("span", class_=lambda x: x and "verse" in x.lower())
    print(f"Found {len(divs)} divs and {len(spans)} spans with 'verse' in class")
    
    for v in (divs + spans)[:2]:
        print("element text:", v.text.strip()[:100])
    print("-" * 40)
