import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import NavBar from './components/NavBar'
import PPTPage from './pages/PPTPage'
import ProjectionPage from './pages/ProjectionPage'
import ReadingPage from './pages/ReadingPage'

function AppContent() {
  const location = useLocation()
  const isProjectorMode = new URLSearchParams(location.search).get('mode') === 'projector'
  return (
    <>
      {!isProjectorMode && <NavBar />}
      <Routes>
        <Route path="/" element={<PPTPage />} />
        <Route path="/projection" element={<ProjectionPage />} />
        <Route path="/reading" element={<ReadingPage />} />
      </Routes>
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}

export default App
