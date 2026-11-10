import type { User } from '@/types/auth'
import { audit } from './auditService'
import { ServiceError } from './mockApi'

/**
 * Official report templates/formats (DILG, OSCA, MADAO, Barangay Bureau and the
 * recurring reports). The Barangay Secretary uploads the file each office
 * requires; it can be replaced or deleted. Saved in this browser (IndexedDB)
 * until the server stores it.
 */

export interface ReportTemplate {
  /** Report category or recurring report id. */
  id: string
  fileName: string
  size: number
  uploadedBy: string
  uploadedAt: string
  blob: Blob
}

const ACCEPTED = /\.(pdf|docx?|xlsx?|csv|png|jpe?g)$/i
const MAX_BYTES = 15 * 1024 * 1024

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('bmis-report-templates', 1)
    req.onupgradeneeded = () => req.result.createObjectStore('templates', { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db()
  return new Promise((resolve, reject) => {
    const r = run(d.transaction('templates', mode).objectStore('templates'))
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

export async function listReportTemplates(): Promise<Record<string, ReportTemplate>> {
  try {
    const all = await tx<ReportTemplate[]>('readonly', (s) => s.getAll() as IDBRequest<ReportTemplate[]>)
    return Object.fromEntries(all.map((t) => [t.id, t]))
  } catch {
    return {}
  }
}

export async function saveReportTemplate(id: string, label: string, file: File, by: User): Promise<void> {
  if (!ACCEPTED.test(file.name)) throw new ServiceError('type', 'Upload a PDF, Word, Excel or image file.')
  if (file.size > MAX_BYTES) throw new ServiceError('size', 'The file is larger than 15 MB.')
  const t: ReportTemplate = { id, fileName: file.name, size: file.size, uploadedBy: by.fullName, uploadedAt: new Date().toISOString(), blob: file }
  try {
    await tx('readwrite', (s) => s.put(t))
  } catch {
    throw new ServiceError('storage', 'The file could not be saved on this device.')
  }
  audit(by, 'Report template uploaded', 'Reports', `${label}: ${file.name}`)
}

export async function deleteReportTemplate(id: string, label: string, by: User): Promise<void> {
  await tx('readwrite', (s) => s.delete(id))
  audit(by, 'Report template deleted', 'Reports', label)
}
