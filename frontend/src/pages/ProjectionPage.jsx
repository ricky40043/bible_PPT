import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Monitor, RefreshCw } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import './ProjectionPage.css'

const isProd = window.location.hostname !== 'localhost'
const API = isProd ? window.location.origin : 'http://localhost:5001'
const WS_URL = isProd
  ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`
  : 'ws://localhost:5001/ws'

export default function ProjectionPage() {
  const params = new URLSearchParams(window.location.search)
  const isProjectorMode = params.get('mode') === 'projector'
  const urlRoom = params.get('room')

  const [versions, setVersions] = useState([])
  const [books, setBooks] = useState([])
  const [chapters, setChapters] = useState(50)
  const [formData, setFormData] = useState({ version: 'CUNP', book: 'GEN', chapter: '1' })
  const [chapterContent, setChapterContent] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [currentVerse, setCurrentVerse] = useState(null)
  const [room, setRoom] = useState(urlRoom || null)
  const [ws, setWs] = useState(null)
  const [projectorOpen, setProjectorOpen] = useState(!!urlRoom)
  const [chapterChanged, setChapterChanged] = useState(false)
  const [error, setError] = useState(null)
  const [loadingContent, setLoadingContent] = useState(false)
  const socketRef = useRef(null)
  const prevSelectionRef = useRef({ book: 'GEN', chapter: '1', version: 'CUNP' })

  // Initial data fetch
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

  // Connect WebSocket (projector display mode)
  useEffect(() => {
    if (isProjectorMode && urlRoom) {
      connectWS(urlRoom)
    }
  }, [])

  const connectWS = (roomId) => {
    const socket = new WebSocket(`${WS_URL}/${roomId}`)
    socket.onopen = () => {
      setWs(socket)
      socketRef.current = socket
    }
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'SYNC') {
        setCurrentVerse(data.payload)
      }
    }
    socket.onclose = () => {
      setTimeout(() => {
        const newSocket = connectWS(roomId)
        return newSocket
      }, 3000)
    }
    setWs(socket)
    socketRef.current = socket
    return socket
  }

  // Fetch chapters when book changes
  useEffect(() => {
    const getChapters = async () => {
      if (!formData.book) return
      try {
        const res = await fetch(`${API}/api/chapters/${formData.book}`)
        const data = await res.json()
        setChapters(data.count)
      } catch (err) {
        console.error(err)
      }
    }
    getChapters()
  }, [formData.book])

  // Fetch chapter content when selection changes
  useEffect(() => {
    const fetchChapter = async () => {
      if (!formData.book || !formData.chapter || !formData.version) return
      setLoadingContent(true)
      try {
        const res = await fetch(`${API}/api/verses_list/${formData.version}/${formData.book}/${formData.chapter}`)
        const data = await res.json()
        setChapterContent(data)
        // Check if selection changed while projector is open
        const prev = prevSelectionRef.current
        if (projectorOpen && (prev.book !== formData.book || prev.chapter !== formData.chapter || prev.version !== formData.version)) {
          setChapterChanged(true)
        }
        prevSelectionRef.current = { book: formData.book, chapter: formData.chapter, version: formData.version }
      } catch (err) {
        console.error(err)
      }
      setLoadingContent(false)
    }
    fetchChapter()
  }, [formData.book, formData.chapter, formData.version])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value, ...(name === 'book' ? { chapter: '1' } : {}) }))
  }

  const sendSync = (verse, index, content) => {
    const bookName = books.find(b => b.id === formData.book)?.name || formData.book
    const versionName = versions.find(v => v.id === formData.version)?.name || formData.version
    const payload = {
      type: 'SYNC',
      payload: {
        title: `${bookName} ${formData.chapter}:${verse.num}`,
        num: verse.num,
        text: verse.text,
        version: versionName,
      },
    }
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload))
    }
    setCurrentVerse(payload.payload)
    setCurrentIndex(index)
  }

  const handlePrev = () => {
    if (currentIndex > 0) {
      sendSync(chapterContent[currentIndex - 1], currentIndex - 1, chapterContent)
    }
  }

  const handleNext = () => {
    if (currentIndex < chapterContent.length - 1) {
      sendSync(chapterContent[currentIndex + 1], currentIndex + 1, chapterContent)
    }
  }

  const handleOpenProjector = () => {
    const sessionId = Math.random().toString(36).substring(2, 8).toUpperCase()
    setRoom(sessionId)
    setProjectorOpen(true)
    setChapterChanged(false)
    prevSelectionRef.current = { book: formData.book, chapter: formData.chapter, version: formData.version }
    window.open(`${window.location.origin}/projection?mode=projector&room=${sessionId}`, '_blank', 'width=1280,height=720')
    connectWS(sessionId)
    setTimeout(() => {
      if (chapterContent.length > 0) {
        sendSync(chapterContent[0], 0, chapterContent)
      }
    }, 1000)
  }

  const handleSyncChapter = () => {
    if (chapterContent.length > 0) {
      sendSync(chapterContent[0], 0, chapterContent)
      setChapterChanged(false)
      prevSelectionRef.current = { book: formData.book, chapter: formData.chapter, version: formData.version }
    }
  }

  // Keyboard controls
  useEffect(() => {
    if (isProjectorMode) return
    const handleKeyDown = (e) => {
      if (!projectorOpen) return
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
  }, [projectorOpen, currentIndex, chapterContent, isProjectorMode])

  // ── PROJECTOR DISPLAY MODE ──────────────────────────────────────
  if (isProjectorMode) {
    return (
      <div className="projector-root">
        {currentVerse ? (
          <div className="projector-container">
            <div className="projector-title">{currentVerse.title}</div>
            <div className="projector-body">
              <span className="projector-num">{currentVerse.num}</span>
              <span className="projector-text">{currentVerse.text}</span>
            </div>
            <div className="projector-version">({currentVerse.version})</div>
          </div>
        ) : (
          <div className="projector-waiting">等待投影同步...</div>
        )}
      </div>
    )
  }

  // ── CONTROL MODE ────────────────────────────────────────────────
  const bookName = books.find(b => b.id === formData.book)?.name || formData.book

  return (
    <div className="proj-page-wrapper">
      <div className="bg-blob-1" />
      <div className="bg-blob-2" />
      <div className="app-container">
        <div className="header">
          <h1><Monitor size={26} />投影模式</h1>
          <p>選擇章節，控制投影片播放</p>
        </div>
        {error && <div className="error-msg">{error}</div>}

        {/* Chapter Selector */}
        <div className="proj-selector-row">
          <div className="proj-select-group">
            <label>版本</label>
            <select className="form-control" name="version" value={formData.version} onChange={handleChange}>
              {versions.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div className="proj-select-group">
            <label>書卷</label>
            <select className="form-control" name="book" value={formData.book} onChange={handleChange}>
              {books.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="proj-select-group proj-select-small">
            <label>章</label>
            <select className="form-control" name="chapter" value={formData.chapter} onChange={handleChange}>
              {Array.from({ length: chapters }, (_, i) => i + 1).map(num => (
                <option key={num} value={num}>{num}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Main Control Area */}
        <div className="proj-main-grid">
          {/* Left: Verse Navigator */}
          <div className="proj-navigator">
            <div className="proj-current-verse">
              {currentVerse ? (
                <>
                  <div className="proj-verse-title">{currentVerse.title}</div>
                  <div className="proj-verse-text">{currentVerse.text}</div>
                </>
              ) : (
                <div className="proj-verse-placeholder">
                  {projectorOpen ? (loadingContent ? '載入中...' : '點選「開啟投影視窗」後開始') : '開啟投影視窗後開始導航'}
                </div>
              )}
            </div>

            <div className="proj-nav-controls">
              <button
                className="proj-nav-btn"
                onClick={handlePrev}
                disabled={!projectorOpen || currentIndex === 0}
              >
                <ChevronLeft size={28} />
              </button>
              <div className="proj-nav-info">
                <div className="proj-chapter-label">{bookName} 第 {formData.chapter} 章</div>
                {projectorOpen && chapterContent.length > 0 && (
                  <div className="proj-verse-counter">{currentIndex + 1} / {chapterContent.length}</div>
                )}
              </div>
              <button
                className="proj-nav-btn"
                onClick={handleNext}
                disabled={!projectorOpen || currentIndex >= chapterContent.length - 1}
              >
                <ChevronRight size={28} />
              </button>
            </div>

            <div className="proj-keyboard-hint">← → 方向鍵導航</div>
          </div>

          {/* Right: Session Panel */}
          <div className="proj-session-panel">
            {!projectorOpen ? (
              <button className="proj-open-btn" onClick={handleOpenProjector}>
                <Monitor size={36} />
                <span>開啟投影視窗</span>
              </button>
            ) : (
              <>
                <div className="proj-session-info">
                  <div className="proj-session-badge">直播中</div>
                  <div className="proj-room-id">房間: {room}</div>
                </div>

                {chapterChanged && (
                  <button className="proj-sync-btn" onClick={handleSyncChapter}>
                    <RefreshCw size={16} />
                    同步到投影
                  </button>
                )}

                <div className="proj-qr-wrap">
                  <div className="proj-qr-box">
                    <QRCodeSVG
                      value={`${window.location.origin}/projection?mode=projector&room=${room}`}
                      size={110}
                      bgColor="#FFFFFF"
                      fgColor="#000000"
                    />
                  </div>
                  <div className="proj-qr-label">掃描加入同步觀看</div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
