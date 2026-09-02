# BIBLE_BOOKS maps the USFM abbreviation to the Chinese book name
BIBLE_BOOKS = [
    {"id": "GEN", "name": "創世記"}, {"id": "EXO", "name": "出埃及記"}, {"id": "LEV", "name": "利未記"},
    {"id": "NUM", "name": "民數記"}, {"id": "DEU", "name": "申命記"}, {"id": "JOS", "name": "約書亞記"},
    {"id": "JDG", "name": "士師記"}, {"id": "RUT", "name": "路得記"}, {"id": "1SA", "name": "撒母耳記上"},
    {"id": "2SA", "name": "撒母耳記下"}, {"id": "1KI", "name": "列王紀上"}, {"id": "2KI", "name": "列王紀下"},
    {"id": "1CH", "name": "歷代志上"}, {"id": "2CH", "name": "歷代志下"}, {"id": "EZR", "name": "以斯拉記"},
    {"id": "NEH", "name": "尼希米記"}, {"id": "EST", "name": "以斯帖記"}, {"id": "JOB", "name": "約伯記"},
    {"id": "PSA", "name": "詩篇"}, {"id": "PRO", "name": "箴言"}, {"id": "ECC", "name": "傳道書"},
    {"id": "SNG", "name": "雅歌"}, {"id": "ISA", "name": "以賽亞書"}, {"id": "JER", "name": "耶利米書"},
    {"id": "LAM", "name": "耶利米哀歌"}, {"id": "EZK", "name": "以西結書"}, {"id": "DAN", "name": "但以理書"},
    {"id": "HOS", "name": "何西阿書"}, {"id": "JOL", "name": "約珥書"}, {"id": "AMO", "name": "阿摩司書"},
    {"id": "OBA", "name": "俄巴底亞書"}, {"id": "JON", "name": "約拿書"}, {"id": "MIC", "name": "彌迦書"},
    {"id": "NAM", "name": "那鴻書"}, {"id": "HAB", "name": "哈巴谷書"}, {"id": "ZEP", "name": "西番雅書"},
    {"id": "HAG", "name": "哈該書"}, {"id": "ZEC", "name": "撒迦利亞書"}, {"id": "MAL", "name": "瑪拉基書"},
    {"id": "MAT", "name": "馬太福音"}, {"id": "MRK", "name": "馬可福音"}, {"id": "LUK", "name": "路加福音"},
    {"id": "JHN", "name": "約翰福音"}, {"id": "ACT", "name": "使徒行傳"}, {"id": "ROM", "name": "羅馬書"},
    {"id": "1CO", "name": "哥林多前書"}, {"id": "2CO", "name": "哥林多後書"}, {"id": "GAL", "name": "加拉太書"},
    {"id": "EPH", "name": "以弗所書"}, {"id": "PHP", "name": "腓立比書"}, {"id": "COL", "name": "歌羅西書"},
    {"id": "1TH", "name": "帖撒羅尼迦前書"}, {"id": "2TH", "name": "帖撒羅尼迦後書"}, {"id": "1TI", "name": "提摩太前書"},
    {"id": "2TI", "name": "提摩太後書"}, {"id": "TIT", "name": "提多書"}, {"id": "PHM", "name": "腓利門書"},
    {"id": "HEB", "name": "希伯來書"}, {"id": "JAS", "name": "雅各書"}, {"id": "1PE", "name": "彼得前書"},
    {"id": "2PE", "name": "彼得後書"}, {"id": "1JN", "name": "約翰一書"}, {"id": "2JN", "name": "約翰二書"},
    {"id": "3JN", "name": "約翰三書"}, {"id": "JUD", "name": "猶大書"}, {"id": "REV", "name": "啟示錄"}
]

VERSIONS = [
    {"id": "CUNP", "name": "新標點和合本"},
    {"id": "RCUV", "name": "和合本修訂版"},
    {"id": "CCB", "name": "當代譯本"}
]

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
