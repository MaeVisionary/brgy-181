import { IMAGE_MAX_SIDE, JPEG_QUALITY, UPLOAD_TYPES, type UploadKind } from '@/config/uploads'

/**
 * Upload validation, independent of where files are stored. The file's real
 * content (its first bytes) decides the type, not the name or the browser's
 * guess, so a renamed program is rejected.
 */

const mb = (n: number) => `${Math.round((n / 1024 / 1024) * 10) / 10} MB`
export const formatBytes = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : mb(n))

async function head(file: Blob, n = 16): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(0, n).arrayBuffer())
}

/** Detects PDF, JPEG or PNG from the file signature; HEIC is reported so the user can be told how to fix it. */
export async function sniff(file: Blob): Promise<UploadKind | 'heic' | null> {
  const b = await head(file)
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) return 'pdf' // %PDF-
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg'
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'png'
  const brand = String.fromCharCode(...b.slice(4, 12))
  if (brand.startsWith('ftyp') && /heic|heix|hevc|mif1|msf1/.test(brand.slice(4))) return 'heic'
  return null
}

/** A PDF must also end with its end-of-file marker; a cut-off or corrupted file usually does not. */
async function pdfLooksComplete(file: Blob): Promise<boolean> {
  const tail = new TextDecoder().decode(await file.slice(Math.max(0, file.size - 1024)).arrayBuffer())
  return tail.includes('%%EOF')
}

export interface CheckedFile {
  file: File
  kind: UploadKind
}

/** Returns the checked file, or a short message the resident can act on. */
export async function checkUpload(file: File): Promise<CheckedFile | { error: string }> {
  const kind = await sniff(file)
  if (kind === 'heic') return { error: 'iPhone HEIC photos are not accepted. Use JPG instead (Settings → Camera → Formats → Most Compatible), or take a screenshot of the photo.' }
  if (!kind) return { error: 'Only PDF, JPG or PNG files are accepted.' }
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!UPLOAD_TYPES[kind].ext.includes(ext)) return { error: `This file is not a real ${ext.toUpperCase() || 'document'} file. Only PDF, JPG or PNG files are accepted.` }
  if (kind === 'pdf' && !(await pdfLooksComplete(file))) return { error: 'This PDF looks damaged. Please save or scan it again.' }
  // Images are shrunk before upload, so only PDFs are held to the size limit as chosen.
  if (kind === 'pdf' && file.size > UPLOAD_TYPES.pdf.maxBytes) return { error: `File is too large. Maximum size is ${mb(UPLOAD_TYPES.pdf.maxBytes)}.` }
  return { file, kind }
}

/**
 * Resizes and re-encodes an image as JPEG. Re-drawing on a canvas drops all
 * metadata (EXIF, including GPS location). PDFs are never altered.
 */
export async function optimizeImage(file: File): Promise<File> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = () => rej(new Error('unreadable'))
      i.src = url
    })
    const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
    const c = document.createElement('canvas')
    c.width = Math.round(img.naturalWidth * scale)
    c.height = Math.round(img.naturalHeight * scale)
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.drawImage(img, 0, 0, c.width, c.height)
    const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', JPEG_QUALITY))
    const base = sanitizeName(file.name).replace(/\.[^.]+$/, '')
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Full check + optimisation, ready to store. */
export async function prepareUpload(file: File): Promise<{ file: File; kind: UploadKind } | { error: string }> {
  const checked = await checkUpload(file)
  if ('error' in checked) return checked
  if (checked.kind === 'pdf') return checked
  let out: File
  try {
    out = await optimizeImage(checked.file)
  } catch {
    return { error: 'This image could not be read. Please choose a clearer photo.' }
  }
  if (out.size > UPLOAD_TYPES.jpeg.maxBytes) return { error: `File is too large. Maximum size is ${mb(UPLOAD_TYPES.jpeg.maxBytes)}.` }
  return { file: out, kind: 'jpeg' }
}

/** Safe storage name: letters, digits, dash, dot; no folders (prevents path traversal). */
export function sanitizeName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'file'
  return base.normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/^\.+/, '').replace(/-+/g, '-').slice(0, 80) || 'file'
}

/** SHA-256 of the content, used to avoid storing the same file twice. */
export async function sha256(blob: Blob): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('')
}
