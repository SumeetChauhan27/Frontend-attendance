import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import {
  collectFaceDescriptorSamples,
  loadFaceModels,
  toStoredEmbedding,
} from '../../services/faceModelService'
import { attachCamera, releaseCamera } from '../../services/cameraService'
import { updateSpreadsheetStudent } from '../../services/spreadsheetService'

type StudentFaceRegistrationProps = {
  studentId: string
  studentName: string
  department: string
  year: string
  rollNumber: string
  onClose: () => void
  onSaved: () => Promise<void>
}

export default function StudentFaceRegistration({
  studentId,
  studentName,
  department,
  year,
  rollNumber,
  onClose,
  onSaved,
}: StudentFaceRegistrationProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [modelsReady, setModelsReady] = useState(false)
  const [loading, setLoading] = useState(false)
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
      }
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
      setStatusMessage('Camera ready. Keep one face centered and well lit before capture.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to access camera.'
      setStatusMessage(message)
      toast.error(message)
    }
  }

  const handleRegister = async () => {
    if (!cameraReady || !modelsReady || !videoRef.current) return
    setLoading(true)
    try {
      setStatusMessage('Capturing 7 face samples. Please move your head slightly between captures...')
      const captureTarget = canvasRef.current ?? videoRef.current
      if (canvasRef.current) {
        const context = canvasRef.current.getContext('2d')
        if (context) {
          canvasRef.current.width = videoRef.current.videoWidth || 640
          canvasRef.current.height = videoRef.current.videoHeight || 480
          context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height)
        }
      }
      const samples = await collectFaceDescriptorSamples(captureTarget, 7, 6, 300)
      if (samples.length < 3) {
        setStatusMessage('Unable to capture enough clear face samples. Move closer and retry.')
        toast.error('Not enough clear face samples detected.')
        return
      }

      await updateSpreadsheetStudent(studentId, {
        name: studentName,
        rollNumber,
        department,
        year,
        faceEmbedding: toStoredEmbedding(studentId, samples) as any, // backend expects JSON string or array, it will stringify the object
      })

      await onSaved()
      setStatusMessage(`Face registered successfully using ${samples.length} samples.`)
      stopCamera()
      toast.success('Face registered successfully.')
      onClose()
    } catch (error) {
      let message = error instanceof Error ? error.message : 'Unable to register face.'
      if (error instanceof DOMException && error.name === 'NotReadableError') {
        message = 'Camera is already in use. Close other camera panels or apps and retry.'
      }
      setStatusMessage(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={() => {
        stopCamera()
        onClose()
      }}
    >
      <div
        className="modal details-modal face-registration-modal"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <h4>Register Face</h4>
        <div className="details-meta">{studentName} · {rollNumber}</div>
        <div className="face-student-video-wrap face-registration-video">
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
            onClick={() => void handleRegister()}
            disabled={!cameraReady || !modelsReady || loading}
          >
            Capture & Save
          </button>
        </div>
        {statusMessage ? <div className="muted compact-text">{statusMessage}</div> : null}
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              stopCamera()
              onClose()
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
