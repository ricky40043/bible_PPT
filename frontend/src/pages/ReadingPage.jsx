import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BookOpen, Copy, Check, Highlighter, Sparkles } from 'lucide-react'
import { useAuth, API_BASE } from '../context/AuthContext'
import HighlightToolbar from '../components/HighlightToolbar'
import Toast from '../components/Toast'
import './ReadingPage.css'

export default function ReadingPage() {
  const [searchParams] = useSearchParams()
  const { user, token, progress, saveProgress } = useAuth()

  const [versions, setVersions] = useState([])
  const [books, setBooks] = useState([])
  const [chapters, setChapters] = useState(50)
  
  // 優先順序：URL 參數 > 使用者進度 > localStorage > 預設創世記 1
  const initialParams = () => {
    const urlV = searchParams.get('version')
    const urlB = searchParams.get('book')
    const urlC = searchParams.get('chapter')
    if (urlB) {
      return { version: urlV || 'CUNP', book: urlB, chapter: urlC || '1' }
    }
    if (progress && progress.book) {
      return { version: progress.version || 'CUNP', book: progress.book, chapter: String(progress.chapter || '1') }
    }
    const local = localStorage.getItem('bible_local_progress')
    if (local) {
      try {
        const p = JSON.parse(local)
        return { version: p.version || 'CUNP', book: p.book || 'GEN', chapter: String(p.chapter || '1') }
      } catch (e) {}
    }
    return { version: 'CUNP', book: 'GEN', chapter: '1' }
  }

  const [formData, setFormData] = useState(initialParams)
  const [chapterContent, setChapterContent] = useState([])
  const [selectedVerse, setSelectedVerse] = useState('1')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  // 經文標註與操作狀態
  const [highlights, setHighlights] = useState({}) // { [verse_num]: color_hex }
  const [activeVerseNum, setActiveVerseNum] = useState(null) // 目前正在編輯工具列的節
  const [toastMsg, setToastMsg] = useState(null)
  const [toastType, setToastType] = useState('success')

  const contentRef = useRef(null)
  const touchStartX = useRef(null)
  const touchStartY = useRef(null)
  const isInitialProgressLoaded = useRef(false)

  const showToast = (msg, type = 'success') => {
    setToastMsg(msg)
    setToastType(type)
    setTimeout(() => {
      setToastMsg(prev => prev === msg ? null : prev)
    }, 2800)
  }

  // 1. 取得版本與書卷
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const vRes = await fetch(`${API_BASE}/api/versions`)
        setVersions(await vRes.json())
        const bRes = await fetch(`${API_BASE}/api/books`)
        setBooks(await bRes.json())
      } catch {
        setError('後端服務連線失敗')
      }
    }
    fetchOptions()
  }, [])

  // 2. 當使用者登入且有進度時，自動載入
  useEffect(() => {
    if (progress && !isInitialProgressLoaded.current && !searchParams.get('book')) {
      isInitialProgressLoaded.current = true
      setFormData({
        version: progress.version || 'CUNP',
        book: progress.book,
        chapter: String(progress.chapter),
      })
      if (progress.verse_num) {
        setSelectedVerse(String(progress.verse_num))
      }
    }
  }, [progress, searchParams])

  // 3. 取得書卷總章數
  useEffect(() => {
    const getChapters = async () => {
      if (!formData.book) return
      try {
        const res = await fetch(`${API_BASE}/api/chapters/${formData.book}`)
        const data = await res.json()
        setChapters(data.count)
      } catch (err) {
        console.error(err)
      }
    }
    getChapters()
  }, [formData.book])

  // 4. 讀取該章經文內容
  useEffect(() => {
    const fetchChapter = async () => {
      if (!formData.book || !formData.chapter || !formData.version) return
      setLoading(true)
      setChapterContent([])
      setActiveVerseNum(null)
      try {
        const res = await fetch(`${API_BASE}/api/verses_list/${formData.version}/${formData.book}/${formData.chapter}`)
        const data = await res.json()
        setChapterContent(data)

        // 讀取該章的高亮標註
        fetchHighlights(formData.version, formData.book, formData.chapter)

        // 自動儲存使用者的讀經進度
        saveProgress(formData.version, formData.book, parseInt(formData.chapter), parseInt(selectedVerse || 1))

        // 若有指定的節，平滑滾動至該節
        setTimeout(() => {
          if (selectedVerse && selectedVerse !== '1') {
            const el = document.getElementById(`verse-${selectedVerse}`)
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          } else {
            contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
        }, 150)
      } catch {
        setError('載入經文失敗')
      }
      setLoading(false)
    }
    fetchChapter()
  }, [formData.book, formData.chapter, formData.version])

  // 讀取該章高亮標註
  const fetchHighlights = async (version, book, chapter) => {
    // 預設先讀 localStorage
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
  }

  // 儲存/更新標註顏色
  const handleSelectHighlightColor = async (verseNum, color) => {
    const num = parseInt(verseNum)
    setHighlights(prev => ({ ...prev, [num]: color }))
    setActiveVerseNum(null)

    // 本地備份
    const localKey = `hl_${formData.version}_${formData.book}_${formData.chapter}`
    try {
      const updated = { ...highlights, [num]: color }
      localStorage.setItem(localKey, JSON.stringify(updated))
    } catch (e) {}

    // 若有登入，同步至後端資料庫
    if (token) {
      try {
        await fetch(`${API_BASE}/api/highlights`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            version: formData.version,
            book: formData.book,
            chapter: parseInt(formData.chapter),
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

  // 移除標註
  const handleRemoveHighlight = async (verseNum) => {
    const num = parseInt(verseNum)
    setHighlights(prev => {
      const copy = { ...prev }
      delete copy[num]
      return copy
    })
    setActiveVerseNum(null)

    // 更新本地
    const localKey = `hl_${formData.version}_${formData.book}_${formData.chapter}`
    try {
      const updated = { ...highlights }
      delete updated[num]
      localStorage.setItem(localKey, JSON.stringify(updated))
    } catch (e) {}

    if (token) {
      try {
        await fetch(`${API_BASE}/api/highlights?version=${formData.version}&book=${formData.book}&chapter=${formData.chapter}&verse_num=${num}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
        showToast(`已清除第 ${num} 節標註`)
      } catch (err) {
        console.error(err)
      }
    } else {
      showToast(`已清除第 ${num} 節標註`)
    }
  }

  // 複製單節經文
  const handleCopyVerse = (verse) => {
    const bookName = books.find(b => b.id === formData.book)?.name || formData.book
    const versionName = versions.find(v => v.id === formData.version)?.name || formData.version
    const formatted = `【${bookName} ${formData.chapter}:${verse.num} ${formData.version}】${verse.text}`
    navigator.clipboard.writeText(formatted)
    showToast(`已複製經文：${bookName} ${formData.chapter}:${verse.num}`)
    setActiveVerseNum(null)
  }

  // 複製全章經文
  const handleCopyEntireChapter = () => {
    if (!chapterContent.length) return
    const bookName = books.find(b => b.id === formData.book)?.name || formData.book
    const versionName = versions.find(v => v.id === formData.version)?.name || formData.version
    const textLines = chapterContent.map(v => `${v.num}. ${v.text}`).join('\n')
    const fullText = `【${bookName} 第 ${formData.chapter} 章 (${versionName})】\n${textLines}`
    navigator.clipboard.writeText(fullText)
    showToast(`已複製 ${bookName} 第 ${formData.chapter} 章全部經文！`)
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value,
      ...(name === 'book' ? { chapter: '1' } : {}),
    }))
    if (name === 'book' || name === 'chapter') {
      setSelectedVerse('1')
    }
  }

  const handleVerseJump = (e) => {
    const num = e.target.value
    setSelectedVerse(num)
    const el = document.getElementById(`verse-${num}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    saveProgress(formData.version, formData.book, parseInt(formData.chapter), parseInt(num))
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
    if (dx < 0 && parseInt(formData.chapter) < chapters) {
      setFormData(prev => ({ ...prev, chapter: (parseInt(prev.chapter) + 1).toString() }))
    } else if (dx > 0 && parseInt(formData.chapter) > 1) {
      setFormData(prev => ({ ...prev, chapter: (parseInt(prev.chapter) - 1).toString() }))
    }
  }

  const bookName = books.find(b => b.id === formData.book)?.name || formData.book
  const versionName = versions.find(v => v.id === formData.version)?.name || formData.version

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
          <p>選擇章節閱讀，點擊經文即可<b>畫線標註顏色</b>或<b>一鍵複製</b></p>
        </div>

        {error && <div className="error-msg">{error}</div>}

        {/* 選擇器列 */}
        <div className="reading-selector-bar">
          <div className="reading-select-group">
            <label>版本</label>
            <select className="form-control" name="version" value={formData.version} onChange={handleChange}>
              {versions.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div className="reading-select-group">
            <label>書卷</label>
            <select className="form-control" name="book" value={formData.book} onChange={handleChange}>
              {books.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="reading-select-group reading-select-small">
            <label>章</label>
            <select className="form-control" name="chapter" value={formData.chapter} onChange={handleChange}>
              {Array.from({ length: chapters }, (_, i) => i + 1).map(num => (
                <option key={num} value={num}>{num}</option>
              ))}
            </select>
          </div>
          <div className="reading-select-group reading-select-small">
            <label>節 (快速跳轉)</label>
            <select className="form-control" value={selectedVerse} onChange={handleVerseJump} disabled={chapterContent.length === 0}>
              {chapterContent.map(v => (
                <option key={v.num} value={v.num}>{v.num}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 章節導航 */}
        <div className="reading-chapter-nav">
          <button
            className="reading-nav-btn"
            disabled={parseInt(formData.chapter) <= 1}
            onClick={() => setFormData(prev => ({ ...prev, chapter: (parseInt(prev.chapter) - 1).toString() }))}
          >
            ← 上一章
          </button>
          <span className="reading-chapter-title">
            {bookName} 第 {formData.chapter} 章
          </span>
          <button
            className="reading-nav-btn"
            disabled={parseInt(formData.chapter) >= chapters}
            onClick={() => setFormData(prev => ({ ...prev, chapter: (parseInt(prev.chapter) + 1).toString() }))}
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
                  <span className="reading-book-title">{bookName} 第 {formData.chapter} 章</span>
                  <span className="reading-version-tag">{versionName}</span>
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
            disabled={parseInt(formData.chapter) <= 1}
            onClick={() => setFormData(prev => ({ ...prev, chapter: (parseInt(prev.chapter) - 1).toString() }))}
          >
            ← 上一章
          </button>
          <span className="reading-chapter-title">
            {bookName} 第 {formData.chapter} 章
          </span>
          <button
            className="reading-nav-btn"
            disabled={parseInt(formData.chapter) >= chapters}
            onClick={() => setFormData(prev => ({ ...prev, chapter: (parseInt(prev.chapter) + 1).toString() }))}
          >
            下一章 →
          </button>
        </div>
      </div>
    </div>
  )
}
