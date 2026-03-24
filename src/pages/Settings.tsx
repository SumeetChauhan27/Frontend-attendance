export default function Settings() {
  return (
    <section className="spreadsheet-card">
      <div className="spreadsheet-head">
        <div>
          <h2>System Settings</h2>
          <p>Configuration options for the teacher workspace.</p>
        </div>
      </div>

      <div className="admin-stats">
        <div className="admin-stat">
          Attendance sessions follow the active class and timetable configuration.
        </div>
        <div className="admin-stat">
          Face recognition relies on local browser camera access and bundled model files.
        </div>
        <div className="admin-stat">
          Additional settings controls can be added here as backend configuration becomes available.
        </div>
      </div>
    </section>
  )
}
