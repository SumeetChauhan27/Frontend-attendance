import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import type { SessionRecord, StudentAttendanceSummary, User } from '../api'
import StudentFaceRecognition from '../components/dashboard/StudentFaceRecognition'
import {
  markAttendance,
  readStudentAttendanceHistory,
  readStudentSession,
} from '../services/attendanceService'

type StudentDashboardProps = {
  user: User
  onLogout: () => Promise<void>
}

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

const buildSubject = (
  entry: { subject: string; room?: string | null },
  includeRoom = true,
) => {
  const parts = [entry.subject]
  if (includeRoom && entry.room) parts.push(`Room ${entry.room}`)
  return parts.join(' ')
}

const stripRoom = (value: string) => value.replace(/\s*Room\s+\w+\b/i, '').trim()

export default function StudentDashboard({ user, onLogout }: StudentDashboardProps) {
  const [studentSession, setStudentSession] = useState<SessionRecord | null>(null)
  const [studentMarked, setStudentMarked] = useState(false)
  const [studentHistory, setStudentHistory] = useState<StudentAttendanceSummary[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [showStudentHistory, setShowStudentHistory] = useState(false)

  useEffect(() => {
    const refreshStudentSession = async () => {
      const nextSession = await readStudentSession()
      setStudentSession(nextSession)
    }

    void refreshStudentSession()
  }, [])

  const refreshStudentHistory = async () => {
    setHistoryLoading(true)
    try {
      const records = await readStudentAttendanceHistory()
      setStudentHistory(records)
    } catch {
      setStudentHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }

  const handleMarkAttendance = async () => {
    try {
      await markAttendance()
      setStudentMarked(true)
      toast.success('Attendance marked.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Mark failed')
    }
  }

  const studentSummary = useMemo(() => {
    const map = new Map<
      string,
      { subject: string; timing: string; total: number; present: number }
    >()

    studentHistory.forEach((record) => {
      const key = `${record.subject}__${record.timing}`
      const entry = map.get(key) ?? {
        subject: record.subject,
        timing: record.timing,
        total: 0,
        present: 0,
      }
      entry.total += 1
      if (record.present) entry.present += 1
      map.set(key, entry)
    })

    return Array.from(map.values()).map((entry) => ({
      ...entry,
      percentage: entry.total ? Math.round((entry.present / entry.total) * 100) : 0,
    }))
  }, [studentHistory])

  const studentSubject = studentSession
    ? stripRoom(buildSubject(studentSession, false))
    : ''
  const studentClassLabel = user.className || user.classId || '--'

  return (
    <div className="page student-page">
      <header className="topbar student-topbar">
        <div className="topbar-inner">
          <div>
            <h1>Student Attendance</h1>
            <p>Welcome, {user.name}</p>
          </div>
          <div className="topbar-actions">
            <button
              className="btn btn-outline"
              onClick={() => {
                setShowStudentHistory(true)
                void refreshStudentHistory()
              }}
              type="button"
            >
              My Attendance
            </button>
            <button
              className="btn btn-outline student-logout-btn"
              onClick={() => void onLogout()}
              type="button"
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="content single">
        <section className="card">
          <h2>Your Profile</h2>
          <div className="profile-grid">
            <div><strong>Student ID:</strong> {user.id}</div>
            <div><strong>Roll:</strong> {user.roll}</div>
            <div><strong>Name:</strong> {user.name}</div>
            <div><strong>Class:</strong> {studentClassLabel}</div>
          </div>
          <div className="divider" />
          <h3>Attendance Session</h3>
          <div className="auto-panel">
            <div className="auto-row">
              <span className="auto-label">Current Class</span>
              {studentSession ? (
                <span className="auto-value">{studentSubject}</span>
              ) : (
                <span className="auto-muted">No active class</span>
              )}
            </div>
            <div className="auto-row">
              <span className="auto-label">Time</span>
              {studentSession ? (
                <span className="auto-value">{studentSession.timing}</span>
              ) : (
                <span className="auto-muted">--</span>
              )}
            </div>
          </div>
          {studentSession ? (
            <div className="session-card">
              <div><strong>Subject:</strong> {studentSubject}</div>
              <div><strong>Timing:</strong> {studentSession.timing}</div>
              <div><strong>Date:</strong> {formatDate(studentSession.date)}</div>
              <div><strong>Status:</strong> {studentSession.status}</div>
            </div>
          ) : (
            <div className="empty">No active session.</div>
          )}
          <div className="info-banner">
            {studentMarked
              ? 'Attendance has been marked for this session after face verification.'
              : 'Attendance will be marked only after successful face verification below.'}
          </div>
          <div className="divider" />
          <StudentFaceRecognition
            studentId={user.id}
            isSessionActive={Boolean(studentSession)}
            onRecognized={handleMarkAttendance}
          />
        </section>
      </main>
      {showStudentHistory ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setShowStudentHistory(false)}
        >
          <div
            className="modal details-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <h4>My Attendance</h4>
            {historyLoading ? (
              <div className="muted compact-text">Loading attendance...</div>
            ) : (
              <div className="summary-table">
                <div className="summary-head">
                  <div>Lecture</div>
                  <div>Time</div>
                  <div>Count</div>
                  <div>Present</div>
                  <div>%</div>
                </div>
                {studentSummary.map((row) => (
                  <div key={`${row.subject}-${row.timing}`} className="summary-row">
                    <div className="summary-title">{stripRoom(row.subject)}</div>
                    <div className="summary-time">{row.timing}</div>
                    <div>{row.total}</div>
                    <div>{row.present}</div>
                    <div>{row.percentage}%</div>
                  </div>
                ))}
                {studentSummary.length === 0 ? (
                  <div className="muted compact-text">No sessions found.</div>
                ) : null}
              </div>
            )}
            <div className="modal-actions">
              <button
                className="btn btn-outline"
                onClick={() => setShowStudentHistory(false)}
                type="button"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
