import { NavLink, Outlet } from 'react-router-dom'
import type { User } from '../api'

type TeacherLayoutProps = {
  user: User
  onLogout: () => Promise<void>
}

export default function TeacherLayout({ user, onLogout }: TeacherLayoutProps) {
  return (
    <div className="page teacher-page">
      <header className="topbar teacher-topbar">
        <div className="topbar-inner teacher-shell-header">
          <div className="teacher-shell-brand">
            <span className="teacher-shell-logo">AMS</span>
            <div>
              <h1>Dashboard</h1>
              <p>Teacher workspace for {user.name}</p>
            </div>
          </div>
          <nav className="teacher-shell-nav" aria-label="Teacher Navigation">
            <NavLink
              to="/dashboard"
              end
              className={({ isActive }) => `teacher-shell-link ${isActive ? 'active' : ''}`}
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/dashboard/management/students"
              className={({ isActive }) => `teacher-shell-link ${isActive ? 'active' : ''}`}
            >
              Management
            </NavLink>
          </nav>
          <button
            className="teacher-shell-logout"
            onClick={() => void onLogout()}
            type="button"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="content teacher-content">
        <div className="teacher-main-wrap">
          <Outlet />
        </div>
      </main>

      <footer className="footer">© QR Attendance System 2026 - Team AbsentMinded</footer>
    </div>
  )
}
