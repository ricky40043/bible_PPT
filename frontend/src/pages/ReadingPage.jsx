import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BookOpen, Copy, Highlighter, Volume2, Search, MoreHorizontal, Play, Pause, ChevronLeft, ChevronRight, Settings, Plus, Cloud } from 'lucide-react'
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
  { id: "ECC", name: "傳道書", chapters: 12 }, { id: "SNG", "name": "雅歌", chapters: 8 },
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

function BookPickerItem({ book, selection, onChooseBook, onChooseChapter }) {
  const expanded = selection.book === book.id
  return (
    <div className={`book-picker-book-group ${expanded ? 'expanded' : ''}`}>
      <button type="button" className={`book-picker-item ${expanded ? 'selected' : ''}`} onClick={() => onChooseBook(book.id)}>
        {book.name}
      </button>
      {expanded && (
        <div className="chapter-picker-grid">
          {Array.from({ length: book.chapters }, (_, i) => i + 1).map(chapter => (
            <button key={chapter} type="button" className={String(selection.chapter) === String(chapter) ? 'selected' : ''} onClick={() => onChooseChapter(book.id, chapter)}>
              {chapter}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ReadingPage() {
  const [searchParams] = useSearchParams()
  const { user, token, progress, saveProgress, openAuthModal } = useAuth()

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
  const [bookPickerOpen, setBookPickerOpen] = useState(false)
  const [recentReads, setRecentReads] = useState([])
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [versionPickerOpen, setVersionPickerOpen] = useState(false)

  const bookSelectRef = useRef(null)
  const chapterSelectRef = useRef(null)

  const contentRef = useRef(null)
  const touchStartX = useRef(null)
  const touchStartY = useRef(null)
  const isInitialProgressLoaded = useRef(false)

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('bible_recent_reads') || '[]')
      setRecentReads(Array.isArray(saved) ? saved : [])
    } catch (e) {
      setRecentReads([])
    }
  }, [])

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

  // 從後端 SQLite 資料庫讀取使用者的畫線筆記
  const fetchHighlights = useCallback(async (version, book, chapter) => {
    if (!token) {
      setHighlights({})
      return
    }

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
        setHighlights(hlMap)
      }
    } catch (err) {
      console.error('獲取資料庫標註失敗:', err)
    }
  }, [token])

  // 讀取 activeTarget 經文內容
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
        rememberRecentRead(activeTarget)
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
        rememberRecentRead(activeTarget)
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

  const rememberRecentRead = (target) => {
    const item = { version: target.version, book: target.book, chapter: String(target.chapter) }
    setRecentReads(prev => {
      const next = [item, ...prev.filter(r => !(r.version === item.version && r.book === item.book && r.chapter === item.chapter))].slice(0, 6)
      localStorage.setItem('bible_recent_reads', JSON.stringify(next))
      return next
    })
  }

  // 每次切換書卷或章節，都從頁面最上方開始閱讀。
  // 在內容載入完成後再執行，避免瀏覽器在 React 重新渲染後恢復舊捲動位置。
  // 不把 verse 放進依賴，避免使用者跳到指定節時又被拉回頂端。
  useEffect(() => {
    if (loading) return

    const scrollToTop = () => {
      window.scrollTo(0, 0)
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    }

    scrollToTop()
    const frame = window.requestAnimationFrame(scrollToTop)
    const retry = window.setTimeout(scrollToTop, 80)

    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(retry)
    }
  }, [activeTarget.version, activeTarget.book, activeTarget.chapter, loading])

  // 書卷選單打開或切換書卷時，把展開中的書卷捲到最上方，直接看到章節格
  useEffect(() => {
    if (!bookPickerOpen) return
    const frame = window.requestAnimationFrame(() => {
      document.querySelector('.book-picker-book-group.expanded')?.scrollIntoView({ block: 'start' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [bookPickerOpen, selection.book])

  // ─────────────────────────── 手機/桌面 連鎖選經流程 ───────────────────────────

  // 1. 選擇版本 -> 自動跳往下一個「書卷」選單（不滾動頁面、不發動跳轉）
  const handleVersionChange = (e) => {
    const val = e.target.value
    setSelection(prev => ({ ...prev, version: val }))
    setTimeout(() => {
      bookSelectRef.current?.focus()
    }, 50)
  }

  // 2. 選擇書卷 -> 自動跳往「章」選單（選完章才開始載入）
  const handleBookChange = (e) => {
    const val = e.target.value
    setSelection(prev => ({ ...prev, book: val, chapter: '', verse: '1' }))
    setTimeout(() => {
      chapterSelectRef.current?.focus()
    }, 50)
  }

  const chooseBook = (bookId) => {
    setSelection(prev => ({ ...prev, book: bookId, chapter: prev.book === bookId ? prev.chapter : '1', verse: '1' }))
  }

  const choosePickerChapter = (bookId, chapter) => {
    const target = { version: selection.version, book: bookId, chapter: String(chapter), verse: '1' }
    setSelection(target)
    setActiveTarget(target)
    setBookPickerOpen(false)
  }

  const openRecentRead = (item) => {
    const target = { version: item.version, book: item.book, chapter: item.chapter, verse: '1' }
    setSelection(target)
    setActiveTarget(target)
    setBookPickerOpen(false)
  }

  const chooseVersion = (version) => {
    const target = { ...activeTarget, version: version.id }
    setSelection(target)
    setActiveTarget(target)
    setVersionPickerOpen(false)
  }

  // 3. 選擇章 -> 立即載入該章，不再要求選節
  const handleChapterChange = (e) => {
    const val = e.target.value
    setSelection(prev => ({ ...prev, chapter: val, verse: '1' }))
    triggerJump({ ...selection, chapter: val, verse: '1' })
  }

  // 執行跳轉（版本、書卷、章確認後載入整章）
  const triggerJump = (targetObj = selection) => {
    setActiveTarget({ ...targetObj })
    saveProgress(targetObj.version, targetObj.book, parseInt(targetObj.chapter), parseInt(targetObj.verse || 1))
    
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

  // ─────────────────────────── 畫線標註（存入 SQLite 資料庫，未登入禁止） ───────────────────────────
  const handleSelectHighlightColor = async (verseNum, color) => {
    // 檢查登入狀態：未登入禁止做筆記
    if (!user || !token) {
      showToast('請先登入帳號，才能做筆記與畫線標註（存入資料庫）', 'info')
      openAuthModal('login')
      return
    }

    const num = parseInt(verseNum)
    setHighlights(prev => ({ ...prev, [num]: color }))
    setActiveVerseNum(null)

    try {
      const res = await fetch(`${API_BASE}/api/highlights`, {
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
      if (res.ok) {
        showToast(`已標註第 ${num} 節（已存入資料庫）`)
      } else {
        throw new Error('儲存失敗')
      }
    } catch (err) {
      showToast('標註儲存失敗', 'error')
    }
  }

  const handleRemoveHighlight = async (verseNum) => {
    if (!user || !token) {
      showToast('請先登入帳號', 'info')
      openAuthModal('login')
      return
    }

    const num = parseInt(verseNum)
    setHighlights(prev => {
      const copy = { ...prev }
      delete copy[num]
      return copy
    })
    setActiveVerseNum(null)

    try {
      await fetch(`${API_BASE}/api/highlights?version=${activeTarget.version}&book=${activeTarget.book}&chapter=${activeTarget.chapter}&verse_num=${num}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      showToast(`已清除第 ${num} 節標註（資料庫已更新）`)
    } catch (err) {}
  }

  // 複製經文（免登入即可複製）
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

  const toggleSpeech = () => {
    if (!('speechSynthesis' in window) || !chapterContent.length) return
    if (isSpeaking) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
      return
    }
    const text = chapterContent.map(v => `${v.num}。${v.text}`).join(' ')
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'zh-TW'
    utterance.rate = 0.9
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
    setIsSpeaking(true)
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

  return (
    <div className="reading-page-wrapper" onClick={() => setActiveVerseNum(null)}>
      <Toast message={toastMsg} type={toastType} onClose={() => setToastMsg(null)} />

      <div className="mobile-reader-toolbar">
        <button type="button" className="mobile-reader-book" onClick={() => setBookPickerOpen(true)}>
          {currentActiveBookName} {activeTarget.chapter}
        </button>
        <span className="mobile-reader-divider" aria-hidden="true" />
        <button type="button" className="mobile-reader-version" onClick={() => setVersionPickerOpen(true)}>
          {activeTarget.version}
        </button>
        <button type="button" className="mobile-reader-icon" onClick={toggleSpeech} aria-label="朗讀">
          <Volume2 size={24} />
        </button>
        <button type="button" className="mobile-reader-icon" aria-label="搜尋" onClick={() => showToast('搜尋功能即將推出', 'info')}>
          <Search size={27} />
        </button>
        <button type="button" className="mobile-reader-icon" aria-label="更多" onClick={() => showToast('點擊經文可標註或複製', 'info')}>
          <MoreHorizontal size={27} />
        </button>
      </div>

      {versionPickerOpen && (
        <div className="version-picker-backdrop" onClick={() => setVersionPickerOpen(false)}>
          <section className="version-picker-sheet" onClick={e => e.stopPropagation()}>
            <div className="version-picker-handle" />
            <div className="version-picker-title-row">
              <h2>我的譯本</h2>
              <div><button type="button" aria-label="設定"><Settings size={27} /></button><button type="button" aria-label="新增譯本"><Plus size={30} /></button></div>
            </div>
            <div className="version-picker-list">
              {versions.map(version => (
                <button key={version.id} type="button" className={`version-picker-item ${version.id === activeTarget.version ? 'selected' : ''}`} onClick={() => chooseVersion(version)}>
                  <span className="version-code">{version.id}<b>{version.id === 'CUNP' ? '神' : ''}</b></span>
                  <span className="version-details"><small>{version.id === 'CCB' ? 'Biblica, Inc.' : 'Hong Kong Bible Society'}</small><strong>{version.id === 'CUNP' ? '新標點和合本, 神版' : version.name}</strong></span>
                  <Cloud size={24} className="version-cloud" /><MoreHorizontal size={23} className="version-more" />
                </button>
              ))}
            </div>
            <button type="button" className="more-versions-btn" onClick={() => showToast('更多譯本功能即將推出', 'info')}>更多譯本</button>
            <p className="version-picker-count">3,868 譯本 共 2,463 種語言</p>
          </section>
        </div>
      )}

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
          <p>選好版本、書卷與章後立即開始閱讀；點擊經文可<b>畫線</b>或<b>複製</b></p>
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

            <button className="book-picker-trigger" type="button" onClick={() => setBookPickerOpen(true)}>
              <span className="book-picker-trigger-label">書卷</span>
              <span>{books.find(b => b.id === selection.book)?.name || '選擇書卷'}</span>
              <span className="book-picker-chevron">›</span>
            </button>

            <div className="reading-select-group book-select-group">
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
                <option value="" disabled>請選擇章</option>
                {Array.from({ length: totalChapters }, (_, i) => i + 1).map(num => (
                  <option key={num} value={num}>{num}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {bookPickerOpen && (
          <div className="book-picker-backdrop" onClick={() => setBookPickerOpen(false)}>
            <section className="book-picker-sheet" onClick={e => e.stopPropagation()}>
              <div className="book-picker-header">
                <button type="button" className="book-picker-close" onClick={() => setBookPickerOpen(false)}>×</button>
                <h2>書卷</h2>
                <span className="book-picker-more" aria-hidden="true"><MoreHorizontal size={22} /></span>
              </div>
              <div className="book-picker-list">
                <div className="book-picker-section-title">舊約</div>
                {books.slice(0, 39).map(book => <BookPickerItem key={book.id} book={book} selection={selection} onChooseBook={chooseBook} onChooseChapter={choosePickerChapter} />)}
                <div className="book-picker-section-title">新約</div>
                {books.slice(39).map(book => <BookPickerItem key={book.id} book={book} selection={selection} onChooseBook={chooseBook} onChooseChapter={choosePickerChapter} />)}
              </div>
              {recentReads.length > 0 && (
                <div className="book-picker-recent">
                  <h3>最近使用 <span>›</span></h3>
                  <div className="recent-read-grid">
                    {recentReads.slice(0, 4).map(item => {
                      const book = books.find(b => b.id === item.book)
                      const version = versions.find(v => v.id === item.version)
                      return <button key={`${item.version}-${item.book}-${item.chapter}`} type="button" className="recent-read-card" onClick={() => openRecentRead(item)}>
                        <strong>{book?.name || item.book} {item.chapter}</strong>
                        <small>{version?.name || item.version}</small>
                      </button>
                    })}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

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
                  <Highlighter size={14} /> {user ? '點擊經文畫線標註（已同步資料庫）' : '登入後可進行經文畫線標註與個人讀經筆記'}
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

        <div className="mobile-reader-controls">
          <button type="button" onClick={handlePrevChapter} disabled={parseInt(activeTarget.chapter) <= 1} aria-label="上一章"><ChevronLeft size={34} /></button>
          <button type="button" className="mobile-reader-play" onClick={toggleSpeech} disabled={!chapterContent.length} aria-label={isSpeaking ? '停止朗讀' : '朗讀'}>
            {isSpeaking ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" />}
          </button>
          <button type="button" onClick={handleNextChapter} disabled={parseInt(activeTarget.chapter) >= (books.find(b => b.id === activeTarget.book)?.chapters || 50)} aria-label="下一章"><ChevronRight size={34} /></button>
        </div>
      </div>
    </div>
  )
}
