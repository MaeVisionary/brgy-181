import { EXPIRING_SOON_DAYS, ID_FILE_MAX_BYTES, ID_FILE_TYPES, idHasExpiry } from '@/config/idTypes'
import { ROLE_PERMISSIONS } from '@/config/permissions'
import { mockRegistrations, mockResidents } from '@/mocks/residents'
import type { Permission, User } from '@/types/auth'
import { audit } from './auditService'
import { ServiceError, mockRequest } from './mockApi'

/**
 * IDENTITY DOCUMENTS: one ID on file per resident, reused by every transaction.
 *
 * The ID submitted at registration is the starting record (read from the
 * registration itself, not copied). A resident replaces it only when it is
 * missing, expired, unreadable or rejected; the replacement waits for staff
 * verification. Reading text from a photo (OCR) is never treated as proof the
 * ID is genuine: only staff approval, or a registration that passed every
 * automated check, marks an ID verified.
 *
 * PROTOTYPE LIMITS: replacements are kept in this browser's localStorage.
 * The backend phase stores ID images encrypted, serves them only to
 * authorised staff, and repeats every permission check on the server.
 */

export type IdReview = 'verified' | 'pending' | 'rejected'
/** What the resident needs to do about their ID. */
export type IdState = 'verified' | 'expiring' | 'pending' | 'expired' | 'rejected' | 'missing'

export interface IdHistoryEntry {
  at: string
  action: string
  by?: string
}

export interface IdDocument {
  id: string
  residentId: string
  idType: string
  idNumber: string
  /** ISO date printed on the card; absent for IDs that do not expire. */
  expiresAt?: string
  uploadedAt: string
  review: IdReview
  reviewedAt?: string
  reviewedBy?: string
  reviewNote?: string
  /** Downscaled image; shown only to staff who can verify residents. */
  image?: string
  source: 'registration' | 'replacement'
  /** What the text reader found on the photo (not proof of authenticity). */
  ocr?: { name: boolean; idNumber: boolean; expiry?: boolean }
  history: IdHistoryEntry[]
}

const KEY = 'bmis.idDocuments'
const replacements: IdDocument[] = (() => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as IdDocument[]
  } catch {
    return []
  }
})()
function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(replacements))
  } catch {
    throw new ServiceError('storage', 'This device has no space left to save the ID photo.')
  }
}

const can = (u: User, p: Permission) => ROLE_PERMISSIONS[u.roleId]?.includes(p) || !!u.extraPermissions?.includes(p)

/** The ID from the resident's registration, when there is one. */
function fromRegistration(residentId: string): IdDocument | undefined {
  const reg = [...mockRegistrations].reverse().find((r) => r.matchedResidentId === residentId && r.evidence)
  if (!reg?.evidence) return undefined
  const review: IdReview = reg.status === 'approved' || reg.status === 'auto_approved' ? 'verified' : reg.status === 'rejected' ? 'rejected' : 'pending'
  const ev = reg.evidence
  return {
    id: `id-${reg.id}`,
    residentId,
    idType: ev.idType,
    idNumber: ev.idNumber,
    expiresAt: ev.idExpiry,
    uploadedAt: reg.submittedAt,
    review,
    reviewedAt: reg.decidedAt ?? (reg.status === 'auto_approved' ? reg.submittedAt : undefined),
    reviewedBy: reg.status === 'auto_approved' ? 'Automated checks' : reg.decidedBy,
    reviewNote: reg.decisionNote,
    image: ev.idImage,
    source: 'registration',
    ocr: { name: ev.ocrFound.firstName && ev.ocrFound.lastName, idNumber: ev.ocrFound.idNumber, expiry: ev.ocrFound.expiry },
    history: [
      { at: reg.submittedAt, action: 'Submitted with registration' },
      ...(reg.decidedAt ? [{ at: reg.decidedAt, action: review === 'verified' ? 'Verified' : 'Rejected', by: reg.decidedBy }] : reg.status === 'auto_approved' ? [{ at: reg.submittedAt, action: 'Verified by automated checks' }] : []),
    ],
  }
}

/** The ID currently on file: the latest replacement, else the registration ID. */
function current(residentId: string): IdDocument | undefined {
  const r = replacements.filter((d) => d.residentId === residentId).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
  // A rejected replacement does not erase a still-valid earlier ID.
  const latest = r[0]
  if (latest && latest.review !== 'rejected') return latest
  const verifiedEarlier = r.find((d) => d.review === 'verified')
  const reg = fromRegistration(residentId)
  return latest?.review === 'rejected' ? (verifiedEarlier && stateOf(verifiedEarlier) !== 'expired' ? verifiedEarlier : latest) : reg
}

export function stateOf(doc: IdDocument | undefined, now = new Date()): IdState {
  if (!doc) return 'missing'
  if (doc.review === 'rejected') return 'rejected'
  if (doc.expiresAt && idHasExpiry(doc.idType)) {
    const exp = new Date(doc.expiresAt + 'T23:59:59')
    if (exp.getTime() < now.getTime()) return 'expired'
    if (doc.review === 'verified' && exp.getTime() - now.getTime() < EXPIRING_SOON_DAYS * 86_400_000) return 'expiring'
  }
  return doc.review === 'pending' ? 'pending' : 'verified'
}

/** States where the resident must upload an ID before a transaction that needs one. */
export const needsUpload = (s: IdState) => s === 'missing' || s === 'expired' || s === 'rejected'

/** The resident's own ID (without the image); staff with verify rights get the image too. */
export function getIdOnFile(residentId: string, viewer: User): Promise<IdDocument | undefined> {
  return mockRequest(() => {
    const own = viewer.residentId === residentId
    const staff = can(viewer, 'residents.verify')
    if (!own && !staff) throw new ServiceError('forbidden', 'You do not have access to this record.')
    const doc = current(residentId)
    if (!doc) return undefined
    if (!staff) return { ...doc, image: undefined }
    audit(viewer, 'Viewed ID on file', 'Residents', residentId)
    return doc
  })
}

export interface IdUpload {
  idType: string
  idNumber: string
  expiresAt?: string
  image: string
  fileType: string
  fileSize: number
  ocr?: IdDocument['ocr']
}

/** Validates an ID before it is saved (type, number, expiry, file). */
export function idUploadProblem(u: Omit<IdUpload, 'image'> & { image?: string }, today = new Date()): string | null {
  if (!u.idType) return 'Choose the type of ID.'
  if (u.idNumber.trim().length < 4) return 'Enter the ID number shown on the card.'
  if (idHasExpiry(u.idType)) {
    if (!u.expiresAt) return 'Enter the expiry date printed on the ID.'
    if (new Date(u.expiresAt + 'T23:59:59').getTime() < today.getTime()) return 'This ID has expired. Please use a valid ID.'
  }
  if (!ID_FILE_TYPES.includes(u.fileType)) return 'Upload a JPG, PNG or WebP photo of the ID.'
  if (u.fileSize > ID_FILE_MAX_BYTES) return 'The photo is too large (8 MB maximum).'
  if (!u.image) return 'Add a photo of the front of the ID.'
  return null
}

/** Resident replaces their ID; it waits for staff verification. */
export function submitReplacementId(residentId: string, u: IdUpload, by: User): Promise<IdDocument> {
  return mockRequest(() => {
    if (by.residentId !== residentId) throw new ServiceError('forbidden', 'You can only update your own ID.')
    const problem = idUploadProblem(u)
    if (problem) throw new ServiceError('invalid', problem)
    if (stateOf(current(residentId)) === 'pending') throw new ServiceError('pending', 'Your ID is already being verified.')
    const now = new Date().toISOString()
    const doc: IdDocument = {
      id: `id-${Date.now().toString(36)}`,
      residentId,
      idType: u.idType,
      idNumber: u.idNumber.trim(),
      expiresAt: idHasExpiry(u.idType) ? u.expiresAt : undefined,
      uploadedAt: now,
      review: 'pending',
      image: u.image,
      source: 'replacement',
      ocr: u.ocr,
      history: [{ at: now, action: 'Uploaded by resident', by: by.id }],
    }
    replacements.push(doc)
    persist()
    audit(by, 'Uploaded a replacement ID', 'Residents', residentId)
    return doc
  })
}

/** Staff queue: replacement IDs waiting for verification. */
export function listPendingIds(viewer: User): Promise<(IdDocument & { residentName: string })[]> {
  return mockRequest(() => {
    if (!can(viewer, 'residents.verify')) throw new ServiceError('forbidden', 'You do not have access to ID verification.')
    return replacements
      .filter((d) => d.review === 'pending')
      .map((d) => {
        const r = mockResidents.find((x) => x.id === d.residentId)
        return { ...d, residentName: r ? [r.firstName, r.middleName, r.lastName, r.suffix].filter(Boolean).join(' ') : 'Unknown resident' }
      })
  })
}

export function decideId(id: string, decision: 'verified' | 'rejected', note: string, by: User): Promise<IdDocument> {
  return mockRequest(() => {
    if (!can(by, 'residents.approve')) throw new ServiceError('forbidden', 'You cannot verify IDs.')
    const doc = replacements.find((d) => d.id === id)
    if (!doc) throw new ServiceError('not_found', 'ID not found.')
    if (doc.review !== 'pending') throw new ServiceError('decided', 'This ID was already reviewed.')
    if (decision === 'rejected' && !note.trim()) throw new ServiceError('note', 'Add the reason for rejecting.')
    const now = new Date().toISOString()
    doc.review = decision
    doc.reviewedAt = now
    doc.reviewedBy = by.id
    doc.reviewNote = note.trim() || undefined
    doc.history.push({ at: now, action: decision === 'verified' ? 'Verified' : `Rejected: ${note.trim()}`, by: by.id })
    persist()
    audit(by, decision === 'verified' ? 'ID verified' : 'ID rejected', 'Residents', doc.residentId)
    return doc
  })
}
