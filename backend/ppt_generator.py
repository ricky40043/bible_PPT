"""
ppt_generator.py
使用 20260322.pptx 作為版面模板，精確重現格式：
  - 框0 (subTitle): 節號，54pt，FFFF00，置中，x=0.209" y=1.230" w=1.194" h=2.090"
  - 框1 (ctrTitle): 標題，54pt，FFFF00，左對齊，anchor=bottom，x=0.209" y=-0.002" w=12.679" h=1.026"
  - 框2 (body/2):   經文，54pt，白色，左對齊，x=1.312" y=1.024" w=11.576" h=6.470"
  - 框3 (body/3):   版本，40pt，dk1(白)，左對齊，x=1.076" y=6.649" w=8.111" h=0.802"
背景：Slide Master schemeClr dk1 = 黑色
"""

from pptx import Presentation
from pptx.util import Emu, Pt
from pptx.enum.text import PP_ALIGN
from pptx.dml.color import RGBColor
from pptx.oxml.ns import qn
from lxml import etree
import copy
import io
import os

# 模板路徑（與此檔案同層的上一層目錄）
_HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_PATH = os.path.join(_HERE, "..", "20260322.pptx")

# 顏色
COLOR_YELLOW = RGBColor(0xFF, 0xFF, 0x00)
COLOR_WHITE  = RGBColor(0xFF, 0xFF, 0xFF)
COLOR_GREY   = RGBColor(0xB0, 0xB0, 0xB0)

# 精確位置 (EMU)，來自原始 PPTX 量測
_BOX = {
    "verse_num": dict(x=191344,  y=1048544, cx=1091664,  cy=1910968),  # 框0
    "title":     dict(x=191344,  y=-1691,   cx=11593288, cy=937979),   # 框1
    "body":      dict(x=1199456, y=936288,  cx=10585176, cy=5916032),  # 框2
    "version":   dict(x=983432,  y=6079951, cx=7416824,  cy=733425),   # 框3
}

# 字型大小 (EMU hundredths of a point)
SZ_LARGE  = 5400   # 54pt — 標題、經文
SZ_VERSE  = 3600   # 36pt — 節號 (圖二需求)
SZ_MEDIUM = 4000   # 40pt — 版本


def _set_textbox(slide, box_key: str, text: str,
                 font_name: str, sz: int,
                 color: RGBColor, bold: bool,
                 align: PP_ALIGN, anchor: str = "t"):
    """在 slide 上加一個文字框，完全以精確 EMU 定位。"""
    b = _BOX[box_key]
    txBox = slide.shapes.add_textbox(
        Emu(b["x"]), Emu(b["y"]), Emu(b["cx"]), Emu(b["cy"])
    )
    tf = txBox.text_frame
    tf.word_wrap = True

    # bodyPr: 設定 anchor
    bodyPr = tf._txBody.find(qn("a:bodyPr"))
    if bodyPr is None:
        bodyPr = etree.SubElement(tf._txBody, qn("a:bodyPr"))
    bodyPr.set("anchor", anchor)
    bodyPr.set("anchorCtr", "0")
    bodyPr.set("wrap", "square")
    bodyPr.set("lIns",  "91425")   # 0.1" 左內距
    bodyPr.set("rIns",  "91425")
    bodyPr.set("tIns",  "45700")
    bodyPr.set("bIns",  "45700")
    bodyPr.set("spcFirstLastPara", "1")

    # noAutofit
    noAutofit = bodyPr.find(qn("a:noAutofit"))
    if noAutofit is None:
        etree.SubElement(bodyPr, qn("a:noAutofit"))

    para = tf.paragraphs[0]

    # pPr: alignment + line spacing
    pPr = para._p.find(qn("a:pPr"))
    if pPr is None:
        pPr = etree.SubElement(para._p, qn("a:pPr"))
        para._p.insert(0, pPr)

    pPr.set("algn", {
        PP_ALIGN.LEFT:   "l",
        PP_ALIGN.CENTER: "ctr",
        PP_ALIGN.RIGHT:  "r",
    }.get(align, "l"))
    pPr.set("indent", "0")
    pPr.set("marL", "0")
    pPr.set("rtl", "0")
    pPr.set("lvl", "0")

    # line spacing 100%
    lnSpc = pPr.find(qn("a:lnSpc"))
    if lnSpc is None:
        lnSpc = etree.SubElement(pPr, qn("a:lnSpc"))
    spcPct = lnSpc.find(qn("a:spcPct"))
    if spcPct is None:
        spcPct = etree.SubElement(lnSpc, qn("a:spcPct"))
    spcPct.set("val", "100000")

    spcBef = pPr.find(qn("a:spcBef"))
    if spcBef is None:
        spcBef = etree.SubElement(pPr, qn("a:spcBef"))
    spcBefPts = spcBef.find(qn("a:spcPts"))
    if spcBefPts is None:
        spcBefPts = etree.SubElement(spcBef, qn("a:spcPts"))
    spcBefPts.set("val", "0")

    spcAft = pPr.find(qn("a:spcAft"))
    if spcAft is None:
        spcAft = etree.SubElement(pPr, qn("a:spcAft"))
    spcAftPts = spcAft.find(qn("a:spcPts"))
    if spcAftPts is None:
        spcAftPts = etree.SubElement(spcAft, qn("a:spcPts"))
    spcAftPts.set("val", "0")

    # buNone
    buNone = pPr.find(qn("a:buNone"))
    if buNone is None:
        etree.SubElement(pPr, qn("a:buNone"))

    # run
    run = para.add_run()
    run.text = text
    f = run.font
    f.name = font_name
    f.size = Pt(sz / 100)
    f.bold = bold
    f.color.rgb = color

    # Also set lang on rPr
    rPr = run._r.find(qn("a:rPr"))
    if rPr is None:
        rPr = etree.SubElement(run._r, qn("a:rPr"))
    rPr.set("lang", "zh-TW")

    return txBox


def generate_bible_ppt(version: str, book_zh: str, chapter: int, verses: list,
                       verse_start: int = None, verse_end: int = None) -> io.BytesIO:
    """
    依照 20260322.pptx 格式產生聖經 PPT：
    - 黑底（Slide Master）
    - 標題：黃色 54pt，左對齊底部錨點
    - 節號：黃色 54pt，置中
    - 經文：白色 54pt，左對齊頂部錨點
    - 版本：灰色 40pt，左對齊
    每節一頁。
    """
    # Filter verses
    if verse_start is not None and verse_end is not None:
        filtered = [v for v in verses if verse_start <= int(v['num']) <= verse_end]
    elif verse_start is not None:
        filtered = [v for v in verses if int(v['num']) >= verse_start]
    else:
        filtered = verses

    if not filtered:
        filtered = verses

    # Build title label (固定顯示整個範圍)
    if verse_start is not None and verse_end is not None:
        range_label = f"{chapter}:{verse_start}-{verse_end}"
    elif verse_start is not None:
        range_label = f"{chapter}:{verse_start}"
    else:
        range_label = f"{chapter}"

    title_text = f"{book_zh} {range_label}"

    # 使用模板
    template_path = TEMPLATE_PATH
    if os.path.exists(template_path):
        prs = Presentation(template_path)
        # 移除模板中舊的投影片
        # 我們要利用它的 Slide Master，所以先清空所有 slide
        xml_slides = prs.slides._sldIdLst
        # Remove all existing slide references
        for sldId in list(xml_slides):
            xml_slides.remove(sldId)
    else:
        # Fallback: 從空白建立
        prs = Presentation()
        prs.slide_width = Emu(12192000)   # 13.333" = 16:9
        prs.slide_height = Emu(6858000)   # 7.5"

    # 使用模板中的第一個佈局
    blank_layout = prs.slide_layouts[0] if len(prs.slide_layouts) > 0 else prs.slide_layouts[0]

    for verse in filtered:
        if not verse['text'].strip():
            continue

        slide = prs.slides.add_slide(blank_layout)

        # ── 清除 Layout 預設的佔位符 (避免出現「按兩下來編輯」文字) ────
        for shape in list(slide.shapes):
            if shape.is_placeholder:
                sp = shape._element
                sp.getparent().remove(sp)

        # 黑色背景（明確設定，不依賴繼承）
        fill = slide.background.fill
        fill.solid()
        fill.fore_color.rgb = RGBColor(0, 0, 0)

        # 框1：標題（黃、54pt、左對齊、anchor=bottom）
        _set_textbox(
            slide, "title",
            text=title_text,
            font_name="Arial",
            sz=SZ_LARGE,
            color=COLOR_YELLOW,
            bold=False,
            align=PP_ALIGN.LEFT,
            anchor="b",
        )

        # 框0：節號（黃、36pt、靠右、anchor=top）
        _set_textbox(
            slide, "verse_num",
            text=str(verse['num']),
            font_name="Arial",
            sz=SZ_VERSE,
            color=COLOR_YELLOW,
            bold=True,
            align=PP_ALIGN.RIGHT,
            anchor="t",
        )

        # 框2：經文（白、54pt、左對齊、anchor=top）
        _set_textbox(
            slide, "body",
            text=verse['text'],
            font_name="Arial",
            sz=SZ_LARGE,
            color=COLOR_WHITE,
            bold=False,
            align=PP_ALIGN.LEFT,
            anchor="t",
        )

        # 框3：版本（黃、40pt、左對齊、anchor=top）
        _set_textbox(
            slide, "version",
            text=f"({version})",
            font_name="Arial",
            sz=SZ_MEDIUM,
            color=COLOR_YELLOW,
            bold=True,
            align=PP_ALIGN.LEFT,
            anchor="t",
        )

    ppt_stream = io.BytesIO()
    prs.save(ppt_stream)
    ppt_stream.seek(0)
    return ppt_stream
