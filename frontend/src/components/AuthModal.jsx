import { useState } from 'react'
import { X, Mail, Lock, User, LogIn, UserPlus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import './AuthModal.css'

export default function AuthModal() {
  const { authModalOpen, authModalMode, setAuthModalMode, closeAuthModal, login, register } = useAuth()
  
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

  return (
    <div className="auth-backdrop" onClick={closeAuthModal}>
      <div className="auth-card" onClick={(e) => e.stopPropagation()}>
        <button className="auth-close-btn" onClick={closeAuthModal} title="關閉">
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
              autoFocus
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
              '立即免費註冊'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
