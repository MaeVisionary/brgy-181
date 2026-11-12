import { ABANDONED_UPLOAD_HOURS, MAX_TRANSACTION_BYTES } from '@/config/uploads'
import { ROLE_PERMISSIONS } from '@/config/permissions'
import { sanitizeName, sha256 } from '@/lib/uploads'
import type { Permission, User } from '@/types/auth'
import { audit } from './auditService'
import { ServiceError } from './mockApi'

/**
 * DOCUMENT STORAGE.
 *
 * File content and file metadata are kept apart, the way Supabase will hold
 * them: content in a private Storage bucket, metadata in a Postgres table
 * (see docs/supabase/documents.sql). Nothing here is connected to Supabase
 * yet; in this prototype the content sits in the browser's IndexedDB and the
 * metadata in localStorage. Only `provider` changes when Supabase is wired in.
 */

export type FileCategory = 'id' | 'requirement' | 'proof' | 'authorization' | 'reply'

/** Metadata only: never the file content. */
export interface StoredFile {
  id: string
  ownerResidentId?: string
  uploadedBy: string
  category: FileCategory
  originalName: string
  storagePath: string
  mimeType: string
  size: number
  sha256: string
  uploadedAt: string
  /** Temporary until attached to a submitted transaction; abandoned temporaries are removed. */
  state: 'temporary' | 'attached'
  attachedTo?: string
}

interface StorageProvider {
  put(path: string, blob: Blob): Promise<void>
  get(path: string): Promise<Blob | undefined>
  remove(path: string): Promise<void>
}

/** Prototype provider: IndexedDB in this browser. */
const idb: StorageProvider = (() => {
  const open = () =>
    new Promise<IDBDatabase>((res, rej) => {
      const r = indexedDB.open('bmis-files', 1)
      r.onupgradeneeded = () => r.result.createObjectStore('blobs')
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
  const tx = async <T,>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) => {
    const db = await open()
    return new Promise<T>((res, rej) => {
      const req = fn(db.transaction('blobs', mode).objectStore('blobs'))
      req.onsuccess = () => res(req.result)
      req.onerror = () => rej(req.error)
    })
  }
  return {
    put: async (p, b) => { await tx('readwrite', (s) => s.put(b, p)) },
    get: (p) => tx<Blob | undefined>('readonly', (s) => s.get(p) as IDBRequest<Blob | undefined>),
    remove: async (p) => { await tx('readwrite', (s) => s.delete(p)) },
  }
})()

const provider: StorageProvider = idb

const META_KEY = 'bmis.files'
const FAIL_KEY = 'bmis.files.failed'
const readMeta = (): StoredFile[] => {
  try {
    return JSON.parse(localStorage.getItem(META_KEY) ?? '[]') as StoredFile[]
  } catch {
    return []
  }
}
const writeMeta = (list: StoredFile[]) => localStorage.setItem(META_KEY, JSON.stringify(list))

const can = (u: User, p: Permission) => !!ROLE_PERMISSIONS[u.roleId]?.includes(p) || !!u.extraPermissions?.includes(p)
/** Staff who may open resident documents for their work. */
const isReviewer = (u: User) => can(u, 'residents.verify') || can(u, 'documents.process') || can(u, 'documents.approve')

export function recordFailedUpload() {
  try {
    localStorage.setItem(FAIL_KEY, String(Number(localStorage.getItem(FAIL_KEY) ?? 0) + 1))
  } catch {
    /* ignore */
  }
}

/**
 * Saves a checked, optimised file as a temporary upload. The same content
 * already uploaded by the same person is reused instead of stored again.
 */
export async function saveUpload(file: File, opts: { category: FileCategory; ownerResidentId?: string }, by: User): Promise<StoredFile> {
  const hash = await sha256(file)
  const list = readMeta()
  const owner = opts.ownerResidentId ?? by.residentId
  const dup = list.find((f) => f.sha256 === hash && f.uploadedBy === by.id && f.ownerResidentId === owner)
  if (dup) return dup
  const id = `file-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
  // Path: owner folder / category / id-name (no user-controlled folders).
  const storagePath = `${owner ?? 'staff'}/${opts.category}/${id}-${sanitizeName(file.name)}`
  try {
    await provider.put(storagePath, file)
  } catch {
    recordFailedUpload()
    throw new ServiceError('storage', 'The file could not be saved. Please try again.')
  }
  const meta: StoredFile = {
    id,
    ownerResidentId: owner,
    uploadedBy: by.id,
    category: opts.category,
    originalName: sanitizeName(file.name),
    storagePath,
    mimeType: file.type,
    size: file.size,
    sha256: hash,
    uploadedAt: new Date().toISOString(),
    state: 'temporary',
  }
  writeMeta([...list, meta])
  return meta
}

/** Removes a temporary upload the person decided not to use. Attached files are never removed here. */
export async function discardUpload(id: string, by: User): Promise<void> {
  const list = readMeta()
  const f = list.find((x) => x.id === id)
  if (!f || f.state !== 'temporary' || f.uploadedBy !== by.id) return
  // Another temporary or attached record may share this content (deduplicated): keep the bytes then.
  writeMeta(list.filter((x) => x.id !== id))
  await provider.remove(f.storagePath).catch(() => undefined)
}

/** Marks uploads as belonging to a submitted transaction; enforces the per-transaction total. */
export function attachUploads(ids: string[], ref: string): void {
  const list = readMeta()
  const files = list.filter((f) => ids.includes(f.id))
  if (files.reduce((n, f) => n + f.size, 0) > MAX_TRANSACTION_BYTES) throw new ServiceError('too_large', 'Attachments total more than 10 MB. Remove a file or use a smaller one.')
  for (const f of files) {
    f.state = 'attached'
    f.attachedTo = ref
  }
  writeMeta(list)
}

export const totalSize = (ids: string[]) => readMeta().filter((f) => ids.includes(f.id)).reduce((n, f) => n + f.size, 0)

/**
 * Short-lived link to view a file (like a Supabase signed URL). Only the
 * owner, the uploader, or reviewing staff may open it; staff views are logged.
 */
export async function openFile(id: string, viewer: User, ttlSeconds = 60): Promise<string> {
  const f = readMeta().find((x) => x.id === id)
  if (!f) throw new ServiceError('not_found', 'File not found.')
  const own = f.uploadedBy === viewer.id || (!!viewer.residentId && viewer.residentId === f.ownerResidentId)
  if (!own && !isReviewer(viewer)) throw new ServiceError('forbidden', 'You do not have access to this file.')
  const blob = await provider.get(f.storagePath)
  if (!blob) throw new ServiceError('missing', 'The file is no longer available.')
  if (!own) audit(viewer, 'Viewed a resident document', 'Documents', f.id)
  const url = URL.createObjectURL(blob)
  setTimeout(() => URL.revokeObjectURL(url), ttlSeconds * 1000)
  return url
}

export function fileMeta(id: string): StoredFile | undefined {
  return readMeta().find((f) => f.id === id)
}

/** Deletes temporary uploads older than the configured period (run on start-up). */
export async function cleanupAbandoned(now = Date.now()): Promise<number> {
  const list = readMeta()
  const cutoff = now - ABANDONED_UPLOAD_HOURS * 3600_000
  const stale = list.filter((f) => f.state === 'temporary' && new Date(f.uploadedAt).getTime() < cutoff)
  if (!stale.length) return 0
  writeMeta(list.filter((f) => !stale.includes(f)))
  await Promise.all(stale.map((f) => provider.remove(f.storagePath).catch(() => undefined)))
  return stale.length
}

/** Administrator summary. */
export function storageStats() {
  const list = readMeta()
  const by = (c: FileCategory) => list.filter((f) => f.category === c).reduce((n, f) => n + f.size, 0)
  return {
    files: list.length,
    bytes: list.reduce((n, f) => n + f.size, 0),
    byCategory: (['id', 'requirement', 'proof', 'authorization', 'reply'] as FileCategory[]).map((c) => [c, by(c)] as const),
    largest: [...list].sort((a, b) => b.size - a.size).slice(0, 5),
    temporary: list.filter((f) => f.state === 'temporary').length,
    failed: Number(localStorage.getItem(FAIL_KEY) ?? 0),
  }
}
