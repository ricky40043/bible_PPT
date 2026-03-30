import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Prevent iOS Safari pull-to-refresh when page is at the top
let touchStartY = 0
document.addEventListener('touchstart', (e) => {
  touchStartY = e.touches[0].clientY
}, { passive: true })
document.addEventListener('touchmove', (e) => {
  if (e.touches.length !== 1) return
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop
  if (scrollTop <= 0 && e.touches[0].clientY > touchStartY) {
    e.preventDefault()
  }
}, { passive: false })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
