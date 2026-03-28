// v1.0.2 - Layout and Deployment Fixed
import { useState, useEffect, useRef } from 'react'
import { Download, Book as BookIcon, Monitor, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

const isProd = window.location.hostname !== 'localhost'
const API = isProd ? window.location.origin : 'http://localhost:5001'
const WS_URL = isProd 
  ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`
  : 'ws://localhost:5001/ws'

function App() {
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
  const [currentIndex, setCurrentIndex] = useState(0)
  const [pendingDirection, setPendingDirection] = useState(null)
  const [loading, setLoading] = useState(false)
  const [fetchingInfo, setFetchingInfo] = useState(false)
  const [error, setError] = useState(null)

  const [mode, setMode] = useState('normal')
  const [room, setRoom] = useState(null)
  const [ws, setWs] = useState(null)
  const [projecting, setProjecting] = useState(false)
  const [currentVerse, setCurrentVerse] = useState(null)
  const [chapterContent, setChapterContent] = useState([])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlMode = params.get('mode')
    const urlRoom = params.get('room')
    if (urlMode === 'projector' && urlRoom) {
      setMode('projector')
      setRoom(urlRoom)
      connectWS(urlRoom)
    }
  }, [])

  const connectWS = (roomId) => {
    const socket = new WebSocket(`${WS_URL}/${roomId}`)
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'SYNC') {
        setCurrentVerse(data.payload)
      } else if (data.type === 'MOVE_NEXT') {
        if (mode === 'normal') handleNext()
      } else if (data.type === 'MOVE_PREV') {
        if (mode === 'normal') handlePrev()
      }
    }
    socket.onclose = () => setTimeout(() => connectWS(roomId), 3000)
    setWs(socket)
  }

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const vRes = await fetch(`${API}/api/versions`); const vData = await vRes.json(); setVersions(vData)
        const bRes = await fetch(`${API}/api/books`); const bData = await bRes.json(); setBooks(bData)
      } catch (err) { setError('後端服務未啟動') }
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
    const getVerseCount = async () => {
      if (!formData.book || !formData.chapter || !formData.version) return
      setFetchingInfo(true)
      try {
        const res = await fetch(`${API}/api/verses_list/${formData.version}/${formData.book}/${formData.chapter}`)
        const data = await res.json()
        setChapterContent(data)
        setVerseCount(data.length)
        if (projecting && pendingDirection) {
          const idx = pendingDirection === 'first' ? 0 : data.length - 1
          sendSync(data[idx], idx, data)
          setPendingDirection(null)
        } else if (!projecting) {
          setFormData(prev => ({ ...prev, verse_start: '1', verse_end: data.length.toString() }))
        }
      } catch (err) { console.error(err) }
      setFetchingInfo(false)
    }
    getVerseCount()
  }, [formData.book, formData.chapter, formData.version, projecting])

  useEffect(() => {
    const handleKeyDown = (e) => {
      // 只有管理控制平台才能操作鍵盤，投影端 (projector) 為唯讀模式
      if (!projecting || mode === 'projector') return
      
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault()
        handleNext()
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        handlePrev()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [projecting, chapters, currentIndex, chapterContent, mode]) 

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => {
      let newData = { ...prev, [name]: value }

      // 防呆邏輯：處理節號範圍越界
      if (name === 'verse_start') {
        const start = parseInt(value)
        const end = parseInt(prev.verse_end)
        if (start > end) {
          newData.verse_end = value // 起始大於結束時，自動將結束同步
        }
      } else if (name === 'verse_end') {
        const end = parseInt(value)
        const start = parseInt(prev.verse_start)
        if (end < start) {
          newData.verse_start = value // 結束小於起始時，自動將起始同步
        }
      }

      return newData
    })
  }

  const handleGenerate = async () => {
    setLoading(true); setError(null)
    try {
      const payload = { ...formData, chapter: parseInt(formData.chapter), verse_start: parseInt(formData.verse_start), verse_end: parseInt(formData.verse_end) }
      const res = await fetch(`${API}/api/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const blob = await res.blob()
      const filename = `${bookName} ${formData.chapter}:${formData.verse_start}-${formData.verse_end}.pptx`
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  const handleStartProjection = async () => {
    const sessionId = Math.random().toString(36).substring(2, 8).toUpperCase()
    setRoom(sessionId); setProjecting(true)
    window.open(`${window.location.origin}/?mode=projector&room=${sessionId}`, '_blank', 'width=1280,height=720')
    connectWS(sessionId)
    setTimeout(() => { if (chapterContent.length > 0) sendSync(chapterContent[0], 0, chapterContent) }, 1000)
  }

  const socketRef = useRef(null)
  useEffect(() => { socketRef.current = ws }, [ws])

  const sendSync = (verse, index, allVerses) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      const payload = { type: 'SYNC', payload: { title: `${bookName} ${formData.chapter}:${verse.num}`, num: verse.num, text: verse.text, version: versions.find(v => v.id === formData.version)?.name || formData.version } }
      socketRef.current.send(JSON.stringify(payload))
      setCurrentVerse(payload.payload)
      setCurrentIndex(index)
    }
  }

  const handlePrev = () => {
    if (currentIndex > 0) { sendSync(chapterContent[currentIndex - 1], currentIndex - 1, chapterContent) }
    else {
      const currentChap = parseInt(formData.chapter)
      if (currentChap > 1) { setPendingDirection('last'); setFormData(prev => ({ ...prev, chapter: (currentChap - 1).toString() })) }
      else {
        const bookIdx = books.findIndex(b => b.id === formData.book)
        if (bookIdx > 0) { setPendingDirection('last'); setFormData(prev => ({ ...prev, book: books[bookIdx - 1].id, chapter: '999' })) }
      }
    }
  }

  const handleNext = () => {
    if (currentIndex < chapterContent.length - 1) { sendSync(chapterContent[currentIndex + 1], currentIndex + 1, chapterContent) }
    else {
      const currentChap = parseInt(formData.chapter)
      if (currentChap < chapters) { setPendingDirection('first'); setFormData(prev => ({ ...prev, chapter: (currentChap + 1).toString() })) }
      else {
        const bookIdx = books.findIndex(b => b.id === formData.book)
        if (bookIdx >= 0 && bookIdx < books.length - 1) { setPendingDirection('first'); setFormData(prev => ({ ...prev, book: books[bookIdx + 1].id, chapter: '1' })) }
      }
    }
  }

  const selectedBook = books.find(b => b.id === formData.book)
  const bookName = selectedBook ? selectedBook.name : formData.book
  const titlePreview = `${bookName} ${formData.chapter}:${formData.verse_start}-${formData.verse_end}`

  if (mode === 'projector') {
    return (
      <div className="projector-root">
        {currentVerse && (
          <div className="projector-container">
            <div className="projector-title">{currentVerse.title}</div>
            <div className="projector-body">
              <span className="projector-num">{currentVerse.num}</span>
              <span className="projector-text">{currentVerse.text}</span>
            </div>
            <div className="projector-version">({currentVerse.version})</div>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="bg-blob-1"></div>
      <div className="bg-blob-2"></div>
      <div className="app-container">
        <div className="header">
          <h1><BookIcon size={32} /> 聖經 PPT 產生器</h1>
          <p>動態連動選單 · 專業黑底黃字簡報</p>
        </div>
        {error && <div className="error-msg">{error}</div>}
        <div className="main-layout three-columns">
          <div className="column column-left">
            <div className="form-group"><label>版本 / Version</label><select className="form-control" name="version" value={formData.version} onChange={handleChange}>{versions.map(v => (<option key={v.id} value={v.id}>{v.name}</option>))}</select></div>
            <div className="form-group"><label>書卷 / Book</label><select className="form-control" name="book" value={formData.book} onChange={handleChange}>{books.map(b => (<option key={b.id} value={b.id}>{b.name}</option>))}</select></div>
            <div className="form-group"><label>章 / Chapter</label><select className="form-control" name="chapter" value={formData.chapter} onChange={handleChange}>{Array.from({ length: chapters }, (_, i) => i + 1).map(num => (<option key={num} value={num}>{num}</option>))}</select></div>
            <div className="form-row">
              <div className="form-group half"><label>起始節 / Start</label><select className="form-control" name="verse_start" value={formData.verse_start} onChange={handleChange}>{Array.from({ length: verseCount }, (_, i) => i + 1).map(num => (<option key={num} value={num}>{num}</option>))}</select></div>
              <div className="form-group half"><label>結束節 / End</label><select className="form-control" name="verse_end" value={formData.verse_end} onChange={handleChange}>{Array.from({ length: verseCount }, (_, i) => i + 1).map(num => (<option key={num} value={num}>{num}</option>))}</select></div>
            </div>
            <button className="btn-generate" onClick={handleGenerate} disabled={loading}><Download size={20} /> 下載 PPTX</button>
          </div>
          <div className="column column-right">
            {!projecting ? (
              <div className="projection-start-card" onClick={handleStartProjection}><div className="btn-start-large"><Monitor /><span>線上投影</span></div></div>
            ) : (
              <div className="projection-control">
                <div className="control-header"><span>直播中: {room}</span><button onClick={() => setProjecting(false)}><X size={16} /></button></div>
                <div className="control-body">
                  <div className="control-current"><div className="title-tag">{currentVerse?.title}</div><div className="text-snippet">{currentVerse?.text}</div></div>
                  <div className="control-navigation"><button className="nav-btn" onClick={handlePrev}><ChevronLeft size={32} /></button><div className="progress-info"><div className="chapter-label">第 {formData.chapter} 章</div><div className="verse-index">{currentIndex + 1} / {chapterContent.length}</div></div><button className="nav-btn" onClick={handleNext}><ChevronRight size={32} /></button></div>
                  
                  {/* 會眾掃描入口 */}
                  <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ background: 'white', padding: '8px', borderRadius: '8px' }}>
                      <QRCodeSVG 
                        value={`${window.location.origin}/?mode=projector&room=${room}`} 
                        size={100} 
                        bgColor="#FFFFFF" 
                        fgColor="#000000" 
                      />
                    </div>
                    <span style={{ fontSize: '0.8rem', color: '#60a5fa', fontWeight: 'bold' }}>邀請會眾掃描同步看</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
export default App
