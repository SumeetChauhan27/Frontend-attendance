import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { QRCodeSVG as QRCode } from 'qrcode.react'
import type { QrSessionStartResponse } from '../../api'
import { SessionStatus, type SessionStatus as SessionStatusValue } from '../../sessionLifecycle'
import { startQrAttendanceSession } from '../../services/sessionService'

type QRGeneratorProps = {
  sessionStatus: SessionStatusValue
  classId: string
  subject: string
  room?: string
}

const formatCountdown = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

export default function QRGenerator({
  sessionStatus,
  classId,
  subject,
  room = '',
}: QRGeneratorProps) {
  const [qrSession, setQrSession] = useState<QrSessionStartResponse | null>(null)
  const [countdownMs, setCountdownMs] = useState(0)
  const [error, setError] = useState('')
  const refreshInFlightRef = useRef(false)

  const refreshQrSession = useCallback(async () => {
    if (sessionStatus !== SessionStatus.ACTIVE) return
    if (!classId || !subject.trim()) return
    if (refreshInFlightRef.current) return
    refreshInFlightRef.current = true
    try {
      const result = await startQrAttendanceSession({
        classId,
        subject: subject.trim(),
        room: room.trim(),
      })
      setQrSession(result)
      setCountdownMs(Math.max(0, result.expiresAt - Date.now()))
      setError('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to generate QR'
      setError(message)
    } finally {
      refreshInFlightRef.current = false
    }
  }, [classId, room, sessionStatus, subject])

  useEffect(() => {
    if (sessionStatus !== SessionStatus.ACTIVE) {
      setQrSession(null)
      setCountdownMs(0)
      setError('')
      return
    }
    void refreshQrSession()
    const id = window.setInterval(() => {
      void refreshQrSession()
    }, 30000)
    return () => window.clearInterval(id)
  }, [refreshQrSession, sessionStatus])

  useEffect(() => {
    if (!qrSession || sessionStatus !== SessionStatus.ACTIVE) return
    const update = () => {
      const next = Math.max(0, qrSession.expiresAt - Date.now())
      setCountdownMs(next)
      if (next <= 0) {
        void refreshQrSession()
      }
    }
    update()
    const id = window.setInterval(update, 1000)
    return () => window.clearInterval(id)
  }, [qrSession, refreshQrSession, sessionStatus])

  const qrValue = useMemo(() => {
    if (!qrSession) return ''
    return JSON.stringify({
      sessionId: qrSession.sessionId,
      token: qrSession.token,
      expiresAt: qrSession.expiresAt,
    })
  }, [qrSession])

  if (sessionStatus !== SessionStatus.ACTIVE) {
    return (
      <div className="qr-disabled-note">
        Session must be active to generate QR
      </div>
    )
  }

  if (error) {
    return <div className="qr-disabled-note">{error}</div>
  }

  return (
    <div className="qr-panel">
      <div className="qr-code-wrap">
        {qrSession ? (
          <QRCode
            value={qrValue}
            size={220}
            bgColor="#ececf5"
            fgColor="#111827"
            level="H"
            includeMargin={false}
          />
        ) : (
          <div className="qr-disabled-note">Generating QR...</div>
        )}
      </div>
      <div className="qr-countdown">QR expires in {formatCountdown(countdownMs)}</div>
    </div>
  )
}
