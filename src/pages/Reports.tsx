import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { listClasses, listSessionsByClass, type ClassRecord, type SessionSummary } from '../api'

export default function Reports() {
  const [classes, setClasses] = useState<ClassRecord[]>([])
  const [selectedClass, setSelectedClass] = useState('')
  const [sessions, setSessions] = useState<SessionSummary[]>([])

  useEffect(() => {
    const loadClasses = async () => {
      try {
        const classList = await listClasses()
        setClasses(classList)
        if (classList.length) {
          setSelectedClass((previous) => previous || classList[0].id)
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Unable to load classes')
      }
    }

    void loadClasses()
  }, [])

  useEffect(() => {
    const loadReports = async () => {
      if (!selectedClass) {
        setSessions([])
        return
      }

      try {
        const reportRows = await listSessionsByClass(selectedClass)
        setSessions(reportRows)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Unable to load reports')
      }
    }

    void loadReports()
  }, [selectedClass])

  return (
    <section className="spreadsheet-card">
      <div className="spreadsheet-head">
        <div>
          <h2>Attendance Reports</h2>
          <p>Review recent attendance sessions for the selected class.</p>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="reports-class-select">Class</label>
        <select
          id="reports-class-select"
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

      <div className="details-list">
        {sessions.map((session) => (
          <div key={session.id} className="details-row reports-row">
            <div className="details-name">{session.subject}</div>
            <div className="details-roll">{session.timing}</div>
            <div className="details-id">{session.presentCount} present</div>
          </div>
        ))}
        {selectedClass && sessions.length === 0 ? (
          <div className="info-banner">No attendance reports found for this class.</div>
        ) : null}
      </div>
    </section>
  )
}
