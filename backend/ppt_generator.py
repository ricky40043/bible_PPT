"""
ppt_generator.py
直接複製 經文範本.pptx 第一頁的 shape 結構並更新文字，
保留所有原始字型大小、顏色設定（從 Slide Master 繼承）。
  Shape 0: 節號 (verse_num)
  Shape 1: 標題 (title)
  Shape 2: 經文 (body)
  Shape 3: 版本 (version)
"""

from pptx import Presentation
from pptx.oxml.ns import qn
from pptx.dml.color import RGBColor
from pptx.util import Pt
from pathlib import Path
import copy
import io
import os

_HERE = Path(__file__).resolve().parent
_TEMPLATE_NAME = "經文範本.pptx"


def _resolve_template_path() -> str:
    env_path = os.environ.get("BIBLE_PPT_TEMPLATE")
    candidates = [
        Path(env_path) if env_path else None,
        _HERE / _TEMPLATE_NAME,
        _HERE.parent / _TEMPLATE_NAME,
        Path.cwd() / _TEMPLATE_NAME,
    ]

    for candidate in candidates:
        if candidate and candidate.exists():
            return str(candidate)

    checked = ", ".join(str(c) for c in candidates if c)
    raise FileNotFoundError(f"找不到 PPT 範本 {_TEMPLATE_NAME}; checked: {checked}")


TEMPLATE_PATH = _resolve_template_path()

_SHAPE_TAGS = {qn("p:sp"), qn("p:pic"), qn("p:graphicFrame"), qn("p:grpSp"), qn("p:contentPart")}
_CSLD_TAG = qn("p:cSld")
_BG_TAG = qn("p:bg")
_SPTREE_TAG = qn("p:spTree")

_TEXT_STYLES = (
    {"size": 36, "color": RGBColor(0xFF, 0xFF, 0x00), "bold": True},
    {"size": 54, "color": RGBColor(0xFF, 0xFF, 0x00), "bold": True},
    {"size": 54, "color": RGBColor(0xFF, 0xFF, 0xFF), "bold": True},
    {"size": 40, "color": RGBColor(0xFF, 0xFF, 0xFF), "bold": True},
)


def _update_shape_text(shape, text):
    """Update first run text in first paragraph, preserving all other formatting."""
    if not shape.has_text_frame:
        return
    tf = shape.text_frame
    for para in tf.paragraphs:
        runs = para.runs
        if runs:
            runs[0].text = text
            for run in runs[1:]:
                run.text = ""
        break


def _apply_shape_text_style(shape, style):
    """Write direct run styling so cloned placeholders render consistently."""
    if not shape.has_text_frame:
        return

    for para in shape.text_frame.paragraphs:
        for run in para.runs:
            font = run.font
            font.size = Pt(style["size"])
            font.color.rgb = style["color"]
            font.bold = style["bold"]


def _clone_shapes(ref_sp_tree, dst_sp_tree):
    """Remove shape elements from dst and copy them from ref."""
    for elem in list(dst_sp_tree):
        if elem.tag in _SHAPE_TAGS:
            dst_sp_tree.remove(elem)
    for elem in ref_sp_tree:
        if elem.tag in _SHAPE_TAGS:
            dst_sp_tree.append(copy.deepcopy(elem))


def _clone_background(ref_slide_element, dst_slide_element):
    """Copy the reference slide background so new slides don't inherit master green."""
    ref_c_sld = ref_slide_element.find(_CSLD_TAG)
    dst_c_sld = dst_slide_element.find(_CSLD_TAG)
    if ref_c_sld is None or dst_c_sld is None:
        return

    ref_bg = ref_c_sld.find(_BG_TAG)
    if ref_bg is None:
        return

    for elem in list(dst_c_sld):
        if elem.tag == _BG_TAG:
            dst_c_sld.remove(elem)

    sp_tree = dst_c_sld.find(_SPTREE_TAG)
    bg_copy = copy.deepcopy(ref_bg)
    if sp_tree is None:
        dst_c_sld.insert(0, bg_copy)
    else:
        dst_c_sld.insert(dst_c_sld.index(sp_tree), bg_copy)


def generate_bible_ppt(version: str, book_zh: str, chapter: int, verses: list,
                        verse_start: int = None, verse_end: int = None,
                        include_version: bool = True) -> io.BytesIO:
    # Filter verses
    if verse_start is not None and verse_end is not None:
        filtered = [v for v in verses if verse_start <= int(v['num']) <= verse_end]
    elif verse_start is not None:
        filtered = [v for v in verses if int(v['num']) >= verse_start]
    else:
        filtered = verses

    if not filtered:
        filtered = verses

    valid_verses = [v for v in filtered if v['text'].strip()]

    # Build title label
    if verse_start is not None and verse_end is not None:
        range_label = f"{chapter}:{verse_start}-{verse_end}"
    elif verse_start is not None:
        range_label = f"{chapter}:{verse_start}"
    else:
        range_label = f"{chapter}"

    title_text = f"{book_zh} {range_label}"

    prs = Presentation(TEMPLATE_PATH)

    # Deep-copy the reference spTree before any modifications
    ref_sp_tree = copy.deepcopy(prs.slides[0].shapes._spTree)
    ref_slide_element = copy.deepcopy(prs.slides[0]._element)

    # Remove all extra template slides beyond the first
    xml_slides = prs.slides._sldIdLst
    for sldId in list(xml_slides)[1:]:
        xml_slides.remove(sldId)

    # Add slides for verses beyond the first (avoids duplicate slide1.xml warning)
    blank_layout = prs.slide_layouts[0]
    for _ in valid_verses[1:]:
        slide = prs.slides.add_slide(blank_layout)
        _clone_background(ref_slide_element, slide._element)
        _clone_shapes(ref_sp_tree, slide.shapes._spTree)

    # Update all slides with verse content
    for i, verse in enumerate(valid_verses):
        slide = prs.slides[i]
        tf_shapes = [s for s in slide.shapes if s.has_text_frame]

        if len(tf_shapes) >= 1:
            _update_shape_text(tf_shapes[0], str(verse['num']))
        if len(tf_shapes) >= 2:
            _update_shape_text(tf_shapes[1], title_text)
        if len(tf_shapes) >= 3:
            _update_shape_text(tf_shapes[2], verse['text'])
        if len(tf_shapes) >= 4:
            _update_shape_text(tf_shapes[3], f"({version})" if include_version else "")

        if i > 0:
            for shape, style in zip(tf_shapes, _TEXT_STYLES):
                _apply_shape_text_style(shape, style)

    ppt_stream = io.BytesIO()
    prs.save(ppt_stream)
    ppt_stream.seek(0)
    return ppt_stream
