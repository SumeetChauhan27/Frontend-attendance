import { useState } from 'react'
import toast from 'react-hot-toast'
import TeacherRegistration from './TeacherRegistration'
import type { LoginPayload } from '../services/authService'

type LoginPageProps = {
  isSubmitting: boolean
  onLogin: (payload: LoginPayload) => Promise<void>
}

export default function LoginPage({ isSubmitting, onLogin }: LoginPageProps) {
  const [role, setRole] = useState<LoginPayload['role']>('TEACHER')
  const [id, setId] = useState('')
  const [password, setPassword] = useState('')
  const [showRegistration, setShowRegistration] = useState(false)

  const handleSubmit = async () => {
    if (!id.trim() || !password.trim()) {
      toast.error('Enter ID and password.')
      return
    }

    try {
      await onLogin({
        role,
        id: id.trim(),
        password,
      })
      setId('')
      setPassword('')
      toast.success('Logged in.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed'
      toast.error(message)
    }
  }

  return (
    <div className="login-shell">
      <div className="login-liquid-blob login-liquid-blob-a" />
      <div className="login-liquid-blob login-liquid-blob-b" />
      <div className="login-liquid-blob login-liquid-blob-c" />
      <div className="login-shell-grid" />

      <section className="login-hero">
        <div className="login-hero-content">
          <div className="login-hero-visual">
            <div className="hero-ring">
              <span className="hero-dot dot-1" />
              <span className="hero-dot dot-2" />
              <span className="hero-dot dot-3" />
              <div className="hero-icon">A</div>
            </div>
          </div>
          <h2>Unified Attendance Platform</h2>
          <p>
            Legacy teacher login and the new attendance dashboard now run inside one React
            workspace.
          </p>
        </div>
      </section>

      <section className="login-panel-wrap">
        <div className="login-panel legacy-login-card">
          <div className="login-panel-shine" />
          <div className="login-brand">Attendance Management</div>
          <h1>Welcome back</h1>
          <p>Sign in to access your dashboard</p>

          <div className="login-role-toggle">
            <button
              className={`login-role-btn ${role === 'SUPER_ADMIN' ? 'active' : ''}`}
              onClick={() => setRole('SUPER_ADMIN')}
              type="button"
            >
              Super Admin
            </button>
            <button
              className={`login-role-btn ${role === 'TEACHER' ? 'active' : ''}`}
              onClick={() => setRole('TEACHER')}
              type="button"
            >
              Teacher
            </button>
            <button
              className={`login-role-btn ${role === 'STUDENT' ? 'active' : ''}`}
              onClick={() => setRole('STUDENT')}
              type="button"
            >
              Student
            </button>
          </div>

          <div className="login-form">
            <div className="form-group">
              <label htmlFor="login-id">
                {role === 'SUPER_ADMIN'
                  ? 'Admin ID'
                  : role === 'TEACHER'
                    ? 'Teacher ID or Email'
                    : 'Student ID'}
              </label>
              <input
                id="login-id"
                value={id}
                onChange={(event) => setId(event.target.value)}
                placeholder={`Enter your ${
                  role === 'SUPER_ADMIN'
                    ? 'admin'
                    : role === 'TEACHER'
                      ? 'teacher ID or email'
                      : 'student ID'
                }`}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void handleSubmit()
                  }
                }}
              />
            </div>
            <div className="form-group">
              <div className="login-password-row">
                <label htmlFor="login-password">Password</label>
                <button type="button" className="link-btn subtle login-forgot-btn">
                  Forgot?
                </button>
              </div>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void handleSubmit()
                  }
                }}
              />
            </div>
          </div>

          <div className="actions login-actions">
            <button
              className="btn login-submit-btn"
              onClick={() => void handleSubmit()}
              type="button"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Signing In...' : 'Sign In'}
            </button>
            {role === 'TEACHER' ? (
              <button
                className="teacher-register-trigger"
                onClick={() => setShowRegistration(true)}
                type="button"
              >
                Reg. Teacher
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {showRegistration ? (
        <div
          className="login-modal-backdrop"
          role="presentation"
          onClick={() => setShowRegistration(false)}
        >
          <div
            className="login-modal-card"
            role="dialog"
            aria-modal="true"
            aria-label="Teacher registration"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="login-modal-close"
              onClick={() => setShowRegistration(false)}
              aria-label="Close registration"
            >
              X
            </button>
            <TeacherRegistration compact />
          </div>
        </div>
      ) : null}
    </div>
  )
}
