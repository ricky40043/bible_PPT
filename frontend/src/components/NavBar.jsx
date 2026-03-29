import { NavLink } from 'react-router-dom'
import { FileText, Monitor, BookOpen } from 'lucide-react'
import './NavBar.css'

export default function NavBar() {
  return (
    <nav className="navbar">
      <div className="navbar-brand">聖經工具</div>
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
    </nav>
  )
}
