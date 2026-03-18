import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import toast, { Toaster } from 'react-hot-toast'
import {
  validateQrSession,
  markAttendanceSecure,
  getStudentFaceEmbedding,
  login,
  type QrSessionValidation,
} from '../api'
import {
  extractFaceDescriptorWithRetry,
  findBestMatch,
  loadFaceModels,
  type StoredEmbedding,
} from '../services/faceModelService'
import { attachCamera, releaseCamera } from '../services/cameraService'

type Step = 'VALIDATE' | 'AUTH' | 'FACE' | 'LOCATION' | 'SUBMIT' | 'SUCCESS' | 'ERROR'

const STEP_LABELS: Record<string, string> = {
  VALIDATE: 'Validating Session',
  AUTH: 'Student Login',
  FACE: 'Face Verification',
  LOCATION: 'Location Check',
  SUBMIT: 'Marking Attendance',
  SUCCESS: 'Attendance Marked',
  ERROR: 'Error',
}

const STEPS_ORDER: Step[] = ['VALIDATE', 'AUTH', 'FACE', 'LOCATION', 'SUBMIT', 'SUCCESS']

export default function QrAttendancePage() {
  const [params] = useSearchParams()
  const sessionId = params.get('sessionId') ?? ''
  const token = params.get('token') ?? ''

  const [step, setStep] = useState<Step>('VALIDATE')
  const [error, setError] = useState('')
  const [sessionInfo, setSessionInfo] = useState<QrSessionValidation | null>(null)

  // Auth state
  const [rollNumber, setRollNumber] = useState('')
  const [password, setPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [studentId, setStudentId] = useState('')

  // Face state
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [faceStatus, setFaceStatus] = useState('')
  const [faceLoading, setFaceLoading] = useState(false)
  const [faceVerified, setFaceVerified] = useState(false)

  // Location state
  const [locationStatus, setLocationStatus] = useState<'idle' | 'fetching' | 'done' | 'error'>('idle')
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)

  // Submit state
  const [, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ studentName: string } | null>(null)

  // Step 1: Validate QR session on mount
  useEffect(() => {
    if (!sessionId || !token) {
      setError('Invalid QR code — missing session data.')
      setStep('ERROR')
      return
    }

    const validate = async () => {
      try {
        const info = await validateQrSession(sessionId, token)
        setSessionInfo(info)
        setStep('AUTH')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Session validation failed.')
        setStep('ERROR')
      }
    }
    void validate()
  }, [sessionId, token])

  // Step 2: Student authentication
  const handleAuth = async () => {
    if (!rollNumber.trim()) {
      toast.error('Please enter your Roll Number.')
      return
    }
    setAuthLoading(true)
    try {
      const res = await login({
        role: 'STUDENT',
        id: rollNumber.trim(),
        password: password.trim() || rollNumber.trim(),
      })
      setStudentId(res.id)
      // Store token for face embedding fetch
      localStorage.setItem('auth_token', res.token)
      setStep('FACE')
      toast.success('Authenticated!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Login failed.')
    } finally {
      setAuthLoading(false)
    }
  }

  // Step 3: Face verification
  const startFaceVerification = useCallback(async () => {
    setFaceLoading(true)
    setFaceStatus('Loading face models...')
    try {
      await loadFaceModels()
      setFaceStatus('Starting camera...')

      if (!videoRef.current) {
        setFaceStatus('Camera element not ready.')
        setFaceLoading(false)
        return
      }

      await attachCamera(videoRef.current)
      setFaceStatus('Camera ready. Keep your face centered and click "Verify Face".')
    } catch (err) {
      setFaceStatus(err instanceof Error ? err.message : 'Failed to start camera.')
      toast.error('Camera or model error.')
    } finally {
      setFaceLoading(false)
    }
  }, [])

  useEffect(() => {
    if (step === 'FACE') {
      void startFaceVerification()
    }
    return () => {
      if (step === 'FACE') void releaseCamera()
    }
  }, [step, startFaceVerification])

  const handleFaceVerify = async () => {
    if (!videoRef.current) return
    setFaceLoading(true)
    setFaceStatus('Capturing face...')

    try {
      // Get stored embedding from backend
      let storedEmbedding: StoredEmbedding | null = null
      try {
        const embeddingData = await getStudentFaceEmbedding()
        if (embeddingData.descriptor.length) {
          storedEmbedding = embeddingData
        }
      } catch {
        // fallback: check localStorage
      }

      if (!storedEmbedding) {
        setFaceStatus('No face enrollment found. Ask your teacher to register your face first.')
        toast.error('No face enrollment found.')
        setFaceLoading(false)
        return
      }

      // Capture descriptor from live video
      let descriptor: Float32Array | null = null
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d')
        if (ctx && videoRef.current) {
          canvasRef.current.width = videoRef.current.videoWidth || 640
          canvasRef.current.height = videoRef.current.videoHeight || 480
          ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height)
          descriptor = await extractFaceDescriptorWithRetry(canvasRef.current)
        }
      }
      if (!descriptor && videoRef.current) {
        descriptor = await extractFaceDescriptorWithRetry(videoRef.current)
      }

      if (!descriptor) {
        setFaceStatus('No face detected. Position your face clearly and try again.')
        toast.error('No face detected.')
        setFaceLoading(false)
        return
      }

      const match = findBestMatch(descriptor, [storedEmbedding], 0.6)

      if (!match.studentId) {
        setFaceStatus(`Face did not match (${Math.round(match.similarity * 100)}% similarity).`)
        toast.error('Face verification failed.')
        setFaceLoading(false)
        return
      }

      setFaceVerified(true)
      setFaceStatus(`Face verified! (${Math.round(match.similarity * 100)}% match)`)
      toast.success(`Face verified (${Math.round(match.similarity * 100)}%).`)
      void releaseCamera()

      // Auto-advance to location step
      setTimeout(() => setStep('LOCATION'), 800)
    } catch (err) {
      setFaceStatus(err instanceof Error ? err.message : 'Face verification error.')
      toast.error('Face verification error.')
    } finally {
      setFaceLoading(false)
    }
  }

  // Step 4: Geolocation
  useEffect(() => {
    if (step !== 'LOCATION') return
    if (!navigator.geolocation) {
      setLocationStatus('error')
      // Skip geo if unavailable, proceed anyway
      setTimeout(() => setStep('SUBMIT'), 500)
      return
    }

    setLocationStatus('fetching')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocationStatus('done')
        toast.success('Location captured!')
        setTimeout(() => setStep('SUBMIT'), 600)
      },
      () => {
        setLocationStatus('error')
        toast.error('Location unavailable — proceeding without.')
        setTimeout(() => setStep('SUBMIT'), 500)
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }, [step])

  // Step 5: Submit
  useEffect(() => {
    if (step !== 'SUBMIT') return
    const submit = async () => {
      setSubmitting(true)
      try {
        const res = await markAttendanceSecure({
          studentId,
          password: password.trim() || rollNumber.trim(),
          sessionId,
          token,
          faceVerified,
          location,
        })
        setResult({ studentName: res.studentName })
        setStep('SUCCESS')
        toast.success('Attendance marked!')
        // Clear auth token
        localStorage.removeItem('auth_token')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to mark attendance.')
        setStep('ERROR')
        localStorage.removeItem('auth_token')
      } finally {
        setSubmitting(false)
      }
    }
    void submit()
  }, [step, studentId, sessionId, token, faceVerified, location, password, rollNumber])

  const getStepIndex = (s: Step) => STEPS_ORDER.indexOf(s)
  const currentIndex = getStepIndex(step)

  return (
    <div className="attend-page">
      <Toaster position="bottom-center" />
      <div className="attend-container">
        <div className="attend-header">
          <div className="attend-logo">AMS</div>
          <h1>Secure Attendance</h1>
          <p className="attend-subtitle">Multi-layer verification</p>
        </div>

        {/* Stepper */}
        <div className="attend-stepper">
          {STEPS_ORDER.slice(0, -1).map((s, i) => {
            const isActive = step === s
            const isPassed = currentIndex > i || step === 'SUCCESS'
            const isFailed = step === 'ERROR' && currentIndex <= i
            let cls = 'attend-step-dot'
            if (isPassed) cls += ' passed'
            else if (isActive) cls += ' active'
            else if (isFailed) cls += ' failed'

            return (
              <div key={s} className="attend-step-item">
                <div className={cls}>
                  {isPassed ? '✓' : i + 1}
                </div>
                <span className={`attend-step-label ${isActive ? 'active' : ''}`}>
                  {STEP_LABELS[s]}
                </span>
                {i < STEPS_ORDER.length - 2 && <div className={`attend-step-line ${isPassed ? 'passed' : ''}`} />}
              </div>
            )
          })}
        </div>

        {/* Session Info Bar */}
        {sessionInfo && step !== 'VALIDATE' && step !== 'ERROR' && (
          <div className="attend-session-bar">
            <span>📚 {sessionInfo.subject}</span>
            {sessionInfo.room && <span>🏫 Room {sessionInfo.room}</span>}
            <span>🔐 Secure Session</span>
          </div>
        )}

        {/* Step Content */}
        <div className="attend-content">
          {/* VALIDATE */}
          {step === 'VALIDATE' && (
            <div className="attend-card">
              <div className="attend-spinner" />
              <h2>Validating Session...</h2>
              <p className="attend-muted">Checking QR code and session status</p>
            </div>
          )}

          {/* AUTH */}
          {step === 'AUTH' && (
            <div className="attend-card">
              <h2>🔑 Student Login</h2>
              <p className="attend-muted">Enter your credentials to verify identity</p>
              <div className="attend-form">
                <div className="attend-field">
                  <label htmlFor="attend-roll">Roll Number / Student ID</label>
                  <input
                    id="attend-roll"
                    type="text"
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value)}
                    placeholder="e.g. A42"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && void handleAuth()}
                  />
                </div>
                <div className="attend-field">
                  <label htmlFor="attend-pass">Password</label>
                  <input
                    id="attend-pass"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    onKeyDown={(e) => e.key === 'Enter' && void handleAuth()}
                  />
                </div>
                <button
                  type="button"
                  className="attend-btn attend-btn-primary"
                  onClick={() => void handleAuth()}
                  disabled={authLoading}
                >
                  {authLoading ? 'Verifying...' : 'Login & Continue →'}
                </button>
              </div>
            </div>
          )}

          {/* FACE */}
          {step === 'FACE' && (
            <div className="attend-card">
              <h2>🤖 Face Verification</h2>
              <p className="attend-muted">Look directly at the camera for face recognition</p>
              <div className="attend-video-wrap">
                <video ref={videoRef} muted playsInline className="attend-video" />
                <canvas ref={canvasRef} style={{ display: 'none' }} />
              </div>
              {faceStatus && <p className="attend-face-status">{faceStatus}</p>}
              <button
                type="button"
                className="attend-btn attend-btn-primary"
                onClick={() => void handleFaceVerify()}
                disabled={faceLoading}
              >
                {faceLoading ? 'Processing...' : '📷 Verify Face'}
              </button>
            </div>
          )}

          {/* LOCATION */}
          {step === 'LOCATION' && (
            <div className="attend-card">
              <h2>📍 Location Verification</h2>
              <p className="attend-muted">Verifying you are physically present in class</p>
              <div className="attend-spinner" />
              {locationStatus === 'fetching' && <p className="attend-muted">Getting your location...</p>}
              {locationStatus === 'done' && <p className="attend-success-text">✓ Location captured</p>}
              {locationStatus === 'error' && <p className="attend-warn-text">⚠ Location unavailable</p>}
            </div>
          )}

          {/* SUBMIT */}
          {step === 'SUBMIT' && (
            <div className="attend-card">
              <div className="attend-spinner" />
              <h2>Marking Attendance...</h2>
              <p className="attend-muted">Submitting your verified attendance</p>
            </div>
          )}

          {/* SUCCESS */}
          {step === 'SUCCESS' && (
            <div className="attend-card attend-card-success">
              <div className="attend-success-icon">✓</div>
              <h2>Attendance Marked!</h2>
              <p className="attend-muted">
                {result?.studentName && <><strong>{result.studentName}</strong> — </>}
                Your attendance has been recorded successfully.
              </p>
              <div className="attend-verify-badges">
                <span className="attend-badge attend-badge-pass">🔐 QR Valid</span>
                <span className="attend-badge attend-badge-pass">🔑 Authenticated</span>
                <span className="attend-badge attend-badge-pass">🤖 Face Matched</span>
                <span className={`attend-badge ${location ? 'attend-badge-pass' : 'attend-badge-warn'}`}>
                  📍 {location ? 'Location OK' : 'No GPS'}
                </span>
              </div>
            </div>
          )}

          {/* ERROR */}
          {step === 'ERROR' && (
            <div className="attend-card attend-card-error">
              <div className="attend-error-icon">✗</div>
              <h2>Attendance Failed</h2>
              <p className="attend-error-msg">{error}</p>
              <button
                type="button"
                className="attend-btn attend-btn-outline"
                onClick={() => window.location.reload()}
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
