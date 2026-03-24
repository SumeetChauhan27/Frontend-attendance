import { useEffect, useMemo, useState } from 'react'
import { SessionStatus } from '../sessionLifecycle'

const formatElapsed = (seconds: number) => {
  const hours = String(Math.floor(seconds / 3600)).padStart(2, '0')
  const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')
  const secs = String(seconds % 60).padStart(2, '0')
  return `${hours}:${minutes}:${secs}`
}

export const useSessionTimer = (
  startTime: Date | null,
  status: SessionStatus,
): string => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  useEffect(() => {
    if (!startTime || status !== SessionStatus.ACTIVE) {
      setElapsedSeconds(0)
      return
    }

    const sync = () => {
      const diff = Math.max(
        0,
        Math.floor((Date.now() - startTime.getTime()) / 1000),
      )
      setElapsedSeconds(diff)
    }

    sync()
    const id = window.setInterval(sync, 1000)
    return () => window.clearInterval(id)
  }, [startTime, status])

  return useMemo(() => formatElapsed(elapsedSeconds), [elapsedSeconds])
}
