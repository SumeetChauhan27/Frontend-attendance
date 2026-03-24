let activeStream: MediaStream | null = null
let activeVideo: HTMLVideoElement | null = null

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

export const releaseCamera = async () => {
  if (activeVideo) {
    activeVideo.pause()
    activeVideo.srcObject = null
    activeVideo = null
  }

  if (activeStream) {
    activeStream.getTracks().forEach((track) => track.stop())
    activeStream = null
    await wait(300)
  }
}

export const attachCamera = async (video: HTMLVideoElement) => {
  const mediaDevices = navigator.mediaDevices
  if (!mediaDevices?.getUserMedia) {
    throw new Error(
      window.isSecureContext || window.location.hostname === 'localhost'
        ? 'Camera API is not available in this browser.'
        : 'Camera requires HTTPS or http://localhost. Open the app in a secure context and retry.',
    )
  }

  await releaseCamera()

  let stream: MediaStream
  try {
    stream = await mediaDevices.getUserMedia({ video: true, audio: false })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotReadableError') {
      throw new Error('Camera is already in use. Close other camera apps or tabs and retry.')
    }
    throw error
  }

  activeStream = stream
  activeVideo = video
  video.srcObject = stream
  await video.play()

  return stream
}
