import * as faceapi from 'face-api.js'
import '@tensorflow/tfjs'

const MODEL_URI = `${import.meta.env.BASE_URL}models`.replace(/\/{2,}/g, '/')
const DESCRIPTOR_LENGTH = 128
const DETECTOR_OPTIONS = new faceapi.TinyFaceDetectorOptions({
  inputSize: 416,
  scoreThreshold: 0.45,
})

let modelsLoaded = false
let modelsLoadingPromise: Promise<void> | null = null

export interface StoredEmbedding {
  studentId: string
  embeddings: number[][]
}

const assertDescriptorLength = (descriptor: ArrayLike<number>) => {
  if (descriptor.length !== DESCRIPTOR_LENGTH) {
    throw new Error(`Invalid descriptor length: expected ${DESCRIPTOR_LENGTH}`)
  }
}

export async function loadFaceModels(): Promise<void> {
  if (modelsLoaded) return
  if (modelsLoadingPromise) return modelsLoadingPromise

  modelsLoadingPromise = (async () => {
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URI),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URI),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URI),
      ])
      modelsLoaded = true
      console.log('Face models loaded successfully')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown model load error'
      throw new Error(`Failed to load face models from "${MODEL_URI}": ${message}`)
    }
  })()

  try {
    await modelsLoadingPromise
  } finally {
    modelsLoadingPromise = null
  }
}

export async function extractFaceDescriptor(
  image: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  checkQuality = false,
): Promise<Float32Array | null> {
  if (!modelsLoaded) {
    throw new Error('Face models are not loaded. Call loadFaceModels() first.')
  }

  const detection = await faceapi
    .detectSingleFace(image, DETECTOR_OPTIONS)
    .withFaceLandmarks()
    .withFaceDescriptor()

  if (!detection) return null

  if (checkQuality) {
    // Basic quality checks: box size
    const box = detection.detection.box
    if (box.width < 100 || box.height < 100) {
      throw new Error('Face too far or too low resolution. Move closer.')
    }
  }

  assertDescriptorLength(detection.descriptor)
  // Normalize descriptor immediately upon extraction
  return new Float32Array(normalize(Array.from(detection.descriptor)))
}

export async function waitForVideoReady(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
    return
  }

  await new Promise<void>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      cleanup()
      reject(new Error('Camera video did not become ready in time.'))
    }, 5000)

    const handleReady = () => {
      cleanup()
      resolve()
    }

    const cleanup = () => {
      window.clearTimeout(timeoutId)
      video.removeEventListener('loadeddata', handleReady)
      video.removeEventListener('canplay', handleReady)
    }

    video.addEventListener('loadeddata', handleReady, { once: true })
    video.addEventListener('canplay', handleReady, { once: true })
  })
}

export async function extractFaceDescriptorWithRetry(
  video: HTMLVideoElement | HTMLCanvasElement,
  attempts = 8,
  delayMs = 250,
  checkQuality = false,
): Promise<Float32Array | null> {
  if (video instanceof HTMLVideoElement) {
    await waitForVideoReady(video)
  }

  let lastError: Error | null = null

  for (let index = 0; index < attempts; index += 1) {
    try {
      const descriptor = await extractFaceDescriptor(video, checkQuality)
      if (descriptor) {
        return descriptor
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('too far')) {
         lastError = err
      }
    }

    if (index < attempts - 1) {
      await new Promise((resolve) => window.setTimeout(resolve, delayMs))
    }
  }

  if (lastError) throw lastError
  return null
}

export async function collectFaceDescriptorSamples(
  video: HTMLVideoElement | HTMLCanvasElement,
  sampleCount = 7,
  attemptsPerSample = 6,
  delayMs = 300,
): Promise<Float32Array[]> {
  const samples: Float32Array[] = []

  for (let index = 0; index < sampleCount; index += 1) {
    try {
      // Use strict quality checks during registration
      const descriptor = await extractFaceDescriptorWithRetry(video, attemptsPerSample, delayMs, true)
      if (!descriptor) {
        break
      }
      samples.push(descriptor)
    } catch (err) {
      console.warn('Sample collection failed:', err)
      break
    }

    if (index < sampleCount - 1) {
      // Pause to allow slight movement
      await new Promise((resolve) => window.setTimeout(resolve, 400))
    }
  }

  return samples
}

export function averageDescriptors(descriptors: Float32Array[]): Float32Array {
  if (!descriptors.length) {
    throw new Error('At least one descriptor is required.')
  }

  const total = new Float32Array(DESCRIPTOR_LENGTH)
  for (const descriptor of descriptors) {
    assertDescriptorLength(descriptor)
    for (let index = 0; index < DESCRIPTOR_LENGTH; index += 1) {
      total[index] += descriptor[index]
    }
  }

  for (let index = 0; index < DESCRIPTOR_LENGTH; index += 1) {
    total[index] /= descriptors.length
  }

  return new Float32Array(normalize(Array.from(total)))
}

export interface StoredEmbedding {
  studentId: string
  embeddings: number[][]
  averageEmbedding?: number[]
}

export function toStoredEmbedding(
  studentId: string,
  descriptors: Float32Array[],
): StoredEmbedding {
  descriptors.forEach(assertDescriptorLength)
  const average = averageDescriptors(descriptors)
  
  return {
    studentId,
    embeddings: descriptors.map(desc => Array.from(desc)),
    averageEmbedding: Array.from(average),
  }
}

export function normalize(vec: number[]): number[] {
  const mag = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0))
  if (mag === 0) return vec
  return vec.map(v => v / mag)
}

export function cosineSimilarityNormalized(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  const normA = normalize(a)
  const normB = normalize(b)
  let dotProduct = 0
  for (let i = 0; i < normA.length; i++) {
    dotProduct += normA[i] * normB[i]
  }
  return Math.min(Math.max(dotProduct, -1), 1)
}

export function findBestMatch(
  currentDescriptor: Float32Array,
  storedEmbeddings: StoredEmbedding[],
  threshold = 0.65,
): { studentId: string | null; similarity: number; status: 'accepted'|'retry'|'rejected' } {
  assertDescriptorLength(currentDescriptor)

  if (storedEmbeddings.length === 0) {
    return { studentId: null, similarity: 0, status: 'rejected' }
  }

  const current = normalize(Array.from(currentDescriptor))
  
  const matches: { studentId: string, score: number }[] = []

  for (const student of storedEmbeddings) {
    let bestForStudent = 0

    // Compare against average embedding if available
    if (student.averageEmbedding && student.averageEmbedding.length === DESCRIPTOR_LENGTH) {
      const avgScore = cosineSimilarityNormalized(current, student.averageEmbedding)
      bestForStudent = Math.max(bestForStudent, avgScore)
    }

    // Compare against all raw samples
    if (student.embeddings && Array.isArray(student.embeddings)) {
      for (const emb of student.embeddings) {
        if (!emb || emb.length !== DESCRIPTOR_LENGTH) continue
        const similarity = cosineSimilarityNormalized(current, emb)
        bestForStudent = Math.max(bestForStudent, similarity)
      }
    }
    
    matches.push({ studentId: student.studentId, score: bestForStudent })
  }

  // Sort matches descending
  matches.sort((a, b) => b.score - a.score)
  
  const bestMatch = matches[0]
  const secondBestMatch = matches.length > 1 ? matches[1] : null

  console.log(`[Face Match] Best: ${bestMatch.score.toFixed(3)} (${bestMatch.studentId}), Second: ${secondBestMatch ? secondBestMatch.score.toFixed(3) : 'N/A'}`)

  // Ambiguity check: prevent cross-matches for similar faces
  if (secondBestMatch && (bestMatch.score - secondBestMatch.score < 0.05) && bestMatch.score < 0.8) {
    console.warn('Face match rejected due to ambiguity (gap < 0.05).')
    return { studentId: null, similarity: bestMatch.score, status: 'rejected' }
  }

  let status: 'accepted' | 'retry' | 'rejected' = 'rejected'
  if (bestMatch.score >= threshold) {
    status = 'accepted'
  } else if (bestMatch.score >= 0.55) {
    status = 'retry'
  }

  return {
    studentId: status === 'accepted' ? bestMatch.studentId : null,
    similarity: bestMatch.score,
    status
  }
}
