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
import copy
import io
import os

_HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_PATH = os.path.join(_HERE, "..", "經文範本.pptx")

_SHAPE_TAGS = {qn("p:sp"), qn("p:pic"), qn("p:graphicFrame"), qn("p:grpSp"), qn("p:contentPart")}


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


def _clone_shapes(ref_sp_tree, dst_sp_tree):
    """Remove shape elements from dst and copy them from ref."""
    for elem in list(dst_sp_tree):
        if elem.tag in _SHAPE_TAGS:
            dst_sp_tree.remove(elem)
    for elem in ref_sp_tree:
        if elem.tag in _SHAPE_TAGS:
            dst_sp_tree.append(copy.deepcopy(elem))


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

    # Remove all extra template slides beyond the first
    xml_slides = prs.slides._sldIdLst
    for sldId in list(xml_slides)[1:]:
        xml_slides.remove(sldId)

    # Add slides for verses beyond the first (avoids duplicate slide1.xml warning)
    blank_layout = prs.slide_layouts[0]
    for _ in valid_verses[1:]:
        slide = prs.slides.add_slide(blank_layout)
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

    ppt_stream = io.BytesIO()
    prs.save(ppt_stream)
    ppt_stream.seek(0)
    return ppt_stream
