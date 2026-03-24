type ManualAttendancePanelProps = {
  isAttendanceEnabled: boolean
}

export default function ManualAttendancePanel({
  isAttendanceEnabled,
}: ManualAttendancePanelProps) {
  if (!isAttendanceEnabled) {
    return (
      <div className="qr-disabled-note">
        Session must be active to use manual attendance.
      </div>
    )
  }

  return (
    <div className="qr-disabled-note">
      Manual attendance module will be enabled in the next phase.
    </div>
  )
}
