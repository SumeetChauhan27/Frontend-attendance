import * as faceapi from 'face-api.js'
import '@tensorflow/tfjs'
import { cosineSimilarity } from '../utils/compareEmbeddings'

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
  descriptor: number[]
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
): Promise<Float32Array | null> {
  if (!modelsLoaded) {
    throw new Error('Face models are not loaded. Call loadFaceModels() first.')
  }

  const detection = await faceapi
    .detectSingleFace(image, DETECTOR_OPTIONS)
    .withFaceLandmarks()
    .withFaceDescriptor()

  if (!detection) return null

  assertDescriptorLength(detection.descriptor)
  return detection.descriptor
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
): Promise<Float32Array | null> {
  if (video instanceof HTMLVideoElement) {
    await waitForVideoReady(video)
  }

  for (let index = 0; index < attempts; index += 1) {
    const descriptor = await extractFaceDescriptor(video)
    if (descriptor) {
      return descriptor
    }

    if (index < attempts - 1) {
      await new Promise((resolve) => window.setTimeout(resolve, delayMs))
    }
  }

  return null
}

export async function collectFaceDescriptorSamples(
  video: HTMLVideoElement | HTMLCanvasElement,
  sampleCount = 3,
  attemptsPerSample = 6,
  delayMs = 300,
): Promise<Float32Array[]> {
  const samples: Float32Array[] = []

  for (let index = 0; index < sampleCount; index += 1) {
    const descriptor = await extractFaceDescriptorWithRetry(video, attemptsPerSample, delayMs)
    if (!descriptor) {
      break
    }
    samples.push(descriptor)

    if (index < sampleCount - 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 250))
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

  return total
}

export function toStoredEmbedding(
  studentId: string,
  descriptor: Float32Array,
): StoredEmbedding {
  assertDescriptorLength(descriptor)
  return {
    studentId,
    descriptor: Array.from(descriptor),
  }
}

export function findBestMatch(
  currentDescriptor: Float32Array,
  storedEmbeddings: StoredEmbedding[],
  threshold = 0.6,
): { studentId: string | null; similarity: number } {
  assertDescriptorLength(currentDescriptor)

  if (storedEmbeddings.length === 0) {
    return { studentId: null, similarity: 0 }
  }

  let bestStudentId: string | null = null
  let bestSimilarity = 0
  const current = Array.from(currentDescriptor)

  for (const embedding of storedEmbeddings) {
    assertDescriptorLength(embedding.descriptor)
    const similarity = cosineSimilarity(current, embedding.descriptor)
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity
      bestStudentId = embedding.studentId
    }
  }

  if (bestSimilarity > threshold) {
    return { studentId: bestStudentId, similarity: bestSimilarity }
  }

  return { studentId: null, similarity: bestSimilarity }
}
