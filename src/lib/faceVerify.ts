/**
 * In-browser face checks for online resident registration (prototype).
 *
 * Uses @vladmandic/face-api (TensorFlow.js) with models served from
 * /models/face. The library is loaded only when the registration page needs it.
 *
 * IMPORTANT: checks that run in the browser can be tampered with. In the backend
 * phase the server must repeat the comparison on the uploaded images before an
 * account is activated (NFR7). Here they decide auto-approval vs. manual review.
 */

type FaceApi = typeof import('@vladmandic/face-api')

let api: Promise<FaceApi> | null = null

export function loadFaceApi(): Promise<FaceApi> {
  if (!api) {
    api = (async () => {
      const faceapi = await import('@vladmandic/face-api')
      await (faceapi.tf as unknown as { ready: () => Promise<void> }).ready()
      const uri = `${import.meta.env.BASE_URL}models/face`
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(uri),
        faceapi.nets.ssdMobilenetv1.loadFromUri(uri),
        faceapi.nets.faceLandmark68Net.loadFromUri(uri),
        faceapi.nets.faceRecognitionNet.loadFromUri(uri),
      ])
      return faceapi
    })().catch((e) => {
      api = null
      throw e
    })
  }
  return api
}

export type Descriptor = Float32Array

/** Faces narrower than this (in pixels) are not compared. */
const MIN_FACE_PX = 48

/** Face descriptor from a still photo (ID card or selfie). Picks the largest face. */
export async function descriptorFromImage(src: string): Promise<Descriptor | null> {
  const faceapi = await loadFaceApi()
  const img = await loadImage(src)
  const results = await faceapi
    .detectAllFaces(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.35 }))
    .withFaceLandmarks()
    .withFaceDescriptors()
  if (!results.length) return null
  const biggest = results.reduce((a, b) => (b.detection.box.area > a.detection.box.area ? b : a))
  // Too small to compare reliably (blurry or far away): treat as "no clear face".
  if (biggest.detection.box.width < MIN_FACE_PX) return null
  return biggest.descriptor
}

/** Similarity 0–100 from the descriptor distance (0.0 identical … ~1.0 different). */
export async function similarity(a: Descriptor, b: Descriptor): Promise<{ distance: number; score: number }> {
  const faceapi = await loadFaceApi()
  const distance = faceapi.euclideanDistance(a, b)
  return { distance, score: Math.max(0, Math.min(100, Math.round((1 - distance) * 100))) }
}

/**
 * Same person (passed), uncertain (inconclusive), or different (failed).
 * Deliberately strict: in testing, different people scored 0.47 and up, so only
 * clear matches (≤ 0.45) are approved automatically; the rest go to the Secretary.
 */
export function faceVerdict(distance: number): 'passed' | 'inconclusive' | 'failed' {
  if (distance <= 0.45) return 'passed'
  if (distance <= 0.55) return 'inconclusive'
  return 'failed'
}

export interface LiveFrame {
  found: boolean
  /** Head turn: ~0.5 facing the camera, lower/higher when turned to a side. */
  yaw: number
  /** Face width relative to the frame width. */
  size: number
  /** Face centre offset from the frame centre (fraction of width/height). */
  offset: { x: number; y: number }
}

/** Fast single-face check on a live video frame (used for the liveness steps). */
export async function analyseFrame(video: HTMLVideoElement): Promise<LiveFrame> {
  const faceapi = await loadFaceApi()
  const r = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 })).withFaceLandmarks()
  if (!r) return { found: false, yaw: 0.5, size: 0, offset: { x: 0, y: 0 } }
  const p = r.landmarks.positions
  const leftEye = p[36]
  const rightEye = p[45]
  const nose = p[30]
  const span = rightEye.x - leftEye.x || 1
  const box = r.detection.box
  return {
    found: true,
    yaw: (nose.x - leftEye.x) / span,
    size: box.width / video.videoWidth,
    offset: { x: (box.x + box.width / 2) / video.videoWidth - 0.5, y: (box.y + box.height / 2) / video.videoHeight - 0.5 },
  }
}

/** Snapshot of the current video frame as a downscaled JPEG (not mirrored). */
export function captureFrame(video: HTMLVideoElement, maxSide = 560): string {
  const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight))
  const c = document.createElement('canvas')
  c.width = Math.round(video.videoWidth * scale)
  c.height = Math.round(video.videoHeight * scale)
  c.getContext('2d')!.drawImage(video, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.8)
}

/** Reads an uploaded image, fixes orientation and downscales it to a JPEG data URL. */
export async function fileToJpeg(file: File, maxSide = 1100, quality = 0.82): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bitmap.width * scale)
  c.height = Math.round(bitmap.height * scale)
  c.getContext('2d')!.drawImage(bitmap, 0, 0, c.width, c.height)
  bitmap.close()
  return c.toDataURL('image/jpeg', quality)
}

/** Smaller copy for storage (the review queue). */
export async function shrink(dataUrl: string, maxSide = 520, quality = 0.72): Promise<string> {
  const img = await loadImage(dataUrl)
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
  const c = document.createElement('canvas')
  c.width = Math.round(img.naturalWidth * scale)
  c.height = Math.round(img.naturalHeight * scale)
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', quality)
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('The image could not be read.'))
    img.src = src
  })
}
