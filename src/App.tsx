import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import type { User } from './api'
import LoginPage from './pages/LoginPage'
import FaceRegistration from './pages/FaceRegistration'
import ManagementPanel from './pages/ManagementPanel'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import SuperAdminDashboard from './pages/SuperAdminDashboard'
import StudentDashboard from './pages/StudentDashboard'
import TeacherLayout from './pages/TeacherLayout'
import TeacherRegistration from './pages/TeacherRegistration'
import TeacherDashboard from './pages/TeacherDashboard'
import { StudentSpreadsheetPage } from './pages/StudentSpreadsheet'
import { restoreSession, signIn, signOut, type LoginPayload } from './services/authService'

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [bootstrapping, setBootstrapping] = useState(true)
  const [isAuthenticating, setIsAuthenticating] = useState(false)

  useEffect(() => {
    const bootstrap = async () => {
      const nextUser = await restoreSession()
      setUser(nextUser)
      setBootstrapping(false)
    }

    void bootstrap()
  }, [])

  const handleLogin = async (payload: LoginPayload) => {
    setIsAuthenticating(true)
    try {
      const nextUser = await signIn(payload)
      setUser(nextUser)
    } finally {
      setIsAuthenticating(false)
    }
  }

  const handleLogout = async () => {
    await signOut()
    setUser(null)
  }

  if (bootstrapping) {
    return (
      <main className="page app-shell">
        <section className="placeholder-card">
          <h1>Loading attendance workspace</h1>
          <p>Restoring your active session.</p>
        </section>
      </main>
    )
  }

  if (!user) {
    return <LoginPage isSubmitting={isAuthenticating} onLogin={handleLogin} />
  }

  if (user.role === 'STUDENT') {
    return <StudentDashboard user={user} onLogout={handleLogout} />
  }

  if (user.role === 'SUPER_ADMIN') {
    return <SuperAdminDashboard user={user} onLogout={handleLogout} />
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<TeacherLayout user={user} onLogout={handleLogout} />}>
        <Route index element={<TeacherDashboard user={user} onLogout={handleLogout} />} />
        <Route path="management" element={<ManagementPanel />}>
          <Route index element={<Navigate to="students" replace />} />
          <Route path="students" element={<StudentSpreadsheetPage />} />
          <Route path="teachers" element={<TeacherRegistration />} />
          <Route path="reports" element={<Reports />} />
          <Route path="faces" element={<FaceRegistration />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default App
