import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { getStudentFaceEmbedding } from '../../api'
import {
  averageDescriptors,
  collectFaceDescriptorSamples,
  extractFaceDescriptorWithRetry,
  findBestMatch,
  loadFaceModels,
  toStoredEmbedding,
  type StoredEmbedding,
} from '../../services/faceModelService'
import { attachCamera, releaseCamera } from '../../services/cameraService'

type StudentFaceRecognitionProps = {
  studentId: string
  isSessionActive: boolean
  onRecognized: () => Promise<void>
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

export default function StudentFaceRecognition({
  studentId,
  isSessionActive,
  onRecognized,
}: StudentFaceRecognitionProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [modelsReady, setModelsReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [faceVerified, setFaceVerified] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')

  const stopCamera = () => {
    setCameraReady(false)
    void releaseCamera()
  }

  useEffect(() => {
    const setup = async () => {
      try {
        await loadFaceModels()
        setModelsReady(true)
      } catch {
        setStatusMessage('Face models are missing. Add model files under /models.')
        toast.error('Face models failed to load.')
        return
      }

      try {
        const stored = await getStudentFaceEmbedding()
        if (stored.descriptor.length) {
          const next = [
            ...loadEmbeddings().filter((item) => item.studentId !== stored.studentId),
            stored,
          ]
          saveEmbeddings(next)
        }
      } catch {
        // Keep the local-storage fallback if backend embedding is not available yet.
      }
      setStatusMessage('')
    }
    void setup()
    return stopCamera
  }, [])

  const startCamera = async () => {
    try {
      if (!videoRef.current) return
      setCameraReady(false)
      await attachCamera(videoRef.current)
      setCameraReady(true)
      setStatusMessage('Camera ready. Keep your face centered before verification.')
    } catch (error) {
      setCameraReady(false)
      const message = error instanceof Error ? error.message : 'Unable to access camera.'
      setStatusMessage(message)
      toast.error(message)
    }
  }

  const getDescriptor = async () => {
    if (!videoRef.current) return null
    if (canvasRef.current) {
      const context = canvasRef.current.getContext('2d')
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth || 640
        canvasRef.current.height = videoRef.current.videoHeight || 480
        context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height)
        return extractFaceDescriptorWithRetry(canvasRef.current)
      }
    }
    return extractFaceDescriptorWithRetry(videoRef.current)
  }

  const handleEnrollFace = async () => {
    if (!cameraReady || !modelsReady) return
    setLoading(true)
    try {
      setStatusMessage('Capturing 3 face samples. Hold still and look at the camera...')
      const captureTarget =
        canvasRef.current && videoRef.current
          ? (() => {
              const context = canvasRef.current?.getContext('2d')
              if (context && videoRef.current) {
                canvasRef.current.width = videoRef.current.videoWidth || 640
                canvasRef.current.height = videoRef.current.videoHeight || 480
                context.drawImage(
                  videoRef.current,
                  0,
                  0,
                  canvasRef.current.width,
                  canvasRef.current.height,
                )
                return canvasRef.current
              }
              return videoRef.current
            })()
          : videoRef.current
      const samples = captureTarget
        ? await collectFaceDescriptorSamples(captureTarget, 3, 6, 300)
        : []
      if (samples.length < 2) {
        setStatusMessage('Unable to capture enough clear face samples. Improve lighting and retry.')
        toast.error('No face detected. Please look at the camera.')
        return
      }
      const descriptor = averageDescriptors(samples)
      const embedding = toStoredEmbedding(studentId, descriptor)
      const embeddings = loadEmbeddings()
      const next = [
        ...embeddings.filter((item) => item.studentId !== studentId),
        embedding,
      ]
      saveEmbeddings(next)
      setStatusMessage(`Face enrolled successfully using ${samples.length} samples.`)
      toast.success('Face enrolled successfully.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Face enrollment failed'
      setStatusMessage(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const handleRecognizeAndMark = async () => {
    if (!cameraReady || !modelsReady || !isSessionActive) return
    setLoading(true)
    try {
      setStatusMessage('Verifying face. Hold still for a moment...')
      const descriptor = await getDescriptor()
      if (!descriptor) {
        setStatusMessage('No clear face detected. Improve lighting and retry.')
        toast.error('No face detected. Please look at the camera.')
        return
      }
      const embeddings = loadEmbeddings()
      if (!embeddings.length) {
        setStatusMessage('No enrolled face was found for this student.')
        toast.error('Enroll a face first before verification.')
        return
      }
      const match = findBestMatch(descriptor, embeddings, 0.65)
      if (!match.studentId || match.studentId !== studentId) {
        setStatusMessage('Face did not match this student record.')
        toast.error('Face not recognized for this student.')
        return
      }
      setFaceVerified(true)
      await onRecognized()
      setStatusMessage(`Face verified with ${Math.round(match.similarity * 100)}% similarity.`)
      stopCamera()
      toast.success(`Face verified (${Math.round(match.similarity * 100)}%).`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Face recognition failed'
      setStatusMessage(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="face-student-panel">
      <div className="face-student-head">
        <strong>Face Recognition</strong>
        <span className="face-status">{faceVerified ? 'Verified' : 'Not verified'}</span>
      </div>
      <div className="face-student-video-wrap">
        <video ref={videoRef} muted playsInline className="face-student-video" />
        <canvas ref={canvasRef} className="spreadsheet-file-input" />
      </div>
      <div className="face-student-actions">
        <button
          type="button"
          className="btn"
          onClick={startCamera}
          disabled={loading}
        >
          Start Face Scan
        </button>
        <button
          type="button"
          className="btn btn-outline"
          onClick={handleEnrollFace}
          disabled={!cameraReady || !modelsReady || loading}
        >
          Enroll Face
        </button>
        <button
          type="button"
          className="btn"
          onClick={handleRecognizeAndMark}
          disabled={!cameraReady || !modelsReady || loading || !isSessionActive}
        >
          Face Verify &amp; Mark
        </button>
      </div>
      {statusMessage && <div className="muted compact-text">{statusMessage}</div>}
      {!isSessionActive && (
        <div className="muted compact-text">Session must be active for face attendance.</div>
      )}
    </div>
  )
}
