import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { registerStudentFaceEmbedding, matchFace } from '../../api'
import {
  collectFaceDescriptorSamples,
  cosineSimilarityNormalized,
  extractFaceDescriptorWithRetry,
  loadFaceModels,
} from '../../services/faceModelService'
import { attachCamera, releaseCamera } from '../../services/cameraService'

type StudentFaceRecognitionProps = {
  studentId: string
  isSessionActive: boolean
  onRecognized: () => Promise<void>
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
      setStatusMessage('Capturing 7 face samples. Hold still and look at the camera...')
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
        ? await collectFaceDescriptorSamples(captureTarget, 7, 6, 300)
        : []
      if (samples.length < 3) {
        setStatusMessage('Unable to capture enough clear face samples. Improve lighting and retry.')
        toast.error('Not enough face samples captured. Please look at the camera.')
        return
      }
      
      const arrays = samples.map(s => Array.from(s))
      await registerStudentFaceEmbedding(arrays)
      
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
      setStatusMessage('Verifying face via secure backend match. Hold still...')
      const descriptor1 = await getDescriptor()
      if (!descriptor1) {
        setStatusMessage('No clear face detected. Improve lighting and retry.')
        toast.error('No face detected. Please look at the camera.')
        return
      }

      setStatusMessage('Liveness check: analyzing slight movement...')
      // Wait 600ms to allow minor natural movements
      await new Promise(resolve => setTimeout(resolve, 600))
      
      const descriptor2 = await getDescriptor()
      if (!descriptor2) {
        setStatusMessage('Liveness check failed. Keep face in frame.')
        toast.error('Liveness check failed.')
        return
      }

      // Liveness and anti-spoof check
      const freshness = cosineSimilarityNormalized(
        Array.from(descriptor1),
        Array.from(descriptor2)
      )
      
      if (freshness > 0.99) {
        setStatusMessage('Liveness check failed. Static image detected.')
        toast.error('Spoof detected! Please blink or slightly move your head.')
        return
      }
      
      if (freshness < 0.85) {
        setStatusMessage('Liveness check failed. Face changed too much.')
        toast.error('Movement too fast or face lost.')
        return
      }

      const match = await matchFace(Array.from(descriptor1))
      
      if (match.status === 'rejected' || !match.studentId) {
        setStatusMessage('Face did not match this student record or no clear match found.')
        toast.error('Face verification failed.')
        return
      }
      
      if (match.status === 'retry') {
        setStatusMessage('Face match was weakly confident. Please improve lighting and try again.')
        toast.error('Verification uncertain. Please try again.')
        return
      }
      
      if (match.studentId !== studentId) {
        setStatusMessage('Face belongs to another registered student. Proxy attempt blocked.')
        toast.error('Identity verification failed (Spoof detected).')
        return
      }

      setFaceVerified(true)
      await onRecognized()
      setStatusMessage(`Face securely verified with ${Math.round(match.similarity * 100)}% similarity.`)
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
