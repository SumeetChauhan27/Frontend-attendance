import {
  getStudentAttendanceHistory,
  getStudentSession,
  listAttendance,
  listStudentsWithAttendance,
  markTeacherFaceAttendance,
  markStudentAttendance,
  type AttendanceRecord,
  type SessionRecord,
  type StudentAttendanceSummary,
  type StudentWithAttendance,
} from '../api'
import { SessionStatus } from '../sessionLifecycle'
import {
  endSession as endSessionRequest,
  getSession as getSessionRequest,
  startSession as startSessionRequest,
} from './sessionService'

export const markAttendance = async () => markStudentAttendance()

export const markTeacherAttendanceByFace = async (payload: {
  studentId: string
  sessionId: string
}) => markTeacherFaceAttendance(payload)

export const fetchAttendanceStats = async (classId = ''): Promise<StudentWithAttendance[]> =>
  classId ? listStudentsWithAttendance(classId) : []

export const fetchSessionAttendance = async (sessionId: string): Promise<AttendanceRecord[]> =>
  sessionId ? listAttendance(sessionId) : []

export const readStudentSession = async (): Promise<SessionRecord | null> => getStudentSession()

export const readStudentAttendanceHistory = async (): Promise<StudentAttendanceSummary[]> =>
  getStudentAttendanceHistory()

export const syncActiveSession = async (
  classId: string,
  options?: { closeSessionId?: string },
): Promise<SessionRecord | null> => {
  if (options?.closeSessionId) {
    await endSessionRequest(options.closeSessionId)
  }

  return getSessionRequest(classId)
}

export const openAttendanceSession = async (payload: {
  classId: string
  sessionId: string
  currentStatus: SessionStatus
  subject: string
  timing: string
}): Promise<SessionRecord> => {
  if (payload.currentStatus === SessionStatus.ACTIVE && payload.sessionId) {
    try {
      await endSessionRequest(payload.sessionId)
    } catch {
      // Best-effort close before opening the next session.
    }
  }

  const activeServerSession = await getSessionRequest(payload.classId)
  if (activeServerSession?.id && activeServerSession.status === 'open') {
    await endSessionRequest(activeServerSession.id)
  }

  return startSessionRequest({
    classId: payload.classId,
    subject: payload.subject,
    timing: payload.timing,
  })
}
