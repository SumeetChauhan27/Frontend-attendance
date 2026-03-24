import { useState } from 'react'
import toast from 'react-hot-toast'
import { submitTeacherRegistration } from '../services/adminService'

type TeacherRegistrationProps = {
  compact?: boolean
}

export default function TeacherRegistration({
  compact = false,
}: TeacherRegistrationProps) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    department: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [registeredId, setRegisteredId] = useState('')

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password.trim() || !form.department.trim()) {
      toast.error('Fill all registration fields.')
      return
    }

    setSubmitting(true)
    try {
      const teacher = await submitTeacherRegistration({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        department: form.department.trim(),
      })
      setRegisteredId(teacher.id)
      setForm({
        name: '',
        email: '',
        password: '',
        department: '',
      })
      toast.success('Registration submitted for approval.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Registration failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className={compact ? 'registration-modal-content' : 'spreadsheet-card registration-card'}>
      {compact ? (
        <>
          <div className="registration-modal-header">
            <div className="login-brand">Attendance Management</div>
            <h2>Register Teacher</h2>
            <p>Create your faculty account and send it for super-admin approval.</p>
          </div>

          <div className="registration-modal-body">
            <div className="form-group">
              <label htmlFor="teacher-name">Name</label>
              <input
                id="teacher-name"
                value={form.name}
                onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
                placeholder="Enter full name"
              />
            </div>
            <div className="form-group">
              <label htmlFor="teacher-email">Email</label>
              <input
                id="teacher-email"
                type="email"
                value={form.email}
                onChange={(event) => setForm((previous) => ({ ...previous, email: event.target.value }))}
                placeholder="faculty@college.edu"
              />
            </div>
            <div className="form-group">
              <label htmlFor="teacher-password">Password</label>
              <input
                id="teacher-password"
                type="password"
                value={form.password}
                onChange={(event) => setForm((previous) => ({ ...previous, password: event.target.value }))}
                placeholder="Create a password"
              />
            </div>
            <div className="form-group">
              <label htmlFor="teacher-department">Department</label>
              <input
                id="teacher-department"
                value={form.department}
                onChange={(event) => setForm((previous) => ({ ...previous, department: event.target.value }))}
                placeholder="e.g. Computer Science"
              />
            </div>
          </div>

          <div className="registration-modal-footer">
            <button
              type="button"
              className="btn login-submit-btn registration-submit-btn"
              disabled={submitting}
              onClick={() => void handleSubmit()}
            >
              {submitting ? 'Submitting...' : 'Submit Application'}
            </button>
            {registeredId ? (
              <div className="info-banner registration-success-banner">
                Registration submitted. Teacher ID: <strong>{registeredId}</strong>.
              </div>
            ) : (
              <p className="registration-helper">
                You can sign in after a super admin approves the account.
              </p>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="spreadsheet-head">
            <div>
              <h2>Teacher Registration</h2>
              <p>Submit a teacher account for super-admin approval.</p>
            </div>
            <span className="class-badge">Pending approval</span>
          </div>

          <div className="form-grid registration-grid">
            <div className="form-group">
              <label htmlFor="teacher-name">Name</label>
              <input
                id="teacher-name"
                value={form.name}
                onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
                placeholder="Enter full name"
              />
            </div>
            <div className="form-group">
              <label htmlFor="teacher-email">Email</label>
              <input
                id="teacher-email"
                type="email"
                value={form.email}
                onChange={(event) => setForm((previous) => ({ ...previous, email: event.target.value }))}
                placeholder="faculty@college.edu"
              />
            </div>
            <div className="form-group">
              <label htmlFor="teacher-password">Password</label>
              <input
                id="teacher-password"
                type="password"
                value={form.password}
                onChange={(event) => setForm((previous) => ({ ...previous, password: event.target.value }))}
                placeholder="Create a password"
              />
            </div>
            <div className="form-group">
              <label htmlFor="teacher-department">Department</label>
              <input
                id="teacher-department"
                value={form.department}
                onChange={(event) => setForm((previous) => ({ ...previous, department: event.target.value }))}
                placeholder="e.g. CSE"
              />
            </div>
          </div>

          <div className="actions">
            <button
              type="button"
              className="btn"
              disabled={submitting}
              onClick={() => void handleSubmit()}
            >
              {submitting ? 'Submitting...' : 'Register Teacher'}
            </button>
          </div>

          {registeredId ? (
            <div className="info-banner">
              Registration submitted. Teacher ID: <strong>{registeredId}</strong>. Login will stay blocked until a
              super admin approves the account. Teachers can sign in with this ID or their email after approval.
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}
