import type { ReactNode } from 'react'
import { SessionStatus, type SessionStatus as SessionStatusValue } from '../../sessionLifecycle'

type SessionControlProps = {
  sessionStatus: SessionStatusValue
  sessionSubject: string
  sessionTiming: string
  sessionStartTime: Date | null
  sessionEndTime: Date | null
  sessionDate: string
  manualTime: string
  sessionForm: { subject: string; timing: string }
  sessionRoom: string
  shouldShowEnd: boolean
  shouldShowClosed: boolean
  sessionTimer: string
  isAttendanceEnabled: boolean
  onNewSession: () => void
  onChooseSession: () => void
  onDateChange: (value: string) => void
  onManualTimeChange: (value: string) => void
  onSubjectChange: (value: string) => void
  onTimingChange: (value: string) => void
  onStartSession: () => void
  onEndSession: () => void
  onResetSession: () => void
  attendanceSection: ReactNode
}

export default function SessionControl({
  sessionStatus,
  sessionSubject,
  sessionTiming,
  sessionStartTime,
  sessionEndTime,
  sessionDate,
  manualTime,
  sessionForm,
  sessionRoom,
  shouldShowEnd,
  shouldShowClosed,
  sessionTimer,
  isAttendanceEnabled,
  onNewSession,
  onChooseSession,
  onDateChange,
  onManualTimeChange,
  onSubjectChange,
  onTimingChange,
  onStartSession,
  onEndSession,
  onResetSession,
  attendanceSection,
}: SessionControlProps) {
  const statusLabel =
    sessionStatus === SessionStatus.ACTIVE
      ? 'Live Session Active'
      : sessionStatus === SessionStatus.CLOSED
        ? 'Session Closed'
        : 'No Live Session'

  return (
    <section className="bg-white rounded-xl shadow-sm p-6 col-span-8 teacher-session-card">
      <div className="teacher-title-row">
        <h2 className="teacher-card-title">Session Control</h2>
        <button
          className="btn btn-outline teacher-new-session-btn"
          type="button"
          onClick={onNewSession}
        >
          + New Session
        </button>
      </div>

      <div className="teacher-calendar-row">
        <div className="form-group compact-form m-0">
          <label htmlFor="session-date">Session Date</label>
          <input
            id="session-date"
            type="date"
            value={sessionDate}
            onChange={(e) => onDateChange(e.target.value)}
          />
        </div>
        <div className="form-group compact-form m-0">
          <label htmlFor="session-start-time">Session Start</label>
          <input
            id="session-start-time"
            type="time"
            value={manualTime}
            onChange={(e) => onManualTimeChange(e.target.value)}
          />
        </div>
        <div className="teacher-calendar-action">
          <button
            className="btn btn-outline teacher-picker-btn"
            type="button"
            onClick={onChooseSession}
          >
            Choose Session
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 teacher-session-grid">
        <div className="teacher-column space-y-4">
          <div className="form-group compact-form m-0">
            <label htmlFor="session-subject">Subject</label>
            <input
              id="session-subject"
              value={sessionForm.subject}
              onChange={(e) => onSubjectChange(e.target.value)}
              placeholder="e.g. Data Structures"
            />
          </div>
          <div className="form-group compact-form m-0">
            <label htmlFor="session-timing">Time</label>
            <input
              id="session-timing"
              value={sessionForm.timing}
              onChange={(e) => onTimingChange(e.target.value)}
              placeholder="e.g. 10:30 - 11:30"
            />
          </div>
        </div>
        <div className="teacher-column space-y-4">
          <div className="form-group compact-form m-0">
            <label htmlFor="session-room">Room</label>
            <input id="session-room" value={sessionRoom} readOnly />
          </div>
          <div className="form-group compact-form m-0">
            <label htmlFor="session-status">Status</label>
            <input id="session-status" value={statusLabel} readOnly />
          </div>
        </div>
      </div>

      <div className="teacher-action-row">
        {shouldShowEnd ? (
          <button className="btn teacher-action-btn teacher-end-btn" onClick={onEndSession}>
            End Session
          </button>
        ) : null}
        <button className="btn btn-primary-gradient teacher-action-btn" onClick={onStartSession}>
          {sessionStatus === SessionStatus.ACTIVE ? 'Start New Session' : 'Start Session'}
        </button>
        {shouldShowClosed ? (
          <button
            className="btn btn-outline teacher-action-btn"
            type="button"
            onClick={onResetSession}
          >
            Reset Session
          </button>
        ) : null}
        {shouldShowEnd ? <span className="teacher-timer">Live timer: {sessionTimer}</span> : null}
      </div>

      {attendanceSection}

      <div className={`teacher-live-meta ${sessionStatus === SessionStatus.ACTIVE ? 'active' : 'idle'}`}>
        {sessionStatus === SessionStatus.ACTIVE ? (
          <div>
            Live session: {sessionSubject} | {sessionTiming} |{' '}
            {sessionStartTime ? sessionStartTime.toLocaleString() : '--'} | Elapsed {sessionTimer}
          </div>
        ) : sessionStatus === SessionStatus.CLOSED ? (
          <div>
            Session closed. Started: {sessionStartTime ? sessionStartTime.toLocaleTimeString() : '--'} |
            Ended: {sessionEndTime ? sessionEndTime.toLocaleTimeString() : '--'}
          </div>
        ) : (
          <div>Live session: Inactive</div>
        )}
        <div>Attendance controls: {isAttendanceEnabled ? 'Enabled' : 'Locked'}</div>
      </div>
    </section>
  )
}
