import { lazy, Suspense, useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { User } from './api'
import LoginPage from './pages/LoginPage'
import { restoreSession, signIn, signOut, type LoginPayload } from './services/authService'

// Eagerly loaded — small, always needed
import StudentDashboard from './pages/StudentDashboard'
import SuperAdminDashboard from './pages/SuperAdminDashboard'
import TeacherLayout from './pages/TeacherLayout'
import TeacherDashboard from './pages/TeacherDashboard'
import QrAttendancePage from './pages/QrAttendancePage'
import TeacherRegistration from './pages/TeacherRegistration'
import Settings from './pages/Settings'

// Lazily loaded — heavy pages (face-api.js, TensorFlow, PapaParse only load when needed)
const FaceRegistration = lazy(() => import('./pages/FaceRegistration'))
const ManagementPanel = lazy(() => import('./pages/ManagementPanel'))
const Reports = lazy(() => import('./pages/Reports'))
const StudentSpreadsheetPage = lazy(() =>
  import('./pages/StudentSpreadsheet').then((m) => ({ default: m.StudentSpreadsheetPage }))
)

// Minimal fallback shown while lazy chunks download
const PageLoader = () => (
  <main className="page app-shell">
    <section className="placeholder-card">
      <h1>Loading...</h1>
      <p>Please wait a moment.</p>
    </section>
  </main>
)

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [bootstrapping, setBootstrapping] = useState(true)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const location = useLocation()

  // The /attend route is public — skip session restore for it
  const isAttendPage = location.pathname === '/attend'

  useEffect(() => {
    if (isAttendPage) {
      setBootstrapping(false)
      return
    }

    const bootstrap = async () => {
      const nextUser = await restoreSession()
      setUser(nextUser)
      setBootstrapping(false)
    }

    void bootstrap()
  }, [isAttendPage])

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

  // Public route: QR attendance page
  if (isAttendPage) {
    return <QrAttendancePage />
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
    <Suspense fallback={<PageLoader />}>
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
    </Suspense>
  )
}

export default App
