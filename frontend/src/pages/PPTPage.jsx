import { useState, useEffect } from 'react'
import { Download, Book as BookIcon } from 'lucide-react'
import './PPTPage.css'

const isProd = window.location.hostname !== 'localhost'
const API = isProd ? window.location.origin : 'http://localhost:5001'

export default function PPTPage() {
  const [versions, setVersions] = useState([])
  const [books, setBooks] = useState([])
  const [chapters, setChapters] = useState(50)
  const [verseCount, setVerseCount] = useState(31)
  const [formData, setFormData] = useState({
    version: 'CUNP',
    book: 'GEN',
    chapter: '1',
    verse_start: '1',
    verse_end: '10',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const vRes = await fetch(`${API}/api/versions`)
        const vData = await vRes.json()
        setVersions(vData)
        const bRes = await fetch(`${API}/api/books`)
        const bData = await bRes.json()
        setBooks(bData)
      } catch (err) {
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
      } catch (err) {
        console.error(err)
      }
    }
    getChapters()
  }, [formData.book])

  useEffect(() => {
    const getVerseCount = async () => {
      if (!formData.book || !formData.chapter || !formData.version) return
      try {
        const res = await fetch(`${API}/api/verses_list/${formData.version}/${formData.book}/${formData.chapter}`)
        const data = await res.json()
        setVerseCount(data.length)
        setFormData(prev => ({ ...prev, verse_start: '1', verse_end: data.length.toString() }))
      } catch (err) {
        console.error(err)
      }
    }
    getVerseCount()
  }, [formData.book, formData.chapter, formData.version])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => {
      let newData = { ...prev, [name]: value }
      if (name === 'verse_start') {
        if (parseInt(value) > parseInt(prev.verse_end)) newData.verse_end = value
      } else if (name === 'verse_end') {
        if (parseInt(value) < parseInt(prev.verse_start)) newData.verse_start = value
      }
      return newData
    })
  }

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)
    try {
      const payload = {
        ...formData,
        chapter: parseInt(formData.chapter),
        verse_start: parseInt(formData.verse_start),
        verse_end: parseInt(formData.verse_end),
      }
      const res = await fetch(`${API}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const blob = await res.blob()
      const bookName = books.find(b => b.id === formData.book)?.name || formData.book
      const filename = `${bookName} ${formData.chapter}:${formData.verse_start}-${formData.verse_end}.pptx`
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const bookName = books.find(b => b.id === formData.book)?.name || formData.book
  const titlePreview = `${bookName} ${formData.chapter}:${formData.verse_start}-${formData.verse_end}`

  return (
    <div className="page-wrapper">
      <div className="app-container">
        <div className="header">
          <h1><BookIcon size={28} />聖經 PPT 產生器</h1>
          <p>選擇章節範圍，下載專業黑底黃字簡報</p>
        </div>

        {error && <div className="error-msg">{error}</div>}

        <div className="ppt-layout">
          <div className="ppt-form-panel">
            <div className="form-group">
              <label>版本 / Version</label>
              <select className="form-control" name="version" value={formData.version} onChange={handleChange}>
                {versions.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>書卷 / Book</label>
              <select className="form-control" name="book" value={formData.book} onChange={handleChange}>
                {books.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>章 / Chapter</label>
              <select className="form-control" name="chapter" value={formData.chapter} onChange={handleChange}>
                {Array.from({ length: chapters }, (_, i) => i + 1).map(num => (
                  <option key={num} value={num}>{num}</option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <div className="form-group half">
                <label>起始節 / Start</label>
                <select className="form-control" name="verse_start" value={formData.verse_start} onChange={handleChange}>
                  {Array.from({ length: verseCount }, (_, i) => i + 1).map(num => (
                    <option key={num} value={num}>{num}</option>
                  ))}
                </select>
              </div>
              <div className="form-group half">
                <label>結束節 / End</label>
                <select className="form-control" name="verse_end" value={formData.verse_end} onChange={handleChange}>
                  {Array.from({ length: verseCount }, (_, i) => i + 1).map(num => (
                    <option key={num} value={num}>{num}</option>
                  ))}
                </select>
              </div>
            </div>
            <button className="btn-generate" onClick={handleGenerate} disabled={loading}>
              {loading ? <span className="loader" /> : <Download size={18} />}
              {loading ? '生成中...' : '下載 PPTX'}
            </button>
          </div>

          <div className="ppt-preview-panel">
            <div className="preview-label">投影片預覽</div>
            <div className="slide-preview">
              <div className="slide-preview-title">{titlePreview}</div>
              <div className="slide-preview-body">
                <span className="slide-preview-num">1</span>
                <span className="slide-preview-text">（選好範圍後下載 PPTX）</span>
              </div>
              <div className="slide-preview-version">(新標點和合本)</div>
            </div>
            <div className="ppt-hint">
              <p>每節經文一張投影片</p>
              <p>黑底黃字專業格式</p>
              <p>支援 16:9 寬螢幕</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
