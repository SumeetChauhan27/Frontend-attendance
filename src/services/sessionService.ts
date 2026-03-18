import {
  closeSession,
  getActiveSession,
  openSession,
  startQrSession,
  type QrSessionStartResponse,
  type SessionRecord,
} from '../api'

export const startSession = async (payload: {
  classId: string
  subject: string
  timing: string
} | null = null): Promise<SessionRecord> => {
  if (!payload) {
    throw new Error('Session payload is required')
  }
  return openSession(payload)
}

export const endSession = async (sessionId = ''): Promise<SessionRecord> => {
  if (!sessionId) {
    throw new Error('Session ID is required')
  }
  return closeSession(sessionId)
}

export const getSession = async (classId = ''): Promise<SessionRecord | null> => {
  if (!classId) return null
  return getActiveSession(classId)
}

export const startQrAttendanceSession = async (payload: {
  classId: string
  subject: string
  room?: string
}): Promise<QrSessionStartResponse> => startQrSession(payload)
