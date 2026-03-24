import Papa from 'papaparse'
import {
  createClass,
  createStudent,
  deleteStudent,
  listClasses,
  listStudentsWithAttendance,
  updateStudent,
  type ClassRecord,
  type StudentRecord,
  type StudentWithAttendance,
} from '../api'

type ParsedStudentRow = {
  id?: string
  name: string
  rollNumber: string
  department: string
  year: string
}

type StudentImportSummary = {
  imported: number
  failed: number
  failures: string[]
  total: number
}

export const listClassrooms = async (): Promise<ClassRecord[]> => listClasses()

export const provisionClassroom = async (name: string): Promise<ClassRecord> =>
  createClass(name)

export const listSpreadsheetStudents = async (
  classId: string,
): Promise<StudentWithAttendance[]> => (classId ? listStudentsWithAttendance(classId) : [])

export const createSpreadsheetStudent = async (payload: {
  id?: string
  name: string
  rollNumber: string
  department: string
  year: string
  classId: string
}): Promise<StudentRecord> => createStudent(payload)

export const updateSpreadsheetStudent = async (
  studentId: string,
  payload: {
    name: string
    rollNumber: string
    department: string
    year: string
    faceEmbedding?: number[] | number[][] | null
  },
): Promise<StudentRecord> => updateStudent(studentId, payload)

export const deleteSpreadsheetStudent = async (studentId: string) =>
  deleteStudent(studentId)

export const exportStudentsAsCsv = (students: StudentWithAttendance[]) => {
  const rows = [
    ['id', 'name', 'rollNumber', 'department', 'year', 'attendancePercent'],
    ...students.map((student) => [
      student.id,
      student.name,
      student.rollNumber ?? student.roll,
      student.department ?? '',
      student.year ?? '',
      String(student.attendance.percentage),
    ]),
  ]

  return rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(','),
    )
    .join('\n')
}

const normalizeHeader = (header: string) =>
  header.toLowerCase().replace(/[\s\r\n."']/g, '')

const getCellValue = (row: Record<string, unknown>, aliases: string[]) => {
  const entries = Object.entries(row)
  for (const [key, value] of entries) {
    if (aliases.includes(normalizeHeader(key))) {
      return String(value ?? '').trim()
    }
  }
  return ''
}

const normalizeParsedRows = (
  rows: Array<Record<string, unknown>>,
  defaults?: { department?: string; year?: string },
) =>
  rows.map((row, index) => {
    const rollNumber = getCellValue(row, ['roll', 'rollnumber', 'rollno'])
    const id = getCellValue(row, ['id', 'idno', 'studentid', 'studentidno'])
    const name = getCellValue(row, ['name', 'studentname'])
    const department =
      getCellValue(row, ['department', 'dept']) || defaults?.department?.trim() || ''
    const year = getCellValue(row, ['year']) || defaults?.year?.trim() || ''

    if (!rollNumber || !name) {
      throw new Error(`Row ${index + 2} is missing roll number or name`)
    }

    return { id: id || undefined, rollNumber, name, department, year }
  })

const parseStudentsCsvFile = (
  file: File,
  defaults?: { department?: string; year?: string },
): Promise<ParsedStudentRow[]> =>
  new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length) {
          reject(new Error(results.errors[0]?.message || 'Unable to parse CSV'))
          return
        }

        try {
          resolve(normalizeParsedRows(results.data, defaults))
        } catch (error: unknown) {
          reject(error)
        }
      },
      error: (error: Error) => reject(error),
    })
  })

const parseStudentsCsvText = (
  csvText: string,
  defaults?: { department?: string; year?: string },
): Promise<ParsedStudentRow[]> =>
  new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length) {
          reject(new Error(results.errors[0]?.message || 'Unable to parse CSV'))
          return
        }

        try {
          resolve(normalizeParsedRows(results.data, defaults))
        } catch (error: unknown) {
          reject(error)
        }
      },
      error: (error: Error) => reject(error),
    })
  })

const importStudentRows = async (
  rows: ParsedStudentRow[],
  classId: string,
): Promise<StudentImportSummary> => {
  const failures: string[] = []
  let imported = 0

  for (const row of rows) {
    try {
      await createSpreadsheetStudent({
        ...row,
        classId,
      })
      imported += 1
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Import failed'
      failures.push(`${row.rollNumber}: ${message}`)
    }
  }

  return {
    imported,
    failed: failures.length,
    failures,
    total: rows.length,
  }
}

const toGoogleSheetMeta = (input: string) => {
  const url = new URL(input.trim())
  if (!url.hostname.includes('docs.google.com')) {
    throw new Error('Enter a valid Google Sheets URL')
  }

  const match = url.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (!match) {
    throw new Error('Unable to read Google Sheet ID from the URL')
  }

  const sheetId = match[1]
  const gid = url.searchParams.get('gid') ?? undefined
  return { sheetId, gid }
}

const buildGoogleSheetCandidateUrls = (
  input: string,
  options?: { gid?: string; sheetName?: string },
) => {
  const { sheetId, gid: parsedGid } = toGoogleSheetMeta(input)
  const gid = options?.gid?.trim() || parsedGid
  const sheetName = options?.sheetName?.trim()
  const urls = new Set<string>()

  if (gid) {
    urls.add(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`)
    urls.add(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`)
  }

  if (sheetName) {
    urls.add(
      `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`,
    )
  }

  urls.add(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`)
  urls.add(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`)
  return Array.from(urls)
}

export const importStudentsFromCsv = async (
  file: File,
  classId: string,
  defaults?: { department?: string; year?: string },
) => {
  const rows = await parseStudentsCsvFile(file, defaults)
  return importStudentRows(rows, classId)
}

export const importStudentsFromGoogleSheet = async (
  sheetUrl: string,
  classId: string,
  defaults?: { department?: string; year?: string },
  options?: { gid?: string; sheetName?: string },
) => {
  const candidateUrls = buildGoogleSheetCandidateUrls(sheetUrl, options)
  let csvText = ''
  let lastError = 'Unable to fetch Google Sheet.'

  for (const candidateUrl of candidateUrls) {
    try {
      const response = await fetch(candidateUrl)
      if (!response.ok) {
        lastError = `Google Sheets responded with ${response.status}`
        continue
      }
      csvText = await response.text()
      if (csvText.trim()) {
        break
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unable to fetch Google Sheet.'
    }
  }

  if (!csvText.trim()) {
    throw new Error(
      `${lastError} Try providing the tab gid or tab name, or publish the sheet to the web.`,
    )
  }

  const rows = await parseStudentsCsvText(csvText, defaults)
  return importStudentRows(rows, classId)
}
