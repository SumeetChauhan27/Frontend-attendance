import { useState } from 'react'
import toast from 'react-hot-toast'
import type { AttendanceRecord, StudentWithAttendance } from '../../api'
import { markTeacherAttendanceManually } from '../../services/attendanceService'

type ManualAttendancePanelProps = {
  isAttendanceEnabled: boolean
  sessionId: string
  students: StudentWithAttendance[]
  attendance: AttendanceRecord[]
  onAttendanceMarked: () => Promise<void>
}

export default function ManualAttendancePanel({
  isAttendanceEnabled,
  sessionId,
  students,
  attendance,
  onAttendanceMarked,
}: ManualAttendancePanelProps) {
  const [processingId, setProcessingId] = useState<string | null>(null)

  const handleMark = async (studentId: string, present: boolean) => {
    if (!isAttendanceEnabled || !sessionId) {
      toast.error('Session is not active.')
      return
    }
    
    setProcessingId(studentId)
    try {
      await markTeacherAttendanceManually({ studentId, sessionId, present })
      await onAttendanceMarked()
      toast.success(`Marked as ${present ? 'Present' : 'Absent'}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action failed')
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div className="manual-attendance-panel">
      {students.length === 0 ? (
        <div className="empty" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          No students found in this class.
        </div>
      ) : (
        <div className="students-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '400px', overflowY: 'auto', paddingRight: '0.5rem' }}>
          {students.map((student) => {
            const isPresent = attendance.some((a) => a.studentId === student.id)
            const isProcessing = processingId === student.id

            return (
              <div
                key={student.id}
                className="student-card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  background: 'var(--surface)'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{student.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Roll: {student.roll}</div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={!isAttendanceEnabled || isProcessing || isPresent}
                    onClick={() => void handleMark(student.id, true)}
                    style={{
                      backgroundColor: isPresent ? 'var(--success-100)' : 'var(--surface-muted)',
                      color: isPresent ? 'var(--success-600)' : 'var(--text-primary)',
                      borderColor: isPresent ? 'var(--success-600)' : 'var(--border)'
                    }}
                  >
                    {isProcessing && !isPresent ? '...' : 'Present'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={!isAttendanceEnabled || isProcessing || !isPresent}
                    onClick={() => void handleMark(student.id, false)}
                    style={{
                      backgroundColor: !isPresent && attendance.length > 0 ? 'var(--danger-100)' : 'var(--surface-muted)',
                      color: !isPresent && attendance.length > 0 ? 'var(--danger-600)' : 'var(--text-primary)',
                      borderColor: !isPresent && attendance.length > 0 ? 'var(--danger-600)' : 'var(--border)'
                    }}
                  >
                    {isProcessing && isPresent ? '...' : 'Absent'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
