import { useState, useEffect, useRef } from 'react'
import { X, Mail, Lock, User, LogIn, UserPlus } from 'lucide-react'
import { useAuth, API_BASE } from '../context/AuthContext'
import './AuthModal.css'

export default function AuthModal() {
  const { authModalOpen, authModalMode, setAuthModalMode, closeAuthModal, login, register, loginWithGoogle } = useAuth()
  
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const googleBtnContainerRef = useRef(null)

  // 1. 初始化 Google Identity Services 官方 SDK
  useEffect(() => {
    if (!authModalOpen) return

    const initGoogleGSI = async () => {
      let clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
      if (!clientId) {
        try {
          const res = await fetch(`${API_BASE}/api/auth/config`)
          if (res.ok) {
            const data = await res.json()
            clientId = data.google_client_id
          }
        } catch (e) {}
      }

      if (!clientId) {
        clientId = "1083945938592-sample.apps.googleusercontent.com"
      }

      if (window.google?.accounts?.id && googleBtnContainerRef.current) {
        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleGoogleResponse,
            auto_select: false,
            cancel_on_tap_outside: true,
          })

          googleBtnContainerRef.current.innerHTML = ''
          window.google.accounts.id.renderButton(googleBtnContainerRef.current, {
            theme: 'filled_blue',
            size: 'large',
            text: 'continue_with',
            shape: 'rectangular',
            width: 320,
            locale: 'zh_TW',
          })
        } catch (err) {
          console.error('Google GSI 初始化失敗:', err)
        }
      }
    }

    // 等待 GSI SDK 載入
    const timer = setTimeout(initGoogleGSI, 150)
    return () => clearTimeout(timer)
  }, [authModalOpen])

  // Google 官方回傳認證 Token
  const handleGoogleResponse = async (response) => {
    if (!response?.credential) {
      setError('Google 登入失敗：未取得憑證')
      return
    }

    setLoading(true)
    setError('')
    try {
      await loginWithGoogle({ credential: response.credential })
      closeAuthModal()
    } catch (err) {
      setError(err.message || 'Google 登入失敗')
    } finally {
      setLoading(false)
    }
  }

  // 點擊自訂 Google 按鈕時觸發官方 Google 授權彈窗
  const handleTriggerGoogleAuth = () => {
    setError('')
    if (window.google?.accounts?.id) {
      // 觸發 Google One Tap / 授權彈窗
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // 若 One Tap 未顯示，嘗試開啟 Google OAuth 彈窗
          openGoogleOAuthPopup()
        }
      })
    } else {
      openGoogleOAuthPopup()
    }
  }

  // 備用：開啟 Google 官方 OAuth 授權彈窗視窗
  const openGoogleOAuthPopup = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "1083945938592-sample.apps.googleusercontent.com"
    const redirectUri = window.location.origin
    const scope = encodeURIComponent('email profile openid')
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token%20id_token&scope=${scope}&nonce=nonce_${Date.now()}&prompt=select_account`
    
    const width = 500
    const height = 600
    const left = window.screen.width / 2 - width / 2
    const top = window.screen.height / 2 - height / 2

    const popup = window.open(
      authUrl,
      'google_auth_popup',
      `width=${width},height=${height},top=${top},left=${left},toolbar=no,menubar=no,location=no,status=no`
    )

    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      setError('瀏覽器封鎖了彈跳視窗，請允許彈跳視窗後再試')
    }
  }

  if (!authModalOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (authModalMode === 'login') {
        await login(email, password)
      } else {
        await register(email, username, password)
      }
      setEmail('')
      setPassword('')
      setUsername('')
    } catch (err) {
      setError(err.message || '操作失敗，請稍後再試')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-backdrop" onClick={closeAuthModal}>
      <div className="auth-card" onClick={(e) => e.stopPropagation()}>
        <button className="auth-close-btn" onClick={closeAuthModal}>
          <X size={20} />
        </button>

        <div className="auth-header">
          <div className="auth-tabs">
            <button
              className={`auth-tab ${authModalMode === 'login' ? 'active' : ''}`}
              onClick={() => { setAuthModalMode('login'); setError('') }}
            >
              <LogIn size={16} /> 登入帳號
            </button>
            <button
              className={`auth-tab ${authModalMode === 'register' ? 'active' : ''}`}
              onClick={() => { setAuthModalMode('register'); setError('') }}
            >
              <UserPlus size={16} /> 註冊新帳號
            </button>
          </div>
          <p className="auth-subtitle">
            {authModalMode === 'login'
              ? '登入後可自動同步您的讀經進度與經文畫線標註（雲端資料庫儲存）'
              : '免費註冊即可永久儲存您的讀經進度與劃線筆記至資料庫'}
          </p>
        </div>

        {error && <div className="auth-error-banner">{error}</div>}

        {/* 1. Google 官方一鍵登入區塊 */}
        <div className="google-auth-section">
          <div ref={googleBtnContainerRef} className="google-btn-wrapper" />
          <button className="auth-google-btn" onClick={handleTriggerGoogleAuth} disabled={loading}>
            <svg className="google-icon" viewBox="0 0 24 24" width="18" height="18">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            使用 Google 帳號授權登入
          </button>
        </div>

        <div className="auth-divider">
          <span>或使用 Email 密碼登入</span>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-input-group">
            <label><Mail size={14} /> 電子郵件 (Email)</label>
            <input
              type="email"
              required
              placeholder="example@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-input"
            />
          </div>

          {authModalMode === 'register' && (
            <div className="auth-input-group">
              <label><User size={14} /> 姓名 / 暱稱</label>
              <input
                type="text"
                required
                placeholder="例如：提摩太"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="auth-input"
              />
            </div>
          )}

          <div className="auth-input-group">
            <label><Lock size={14} /> 密碼 (至少 6 個字元)</label>
            <input
              type="password"
              required
              minLength={6}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-input"
            />
          </div>

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? (
              <span className="auth-spinner" />
            ) : authModalMode === 'login' ? (
              '登入'
            ) : (
              '立即註冊'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
