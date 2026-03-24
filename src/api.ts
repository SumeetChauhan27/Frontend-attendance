export type User = {
  id: string
  role: 'SUPER_ADMIN' | 'TEACHER' | 'STUDENT'
  name: string
  roll: string
  classId: string
  className?: string
  department?: string
  approved?: boolean
  rollNumber?: string
  year?: string
  faceEmbedding?: number[] | null
}

export type StudentWithAttendance = User & {
  attendance: { present: number; total: number; percentage: number }
}

export type StudentRecord = {
  id: string
  name: string
  rollNumber: string
  department: string
  year: string
  faceEmbedding: number[] | null
  classId: string
}

export type ClassRecord = { id: string; name: string }

export type SessionRecord = {
  id: string
  classId: string
  subject: string
  timing: string
  date: string
  status: 'open' | 'closed'
}

export type AttendanceRecord = {
  id: string
  sessionId: string
  studentId: string
  timestamp: string
}

export type AttendanceDetail = AttendanceRecord & {
  student: { id: string; name: string; roll: string }
}

export type SessionSummary = SessionRecord & { presentCount: number }

export type StudentAttendanceSummary = {
  id: string
  subject: string
  timing: string
  date: string
  status: 'open' | 'closed'
  present: boolean
}

export type TeacherStudentAttendance = {
  student: { id: string; name: string; roll: string }
  records: StudentAttendanceSummary[]
}

export type TeacherAccount = {
  id: string
  name: string
  email: string
  department: string
  role: 'TEACHER'
  approved: boolean
}

export type StudentFaceEmbedding = {
  studentId: string
  descriptor: number[]
}

export type SystemActivity = {
  totals: {
    teachers: number
    approvedTeachers: number
    pendingTeachers: number
    students: number
    classes: number
    sessions: number
    activeSessions: number
    attendanceRecords: number
  }
  recentSessions: Array<{
    id: string
    classId: string
    subject: string
    timing: string
    date: string
    status: 'open' | 'closed'
    createdAt?: string
  }>
}

export type QrSessionStartResponse = {
  sessionId: string
  token: string
  expiresAt: number
}

export type QrSessionValidation = {
  valid: boolean
  classId: string
  subject: string
  room: string
  expiresAt: number
  hasLocation: boolean
}

export type SecureAttendancePayload = {
  studentId: string
  password?: string
  sessionId: string
  token: string
  faceVerified: boolean
  location?: { lat: number; lng: number } | null
}

export type SecureAttendanceResult = {
  message: string
  studentId: string
  studentName: string
  verified: { face: boolean; location: boolean }
}

const apiBase = import.meta.env.VITE_API_URL

const toJson = async <T>(res: Response): Promise<T> => {
  if (!res.ok) {
    const message = await res.text()
    throw new Error(message || 'Request failed')
  }
  return res.json() as Promise<T>
}

const authHeader = (): Record<string, string> => {
  const token = localStorage.getItem('auth_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export const login = async (payload: {
  role: 'SUPER_ADMIN' | 'TEACHER' | 'STUDENT'
  id: string
  password: string
}): Promise<{ token: string; role: string; id: string }> => {
  const res = await fetch(`${apiBase}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return toJson(res)
}

export const logout = async (): Promise<{ ok: boolean }> => {
  const res = await fetch(`${apiBase}/api/auth/logout`, {
    method: 'POST',
    headers: { ...authHeader() },
  })
  return toJson(res)
}

export const getMe = async (): Promise<User> => {
  const res = await fetch(`${apiBase}/api/me`, {
    headers: { ...authHeader() },
  })
  return toJson(res)
}

export const listClasses = async (): Promise<ClassRecord[]> => {
  const res = await fetch(`${apiBase}/api/classes`, {
    headers: { ...authHeader() },
  })
  return toJson(res)
}

export const createClass = async (name: string): Promise<ClassRecord> => {
  const res = await fetch(`${apiBase}/api/classes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({ name }),
  })
  return toJson(res)
}

export const createStudent = async (payload: {
  id?: string
  name: string
  rollNumber: string
  department: string
  year: string
  classId: string
}): Promise<StudentRecord> => {
  const res = await fetch(`${apiBase}/api/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(payload),
  })
  return toJson(res)
}

export const updateStudent = async (
  studentId: string,
  payload: {
    name: string
    rollNumber: string
    department: string
    year: string
    faceEmbedding?: number[][] | number[] | null
  },
): Promise<StudentRecord> => {
  const res = await fetch(`${apiBase}/api/students/${studentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(payload),
  })
  return toJson(res)
}

export const deleteStudent = async (studentId: string): Promise<{ ok: boolean }> => {
  const res = await fetch(`${apiBase}/api/students/${studentId}`, {
    method: 'DELETE',
    headers: { ...authHeader() },
  })
  return toJson(res)
}

export const listStudentsByClass = async (
  classId: string,
): Promise<User[]> => {
  const res = await fetch(`${apiBase}/api/classes/${classId}/students`, {
    headers: { ...authHeader() },
  })
  return toJson(res)
}

export const listStudentsWithAttendance = async (
  classId: string,
): Promise<StudentWithAttendance[]> => {
  const res = await fetch(
    `${apiBase}/api/classes/${classId}/students/attendance`,
    {
      headers: { ...authHeader() },
    },
  )
  return toJson(res)
}

export const openSession = async (payload: {
  classId: string
  subject: string
  timing: string
}): Promise<SessionRecord> => {
  const res = await fetch(`${apiBase}/api/sessions/open`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(payload),
  })
  return toJson(res)
}

export const closeSession = async (sessionId: string): Promise<SessionRecord> => {
  const res = await fetch(`${apiBase}/api/sessions/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({ sessionId }),
  })
  return toJson(res)
}

export const getActiveSession = async (
  classId: string,
): Promise<SessionRecord | null> => {
  const res = await fetch(`${apiBase}/api/sessions/active/${classId}`, {
    headers: { ...authHeader() },
  })
  return toJson(res)
}

export const listAttendance = async (
  sessionId: string,
): Promise<AttendanceRecord[]> => {
  const res = await fetch(`${apiBase}/api/attendance/session/${sessionId}`, {
    headers: { ...authHeader() },
  })
  return toJson(res)
}

export const listAttendanceDetails = async (
  sessionId: string,
): Promise<AttendanceDetail[]> => {
  const res = await fetch(
    `${apiBase}/api/attendance/session/${sessionId}/details`,
    {
      headers: { ...authHeader() },
    },
  )
  return toJson(res)
}

export const listSessionsByClass = async (
  classId: string,
): Promise<SessionSummary[]> => {
  const res = await fetch(`${apiBase}/api/sessions/class/${classId}`, {
    headers: { ...authHeader() },
  })
  return toJson(res)
}

export const getStudentSession = async (): Promise<SessionRecord | null> => {
  const res = await fetch(`${apiBase}/api/student/session`, {
    headers: { ...authHeader() },
  })
  return toJson(res)
}

export const markStudentAttendance = async (): Promise<AttendanceRecord> => {
  const res = await fetch(`${apiBase}/api/student/attendance`, {
    method: 'POST',
    headers: { ...authHeader() },
  })
  return toJson(res)
}

export const markTeacherFaceAttendance = async (payload: {
  studentId: string
  sessionId: string
}): Promise<AttendanceRecord> => {
  const res = await fetch(`${apiBase}/api/teachers/attendance/face-mark`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(payload),
  })
  return toJson(res)
}

export const getStudentAttendanceHistory = async (): Promise<
  StudentAttendanceSummary[]
> => {
  const res = await fetch(`${apiBase}/api/student/attendance/history`, {
    headers: { ...authHeader() },
  })
  return toJson(res)
}

export const getStudentAttendanceByTeacher = async (
  studentId: string,
): Promise<TeacherStudentAttendance> => {
  const res = await fetch(
    `${apiBase}/api/teachers/students/${studentId}/attendance`,
    {
      headers: { ...authHeader() },
    },
  )
  return toJson(res)
}

export const getStudentFaceEmbedding = async (): Promise<{
  studentId: string
  descriptor: number[]
}> => {
  const res = await fetch(`${apiBase}/api/student/face-embedding`, {
    headers: { ...authHeader() },
  })
  return toJson(res)
}

export const registerStudentFaceEmbedding = async (
  embeddings: number[][]
): Promise<{ message: string; embeddings: number[][] }> => {
  const res = await fetch(`${apiBase}/api/student/face-embedding`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({ embeddings }),
  })
  return toJson(res)
}

export const listTeacherAccounts = async (): Promise<TeacherAccount[]> => {
  const res = await fetch(`${apiBase}/api/admin/teachers`, {
    headers: { ...authHeader() },
  })
  return toJson(res)
}

export const approveTeacherAccount = async (teacherId: string): Promise<TeacherAccount> => {
  const res = await fetch(`${apiBase}/api/admin/teachers/${teacherId}/approve`, {
    method: 'POST',
    headers: { ...authHeader() },
  })
  return toJson(res)
}

export const getSystemActivity = async (): Promise<SystemActivity> => {
  const res = await fetch(`${apiBase}/api/admin/activity`, {
    headers: { ...authHeader() },
  })
  return toJson(res)
}

export const registerTeacherAccount = async (payload: {
  name: string
  email: string
  password: string
  department: string
}): Promise<TeacherAccount> => {
  const res = await fetch(`${apiBase}/api/teachers/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return toJson(res)
}

export const startQrSession = async (payload: {
  classId: string
  subject: string
  room?: string
  classroomLat?: number | null
  classroomLng?: number | null
}): Promise<QrSessionStartResponse> => {
  const res = await fetch(`${apiBase}/api/session/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(payload),
  })
  return toJson(res)
}

export const downloadAttendanceCsv = async (classId: string): Promise<void> => {
  const res = await fetch(`${apiBase}/api/attendance/export/${classId}`, {
    headers: { ...authHeader() },
  })
  if (!res.ok) {
    const message = await res.text()
    throw new Error(message || 'Export failed')
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `attendance_${classId}_${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export const validateQrSession = async (
  sessionId: string,
  token: string,
): Promise<QrSessionValidation> => {
  const res = await fetch(`${apiBase}/api/session/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, token }),
  })
  return toJson(res)
}

export const markAttendanceSecure = async (
  payload: SecureAttendancePayload,
): Promise<SecureAttendanceResult> => {
  const res = await fetch(`${apiBase}/api/attendance/mark-secure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return toJson(res)
}

export const matchFace = async (
  descriptor: number[],
): Promise<{ studentId: string | null; name: string; similarity: number; status: 'accepted'|'retry'|'rejected' }> => {
  const res = await fetch(`${apiBase}/api/face/match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ descriptor }),
  })
  return toJson(res)
}
