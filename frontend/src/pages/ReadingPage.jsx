import { useState, useEffect, useRef } from 'react'
import { BookOpen } from 'lucide-react'
import './ReadingPage.css'

const isProd = window.location.hostname !== 'localhost'
const API = isProd ? window.location.origin : 'http://localhost:5001'

export default function ReadingPage() {
  const [versions, setVersions] = useState([])
  const [books, setBooks] = useState([])
  const [chapters, setChapters] = useState(50)
  const [formData, setFormData] = useState({ version: 'CUNP', book: 'GEN', chapter: '1' })
  const [chapterContent, setChapterContent] = useState([])
  const [selectedVerse, setSelectedVerse] = useState('1')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const contentRef = useRef(null)

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const vRes = await fetch(`${API}/api/versions`)
        setVersions(await vRes.json())
        const bRes = await fetch(`${API}/api/books`)
        setBooks(await bRes.json())
      } catch {
        setError('後端服務未啟動')
      }
    }
    fetchOptions()
  }, [])

  useEffect(() => {
    const getChapters = async () => {
      if (!formData.book) return
      try {
        const res = await fetch(`${API}/api/chapters/${formData.book}`)
        const data = await res.json()
        setChapters(data.count)
        setFormData(prev => ({ ...prev, chapter: '1' }))
      } catch (err) { console.error(err) }
    }
    getChapters()
  }, [formData.book])

  useEffect(() => {
    const fetchChapter = async () => {
      if (!formData.book || !formData.chapter || !formData.version) return
      setLoading(true)
      setChapterContent([])
      setSelectedVerse('1')
      try {
        const res = await fetch(`${API}/api/verses_list/${formData.version}/${formData.book}/${formData.chapter}`)
        const data = await res.json()
        setChapterContent(data)
        setTimeout(() => {
          contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 100)
      } catch (err) {
        setError('載入失敗')
      }
      setLoading(false)
    }
    fetchChapter()
  }, [formData.book, formData.chapter, formData.version])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value,
      ...(name === 'book' ? { chapter: '1' } : {}),
    }))
  }

  const handleVerseJump = (e) => {
    const num = e.target.value
    setSelectedVerse(num)
    const el = document.getElementById(`verse-${num}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const bookName = books.find(b => b.id === formData.book)?.name || formData.book
  const versionName = versions.find(v => v.id === formData.version)?.name || formData.version

  return (
    <div className="reading-page-wrapper">
      <div className="bg-blob-1" />
      <div className="bg-blob-2" />
      <div className="app-container">
        <div className="header">
          <h1><BookOpen size={26} />線上閱讀</h1>
          <p>選擇章節，閱讀完整篇章</p>
        </div>

        {error && <div className="error-msg">{error}</div>}

        {/* Selector Bar: version / book / chapter / verse */}
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
            <label>節</label>
            <select className="form-control" value={selectedVerse} onChange={handleVerseJump} disabled={chapterContent.length === 0}>
              {chapterContent.map(v => (
                <option key={v.num} value={v.num}>{v.num}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Chapter Navigation */}
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

        {/* Content */}
        <div className="reading-content" ref={contentRef}>
          {loading ? (
            <div className="reading-loading">
              <span className="loader" />
              <span>載入中...</span>
            </div>
          ) : chapterContent.length > 0 ? (
            <>
              <div className="reading-header-bar">
                <span className="reading-book-title">{bookName} {formData.chapter}</span>
                <span className="reading-version-tag">{versionName}</span>
              </div>
              <div className="reading-verses">
                {chapterContent.map((verse) => (
                  <div key={verse.num} id={`verse-${verse.num}`} className="verse-item">
                    <span className="verse-num">{verse.num}</span>
                    <span className="verse-text">{verse.text}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="reading-empty">選擇書卷和章節開始閱讀</div>
          )}
        </div>
      </div>
    </div>
  )
}
