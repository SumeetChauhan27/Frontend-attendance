import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import type { StudentWithAttendance } from '../api'
import StudentFaceRegistration from '../components/dashboard/StudentFaceRegistration'
import {
  createSpreadsheetStudent,
  deleteSpreadsheetStudent,
  exportStudentsAsCsv,
  importStudentsFromCsv,
  listClassrooms,
  listSpreadsheetStudents,
  updateSpreadsheetStudent,
} from '../services/spreadsheetService'

type StudentSpreadsheetProps = {
  classId: string
  classNameName: string
  students: StudentWithAttendance[]
  onRefresh: () => Promise<void>
}

const emptyStudentForm = {
  name: '',
  rollNumber: '',
  department: '',
  year: '',
}

const emptyImportDefaults = {
  department: '',
  year: '',
}

export default function StudentSpreadsheet({
  classId,
  classNameName,
  students,
  onRefresh,
}: StudentSpreadsheetProps) {
  const [sheetStudents, setSheetStudents] = useState<StudentWithAttendance[]>(students)
  const [newStudent, setNewStudent] = useState(emptyStudentForm)
  const [editingId, setEditingId] = useState('')
  const [editingStudent, setEditingStudent] = useState(emptyStudentForm)
  const [importDefaults, setImportDefaults] = useState(emptyImportDefaults)
  const [submitting, setSubmitting] = useState(false)
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null)
  const [faceRegistrationStudent, setFaceRegistrationStudent] =
    useState<StudentWithAttendance | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setSheetStudents(students)
  }, [students])

  useEffect(() => {
    setEditingId('')
    setEditingStudent(emptyStudentForm)
    setFaceRegistrationStudent(null)
  }, [classId])

  const refreshSpreadsheet = async () => {
    await onRefresh()
  }

  const handleCreate = async () => {
    if (!classId) {
      toast.error('Select a class first.')
      return
    }
    if (!newStudent.name || !newStudent.rollNumber || !newStudent.department || !newStudent.year) {
      toast.error('Fill all student fields.')
      return
    }

    setSubmitting(true)
    try {
      const createdStudent = await createSpreadsheetStudent({
        ...newStudent,
        classId,
      })
      setSheetStudents((previous) => [
        ...previous,
        {
          ...createdStudent,
          role: 'STUDENT',
          roll: createdStudent.rollNumber,
          attendance: { present: 0, total: 0, percentage: 0 },
        },
      ])
      setNewStudent(emptyStudentForm)
      await refreshSpreadsheet()
      toast.success('Student added.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to add student')
    } finally {
      setSubmitting(false)
    }
  }

  const handleExport = () => {
    const csv = exportStudentsAsCsv(sheetStudents)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${classNameName || 'students'}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleImportPick = (file: File | null) => {
    if (!file) return
    if (!classId) {
      toast.error('Select a class first.')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    setPendingImportFile(file)
  }

  const handleImportConfirm = async () => {
    if (!pendingImportFile) return
    if (!importDefaults.department.trim() || !importDefaults.year.trim()) {
      toast.error('Enter department and year before importing.')
      return
    }

    setSubmitting(true)
    try {
      const result = await importStudentsFromCsv(pendingImportFile, classId, {
        department: importDefaults.department.trim(),
        year: importDefaults.year.trim(),
      })
      await refreshSpreadsheet()
      if (result.failed) {
        toast.success(`Imported ${result.imported} of ${result.total} students.`)
        toast.error(result.failures[0] || 'Some rows could not be imported.')
      } else {
        toast.success(`Imported ${result.imported} students.`)
      }
      setPendingImportFile(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to import CSV')
    } finally {
      setSubmitting(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const beginEdit = (student: StudentWithAttendance) => {
    setEditingId(student.id)
    setEditingStudent({
      name: student.name,
      rollNumber: student.rollNumber ?? student.roll,
      department: student.department ?? '',
      year: student.year ?? '',
    })
  }

  const handleSave = async (studentId: string) => {
    if (!editingStudent.name || !editingStudent.rollNumber || !editingStudent.department || !editingStudent.year) {
      toast.error('Fill all student fields before saving.')
      return
    }

    setSubmitting(true)
    try {
      const updatedStudent = await updateSpreadsheetStudent(studentId, editingStudent)
      setSheetStudents((previous) =>
        previous.map((student) =>
          student.id === studentId
            ? {
                ...student,
                ...updatedStudent,
                attendance: student.attendance,
              }
            : student,
        ),
      )
      setEditingId('')
      setEditingStudent(emptyStudentForm)
      await refreshSpreadsheet()
      toast.success('Student updated.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update student')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (studentId: string) => {
    const confirmed = window.confirm('Delete this student from the class?')
    if (!confirmed) return

    setSubmitting(true)
    try {
      setSheetStudents((previous) => previous.filter((student) => student.id !== studentId))
      await deleteSpreadsheetStudent(studentId)
      await refreshSpreadsheet()
      toast.success('Student deleted.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to delete student')
      await refreshSpreadsheet()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="spreadsheet-card">
      <div className="spreadsheet-head">
        <div>
          <h2>Student Spreadsheet</h2>
          <p>Manage students for class {classNameName || '--'}.</p>
        </div>
        <div className="spreadsheet-actions">
          <button
            type="button"
            className="btn btn-outline btn-xs"
            onClick={handleExport}
            disabled={!classId || sheetStudents.length === 0}
          >
            Export CSV
          </button>
          <button
            type="button"
            className="btn btn-outline btn-xs"
            disabled={submitting}
            onClick={() => fileInputRef.current?.click()}
          >
            Import Spreadsheet
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="spreadsheet-file-input"
            onChange={(event) => handleImportPick(event.target.files?.[0] ?? null)}
          />
        </div>
      </div>

      <div className="registration-grid">
        <div className="form-group">
          <label htmlFor="student-name-new">Name</label>
          <input
            id="student-name-new"
            value={newStudent.name}
            onChange={(event) =>
              setNewStudent((previous) => ({ ...previous, name: event.target.value }))
            }
            placeholder="Student name"
          />
        </div>
        <div className="form-group">
          <label htmlFor="student-roll-new">Roll Number</label>
          <input
            id="student-roll-new"
            value={newStudent.rollNumber}
            onChange={(event) =>
              setNewStudent((previous) => ({ ...previous, rollNumber: event.target.value }))
            }
            placeholder="e.g. 101"
          />
        </div>
        <div className="form-group">
          <label htmlFor="student-department-new">Department</label>
          <input
            id="student-department-new"
            value={newStudent.department}
            onChange={(event) =>
              setNewStudent((previous) => ({ ...previous, department: event.target.value }))
            }
            placeholder="e.g. CSE"
          />
        </div>
        <div className="form-group">
          <label htmlFor="student-year-new">Year</label>
          <input
            id="student-year-new"
            value={newStudent.year}
            onChange={(event) =>
              setNewStudent((previous) => ({ ...previous, year: event.target.value }))
            }
            placeholder="e.g. 2"
          />
        </div>
      </div>

      <div className="actions">
        <button type="button" className="btn" disabled={submitting} onClick={() => void handleCreate()}>
          Add Student Row
        </button>
      </div>

      <div className="info-banner">
        Use one import path: export or download your spreadsheet as <strong>CSV</strong> from
        Excel or Google Sheets, then click <strong>Import Spreadsheet</strong>. The app will ask
        for department and year before importing.
      </div>

      <div className="registration-grid">
        <div className="form-group">
          <label htmlFor="import-department-default">Import Department Default</label>
          <input
            id="import-department-default"
            value={importDefaults.department}
            onChange={(event) =>
              setImportDefaults((previous) => ({
                ...previous,
                department: event.target.value,
              }))
            }
            placeholder="Used when CSV/Sheet has no department column"
          />
        </div>
        <div className="form-group">
          <label htmlFor="import-year-default">Import Year Default</label>
          <input
            id="import-year-default"
            value={importDefaults.year}
            onChange={(event) =>
              setImportDefaults((previous) => ({
                ...previous,
                year: event.target.value,
              }))
            }
            placeholder="Used when CSV has no year column"
          />
        </div>
      </div>

      <div className="info-banner">
        Expected headers: <strong>roll,name,department,year</strong>. Institutional columns like
        <strong> Roll No.</strong>, <strong>ID No.</strong>, and <strong>Student Name</strong>
        are also accepted.
      </div>

      {!classId ? (
        <div className="info-banner">
          Select a class to connect the spreadsheet. Student rows, imports, exports, and face
          registration stay scoped to the active class.
        </div>
      ) : null}

      <div className="spreadsheet-table-wrap student-records-scroll">
        <table className="spreadsheet-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Roll Number</th>
              <th>Department</th>
              <th>Year</th>
              <th>Present</th>
              <th>Total</th>
              <th>%</th>
              <th>Face</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sheetStudents.map((student) => {
              const isEditing = editingId === student.id
              return (
                <tr key={student.id}>
                  <td>{student.id}</td>
                  <td>
                    {isEditing ? (
                      <input
                        value={editingStudent.name}
                        onChange={(event) =>
                          setEditingStudent((previous) => ({ ...previous, name: event.target.value }))
                        }
                      />
                    ) : (
                      student.name
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        value={editingStudent.rollNumber}
                        onChange={(event) =>
                          setEditingStudent((previous) => ({
                            ...previous,
                            rollNumber: event.target.value,
                          }))
                        }
                      />
                    ) : (
                      student.rollNumber ?? student.roll
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        value={editingStudent.department}
                        onChange={(event) =>
                          setEditingStudent((previous) => ({
                            ...previous,
                            department: event.target.value,
                          }))
                        }
                      />
                    ) : (
                      student.department ?? '--'
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        value={editingStudent.year}
                        onChange={(event) =>
                          setEditingStudent((previous) => ({ ...previous, year: event.target.value }))
                        }
                      />
                    ) : (
                      student.year ?? '--'
                    )}
                  </td>
                  <td>{student.attendance.present}</td>
                  <td>{student.attendance.total}</td>
                  <td>{student.attendance.percentage}%</td>
                  <td>
                    <div className="spreadsheet-face-cell">
                      <span>{student.faceEmbedding?.length ? 'Registered' : 'Not registered'}</span>
                      {!isEditing ? (
                        <button
                          type="button"
                          className="btn btn-outline btn-xs"
                          onClick={() => setFaceRegistrationStudent(student)}
                        >
                          Register Face
                        </button>
                      ) : null}
                    </div>
                  </td>
                  <td>
                    <div className="spreadsheet-row-actions">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            className="btn btn-xs"
                            disabled={submitting}
                            onClick={() => void handleSave(student.id)}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline btn-xs"
                            onClick={() => setEditingId('')}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn btn-outline btn-xs"
                            onClick={() => beginEdit(student)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline btn-xs"
                            disabled={submitting}
                            onClick={() => void handleDelete(student.id)}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {sheetStudents.length === 0 ? (
              <tr>
                <td colSpan={10} className="spreadsheet-empty">
                  {classId ? 'No students loaded for this class.' : 'Select a class to load students.'}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {faceRegistrationStudent ? (
        <StudentFaceRegistration
          studentId={faceRegistrationStudent.id}
          studentName={faceRegistrationStudent.name}
          rollNumber={faceRegistrationStudent.rollNumber ?? faceRegistrationStudent.roll}
          department={faceRegistrationStudent.department ?? ''}
          year={faceRegistrationStudent.year ?? ''}
          onClose={() => setFaceRegistrationStudent(null)}
          onSaved={onRefresh}
        />
      ) : null}
      {pendingImportFile ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setPendingImportFile(null)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <h4>Import Spreadsheet</h4>
            <div className="details-meta">{pendingImportFile.name}</div>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="import-confirm-department">Department</label>
                <input
                  id="import-confirm-department"
                  value={importDefaults.department}
                  onChange={(event) =>
                    setImportDefaults((previous) => ({
                      ...previous,
                      department: event.target.value,
                    }))
                  }
                  placeholder="e.g. CSE"
                />
              </div>
              <div className="form-group">
                <label htmlFor="import-confirm-year">Year</label>
                <input
                  id="import-confirm-year"
                  value={importDefaults.year}
                  onChange={(event) =>
                    setImportDefaults((previous) => ({
                      ...previous,
                      year: event.target.value,
                    }))
                  }
                  placeholder="e.g. 2"
                />
              </div>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setPendingImportFile(null)
                  if (fileInputRef.current) {
                    fileInputRef.current.value = ''
                  }
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                disabled={submitting}
                onClick={() => void handleImportConfirm()}
              >
                Import
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export function StudentSpreadsheetPage() {
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([])
  const [selectedClass, setSelectedClass] = useState('')
  const [students, setStudents] = useState<StudentWithAttendance[]>([])

  const refreshStudents = async (classId: string) => {
    if (!classId) {
      setStudents([])
      return
    }
    const rows = await listSpreadsheetStudents(classId)
    setStudents(rows)
  }

  useEffect(() => {
    const loadClasses = async () => {
      const classList = await listClassrooms()
      setClasses(classList)
      if (classList.length) {
        setSelectedClass((previous) => previous || classList[0].id)
      }
    }

    void loadClasses()
  }, [])

  useEffect(() => {
    void refreshStudents(selectedClass)
  }, [selectedClass])

  return (
    <div className="management-page-stack">
      <section className="spreadsheet-card management-class-panel">
        <div className="spreadsheet-head">
          <div>
            <h2>Student Management</h2>
            <p>Choose a class to manage student rows and imports.</p>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="management-student-class">Class</label>
          <select
            id="management-student-class"
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
      </section>

      <StudentSpreadsheet
        classId={selectedClass}
        classNameName={classes.find((item) => item.id === selectedClass)?.name ?? ''}
        students={students}
        onRefresh={() => refreshStudents(selectedClass)}
      />
    </div>
  )
}
