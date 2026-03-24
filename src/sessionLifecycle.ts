export const SessionStatus = {
  INACTIVE: 'INACTIVE',
  ACTIVE: 'ACTIVE',
  CLOSED: 'CLOSED',
} as const

export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus]

export interface Session {
  id: string
  subject: string
  room: string
  startTime: Date | null
  endTime: Date | null
  status: SessionStatus
}

export const createInitialSession = (): Session => ({
  id: '',
  subject: '',
  room: '',
  startTime: null,
  endTime: null,
  status: SessionStatus.INACTIVE,
})
