import { useState } from 'react'
import { X, Mail, Lock, User, LogIn, UserPlus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import './AuthModal.css'

export default function AuthModal() {
  const { authModalOpen, authModalMode, setAuthModalMode, closeAuthModal, login, register, loginWithGoogle } = useAuth()
  
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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

  const handleGoogleMockLogin = async () => {
    setLoading(true)
    setError('')
    try {
      // 支援 Google 快速綁定登入
      const promptEmail = prompt('請輸入您的 Google 帳號 Email（例如 yourname@gmail.com）:', email || 'user@gmail.com')
      if (!promptEmail) {
        setLoading(false)
        return
      }
      const mockGoogleId = 'google_' + Math.random().toString(36).substring(2, 10)
      const mockName = promptEmail.split('@')[0]
      await loginWithGoogle({
        email: promptEmail,
        name: mockName,
        google_id: mockGoogleId,
        avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${mockName}`
      })
    } catch (err) {
      setError(err.message || 'Google 登入失敗')
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
              ? '登入後可自動同步您的讀經進度與經文畫線標註'
              : '免費註冊即可永久儲存您的讀經進度與劃線筆記'}
          </p>
        </div>

        {error && <div className="auth-error-banner">{error}</div>}

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

        <div className="auth-divider">
          <span>或使用第三方登入</span>
        </div>

        <button className="auth-google-btn" onClick={handleGoogleMockLogin} disabled={loading}>
          <svg className="google-icon" viewBox="0 0 24 24" width="18" height="18">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          Google 帳號快速登入 / 綁定
        </button>
      </div>
    </div>
  )
}
