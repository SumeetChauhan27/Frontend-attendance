import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import type { ClassRecord, StudentWithAttendance } from '../api'
import StudentFaceRegistration from '../components/dashboard/StudentFaceRegistration'
import { listClassrooms, listSpreadsheetStudents } from '../services/spreadsheetService'

export default function FaceRegistration() {
  const [classes, setClasses] = useState<ClassRecord[]>([])
  const [selectedClass, setSelectedClass] = useState('')
  const [students, setStudents] = useState<StudentWithAttendance[]>([])
  const [selectedStudent, setSelectedStudent] = useState<StudentWithAttendance | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const refreshStudents = async (classId: string) => {
    if (!classId) {
      setStudents([])
      return
    }
    const items = await listSpreadsheetStudents(classId)
    setStudents(items)
  }

  useEffect(() => {
    const loadClasses = async () => {
      try {
        const classList = await listClassrooms()
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
    void refreshStudents(selectedClass)
  }, [selectedClass])

  const normalizedQuery = searchQuery.trim().toLowerCase()
  const filteredStudents = students.filter((student) => {
    if (!normalizedQuery) return true
    const roll = (student.rollNumber ?? student.roll ?? '').toLowerCase()
    const name = student.name.toLowerCase()
    return roll.includes(normalizedQuery) || name.includes(normalizedQuery)
  })

  return (
    <section className="spreadsheet-card">
      <div className="spreadsheet-head">
        <div>
          <h2>Face Registration</h2>
          <p>Register and maintain face data for students in the selected class.</p>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="face-class-select">Class</label>
        <select
          id="face-class-select"
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

      <div className="form-group">
        <label htmlFor="face-student-search">Search Student</label>
        <input
          id="face-student-search"
          type="text"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search by roll number or name, for example A42 or Ananya"
        />
      </div>

      <div className="details-list">
        {filteredStudents.map((student) => (
          <div key={student.id} className="details-row face-row">
            <div className="details-name">{student.name}</div>
            <div className="details-roll">{student.rollNumber ?? student.roll}</div>
            <div className="face-row-actions">
              <span className={`face-state ${student.faceEmbedding?.length ? 'ready' : 'missing'}`}>
                {student.faceEmbedding?.length ? 'Registered' : 'Missing'}
              </span>
              <button
                type="button"
                className="btn btn-outline btn-xs"
                onClick={() => setSelectedStudent(student)}
              >
                Register Face
              </button>
            </div>
          </div>
        ))}
        {selectedClass && students.length === 0 ? (
          <div className="info-banner">No students available for face registration.</div>
        ) : null}
        {selectedClass && students.length > 0 && filteredStudents.length === 0 ? (
          <div className="info-banner">
            No students match "{searchQuery.trim()}". Try a roll number like A42 or part of the
            student name.
          </div>
        ) : null}
      </div>

      {selectedStudent ? (
        <StudentFaceRegistration
          studentId={selectedStudent.id}
          studentName={selectedStudent.name}
          rollNumber={selectedStudent.rollNumber ?? selectedStudent.roll}
          department={selectedStudent.department ?? ''}
          year={selectedStudent.year ?? ''}
          onClose={() => setSelectedStudent(null)}
          onSaved={() => refreshStudents(selectedClass)}
        />
      ) : null}
    </section>
  )
}
