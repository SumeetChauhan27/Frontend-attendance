import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import type { AttendanceRecord, StudentWithAttendance } from '../../api'
import { markTeacherAttendanceByFace } from '../../services/attendanceService'
import {
  extractFaceDescriptorWithRetry,
  findBestMatch,
  loadFaceModels,
  toStoredEmbedding,
  type StoredEmbedding,
} from '../../services/faceModelService'
import { attachCamera, releaseCamera } from '../../services/cameraService'

type FaceAttendancePanelProps = {
  isAttendanceEnabled: boolean
  sessionId: string
  students: StudentWithAttendance[]
  attendance: AttendanceRecord[]
  onAttendanceMarked: () => Promise<void>
}

const STORAGE_KEY = 'attendance_face_embeddings'

const loadEmbeddings = (): StoredEmbedding[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as StoredEmbedding[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const saveEmbeddings = (items: StoredEmbedding[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export default function FaceAttendancePanel({
  isAttendanceEnabled,
  sessionId,
  students,
  attendance,
  onAttendanceMarked,
}: FaceAttendancePanelProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [modelsReady, setModelsReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [lastMatch, setLastMatch] = useState<{ studentId: string; similarity: number } | null>(null)

  const stopCamera = () => {
    setCameraReady(false)
    void releaseCamera()
  }

  const registeredStudents = useMemo(
    () =>
      students.filter(
        (student) => Array.isArray(student.faceEmbedding) && student.faceEmbedding.length > 0,
      ),
    [students],
  )

  const presentIds = useMemo(
    () => new Set(attendance.map((record) => record.studentId)),
    [attendance],
  )

  const registeredEmbeddings = useMemo(() => {
    const current = loadEmbeddings()
    return [
      ...current.filter((item) => !registeredStudents.some((student) => student.id === item.studentId)),
      ...registeredStudents.map((student) => ({
        studentId: student.id,
        descriptor: student.faceEmbedding ?? [],
      })),
    ].filter((item) => item.descriptor.length > 0)
  }, [registeredStudents])

  useEffect(() => {
    const setup = async () => {
      try {
        await loadFaceModels()
        setModelsReady(true)
      } catch {
        setStatusMessage('Face models are missing. Add model files under /models.')
      }
    }

    void setup()

    return stopCamera
  }, [])

  useEffect(() => {
    saveEmbeddings(registeredEmbeddings)
  }, [registeredEmbeddings])

  const startCamera = async () => {
    try {
      if (!videoRef.current) return
      setCameraReady(false)
      await attachCamera(videoRef.current)
      setCameraReady(true)
      setStatusMessage('Camera ready. Keep one student face centered before scanning.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to access camera.'
      setStatusMessage(message)
      toast.error(message)
    }
  }

  const handleRecognize = async () => {
    if (!isAttendanceEnabled || !cameraReady || !modelsReady || !videoRef.current || !sessionId) return

    setLoading(true)
    try {
      if (!registeredEmbeddings.length) {
        setStatusMessage('No registered student faces are available for this class.')
        toast.error('No registered student faces are available for this class.')
        return
      }

      setStatusMessage('Scanning face. Hold still for a moment...')
      let captureTarget: HTMLVideoElement | HTMLCanvasElement = videoRef.current
      if (canvasRef.current) {
        const context = canvasRef.current.getContext('2d')
        if (context) {
          canvasRef.current.width = videoRef.current.videoWidth || 640
          canvasRef.current.height = videoRef.current.videoHeight || 480
          context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height)
          captureTarget = canvasRef.current
        }
      }

      const descriptor = await extractFaceDescriptorWithRetry(captureTarget)
      if (!descriptor) {
        setStatusMessage('No clear face detected. Move closer, improve lighting, and retry.')
        toast.error('No face detected. Keep one student face centered in the frame.')
        return
      }

      const match = findBestMatch(descriptor, registeredEmbeddings)
      if (!match.studentId) {
        setLastMatch(null)
        setStatusMessage('Face not recognized. Try better lighting or re-register the student face.')
        toast.error('Face not recognized.')
        return
      }

      const matchedStudent = students.find((student) => student.id === match.studentId)
      if (!matchedStudent) {
        toast.error('Matched student record was not found.')
        return
      }

      setLastMatch({ studentId: match.studentId, similarity: match.similarity })
      saveEmbeddings([
        ...loadEmbeddings().filter((item) => item.studentId !== match.studentId),
        toStoredEmbedding(match.studentId, descriptor),
      ])

      if (presentIds.has(match.studentId)) {
        setStatusMessage(`${matchedStudent.name} is already marked present for this session.`)
        toast('Attendance already marked.')
        return
      }

      await markTeacherAttendanceByFace({
        studentId: match.studentId,
        sessionId,
      })
      await onAttendanceMarked()
      stopCamera()
      setStatusMessage(
        `${matchedStudent.name} marked present with ${(match.similarity * 100).toFixed(1)}% similarity.`,
      )
      toast.success(`Marked ${matchedStudent.name} present.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to complete face attendance.'
      setStatusMessage(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const lastMatchedStudent = lastMatch
    ? students.find((student) => student.id === lastMatch.studentId)
    : null

  if (!isAttendanceEnabled) {
    return <div className="qr-disabled-note">Session must be active to use face attendance.</div>
  }

  return (
    <div className="face-student-panel">
      <div className="face-student-head">
        <div>
          <strong>Live face attendance</strong>
          <div className="muted compact-text">
            {registeredStudents.length} registered of {students.length} students in this class
          </div>
        </div>
        <span className="face-status">{modelsReady ? 'Models Ready' : 'Loading Models'}</span>
      </div>

      <div className="face-student-video-wrap">
        <video ref={videoRef} muted playsInline className="face-student-video" />
        <canvas ref={canvasRef} className="spreadsheet-file-input" />
      </div>

      <div className="face-student-actions">
        <button type="button" className="btn" onClick={startCamera} disabled={loading}>
          Open Webcam
        </button>
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => void handleRecognize()}
          disabled={!cameraReady || !modelsReady || loading || !registeredEmbeddings.length}
        >
          Scan & Mark
        </button>
      </div>

      {lastMatchedStudent ? (
        <div className="teacher-live-meta active">
          Last match: {lastMatchedStudent.name} ({lastMatchedStudent.rollNumber ?? lastMatchedStudent.roll})
          {lastMatch ? ` · ${(lastMatch.similarity * 100).toFixed(1)}% similarity` : ''}
        </div>
      ) : null}

      {statusMessage ? <div className="teacher-live-meta">{statusMessage}</div> : null}
    </div>
  )
}
