import { useMemo, useState } from 'react'
import type { AttendanceRecord, StudentWithAttendance } from '../../api'
import { SessionStatus, type SessionStatus as SessionStatusValue } from '../../sessionLifecycle'
import FaceAttendancePanel from './FaceAttendancePanel'
import QRGenerator from './QRGenerator'

type TabType = 'QR' | 'FACE'

type AttendanceTabsProps = {
  sessionStatus: SessionStatusValue
  classId: string
  sessionId: string
  subject: string
  room?: string
  isAttendanceEnabled: boolean
  students: StudentWithAttendance[]
  attendance: AttendanceRecord[]
  onFaceAttendanceMarked: () => Promise<void>
}

export default function AttendanceTabs({
  sessionStatus,
  classId,
  sessionId,
  subject,
  room = '',
  isAttendanceEnabled,
  students,
  attendance,
  onFaceAttendanceMarked,
}: AttendanceTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('QR')
  const isQRDisabled = sessionStatus !== SessionStatus.ACTIVE

  const content = useMemo(() => {
    if (activeTab === 'QR') {
      return (
        <QRGenerator
          sessionStatus={sessionStatus}
          classId={classId}
          subject={subject}
          room={room}
        />
      )
    }
    return (
      <FaceAttendancePanel
        isAttendanceEnabled={isAttendanceEnabled}
        sessionId={sessionId}
        students={students}
        attendance={attendance}
        onAttendanceMarked={onFaceAttendanceMarked}
      />
    )
  }, [
    activeTab,
    attendance,
    classId,
    isAttendanceEnabled,
    onFaceAttendanceMarked,
    room,
    sessionId,
    sessionStatus,
    students,
    subject,
  ])

  return (
    <>
      <div className="attendance-tabs">
        <button
          type="button"
          className={`attendance-tab ${activeTab === 'QR' ? 'active' : ''}`}
          onClick={() => setActiveTab('QR')}
          disabled={isQRDisabled}
        >
          QR
        </button>
        <button
          type="button"
          className={`attendance-tab ${activeTab === 'FACE' ? 'active' : ''}`}
          onClick={() => setActiveTab('FACE')}
        >
          Face
        </button>
      </div>
      <div className="attendance-tab-panel">{content}</div>
    </>
  )
}
