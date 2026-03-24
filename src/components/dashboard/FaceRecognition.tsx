type FaceRecognitionProps = {
  isAttendanceEnabled: boolean
}

export default function FaceRecognition({
  isAttendanceEnabled,
}: FaceRecognitionProps) {
  return (
    <div className="qr-disabled-note">
      <strong>Face registration is available now.</strong>
      <div className="compact-text">
        Register student faces from the <strong>Student Spreadsheet</strong> using the
        <strong> Register Face</strong> action in each row.
      </div>
      <div className="compact-text">
        {isAttendanceEnabled
          ? 'Face verification for live attendance will be wired into this tab next.'
          : 'Start a session to use live attendance tools.'}
      </div>
    </div>
  )
}
