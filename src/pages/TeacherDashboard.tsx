import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import type { AttendanceRecord, ClassRecord, SessionRecord, StudentWithAttendance, User } from '../api'
import { downloadAttendanceCsv } from '../api'
import AttendanceTabs from '../components/dashboard/AttendanceTabs'
import QuickStats from '../components/dashboard/QuickStats'
import SessionControl from '../components/dashboard/SessionControl'
import { useSessionTimer } from '../hooks/useSessionTimer'
import { SessionStatus, createInitialSession, type Session } from '../sessionLifecycle'
import {
  formatRange,
  getCurrentSlot,
  getEntryForBatch,
  getNextSlot,
  getSlotsForDay,
  type DayName,
  type SlotGroup,
} from '../timetable'
import {
  fetchSessionAttendance,
  openAttendanceSession,
  syncActiveSession,
} from '../services/attendanceService'
import {
  listClassrooms,
  listSpreadsheetStudents,
  provisionClassroom,
} from '../services/spreadsheetService'

type TeacherDashboardProps = {
  user: User
  onLogout: () => Promise<void>
}

const toDayName = (dateValue: string): DayName => {
  const week = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const day = week[new Date(`${dateValue}T00:00:00`).getDay()]
  if (day === 'Monday' || day === 'Tuesday' || day === 'Wednesday' || day === 'Thursday' || day === 'Friday') {
    return day
  }
  return 'Monday'
}

const buildSubject = (
  entry: { subject: string; room?: string | null },
  batch?: string,
  includeRoom = true,
) => {
  const parts = [entry.subject]
  if (batch) parts.push(`(${batch})`)
  if (includeRoom && entry.room) parts.push(`Room ${entry.room}`)
  return parts.join(' ')
}

const makeDateFromDayTime = (day: DayName, time: string) => {
  const now = new Date()
  const dayMap: Record<DayName, number> = {
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
  }
  const date = new Date(now)
  const diff = dayMap[day] - date.getDay()
  date.setDate(date.getDate() + diff)
  const [hours, minutes] = time.split(':').map(Number)
  date.setHours(hours, minutes, 0, 0)
  return date
}

const mapServerStatusToSessionStatus = (status: SessionRecord['status']): SessionStatus =>
  status === 'open' ? SessionStatus.ACTIVE : SessionStatus.CLOSED

export default function TeacherDashboard(_props: TeacherDashboardProps) {
  const [classes, setClasses] = useState<ClassRecord[]>([])
  const [selectedClass, setSelectedClass] = useState('')
  const [students, setStudents] = useState<StudentWithAttendance[]>([])
  const [session, setSession] = useState<Session>(createInitialSession)
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [autoSlot, setAutoSlot] = useState<SlotGroup | null>(null)
  const [autoSlotKey, setAutoSlotKey] = useState('')
  const [selectedBatch, setSelectedBatch] = useState('')
  const [showSessionPicker, setShowSessionPicker] = useState(false)
  const [sessionDate, setSessionDate] = useState('')
  const [manualDay, setManualDay] = useState<DayName>('Monday')
  const [manualTime, setManualTime] = useState('09:00')
  const [sessionForm, setSessionForm] = useState({
    subject: '',
    timing: '',
  })

  const refreshTeacherData = async () => {
    const classList = await listClassrooms()
    setClasses(classList)
    if (classList.length && !selectedClass) {
      setSelectedClass(classList[0].id)
    }
  }

  const refreshStudents = async (classId: string) => {
    if (!classId) return
    const list = await listSpreadsheetStudents(classId)
    setStudents(list)
  }

  const refreshSession = async (classId: string) => {
    if (!classId) return
    const current = await syncActiveSession(classId)
    if (!current) {
      setSession(createInitialSession())
      setAttendance([])
      return
    }

    setSession((previous) => ({
      ...previous,
      id: current.id,
      subject: current.subject || previous.subject,
      startTime: new Date(current.date),
      endTime: current.status === 'closed' ? new Date(current.date) : null,
      status: mapServerStatusToSessionStatus(current.status),
    }))

    const records = await fetchSessionAttendance(current.id)
    setAttendance(records)
  }

  const handleFaceAttendanceMarked = async () => {
    if (!selectedClass || !session.id) return
    await Promise.all([refreshStudents(selectedClass), refreshSession(selectedClass)])
  }

  useEffect(() => {
    void refreshTeacherData()
  }, [])

  useEffect(() => {
    if (!selectedClass) return
    void refreshStudents(selectedClass)
    void refreshSession(selectedClass)
  }, [selectedClass])

  useEffect(() => {
    if (!sessionDate) return
    setManualDay(toDayName(sessionDate))
  }, [sessionDate])

  useEffect(() => {
    const baseDate = makeDateFromDayTime(manualDay, manualTime)
    const current = getCurrentSlot(baseDate)
    const next = getNextSlot(baseDate)
    setAutoSlot(current ?? next ?? null)

    if (!current) {
      setSelectedBatch('')
      return
    }

    const key = `${current.day}-${current.startTime}-${current.endTime}`
    if (key === autoSlotKey) return

    const defaultEntry = current.entries[0]
    const nextBatch = defaultEntry.batch ?? ''
    setSelectedBatch(nextBatch)
    setAutoSlotKey(key)
    setSessionForm({
      subject: buildSubject(defaultEntry, nextBatch),
      timing: formatRange(current),
    })
  }, [autoSlotKey, manualDay, manualTime])

  useEffect(() => {
    if (!autoSlot) return
    const entry = getEntryForBatch(autoSlot, selectedBatch || null)
    setSessionForm((previous) => ({
      ...previous,
      subject: buildSubject(entry, selectedBatch || entry.batch || undefined),
      timing: formatRange(autoSlot),
    }))
  }, [autoSlot, selectedBatch])

  const currentEntry =
    autoSlot && selectedBatch
      ? getEntryForBatch(autoSlot, selectedBatch)
      : autoSlot?.entries[0]

  const sessionRoom =
    currentEntry?.room ??
    session.subject.match(/Room\s+([A-Za-z0-9-]+)/i)?.[1] ??
    '--'

  const startSession = async () => {
    let effectiveClassId = selectedClass || classes[0]?.id || ''
    if (!effectiveClassId) {
      try {
        const fallbackClass = await provisionClassroom('General')
        setClasses((previous) => {
          if (previous.some((item) => item.id === fallbackClass.id)) return previous
          return [...previous, fallbackClass]
        })
        setSelectedClass(fallbackClass.id)
        effectiveClassId = fallbackClass.id
      } catch {
        // Let the backend return the hard error if classroom creation fails.
      }
    }

    try {
      const opened = await openAttendanceSession({
        classId: effectiveClassId,
        sessionId: session.id,
        currentStatus: session.status,
        subject: sessionForm.subject.trim() || 'General Session',
        timing: sessionForm.timing.trim() || 'Flexible',
      })

      setSession((previous) => ({
        ...previous,
        id: opened.id,
        subject: opened.subject,
        startTime: new Date(opened.date),
        endTime: null,
        status: SessionStatus.ACTIVE,
      }))
      setAttendance([])
      toast.success('Session opened.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Open failed')
    }
  }

  const endSession = async () => {
    if (session.status !== SessionStatus.ACTIVE || !session.id) return

    try {
      await syncActiveSession(selectedClass, { closeSessionId: session.id })
      setSession((previous) => ({
        ...previous,
        endTime: new Date(),
        status: SessionStatus.CLOSED,
      }))
      toast.success('Session closed.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Close failed')
    }
  }

  const resetSession = () => {
    setSession(createInitialSession())
    setAttendance([])
  }

  const handleCreateNewSession = async () => {
    if (session.status === SessionStatus.ACTIVE) {
      const confirmed = window.confirm(
        'Current session is still active. End it and prepare a new session?',
      )
      if (!confirmed) return
      await endSession()
    }

    if (session.status === SessionStatus.CLOSED) {
      resetSession()
    }

    if (autoSlot) {
      const entry = getEntryForBatch(autoSlot, selectedBatch || null)
      setSessionForm({
        subject: buildSubject(entry, selectedBatch || entry.batch || undefined),
        timing: formatRange(autoSlot),
      })
    } else {
      setSessionForm({ subject: '', timing: '' })
    }

    toast.success('New session form is ready.')
  }

  const handleSlotPick = (slot: SlotGroup) => {
    setManualTime(slot.startTime)
    setAutoSlot(slot)
    const defaultEntry = slot.entries[0]
    const nextBatch = defaultEntry.batch ?? ''
    setSelectedBatch(nextBatch)
    setAutoSlotKey(`${slot.day}-${slot.startTime}-${slot.endTime}`)
    setSessionForm({
      subject: buildSubject(defaultEntry, nextBatch),
      timing: formatRange(slot),
    })
    setShowSessionPicker(false)
  }

  const attendanceCount = useMemo(() => attendance.length, [attendance.length])
  const absentCount = Math.max(students.length - attendanceCount, 0)
  const attendancePercent = students.length
    ? Math.round((attendanceCount / students.length) * 100)
    : 0
  const attendancePercentTone =
    attendancePercent > 75 ? 'good' : attendancePercent < 50 ? 'low' : 'mid'
  const shouldShowEnd = session.status === SessionStatus.ACTIVE
  const shouldShowClosed = session.status === SessionStatus.CLOSED
  const daySlots = useMemo(() => getSlotsForDay(manualDay), [manualDay])
  const sessionTimer = useSessionTimer(session.startTime, session.status)

  return (
    <>
      <section className="teacher-context-card">
        <div className="teacher-context-grid">
          <div className="form-group compact-form teacher-class-select-inline">
            <label htmlFor="class-select">Class</label>
            <select
              id="class-select"
              value={selectedClass}
              onChange={(event) => setSelectedClass(event.target.value)}
            >
              <option value="">-- Select --</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div
            className={`teacher-session-badge ${
              session.status === SessionStatus.ACTIVE ? 'active' : 'inactive'
            }`}
          >
            Session: {session.status === SessionStatus.ACTIVE ? 'Active' : 'Inactive'}
          </div>
          <button
            className="btn btn-outline"
            type="button"
            disabled={!selectedClass}
            onClick={() => {
              if (!selectedClass) return
              void downloadAttendanceCsv(selectedClass)
                .then(() => toast.success('Attendance downloaded!'))
                .catch((err: unknown) =>
                  toast.error(err instanceof Error ? err.message : 'Download failed'),
                )
            }}
          >
            📥 Download Attendance
          </button>
        </div>
      </section>

      <div className="teacher-main-grid">
        <SessionControl
          sessionStatus={session.status}
          sessionSubject={session.subject}
          sessionTiming={sessionForm.timing}
          sessionStartTime={session.startTime}
          sessionEndTime={session.endTime}
          sessionDate={sessionDate}
          manualTime={manualTime}
          sessionForm={sessionForm}
          sessionRoom={sessionRoom}
          shouldShowEnd={shouldShowEnd}
          shouldShowClosed={shouldShowClosed}
          sessionTimer={sessionTimer}
          isAttendanceEnabled={session.status === SessionStatus.ACTIVE}
          onNewSession={() => void handleCreateNewSession()}
          onChooseSession={() => setShowSessionPicker(true)}
          onDateChange={setSessionDate}
          onManualTimeChange={setManualTime}
          onSubjectChange={(value) =>
            setSessionForm((previous) => ({ ...previous, subject: value }))
          }
          onTimingChange={(value) =>
            setSessionForm((previous) => ({ ...previous, timing: value }))
          }
          onStartSession={() => void startSession()}
          onEndSession={() => void endSession()}
          onResetSession={resetSession}
          attendanceSection={
            <AttendanceTabs
              sessionStatus={session.status}
              classId={selectedClass}
              sessionId={session.id}
              subject={sessionForm.subject}
              room={sessionRoom === '--' ? '' : sessionRoom}
              isAttendanceEnabled={session.status === SessionStatus.ACTIVE}
              students={students}
              attendance={attendance}
              onFaceAttendanceMarked={handleFaceAttendanceMarked}
            />
          }
        />

        <QuickStats
          totalStudents={students.length}
          presentCount={attendanceCount}
          absentCount={absentCount}
          attendancePercent={attendancePercent}
          attendancePercentTone={attendancePercentTone}
        />
      </div>

      {showSessionPicker ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setShowSessionPicker(false)}
        >
          <div
            className="modal slot-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <h4>Choose Session Slot ({manualDay})</h4>
            {daySlots.length === 0 ? (
              <div className="muted compact-text">
                No scheduled slots for this date. Pick a weekday date.
              </div>
            ) : (
              <div className="slot-grid modal-grid">
                {daySlots.map((slot) => {
                  const isActive =
                    autoSlot?.day === slot.day &&
                    autoSlot?.startTime === slot.startTime &&
                    autoSlot?.endTime === slot.endTime
                  return (
                    <button
                      key={`${slot.day}-${slot.startTime}`}
                      className={`slot-card ${isActive ? 'active' : ''}`}
                      type="button"
                      onClick={() => handleSlotPick(slot)}
                    >
                      <div className="slot-time">{formatRange(slot)}</div>
                      {slot.entries.length > 1 ? (
                        <div className="slot-lines">
                          {slot.entries.map((entry) => (
                            <div key={`${entry.batch}-${entry.subject}`}>
                              {entry.batch ?? 'All'} · {entry.subject}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="slot-subject">{slot.entries[0].subject}</div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
            <div className="modal-actions">
              <button
                className="btn btn-outline"
                onClick={() => setShowSessionPicker(false)}
                type="button"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
