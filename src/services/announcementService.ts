import { ROLE_PERMISSIONS } from '@/config/permissions'
import { mockNotifications } from '@/mocks/notifications'
import { mockUsers } from '@/mocks/users'
import type { Permission, User } from '@/types/auth'
import { audit } from './auditService'
import { sendEmail } from './emailService'
import { ServiceError, mockRequest } from './mockApi'

/**
 * ANNOUNCEMENTS: the Secretary writes, the Punong Barangay approves, the
 * system publishes (now or at the chosen time), notifies residents once, and
 * archives when it expires. Residents only ever see published announcements.
 * A change to an approved or published announcement is held as a revision
 * until approved again; the published text never changes silently.
 * Every step is in the announcement's history and the audit log.
 * Prototype storage: this browser (see docs/supabase/announcements.sql).
 */

export const ANNOUNCEMENT_CATEGORIES = [
  'Public Advisory', 'Office Schedule', 'Community Activity', 'Health and Safety',
  'Emergency Announcement', 'Government Program', 'Community Notice', 'Other',
] as const
export type AnnouncementCategory = (typeof ANNOUNCEMENT_CATEGORIES)[number]
export const AUDIENCES = ['All residents', 'Senior citizens', 'Youth', 'Persons with disability', 'Parents and guardians'] as const

export type AnnouncementStatus = 'draft' | 'pending' | 'returned' | 'scheduled' | 'published' | 'rejected' | 'archived' | 'cancelled'
export const ANNOUNCEMENT_STATUS_LABEL: Record<AnnouncementStatus, string> = {
  draft: 'Draft', pending: 'Pending approval', returned: 'Needs revision', scheduled: 'Approved · scheduled',
  published: 'Published', rejected: 'Rejected', archived: 'Archived', cancelled: 'Cancelled',
}

export interface AnnouncementContent {
  title: string
  category: AnnouncementCategory
  /** One sentence for notifications and lists. */
  summary: string
  body: string
  /** When it may appear (ISO). */
  publishAt: string
  /** When it leaves the list (ISO date); optional. */
  expiresOn?: string
  /** Activities: date, time and place. Office schedules: effective dates and hours. */
  event?: { date?: string; endDate?: string; start?: string; end?: string; location?: string }
  bring?: string[]
  contact?: string
  audience: (typeof AUDIENCES)[number]
  urgent: boolean
}

export interface AnnouncementEvent { at: string; byUserId: string; action: string; note?: string }
export interface Announcement extends AnnouncementContent {
  id: string
  ref: string
  status: AnnouncementStatus
  createdBy: string
  createdAt: string
  updatedAt: string
  approvedBy?: string
  approvedAt?: string
  publishedAt?: string
  /** Residents were notified (once). */
  notifiedAt?: string
  /** Latest note from the Chairman when sent back or rejected. */
  reviewNote?: string
  /** Proposed change to an approved or published announcement, waiting for approval. */
  revision?: AnnouncementContent & { by: string; at: string }
  readBy: string[]
  history: AnnouncementEvent[]
  sample?: boolean
}

const KEY = 'bmis.announcements'
const can = (u: User, p: Permission) => !!ROLE_PERMISSIONS[u.roleId]?.includes(p) || !!u.extraPermissions?.includes(p)
const iso = (d: string) => new Date(`${d}T08:00:00+08:00`).toISOString()

/** Sample announcements that were shown before this module existed (marked as samples). */
const SAMPLES: Announcement[] = [
  { title: 'Free Anti-Rabies Vaccination', category: 'Health and Safety', summary: 'Free vaccination for dogs and cats at the Barangay Hall on Saturday, 14 November.', body: 'Bring your pets to the Barangay 181 Hall for free anti-rabies vaccination.', publishAt: iso('2026-11-06'), event: { date: '2026-11-14', start: '08:00', end: '12:00', location: 'Barangay 181 Hall' }, bring: ['Pet vaccination card, if available', 'Pets must be at least three months old'], audience: 'All residents', urgent: false },
  { title: 'Barangay Hall Closed on Bonifacio Day', category: 'Office Schedule', summary: 'The Barangay Hall is closed on Monday, 30 November.', body: 'The Barangay Hall will be closed in observance of Bonifacio Day. Online requests sent that day will be processed on the next working day.', publishAt: iso('2026-11-04'), event: { date: '2026-11-30' }, audience: 'All residents', urgent: false },
  { title: 'Community Clean-Up Drive', category: 'Community Activity', summary: 'Linis Barangay on Sunday, 22 November, 6:00 AM at Asa St. corner Apog St.', body: 'Join the community clean-up. Drinking water will be provided. Open to all residents.', publishAt: iso('2026-11-01'), event: { date: '2026-11-22', start: '06:00', location: 'Asa St. corner Apog St.' }, bring: ['Gloves', 'A sack'], audience: 'All residents', urgent: false },
].map((c, i) => ({ ...(c as AnnouncementContent), id: `ann-s${i + 1}`, ref: `ANN-2026-${String(i + 1).padStart(4, '0')}`, status: 'published' as const, createdBy: 'usr-sec', createdAt: c.publishAt, updatedAt: c.publishAt, approvedBy: 'usr-chair', approvedAt: c.publishAt, publishedAt: c.publishAt, notifiedAt: c.publishAt, readBy: [], history: [{ at: c.publishAt, byUserId: 'usr-chair', action: 'Approved and published' }], sample: true }))

const load = (): Announcement[] => { try { return (JSON.parse(localStorage.getItem(KEY) ?? 'null') as Announcement[] | null) ?? SAMPLES.map((x) => ({ ...x })) } catch { return SAMPLES.map((x) => ({ ...x })) } }
const save = (l: Announcement[]) => localStorage.setItem(KEY, JSON.stringify(l))
const nextRef = (l: Announcement[]) => `ANN-${new Date().getFullYear()}-${String(Math.max(0, ...l.map((a) => Number(a.ref.split('-').pop()) || 0)) + 1).padStart(4, '0')}`

function notify(userIds: string[], title: string, body: string, link: string, high = false) {
  const now = new Date().toISOString()
  for (const userId of new Set(userIds)) mockNotifications.push({ id: `ntf-${Math.random().toString(36).slice(2, 9)}`, userId, category: 'announcement', title, body, createdAt: now, read: false, link, priority: high ? 'high' : undefined })
  window.dispatchEvent(new Event('bmis:notifications-changed'))
}
const usersWith = (p: Permission) => mockUsers.filter((u) => u.status === 'active' && can(u, p)).map((u) => u.id)
const residents = () => mockUsers.filter((u) => u.status === 'active' && u.roleId === 'resident')

/** Required fields and sensible dates; returns the cleaned content. */
function validate(c: AnnouncementContent): AnnouncementContent {
  const out = { ...c, title: c.title.trim(), summary: c.summary.trim(), body: c.body.trim(), bring: (c.bring ?? []).map((x) => x.trim()).filter(Boolean), contact: c.contact?.trim() || undefined }
  if (out.title.length < 5) throw new ServiceError('title', 'Write a title (at least 5 characters).')
  if (!ANNOUNCEMENT_CATEGORIES.includes(out.category)) throw new ServiceError('category', 'Choose a category.')
  if (out.summary.length < 10 || out.summary.length > 160) throw new ServiceError('summary', 'Write one short sentence for the summary (10 to 160 characters).')
  if (out.body.length < 10) throw new ServiceError('body', 'Write the full announcement.')
  if (!out.publishAt || Number.isNaN(Date.parse(out.publishAt))) throw new ServiceError('publishAt', 'Choose when to publish.')
  if (out.category === 'Community Activity' || out.category === 'Health and Safety') {
    if (!out.event?.date) throw new ServiceError('event', 'Add the date of the activity.')
  }
  if (out.event?.date && out.event.endDate && out.event.endDate < out.event.date) throw new ServiceError('event', 'The end date must be on or after the start date.')
  if (out.event?.start && out.event.end && out.event.end <= out.event.start) throw new ServiceError('event', 'The end time must be after the start time.')
  if (out.expiresOn && out.expiresOn < out.publishAt.slice(0, 10)) throw new ServiceError('expires', 'The end of display must be after the publish date.')
  return out
}

function mutate(id: string, by: User, fn: (a: Announcement, list: Announcement[]) => string, needs: Permission | Permission[]): Promise<Announcement> {
  return mockRequest(() => {
    const perms = Array.isArray(needs) ? needs : [needs]
    if (!perms.some((p) => can(by, p))) throw new ServiceError('forbidden', 'You are not allowed to do this.')
    const list = load()
    const a = list.find((x) => x.id === id)
    if (!a) throw new ServiceError('not_found', 'Announcement not found.')
    const action = fn(a, list)
    const now = new Date().toISOString()
    a.updatedAt = now
    a.history.push({ at: now, byUserId: by.id, action, note: a.reviewNote && /revision|reject/i.test(action) ? a.reviewNote : undefined })
    save(list)
    audit(by, `Announcement ${action.toLowerCase()}: ${a.ref}`, 'Announcements', a.title)
    return { ...a }
  })
}

/** Publish now: residents are told once (in-app; email records only where an address exists and no service is connected). */
function publish(a: Announcement, now: string) {
  a.status = 'published'
  a.publishedAt = now
  if (!a.notifiedAt) {
    a.notifiedAt = now
    const people = residents()
    notify(people.map((u) => u.id), a.urgent ? `Urgent: ${a.title}` : a.title, a.summary, `/my/announcements/${a.id}`, a.urgent)
    if (a.urgent) for (const u of people.filter((x) => x.email)) void sendEmail({ to: u.email, subject: `Barangay 181: ${a.title}`, body: `${a.summary}\n\n${a.body}`, ref: a.ref })
  }
}

// ── Secretary ────────────────────────────────────────────────────────
export function saveDraft(content: AnnouncementContent, by: User, id?: string): Promise<Announcement> {
  return mockRequest(() => {
    if (!can(by, 'announcements.manage')) throw new ServiceError('forbidden', 'You cannot write announcements.')
    const list = load()
    const now = new Date().toISOString()
    const c = { ...content, title: content.title.trim() || 'Untitled announcement' }
    if (!id) {
      const a: Announcement = { ...c, id: `ann-${Date.now().toString(36)}`, ref: nextRef(list), status: 'draft', createdBy: by.id, createdAt: now, updatedAt: now, readBy: [], history: [{ at: now, byUserId: by.id, action: 'Draft created' }] }
      save([a, ...list])
      audit(by, `Announcement draft created: ${a.ref}`, 'Announcements', a.title)
      return a
    }
    const a = list.find((x) => x.id === id)
    if (!a) throw new ServiceError('not_found', 'Announcement not found.')
    if (['draft', 'returned', 'rejected'].includes(a.status)) {
      Object.assign(a, c, { status: a.status === 'rejected' ? 'draft' : a.status, updatedAt: now })
      a.history.push({ at: now, byUserId: by.id, action: 'Draft edited' })
    } else if (['scheduled', 'published', 'pending'].includes(a.status)) {
      // Approved or published text stays as it is; the change waits for approval.
      a.revision = { ...validate(c), by: by.id, at: now }
      a.history.push({ at: now, byUserId: by.id, action: 'Change proposed (waiting for approval)' })
      notify(usersWith('announcements.approve'), 'Announcement change to review', `${a.ref}: ${c.title}`, `/announcements/${a.id}`)
    } else throw new ServiceError('state', 'This announcement can no longer be edited.')
    save(list)
    audit(by, `Announcement edited: ${a.ref}`, 'Announcements', a.title)
    return { ...a }
  })
}

export const submitForApproval = (id: string, by: User) => mutate(id, by, (a) => {
  if (!['draft', 'returned'].includes(a.status)) throw new ServiceError('state', 'Only drafts can be submitted.')
  Object.assign(a, validate(a))
  a.status = 'pending'
  a.reviewNote = undefined
  notify(usersWith('announcements.approve'), 'Announcement waiting for your approval', `${a.ref}: ${a.title}`, `/announcements/${a.id}`, a.urgent)
  return 'Submitted for approval'
}, 'announcements.manage')

/** Secretary cancels a scheduled or published announcement (residents who saw it are told). */
export const cancelAnnouncement = (id: string, reason: string, by: User) => mutate(id, by, (a) => {
  if (!['scheduled', 'published', 'pending', 'draft', 'returned'].includes(a.status)) throw new ServiceError('state', 'This announcement is already closed.')
  if (reason.trim().length < 5) throw new ServiceError('reason', 'Give the reason.')
  const wasPublic = a.status === 'published'
  a.status = 'cancelled'
  a.revision = undefined
  if (wasPublic) notify(residents().map((u) => u.id), `Cancelled: ${a.title}`, reason.trim(), `/my/announcements/${a.id}`)
  return `Cancelled: ${reason.trim()}`
}, 'announcements.manage')

export const archiveAnnouncement = (id: string, by: User) => mutate(id, by, (a) => {
  if (a.status !== 'published') throw new ServiceError('state', 'Only published announcements can be archived.')
  a.status = 'archived'
  return 'Archived'
}, ['announcements.manage', 'announcements.approve'])

// ── Chairman ─────────────────────────────────────────────────────────
/** Approve: publishes now, or at the scheduled time. Also approves a proposed change. */
export const approveAnnouncement = (id: string, by: User) => mutate(id, by, (a) => {
  const now = new Date().toISOString()
  if (a.createdBy === by.id) throw new ServiceError('self', 'Another official must approve your own announcement.')
  if (a.revision) {
    const { by: _b, at: _t, ...content } = a.revision
    void _b; void _t
    Object.assign(a, content)
    a.revision = undefined
    a.approvedBy = by.id; a.approvedAt = now
    if (a.status === 'published') notify(residents().map((u) => u.id), `Updated: ${a.title}`, a.summary, `/my/announcements/${a.id}`)
    return 'Change approved'
  }
  if (a.status !== 'pending') throw new ServiceError('state', 'Nothing to approve.')
  Object.assign(a, validate(a))
  a.approvedBy = by.id; a.approvedAt = now; a.reviewNote = undefined
  const now_ = new Date(a.publishAt).getTime() <= Date.now()
  if (now_) publish(a, now)
  else a.status = 'scheduled'
  notify([a.createdBy], now_ ? 'Announcement approved and published' : 'Announcement approved', `${a.ref}: ${a.title}`, `/announcements/${a.id}`)
  return now_ ? 'Approved and published' : `Approved; publishes ${new Date(a.publishAt).toLocaleString('en-US', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' })}`
}, 'announcements.approve')

export const requestRevision = (id: string, note: string, by: User) => mutate(id, by, (a) => {
  if (note.trim().length < 5) throw new ServiceError('note', 'Write what should change.')
  if (a.revision) { a.revision = undefined; a.reviewNote = note.trim(); notify([a.createdBy], 'Change not approved', note.trim(), `/announcements/${a.id}`); return 'Revision requested on the change' }
  if (a.status !== 'pending') throw new ServiceError('state', 'Only pending announcements can be sent back.')
  a.status = 'returned'
  a.reviewNote = note.trim()
  notify([a.createdBy], 'Announcement needs revision', `${a.ref}: ${note.trim()}`, `/announcements/${a.id}`)
  return 'Revision requested'
}, 'announcements.approve')

export const rejectAnnouncement = (id: string, reason: string, by: User) => mutate(id, by, (a) => {
  if (a.status !== 'pending') throw new ServiceError('state', 'Only pending announcements can be rejected.')
  if (reason.trim().length < 5) throw new ServiceError('reason', 'Give the reason.')
  a.status = 'rejected'
  a.reviewNote = reason.trim()
  notify([a.createdBy], 'Announcement rejected', `${a.ref}: ${reason.trim()}`, `/announcements/${a.id}`)
  return 'Rejected'
}, 'announcements.approve')

// ── Automatic jobs ───────────────────────────────────────────────────
/** Publishes approved announcements when their time comes and archives expired ones (a server job on Supabase). */
export function runAnnouncementJobs(now = Date.now()) {
  const list = load()
  let changed = false
  const stamp = new Date(now).toISOString()
  const today = new Date(now).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
  for (const a of list) {
    if (a.status === 'scheduled' && new Date(a.publishAt).getTime() <= now) { publish(a, stamp); a.history.push({ at: stamp, byUserId: 'system', action: 'Published at the scheduled time' }); changed = true }
    const end = a.expiresOn ?? a.event?.endDate ?? a.event?.date
    if (a.status === 'published' && end && end < today) { a.status = 'archived'; a.history.push({ at: stamp, byUserId: 'system', action: 'Archived after its date passed' }); changed = true }
  }
  if (changed) save(list)
}

// ── Reading ──────────────────────────────────────────────────────────
/** Residents: published only, newest first, urgent first. */
export function listPublished(by: User): Promise<(Announcement & { read: boolean })[]> {
  return mockRequest(() => {
    runAnnouncementJobs()
    return load().filter((a) => a.status === 'published').map((a) => ({ ...a, revision: undefined, reviewNote: undefined, read: a.readBy.includes(by.id) }))
      .sort((x, y) => Number(y.urgent) - Number(x.urgent) || (y.publishedAt ?? '').localeCompare(x.publishedAt ?? ''))
  })
}
export function getPublished(id: string, by: User): Promise<Announcement> {
  return mockRequest(() => {
    const list = load()
    const a = list.find((x) => x.id === id)
    // Residents may open published, and archived or cancelled ones they were told about; never drafts.
    if (!a || !['published', 'archived', 'cancelled'].includes(a.status) || (a.status === 'cancelled' && !a.notifiedAt)) throw new ServiceError('not_found', 'Announcement not found.')
    if (!a.readBy.includes(by.id)) { a.readBy.push(by.id); save(list) }
    return { ...a, revision: undefined, reviewNote: undefined }
  })
}
/** Staff with manage or approve permission. */
export function listAnnouncements(by: User): Promise<Announcement[]> {
  return mockRequest(() => {
    if (!can(by, 'announcements.manage') && !can(by, 'announcements.approve')) throw new ServiceError('forbidden', 'You cannot view announcement management.')
    runAnnouncementJobs()
    return load().sort((x, y) => y.updatedAt.localeCompare(x.updatedAt))
  })
}
export function getAnnouncement(id: string, by: User): Promise<Announcement> {
  return mockRequest(() => {
    if (!can(by, 'announcements.manage') && !can(by, 'announcements.approve')) throw new ServiceError('forbidden', 'Not allowed.')
    const a = load().find((x) => x.id === id)
    if (!a) throw new ServiceError('not_found', 'Announcement not found.')
    return a
  })
}
/** For the barangay calendar: published announcements that have a date. */
export const announcementEvents = () => load().filter((a) => a.status === 'published' && a.event?.date)
export const pendingApprovalCount = () => load().filter((a) => a.status === 'pending' || !!a.revision).length
