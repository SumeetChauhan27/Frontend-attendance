import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/dashboard/management/students', label: 'Students' },
  { to: '/dashboard/management/teachers', label: 'Teachers' },
  { to: '/dashboard/management/reports', label: 'Reports' },
  { to: '/dashboard/management/faces', label: 'Face Data' },
  { to: '/dashboard/management/settings', label: 'Settings' },
]

export default function ManagementMenu() {
  return (
    <aside className="management-menu-card">
      <div className="management-menu-head">
        <h2>Management Panel</h2>
        <p>Teacher and student management tools.</p>
      </div>
      <nav className="management-menu-nav" aria-label="Management Panel">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `management-menu-link ${isActive ? 'active' : ''}`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
