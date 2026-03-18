import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import type { SystemActivity, TeacherAccount, User } from '../api'
import { approveTeacher, fetchSystemActivity, fetchTeacherAccounts } from '../services/adminService'

type SuperAdminDashboardProps = {
  user: User
  onLogout: () => Promise<void>
}

export default function SuperAdminDashboard({
  user,
  onLogout,
}: SuperAdminDashboardProps) {
  const [teachers, setTeachers] = useState<TeacherAccount[]>([])
  const [activity, setActivity] = useState<SystemActivity | null>(null)
  const [loading, setLoading] = useState(true)

  const loadDashboard = async () => {
    setLoading(true)
    try {
      const [teacherList, activitySummary] = await Promise.all([
        fetchTeacherAccounts(),
        fetchSystemActivity(),
      ])
      setTeachers(teacherList)
      setActivity(activitySummary)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load admin data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDashboard()
  }, [])

  const handleApprove = async (teacherId: string) => {
    try {
      const updated = await approveTeacher(teacherId)
      setTeachers((previous) =>
        previous.map((teacher) => (teacher.id === teacherId ? updated : teacher)),
      )
      setActivity((previous) =>
        previous
          ? {
              ...previous,
              totals: {
                ...previous.totals,
                approvedTeachers: previous.totals.approvedTeachers + 1,
                pendingTeachers: Math.max(previous.totals.pendingTeachers - 1, 0),
              },
            }
          : previous,
      )
      toast.success('Teacher approved.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Approval failed')
    }
  }

  return (
    <div className="page teacher-page">
      <header className="topbar teacher-topbar">
        <div className="topbar-inner teacher-header">
          <div className="topbar-left teacher-header-left">
            <h1>Attendance Management System</h1>
            <p>Super admin workspace for {user.name}</p>
          </div>
          <div className="teacher-header-center" />
          <div className="topbar-actions teacher-header-right">
            <div className="teacher-session-badge active">Role: SUPER_ADMIN</div>
            <button className="teacher-logout-btn" onClick={() => void onLogout()}>
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="content teacher-content">
        <div className="teacher-main-wrap">
          <div className="admin-grid">
            <section className="spreadsheet-card">
              <div className="spreadsheet-head">
                <div>
                  <h2>Teacher Approvals</h2>
                  <p>Approve teacher accounts and monitor onboarding status.</p>
                </div>
                <span className="class-badge">
                  {loading ? 'Loading...' : `${teachers.length} teachers`}
                </span>
              </div>

              <div className="spreadsheet-table-wrap">
                <table className="spreadsheet-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Department</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teachers.map((teacher) => (
                      <tr key={teacher.id}>
                        <td>{teacher.id}</td>
                        <td>{teacher.name}</td>
                        <td>{teacher.email}</td>
                        <td>{teacher.department || '--'}</td>
                        <td>{teacher.approved ? 'Approved' : 'Pending'}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-xs"
                            disabled={teacher.approved}
                            onClick={() => void handleApprove(teacher.id)}
                          >
                            {teacher.approved ? 'Approved' : 'Approve'}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {teachers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="spreadsheet-empty">
                          No teacher accounts available yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="placeholder-card">
              <h2>System Activity</h2>
              {activity ? (
                <div className="admin-stats">
                  <div className="admin-stat"><strong>Teachers:</strong> {activity.totals.teachers}</div>
                  <div className="admin-stat"><strong>Approved:</strong> {activity.totals.approvedTeachers}</div>
                  <div className="admin-stat"><strong>Pending:</strong> {activity.totals.pendingTeachers}</div>
                  <div className="admin-stat"><strong>Students:</strong> {activity.totals.students}</div>
                  <div className="admin-stat"><strong>Classes:</strong> {activity.totals.classes}</div>
                  <div className="admin-stat"><strong>Sessions:</strong> {activity.totals.sessions}</div>
                  <div className="admin-stat"><strong>Active Sessions:</strong> {activity.totals.activeSessions}</div>
                  <div className="admin-stat"><strong>Attendance Records:</strong> {activity.totals.attendanceRecords}</div>
                </div>
              ) : (
                <p>{loading ? 'Loading activity...' : 'No activity available.'}</p>
              )}

              <div className="divider" />
              <h3>Recent Sessions</h3>
              <div className="list">
                {activity?.recentSessions.length ? (
                  activity.recentSessions.map((session) => (
                    <div key={session.id} className="list-row">
                      <span>{session.subject}</span>
                      <span className="muted">{session.date}</span>
                    </div>
                  ))
                ) : (
                  <div className="muted compact-text">
                    {loading ? 'Loading sessions...' : 'No recent sessions found.'}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}
