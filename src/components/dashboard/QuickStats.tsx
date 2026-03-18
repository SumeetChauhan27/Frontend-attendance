type QuickStatsProps = {
  totalStudents: number
  presentCount: number
  absentCount: number
  attendancePercent: number
  attendancePercentTone: 'good' | 'mid' | 'low'
}

export default function QuickStats({
  totalStudents,
  presentCount,
  absentCount,
  attendancePercent,
  attendancePercentTone,
}: QuickStatsProps) {
  return (
    <aside className="bg-white rounded-xl shadow-sm p-6 col-span-4 teacher-stats-card quick-stats-panel">
      <h2 className="teacher-card-title">Quick Stats</h2>
      <div className="space-y-5 teacher-stats-list">
        <div className="teacher-stat-item teacher-stat-item-total">
          <span className="teacher-stat-label">Total Students</span>
          <span className="teacher-stat-value teacher-stat-value-total">{totalStudents}</span>
        </div>
        <div className="teacher-stat-item teacher-stat-item-present">
          <span className="teacher-stat-label">Present</span>
          <span className="teacher-stat-value teacher-stat-value-present">{presentCount}</span>
        </div>
        <div className="teacher-stat-item teacher-stat-item-absent">
          <span className="teacher-stat-label">Absent</span>
          <span className="teacher-stat-value teacher-stat-value-absent">{absentCount}</span>
        </div>
        <div className="teacher-stat-item teacher-stat-item-rate">
          <span className="teacher-stat-label">Attendance %</span>
          <span className={`teacher-stat-value teacher-stat-value-rate ${attendancePercentTone}`}>
            {attendancePercent}%
          </span>
        </div>
      </div>
    </aside>
  )
}
