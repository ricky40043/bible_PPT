import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import NavBar from './components/NavBar'
import AuthModal from './components/AuthModal'
import PPTPage from './pages/PPTPage'
import ProjectionPage from './pages/ProjectionPage'
import ReadingPage from './pages/ReadingPage'

function AppContent() {
  const location = useLocation()
  const isProjectorMode = new URLSearchParams(location.search).get('mode') === 'projector'
  if (isProjectorMode) {
    return (
      <Routes>
        <Route path="/projection" element={<ProjectionPage />} />
      </Routes>
    )
  }
  return (
    <div className="app-layout">
      <div className="bg-blob-1" />
      <div className="bg-blob-2" />
      <NavBar />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<PPTPage />} />
          <Route path="/projection" element={<ProjectionPage />} />
          <Route path="/reading" element={<ReadingPage />} />
        </Routes>
      </main>
      <AuthModal />
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
