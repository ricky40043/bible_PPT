import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

const isProd = window.location.hostname !== 'localhost'
export const API_BASE = isProd ? window.location.origin : 'http://localhost:5001'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('bible_token') || '')
  const [progress, setProgress] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authModalMode, setAuthModalMode] = useState('login') // 'login' | 'register'

  // 初始化取得當前用戶資訊
  useEffect(() => {
    const fetchCurrentUser = async () => {
      if (!token) {
        setLoading(false)
        return
      }
      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setUser(data.user)
          setProgress(data.progress)
        } else {
          // Token 過期或無效
          localStorage.removeItem('bible_token')
          setToken('')
          setUser(null)
        }
      } catch (err) {
        console.error('驗證登入失敗:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchCurrentUser()
  }, [token])

  const login = async (email, password) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.detail || '登入失敗')
    }
    localStorage.setItem('bible_token', data.token)
    setToken(data.token)
    setUser(data.user)
    setAuthModalOpen(false)
    return data
  }

  const register = async (email, username, password) => {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, password }),
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.detail || '註冊失敗')
    }
    localStorage.setItem('bible_token', data.token)
    setToken(data.token)
    setUser(data.user)
    setAuthModalOpen(false)
    return data
  }

  const loginWithGoogle = async (googleData) => {
    const res = await fetch(`${API_BASE}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(googleData),
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.detail || 'Google 登入失敗')
    }
    localStorage.setItem('bible_token', data.token)
    setToken(data.token)
    setUser(data.user)
    setAuthModalOpen(false)
    return data
  }

  const logout = () => {
    localStorage.removeItem('bible_token')
    setToken('')
    setUser(null)
    setProgress(null)
  }

  const saveProgress = async (version, book, chapter, verseNum = 1) => {
    const newProgress = { version, book, chapter: parseInt(chapter), verse_num: parseInt(verseNum) }
    setProgress(newProgress)
    
    if (token) {
      try {
        await fetch(`${API_BASE}/api/progress`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(newProgress),
        })
      } catch (err) {
        console.error('儲存進度失敗:', err)
      }
    } else {
      localStorage.setItem('bible_local_progress', JSON.stringify(newProgress))
    }
  }

  const openAuthModal = (mode = 'login') => {
    setAuthModalMode(mode)
    setAuthModalOpen(true)
  }

  const closeAuthModal = () => {
    setAuthModalOpen(false)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        progress,
        loading,
        authModalOpen,
        authModalMode,
        login,
        register,
        loginWithGoogle,
        logout,
        saveProgress,
        openAuthModal,
        closeAuthModal,
        setAuthModalMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
