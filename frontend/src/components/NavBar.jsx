import { NavLink, useNavigate } from 'react-router-dom'
import { FileText, Monitor, BookOpen, User, LogOut, BookmarkCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import './NavBar.css'

export default function NavBar() {
  const { user, progress, logout, openAuthModal } = useAuth()
  const navigate = useNavigate()

  const handleProgressClick = () => {
    if (progress) {
      navigate(`/reading?book=${progress.book}&chapter=${progress.chapter}&version=${progress.version || 'CUNP'}&verse=${progress.verse_num || 1}`)
    } else {
      navigate('/reading')
    }
  }

  return (
    <nav className="navbar">
      <div className="navbar-brand" onClick={() => navigate('/')}>
        <span className="brand-logo">✝</span>
        <span className="brand-title">聖經 PPT 產生器</span>
      </div>

      <div className="navbar-links">
        <NavLink to="/" end className={({ isActive }) => isActive ? 'navbar-link active' : 'navbar-link'}>
          <FileText size={18} /><span>PPT製作</span>
        </NavLink>
        <NavLink to="/projection" className={({ isActive }) => isActive ? 'navbar-link active' : 'navbar-link'}>
          <Monitor size={18} /><span>投影模式</span>
        </NavLink>
        <NavLink to="/reading" className={({ isActive }) => isActive ? 'navbar-link active' : 'navbar-link'}>
          <BookOpen size={18} /><span>線上閱讀</span>
        </NavLink>
      </div>

      <div className="navbar-user-section">
        {user ? (
          <div className="user-profile-bar">
            {progress && (
              <button
                className="progress-quick-btn"
                title={`繼續閱讀：${progress.book} 第 ${progress.chapter} 章`}
                onClick={handleProgressClick}
              >
                <BookmarkCheck size={15} />
                <span>上次讀經：{progress.book} {progress.chapter}章</span>
              </button>
            )}
            <div className="user-info-chip">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="avatar" className="user-avatar" />
              ) : (
                <div className="user-avatar-placeholder">
                  {user.username ? user.username.charAt(0).toUpperCase() : 'U'}
                </div>
              )}
              <span className="user-name">{user.username}</span>
            </div>
            <button className="navbar-logout-btn" title="登出" onClick={logout}>
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <div className="auth-btns">
            <button className="navbar-login-btn" onClick={() => openAuthModal('login')}>
              <User size={15} />
              <span>登入 / 註冊</span>
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}
