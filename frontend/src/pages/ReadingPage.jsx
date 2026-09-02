import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BookOpen, Copy, Highlighter, ArrowRight } from 'lucide-react'
import { useAuth, API_BASE } from '../context/AuthContext'
import HighlightToolbar from '../components/HighlightToolbar'
import Toast from '../components/Toast'
import './ReadingPage.css'

export const BIBLE_BOOKS = [
  { id: "GEN", name: "創世記", chapters: 50 }, { id: "EXO", name: "出埃及記", chapters: 40 },
  { id: "LEV", name: "利未記", chapters: 27 }, { id: "NUM", name: "民數記", chapters: 36 },
  { id: "DEU", name: "申命記", chapters: 34 }, { id: "JOS", name: "約書亞記", chapters: 24 },
  { id: "JDG", name: "士師記", chapters: 21 }, { id: "RUT", name: "路得記", chapters: 4 },
  { id: "1SA", name: "撒母耳記上", chapters: 31 }, { id: "2SA", name: "撒母耳記下", chapters: 24 },
  { id: "1KI", name: "列王紀上", chapters: 22 }, { id: "2KI", name: "列王紀下", chapters: 25 },
  { id: "1CH", name: "歷代志上", chapters: 29 }, { id: "2CH", name: "歷代志下", chapters: 36 },
  { id: "EZR", name: "以斯拉記", chapters: 10 }, { id: "NEH", name: "尼希米記", chapters: 13 },
  { id: "EST", name: "以斯帖記", chapters: 10 }, { id: "JOB", name: "約伯記", chapters: 42 },
  { id: "PSA", name: "詩篇", chapters: 150 }, { id: "PRO", name: "箴言", chapters: 31 },
  { id: "ECC", name: "傳道書", chapters: 12 }, { id: "SNG", name: "雅歌", chapters: 8 },
  { id: "ISA", name: "以賽亞書", chapters: 66 }, { id: "JER", name: "耶利米書", chapters: 52 },
  { id: "LAM", name: "耶利米哀歌", chapters: 5 }, { id: "EZK", name: "以西結書", chapters: 48 },
  { id: "DAN", name: "但以理書", chapters: 12 }, { id: "HOS", name: "何西阿書", chapters: 14 },
  { id: "JOL", name: "約珥書", chapters: 3 }, { id: "AMO", name: "阿摩司書", chapters: 9 },
  { id: "OBA", name: "俄巴底亞書", chapters: 1 }, { id: "JON", name: "約拿書", chapters: 4 },
  { id: "MIC", name: "彌迦書", chapters: 7 }, { id: "NAM", name: "那鴻書", chapters: 3 },
  { id: "HAB", name: "哈巴谷書", chapters: 3 }, { id: "ZEP", name: "西番雅書", chapters: 3 },
  { id: "HAG", name: "哈該書", chapters: 2 }, { id: "ZEC", name: "撒迦利亞書", chapters: 14 },
  { id: "MAL", name: "瑪拉基書", chapters: 4 }, { id: "MAT", name: "馬太福音", chapters: 28 },
  { id: "MRK", name: "馬可福音", chapters: 16 }, { id: "LUK", name: "路加福音", chapters: 24 },
  { id: "JHN", name: "約翰福音", chapters: 21 }, { id: "ACT", name: "使徒行傳", chapters: 28 },
  { id: "ROM", name: "羅馬書", chapters: 16 }, { id: "1CO", name: "哥林多前書", chapters: 16 },
  { id: "2CO", name: "哥林多後書", chapters: 13 }, { id: "GAL", name: "加拉太書", chapters: 6 },
  { id: "EPH", name: "以弗所書", chapters: 6 }, { id: "PHP", name: "腓立比書", chapters: 4 },
  { id: "COL", name: "歌羅西書", chapters: 4 }, { id: "1TH", name: "帖撒羅尼迦前書", chapters: 5 },
  { id: "2TH", name: "帖撒羅尼迦後書", chapters: 3 }, { id: "1TI", name: "提摩太前書", chapters: 6 },
  { id: "2TI", name: "提摩太後書", chapters: 4 }, { id: "TIT", name: "提多書", chapters: 3 },
  { id: "PHM", name: "腓利門書", chapters: 1 }, { id: "HEB", name: "希伯來書", chapters: 13 },
  { id: "JAS", name: "雅各書", chapters: 5 }, { id: "1PE", name: "彼得前書", chapters: 5 },
  { id: "2PE", name: "彼得後書", chapters: 3 }, { id: "1JN", name: "約翰一書", chapters: 5 },
  { id: "2JN", name: "約翰二書", chapters: 1 }, { id: "3JN", name: "約翰三書", chapters: 1 },
  { id: "JUD", name: "猶大書", chapters: 1 }, { id: "REV", name: "啟示錄", chapters: 22 }
]

export const BIBLE_VERSIONS = [
  { id: "CUNP", name: "新標點和合本" },
  { id: "RCUV", name: "和合本修訂版" },
  { id: "CCB", name: "當代譯本" }
]

const memoryVerseCache = new Map()

export default function ReadingPage() {
  const [searchParams] = useSearchParams()
  const { user, token, progress, saveProgress } = useAuth()

  const [versions] = useState(BIBLE_VERSIONS)
  const [books] = useState(BIBLE_BOOKS)
  
  const getInitialTarget = () => {
    const urlV = searchParams.get('version')
    const urlB = searchParams.get('book')
    const urlC = searchParams.get('chapter')
    const urlVerse = searchParams.get('verse')
    if (urlB) {
      return { version: urlV || 'CUNP', book: urlB, chapter: urlC || '1', verse: urlVerse || '1' }
    }
    if (progress && progress.book) {
      return { version: progress.version || 'CUNP', book: progress.book, chapter: String(progress.chapter || '1'), verse: String(progress.verse_num || '1') }
    }
    const local = localStorage.getItem('bible_local_progress')
    if (local) {
      try {
        const p = JSON.parse(local)
        return { version: p.version || 'CUNP', book: p.book || 'GEN', chapter: String(p.chapter || '1'), verse: String(p.verse_num || '1') }
      } catch (e) {}
    }
    return { version: 'CUNP', book: 'GEN', chapter: '1', verse: '1' }
  }

  // 1. selection: 頂部正在選取的版本、書卷、章、節
  const [selection, setSelection] = useState(getInitialTarget)
  // 2. activeTarget: 目前已確認跳轉並正在展示的章節
  const [activeTarget, setActiveTarget] = useState(getInitialTarget)

  const [chapterContent, setChapterContent] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  // 經文標註與操作狀態
  const [highlights, setHighlights] = useState({})
  const [activeVerseNum, setActiveVerseNum] = useState(null)
  const [toastMsg, setToastMsg] = useState(null)
  const [toastType, setToastType] = useState('success')

  const bookSelectRef = useRef(null)
  const chapterSelectRef = useRef(null)
  const verseSelectRef = useRef(null)

  const contentRef = useRef(null)
  const touchStartX = useRef(null)
  const touchStartY = useRef(null)
  const isInitialProgressLoaded = useRef(false)

  // 計算選中書卷的總章數
  const selectedBookInfo = books.find(b => b.id === selection.book)
  const totalChapters = selectedBookInfo?.chapters || 50

  const showToast = (msg, type = 'success') => {
    setToastMsg(msg)
    setToastType(type)
    setTimeout(() => {
      setToastMsg(prev => prev === msg ? null : prev)
    }, 2800)
  }

  // 同步雲端進度（初次）
  useEffect(() => {
    if (progress && !isInitialProgressLoaded.current && !searchParams.get('book')) {
      isInitialProgressLoaded.current = true
      const loaded = {
        version: progress.version || 'CUNP',
        book: progress.book,
        chapter: String(progress.chapter || '1'),
        verse: String(progress.verse_num || '1')
      }
      setSelection(loaded)
      setActiveTarget(loaded)
    }
  }, [progress, searchParams])

  // 讀取高亮標註
  const fetchHighlights = useCallback(async (version, book, chapter) => {
    const localKey = `hl_${version}_${book}_${chapter}`
    let localMap = {}
    try {
      const stored = localStorage.getItem(localKey)
      if (stored) localMap = JSON.parse(stored)
    } catch (e) {}

    if (token) {
      try {
        const res = await fetch(`${API_BASE}/api/highlights?version=${version}&book=${book}&chapter=${chapter}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          const hlMap = {}
          data.highlights.forEach(h => {
            hlMap[h.verse_num] = h.color
          })
          setHighlights({ ...localMap, ...hlMap })
          return
        }
      } catch (err) {
        console.error('獲取標註失敗:', err)
      }
    }
    setHighlights(localMap)
  }, [token])

  // 讀取 activeTarget 經文內容（章節選完確定跳轉時才載入）
  useEffect(() => {
    if (!activeTarget.book || !activeTarget.chapter || !activeTarget.version) return

    const cacheKey = `${activeTarget.version}_${activeTarget.book}_${activeTarget.chapter}`
    const cachedData = memoryVerseCache.get(cacheKey)

    if (cachedData) {
      setChapterContent(cachedData)
      setLoading(false)
      setError(null)
      fetchHighlights(activeTarget.version, activeTarget.book, activeTarget.chapter)
      saveProgress(activeTarget.version, activeTarget.book, parseInt(activeTarget.chapter), parseInt(activeTarget.verse || 1))
      return
    }

    const abortCtrl = new AbortController()
    setLoading(true)
    setError(null)
    setActiveVerseNum(null)

    const fetchChapter = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/verses_list/${activeTarget.version}/${activeTarget.book}/${activeTarget.chapter}`,
          { signal: abortCtrl.signal }
        )
        if (!res.ok) {
          throw new Error(`載入失敗 (${res.status})`)
        }
        const data = await res.json()
        memoryVerseCache.set(cacheKey, data)
        setChapterContent(data)
        fetchHighlights(activeTarget.version, activeTarget.book, activeTarget.chapter)
        saveProgress(activeTarget.version, activeTarget.book, parseInt(activeTarget.chapter), parseInt(activeTarget.verse || 1))
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error(err)
          setError('載入經文失敗')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchChapter()

    return () => {
      abortCtrl.abort()
    }
  }, [activeTarget, fetchHighlights])

  // ─────────────────────────── 手機/桌面 連鎖選經流程 ───────────────────────────

  // 1. 選擇版本 -> 自動跳往下一個「書卷」選單（不滾動頁面、不發動跳轉）
  const handleVersionChange = (e) => {
    const val = e.target.value
    setSelection(prev => ({ ...prev, version: val }))
    setTimeout(() => {
      bookSelectRef.current?.focus()
    }, 50)
  }

  // 2. 選擇書卷 -> 自動跳往下一個「章」選單（不滾動頁面、不發動跳轉）
  const handleBookChange = (e) => {
    const val = e.target.value
    setSelection(prev => ({ ...prev, book: val, chapter: '1', verse: '1' }))
    setTimeout(() => {
      chapterSelectRef.current?.focus()
    }, 50)
  }

  // 3. 選擇章 -> 自動跳往下一個「節」選單（不滾動頁面、不發動跳轉）
  const handleChapterChange = (e) => {
    const val = e.target.value
    setSelection(prev => ({ ...prev, chapter: val, verse: '1' }))
    setTimeout(() => {
      verseSelectRef.current?.focus()
    }, 50)
  }

  // 4. 選擇節 -> 選完節（或點擊前往）後，正式跳轉並載入經文！
  const handleVerseChange = (e) => {
    const val = e.target.value
    setSelection(prev => ({ ...prev, verse: val }))
    // 選好節了，立即發動跳轉
    triggerJump({ ...selection, verse: val })
  }

  // 執行跳轉（版本、書卷、章、節全部確認）
  const triggerJump = (targetObj = selection) => {
    setActiveTarget({ ...targetObj })
    saveProgress(targetObj.version, targetObj.book, parseInt(targetObj.chapter), parseInt(targetObj.verse || 1))
    
    // 如果有指定節，輕微定位該節
    if (targetObj.verse && targetObj.verse !== '1') {
      setTimeout(() => {
        const el = document.getElementById(`verse-${targetObj.verse}`)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 150)
    }
  }

  // 上一章 / 下一章切換
  const handlePrevChapter = () => {
    const prevChap = (parseInt(activeTarget.chapter) - 1).toString()
    if (parseInt(prevChap) >= 1) {
      const nextTarget = { ...activeTarget, chapter: prevChap, verse: '1' }
      setSelection(nextTarget)
      setActiveTarget(nextTarget)
    }
  }

  const handleNextChapter = () => {
    const activeBookTotal = books.find(b => b.id === activeTarget.book)?.chapters || 50
    const nextChap = (parseInt(activeTarget.chapter) + 1).toString()
    if (parseInt(nextChap) <= activeBookTotal) {
      const nextTarget = { ...activeTarget, chapter: nextChap, verse: '1' }
      setSelection(nextTarget)
      setActiveTarget(nextTarget)
    }
  }

  // 標註與複製
  const handleSelectHighlightColor = async (verseNum, color) => {
    const num = parseInt(verseNum)
    setHighlights(prev => ({ ...prev, [num]: color }))
    setActiveVerseNum(null)

    const localKey = `hl_${activeTarget.version}_${activeTarget.book}_${activeTarget.chapter}`
    try {
      const updated = { ...highlights, [num]: color }
      localStorage.setItem(localKey, JSON.stringify(updated))
    } catch (e) {}

    if (token) {
      try {
        await fetch(`${API_BASE}/api/highlights`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            version: activeTarget.version,
            book: activeTarget.book,
            chapter: parseInt(activeTarget.chapter),
            verse_num: num,
            color: color,
          }),
        })
        showToast(`已標註第 ${num} 節經文`)
      } catch (err) {
        showToast('標註儲存失敗', 'error')
      }
    } else {
      showToast(`已標註第 ${num} 節（登入可跨裝置同步）`, 'info')
    }
  }

  const handleRemoveHighlight = async (verseNum) => {
    const num = parseInt(verseNum)
    setHighlights(prev => {
      const copy = { ...prev }
      delete copy[num]
      return copy
    })
    setActiveVerseNum(null)

    const localKey = `hl_${activeTarget.version}_${activeTarget.book}_${activeTarget.chapter}`
    try {
      const updated = { ...highlights }
      delete updated[num]
      localStorage.setItem(localKey, JSON.stringify(updated))
    } catch (e) {}

    if (token) {
      try {
        await fetch(`${API_BASE}/api/highlights?version=${activeTarget.version}&book=${activeTarget.book}&chapter=${activeTarget.chapter}&verse_num=${num}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
        showToast(`已清除第 ${num} 節標註`)
      } catch (err) {}
    } else {
      showToast(`已清除第 ${num} 節標註`)
    }
  }

  const handleCopyVerse = (verse) => {
    const bookName = books.find(b => b.id === activeTarget.book)?.name || activeTarget.book
    const versionName = versions.find(v => v.id === activeTarget.version)?.name || activeTarget.version
    const formatted = `【${bookName} ${activeTarget.chapter}:${verse.num} ${activeTarget.version}】${verse.text}`
    navigator.clipboard.writeText(formatted)
    showToast(`已複製經文：${bookName} ${activeTarget.chapter}:${verse.num}`)
    setActiveVerseNum(null)
  }

  const handleCopyEntireChapter = () => {
    if (!chapterContent.length) return
    const bookName = books.find(b => b.id === activeTarget.book)?.name || activeTarget.book
    const versionName = versions.find(v => v.id === activeTarget.version)?.name || activeTarget.version
    const textLines = chapterContent.map(v => `${v.num}. ${v.text}`).join('\n')
    const fullText = `【${bookName} 第 ${activeTarget.chapter} 章 (${versionName})】\n${textLines}`
    navigator.clipboard.writeText(fullText)
    showToast(`已複製 ${bookName} 第 ${activeTarget.chapter} 章全部經文！`)
  }

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    touchStartX.current = null
    touchStartY.current = null
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return
    if (dx < 0) {
      handleNextChapter()
    } else if (dx > 0) {
      handlePrevChapter()
    }
  }

  const currentActiveBookName = books.find(b => b.id === activeTarget.book)?.name || activeTarget.book
  const currentActiveVersionName = versions.find(v => v.id === activeTarget.version)?.name || activeTarget.version

  // 判斷當前 selection 是否與 activeTarget 不同（有未跳轉的選擇）
  const isSelectionChanged = selection.version !== activeTarget.version || selection.book !== activeTarget.book || selection.chapter !== activeTarget.chapter || selection.verse !== activeTarget.verse

  return (
    <div className="reading-page-wrapper" onClick={() => setActiveVerseNum(null)}>
      <Toast message={toastMsg} type={toastType} onClose={() => setToastMsg(null)} />

      <div className="app-container">
        <div className="header">
          <div className="header-title-row">
            <h1><BookOpen size={26} />線上閱讀</h1>
            {chapterContent.length > 0 && (
              <button className="copy-all-btn" onClick={handleCopyEntireChapter} title="複製整章經文">
                <Copy size={15} /> 複製本章
              </button>
            )}
          </div>
          <p>依序選好版本、書卷、章、節後直接跳轉；點擊經文可<b>畫線</b>或<b>複製</b></p>
        </div>

        {error && <div className="error-msg">{error}</div>}

        {/* 選擇器列（版本 -> 書卷 -> 章 -> 節 全部選完才跳轉） */}
        <div className="reading-selector-card">
          <div className="reading-selector-bar">
            <div className="reading-select-group">
              <label>1. 版本</label>
              <select
                className="form-control"
                value={selection.version}
                onChange={handleVersionChange}
              >
                {versions.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>

            <div className="reading-select-group">
              <label>2. 書卷</label>
              <select
                ref={bookSelectRef}
                className="form-control"
                value={selection.book}
                onChange={handleBookChange}
              >
                {books.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            <div className="reading-select-group reading-select-small">
              <label>3. 章</label>
              <select
                ref={chapterSelectRef}
                className="form-control"
                value={selection.chapter}
                onChange={handleChapterChange}
              >
                {Array.from({ length: totalChapters }, (_, i) => i + 1).map(num => (
                  <option key={num} value={num}>{num}</option>
                ))}
              </select>
            </div>

            <div className="reading-select-group reading-select-small">
              <label>4. 節 (選完跳轉)</label>
              <select
                ref={verseSelectRef}
                className="form-control"
                value={selection.verse}
                onChange={handleVerseChange}
              >
                {Array.from({ length: 60 }, (_, i) => i + 1).map(num => (
                  <option key={num} value={num}>{num}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 前往跳轉按鈕 (選定後也可手動一鍵跳轉) */}
          {isSelectionChanged && (
            <button className="jump-now-btn" onClick={() => triggerJump(selection)}>
              <span>跳轉至 {books.find(b => b.id === selection.book)?.name} {selection.chapter} 章</span>
              <ArrowRight size={16} />
            </button>
          )}
        </div>

        {/* 章節導航 */}
        <div className="reading-chapter-nav">
          <button
            className="reading-nav-btn"
            disabled={parseInt(activeTarget.chapter) <= 1}
            onClick={handlePrevChapter}
          >
            ← 上一章
          </button>
          <span className="reading-chapter-title">
            {currentActiveBookName} 第 {activeTarget.chapter} 章
          </span>
          <button
            className="reading-nav-btn"
            disabled={parseInt(activeTarget.chapter) >= (books.find(b => b.id === activeTarget.book)?.chapters || 50)}
            onClick={handleNextChapter}
          >
            下一章 →
          </button>
        </div>

        {/* 經文內容區 */}
        <div
          className="reading-content"
          ref={contentRef}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {loading ? (
            <div className="reading-loading">
              <span className="loader" />
              <span>載入經文中...</span>
            </div>
          ) : chapterContent.length > 0 ? (
            <>
              <div className="reading-header-bar">
                <div className="reading-title-wrap">
                  <span className="reading-book-title">{currentActiveBookName} 第 {activeTarget.chapter} 章</span>
                  <span className="reading-version-tag">{currentActiveVersionName}</span>
                </div>
                <div className="reading-tips">
                  <Highlighter size={14} /> 點擊經文進行畫線標註
                </div>
              </div>

              <div className="reading-verses">
                {chapterContent.map((verse) => {
                  const verseNumInt = parseInt(verse.num)
                  const hlColor = highlights[verseNumInt]
                  const isActive = activeVerseNum === verseNumInt

                  return (
                    <div
                      key={verse.num}
                      id={`verse-${verse.num}`}
                      className={`verse-item ${hlColor ? 'highlighted' : ''} ${isActive ? 'active-toolbar-verse' : ''}`}
                      style={hlColor ? { '--hl-bg': hlColor } : {}}
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveVerseNum(prev => prev === verseNumInt ? null : verseNumInt)
                      }}
                    >
                      <span className="verse-num">{verse.num}</span>
                      <span className="verse-text">{verse.text}</span>

                      {/* 懸浮/點擊色票工具列 */}
                      {isActive && (
                        <HighlightToolbar
                          verseNum={verse.num}
                          currentColor={hlColor}
                          onSelectColor={(color) => handleSelectHighlightColor(verse.num, color)}
                          onRemoveColor={() => handleRemoveHighlight(verse.num)}
                          onCopyVerse={() => handleCopyVerse(verse)}
                          onClose={() => setActiveVerseNum(null)}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="reading-empty">請選擇書卷與章節開始閱讀</div>
          )}
        </div>

        {/* 底部導航 */}
        <div className="reading-chapter-nav reading-chapter-nav-bottom">
          <button
            className="reading-nav-btn"
            disabled={parseInt(activeTarget.chapter) <= 1}
            onClick={handlePrevChapter}
          >
            ← 上一章
          </button>
          <span className="reading-chapter-title">
            {currentActiveBookName} 第 {activeTarget.chapter} 章
          </span>
          <button
            className="reading-nav-btn"
            disabled={parseInt(activeTarget.chapter) >= (books.find(b => b.id === activeTarget.book)?.chapters || 50)}
            onClick={handleNextChapter}
          >
            下一章 →
          </button>
        </div>
      </div>
    </div>
  )
}
