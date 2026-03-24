import { Outlet } from 'react-router-dom'
import ManagementMenu from '../components/dashboard/ManagementMenu'

export default function ManagementPanel() {
  return (
    <div className="management-shell">
      <ManagementMenu />
      <div className="management-shell-content">
        <Outlet />
      </div>
    </div>
  )
}
