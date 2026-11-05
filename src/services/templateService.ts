import { jsPDF } from 'jspdf'
import { DOCUMENT_TYPES, type DocumentTypeDef } from '@/documents/catalog'
import type { User } from '@/types/auth'
import type { DocumentTypeId } from '@/types/document'
import { audit } from './auditService'
import { ServiceError } from './mockApi'

/**
 * Template management (prototype, saved in this browser only):
 *  - remove / restore a template (removed ones disappear from request forms);
 *  - upload a new version of a template file (kept for the layout update: the
 *    system fills a template at measured spots, so a changed layout has to be
 *    set up before the system can fill it);
 *  - download a blank, print-ready PDF for walk-in requests.
 * The backend phase stores uploads on the server.
 */

const REMOVED_KEY = 'bmis.removedTemplates'

export interface RemovedTemplate {
  id: DocumentTypeId
  by: string
  at: string
}

function readRemoved(): RemovedTemplate[] {
  try {
    return JSON.parse(localStorage.getItem(REMOVED_KEY) ?? '[]') as RemovedTemplate[]
  } catch {
    return []
  }
}
function writeRemoved(list: RemovedTemplate[]) {
  try {
    localStorage.setItem(REMOVED_KEY, JSON.stringify(list))
  } catch {
    /* storage unavailable */
  }
}

export const listRemovedTemplates = readRemoved
export const isTemplateRemoved = (id: DocumentTypeId) => readRemoved().some((r) => r.id === id)

/** Templates in use (removed ones excluded). Use this for request forms. */
export function activeDocumentTypes(): DocumentTypeDef[] {
  const removed = new Set(readRemoved().map((r) => r.id))
  return DOCUMENT_TYPES.filter((d) => !removed.has(d.id))
}

export function removeTemplate(id: DocumentTypeId, by: User) {
  if (isTemplateRemoved(id)) return
  writeRemoved([...readRemoved(), { id, by: by.fullName, at: new Date().toISOString() }])
  audit(by, 'Template removed', 'Documents', id)
}

export function restoreTemplate(id: DocumentTypeId, by: User) {
  writeRemoved(readRemoved().filter((r) => r.id !== id))
  audit(by, 'Template restored', 'Documents', id)
}

// ── Uploaded versions (IndexedDB: files can be large) ─────────────────

export interface TemplateUpload {
  id: string
  typeId: DocumentTypeId
  fileName: string
  mime: string
  size: number
  uploadedBy: string
  uploadedAt: string
  blob: Blob
}

const ACCEPTED = /\.(pdf|docx?|png|jpe?g)$/i
const MAX_BYTES = 15 * 1024 * 1024

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('bmis-templates', 1)
    req.onupgradeneeded = () => req.result.createObjectStore('uploads', { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db()
  return new Promise((resolve, reject) => {
    const r = run(d.transaction('uploads', mode).objectStore('uploads'))
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

export async function listUploads(typeId: DocumentTypeId): Promise<TemplateUpload[]> {
  try {
    const all = await tx<TemplateUpload[]>('readonly', (s) => s.getAll() as IDBRequest<TemplateUpload[]>)
    return all.filter((u) => u.typeId === typeId).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
  } catch {
    return []
  }
}

export async function uploadTemplate(typeId: DocumentTypeId, file: File, by: User): Promise<TemplateUpload> {
  if (!ACCEPTED.test(file.name)) throw new ServiceError('type', 'Upload a PDF, Word (.docx) or image file of the template.')
  if (file.size > MAX_BYTES) throw new ServiceError('size', 'The file is larger than 15 MB.')
  const up: TemplateUpload = {
    id: `tpl-${Date.now().toString(36)}`,
    typeId,
    fileName: file.name,
    mime: file.type || 'application/octet-stream',
    size: file.size,
    uploadedBy: by.fullName,
    uploadedAt: new Date().toISOString(),
    blob: file,
  }
  try {
    await tx('readwrite', (s) => s.put(up))
  } catch {
    throw new ServiceError('storage', 'The file could not be saved on this device.')
  }
  audit(by, 'Template file uploaded', 'Documents', `${typeId}: ${file.name}`)
  return up
}

export async function deleteUpload(id: string, by: User) {
  await tx('readwrite', (s) => s.delete(id))
  audit(by, 'Uploaded template file deleted', 'Documents', id)
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ── Blank printable form ─────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Could not load ${src}`))
    img.src = src
  })
}

/** The official template pages as a blank PDF at the exact paper size, for walk-in requests. */
export async function downloadBlankPdf(type: DocumentTypeDef) {
  const { widthMm: w, heightMm: h } = type.template.pageSize
  const doc = new jsPDF({ orientation: w > h ? 'landscape' : 'portrait', unit: 'mm', format: [w, h] })
  const pages = await Promise.all(type.template.pages.map(loadImage))
  pages.forEach((img, i) => {
    if (i > 0) doc.addPage([w, h], w > h ? 'landscape' : 'portrait')
    doc.addImage(img, 'PNG', 0, 0, w, h, undefined, 'FAST')
  })
  doc.setProperties({ title: `${type.name} (blank form)` })
  doc.save(`${type.name.replace(/[^\w\- ]+/g, '').replace(/\s+/g, '_')}_blank.pdf`)
}
