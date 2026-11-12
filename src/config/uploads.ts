/**
 * UPLOAD POLICY (one place to change it).
 *
 * Application limits for resident documents, chosen to keep storage small.
 * They are not storage-plan quotas: the storage capacity used for warnings is
 * entered by an administrator (System Settings), never assumed here.
 */
export type UploadKind = 'pdf' | 'jpeg' | 'png'

export const UPLOAD_TYPES: Record<UploadKind, { mime: string; ext: string[]; maxBytes: number; label: string }> = {
  pdf: { mime: 'application/pdf', ext: ['pdf'], maxBytes: 5 * 1024 * 1024, label: 'PDF' },
  jpeg: { mime: 'image/jpeg', ext: ['jpg', 'jpeg'], maxBytes: 2 * 1024 * 1024, label: 'JPG' },
  png: { mime: 'image/png', ext: ['png'], maxBytes: 2 * 1024 * 1024, label: 'PNG' },
}

/** Total attachments allowed on one transaction. */
export const MAX_TRANSACTION_BYTES = 10 * 1024 * 1024

/** `accept` attribute for file pickers (the content is still checked after selection). */
export const UPLOAD_ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png'

/** Images are resized to this longest side (enough for reading IDs and OCR) and re-encoded, which also drops EXIF/GPS data. */
export const IMAGE_MAX_SIDE = 1800
export const JPEG_QUALITY = 0.86

/** Temporary uploads not attached to a submitted transaction are removed after this many hours. */
export const ABANDONED_UPLOAD_HOURS = 24

/** Storage warning levels, as a share of the capacity an administrator enters. */
export const STORAGE_THRESHOLDS = { monitor: 0.7, warning: 0.85, critical: 0.95 }

export const UPLOAD_HINT = 'PDF, JPG or PNG · Maximum 5 MB'
