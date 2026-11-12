import { ROLE_PERMISSIONS } from '@/config/permissions'
import { CONCERN_CATEGORIES, computePriority, conceptsOf, isHazard, priorityRank, similarity, suggestCategory, type Confidence, type ConcernCategory, type Priority } from '@/concerns/engine'
import { mockNotifications } from '@/mocks/notifications'
import { mockResidents } from '@/mocks/residents'
import { mockUsers } from '@/mocks/users'
import type { Permission, User } from '@/types/auth'
import { audit } from './auditService'
import { attachUploads } from './fileStore'
import { ServiceError, mockRequest } from './mockApi'

/**
 * COMMUNITY CONCERNS: resident submissions grouped into community issues.
 *
 * Kept apart from complaints and incident reports (Katarungang Pambarangay),
 * which are about people and stay confidential. Every submission keeps its
 * own reference and text forever; grouping only links it to an issue.
 * Prototype storage: this browser. Database version: docs/supabase/concerns.sql.
 */

export type IssueStatus = 'open' | 'under_review' | 'assigned' | 'in_progress' | 'resolved' | 'closed'
export const ISSUE_STATUS_LABEL: Record<IssueStatus, string> = { open: 'Open', under_review: 'Under Review', assigned: 'Action Assigned', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed' }
const ACTIVE: IssueStatus[] = ['open', 'under_review', 'assigned', 'in_progress']

export interface ConcernSubmission {
  id: string
  ref: string
  residentId: string
  userId: string
  category: ConcernCategory
  /** What the resident chose; "Not sure" lets the system suggest one. */
  categoryChosen: ConcernCategory | 'Not sure'
  title: string
  details: string
  street?: string
  landmark?: string
  startedOn?: string
  frequency?: string
  photoFileId?: string
  submittedAt: string
  /** Confirmed group. */
  issueId?: string
  /** Suggested group awaiting staff review (medium confidence or missing location). */
  suggestedIssueId?: string
  match?: { confidence: Confidence; score: number; reason: string; by: 'system' | string; at: string }
  needsReview?: 'location' | 'match'
  hazard: boolean
}

export interface IssueEvent { at: string; byUserId: string; action: string; detail?: string }

export interface ConcernIssue {
  id: string
  ref: string
  title: string
  category: ConcernCategory
  street?: string
  landmark?: string
  status: IssueStatus
  priorityOverride?: { priority: Priority; reason: string; byUserId: string; at: string }
  assignedTo?: string
  expectedBy?: string
  firstActionAt?: string
  resolution?: { description: string; actionTaken: string; resolvedAt: string; byUserId: string; evidenceFileId?: string }
  createdAt: string
  history: IssueEvent[]
}

interface Store { submissions: ConcernSubmission[]; issues: ConcernIssue[] }
const KEY = 'bmis.concerns'
const load = (): Store => {
  try {
    return { submissions: [], issues: [], ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Store>) }
  } catch {
    return { submissions: [], issues: [] }
  }
}
const save = (s: Store) => localStorage.setItem(KEY, JSON.stringify(s))

const can = (u: User, p: Permission) => !!ROLE_PERMISSIONS[u.roleId]?.includes(p) || !!u.extraPermissions?.includes(p)
const requireManage = (u: User) => { if (!can(u, 'concerns.manage')) throw new ServiceError('forbidden', 'You cannot manage community concerns.') }
const requireView = (u: User) => { if (!can(u, 'concerns.manage') && !can(u, 'concerns.view')) throw new ServiceError('forbidden', 'You cannot view community concerns.') }

function notify(userIds: string[], title: string, body: string, link: string) {
  const now = new Date().toISOString()
  for (const userId of new Set(userIds)) mockNotifications.push({ id: `ntf-${Math.random().toString(36).slice(2, 9)}`, userId, category: 'complaint', title, body, createdAt: now, read: false, link })
  window.dispatchEvent(new Event('bmis:notifications-changed'))
}
const ownersOf = (s: Store, issueId: string) => [...new Set(s.submissions.filter((x) => x.issueId === issueId).map((x) => x.userId))]
const staff = () => mockUsers.filter((u) => u.status === 'active' && can(u, 'concerns.manage')).map((u) => u.id)

const nextRef = (prefix: string, n: number) => `${prefix}-${new Date().getFullYear()}-${String(n).padStart(4, '0')}`
const asInput = (x: { category: ConcernCategory; street?: string; landmark?: string; title: string; details: string }) => ({ category: x.category, street: x.street, landmark: x.landmark, text: `${x.title} ${x.details}` })

// ── Issue facts ──────────────────────────────────────────────────────

export interface IssueView extends ConcernIssue {
  reports: number
  uniqueResidents: number
  firstReportedAt: string
  latestReportAt: string
  priority: Priority
  priorityReason: string
  trend: 'rising' | 'falling' | 'steady'
  hazard: boolean
}

function view(s: Store, i: ConcernIssue): IssueView {
  const subs = s.submissions.filter((x) => x.issueId === i.id).sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
  const now = Date.now()
  const day = 86_400_000
  const recent = subs.filter((x) => now - new Date(x.submittedAt).getTime() < 7 * day).length
  const previous = subs.filter((x) => { const d = now - new Date(x.submittedAt).getTime(); return d >= 7 * day && d < 14 * day }).length
  const hazard = subs.some((x) => x.hazard)
  const uniqueResidents = new Set(subs.map((x) => x.residentId)).size
  const daysOpen = Math.floor((now - new Date(i.createdAt).getTime()) / day)
  const auto = computePriority({ reports: subs.length, uniqueResidents, hazard, category: i.category, daysOpen, recent, previous })
  const o = i.priorityOverride
  return {
    ...i,
    reports: subs.length,
    uniqueResidents,
    firstReportedAt: subs[0]?.submittedAt ?? i.createdAt,
    latestReportAt: subs[subs.length - 1]?.submittedAt ?? i.createdAt,
    priority: o ? o.priority : auto.priority,
    priorityReason: o ? `Set to ${o.priority} by staff: ${o.reason} (Suggested: ${auto.reason})` : auto.reason,
    trend: auto.trend,
    hazard,
  }
}

// ── Resident side ────────────────────────────────────────────────────

export interface ConcernInput {
  category: ConcernCategory | 'Not sure'
  title: string
  details: string
  street?: string
  landmark?: string
  startedOn?: string
  frequency?: string
  photoFileId?: string
}

/** Resident submits a concern; the system links it to a matching open issue or starts a new one. */
export function submitConcern(input: ConcernInput, by: User): Promise<{ submission: ConcernSubmission; linked: 'new' | 'existing' | 'review' }> {
  return mockRequest(() => {
    if (!can(by, 'self.complaints') || !by.residentId) throw new ServiceError('forbidden', 'Only residents can send community concerns here.')
    if (input.title.trim().length < 3) throw new ServiceError('title', 'Give a short title, for example "Broken streetlight".')
    if (input.details.trim().length < 10) throw new ServiceError('details', 'Tell us what is happening.')
    if (!input.street && !input.landmark?.trim()) throw new ServiceError('location', 'Tell us where it is: choose the street or name a landmark.')
    if (input.category !== 'Not sure' && !CONCERN_CATEGORIES.includes(input.category)) throw new ServiceError('category', 'Choose a type.')
    const s = load()
    // Double-tap / repeat protection: same resident, same text, within 10 minutes.
    const dup = s.submissions.find((x) => x.residentId === by.residentId && x.details.trim() === input.details.trim() && Date.now() - new Date(x.submittedAt).getTime() < 10 * 60_000)
    if (dup) throw new ServiceError('duplicate', `You already sent this (${dup.ref}).`)
    const text = `${input.title} ${input.details}`
    const category = input.category === 'Not sure' ? suggestCategory(text) : input.category
    const now = new Date().toISOString()
    const sub: ConcernSubmission = {
      id: `cc-${Date.now().toString(36)}`,
      ref: nextRef('CC', s.submissions.length + 1),
      residentId: by.residentId,
      userId: by.id,
      category,
      categoryChosen: input.category,
      title: input.title.trim(),
      details: input.details.trim(),
      street: input.street || undefined,
      landmark: input.landmark?.trim() || undefined,
      startedOn: input.startedOn || undefined,
      frequency: input.frequency || undefined,
      photoFileId: input.photoFileId,
      submittedAt: now,
      hazard: isHazard(conceptsOf(text)),
    }
    let linked: 'new' | 'existing' | 'review' = 'new'
    // Compare with open issues on the same street.
    const candidates = s.issues.filter((i) => ACTIVE.includes(i.status)).map((i) => ({ i, m: similarity(asInput(sub), { category: i.category, street: i.street, landmark: i.landmark, text: `${i.title} ${s.submissions.filter((x) => x.issueId === i.id).map((x) => x.details).join(' ')}` }) })).sort((a, b) => b.m.score - a.m.score)
    const best = candidates[0]
    if (!sub.street) {
      sub.needsReview = 'location'
      linked = 'review'
    } else if (best && best.m.confidence === 'high') {
      sub.issueId = best.i.id
      sub.match = { ...best.m, by: 'system', at: now }
      best.i.history.push({ at: now, byUserId: 'system', action: `Report ${sub.ref} linked automatically`, detail: `${best.m.reason} (score ${best.m.score})` })
      linked = 'existing'
    } else if (best && best.m.confidence === 'medium') {
      sub.suggestedIssueId = best.i.id
      sub.match = { ...best.m, by: 'system', at: now }
      sub.needsReview = 'match'
      linked = 'review'
    }
    if (linked === 'new') {
      const issue: ConcernIssue = { id: `iss-${Date.now().toString(36)}`, ref: nextRef('ISS', s.issues.length + 1), title: sub.title, category, street: sub.street, landmark: sub.landmark, status: 'open', createdAt: now, history: [{ at: now, byUserId: 'system', action: `Issue started from report ${sub.ref}` }] }
      s.issues.push(issue)
      sub.issueId = issue.id
    }
    s.submissions.push(sub)
    save(s)
    if (input.photoFileId) attachUploads([input.photoFileId], sub.ref)
    audit(by, `Community concern submitted ${sub.ref}`, 'Community concerns')
    notify([by.id], 'We received your concern', `${sub.ref} · ${sub.title}`, `/my/concerns/${sub.id}`)
    if (linked === 'existing') notify([by.id], 'Your concern was linked to a community issue', 'Others reported the same problem. The barangay is reviewing it.', `/my/concerns/${sub.id}`)
    if (sub.hazard) notify(staff(), 'Urgent community concern', `${sub.ref} · ${sub.title}${sub.street ? ` · ${sub.street}` : ''}`, '/concerns')
    return { submission: sub, linked }
  })
}

export interface MyConcern { submission: ConcernSubmission; status: 'Submitted' | 'Processing' | 'Completed'; linkedToOthers: boolean }

/** A resident sees only their own submissions and the status of the linked issue (no other residents). */
export function listMyConcerns(by: User): Promise<MyConcern[]> {
  return mockRequest(() => {
    const s = load()
    return s.submissions.filter((x) => x.userId === by.id).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).map((x) => {
      const i = s.issues.find((y) => y.id === x.issueId)
      const status: MyConcern['status'] = !i || i.status === 'open' ? 'Submitted' : i.status === 'resolved' || i.status === 'closed' ? 'Completed' : 'Processing'
      return { submission: x, status, linkedToOthers: !!i && s.submissions.filter((y) => y.issueId === i.id).length > 1 }
    })
  })
}

export function getMyConcern(id: string, by: User): Promise<MyConcern & { resolution?: string }> {
  return listMyConcerns(by).then((list) => {
    const c = list.find((x) => x.submission.id === id)
    if (!c) throw new ServiceError('not_found', 'Not found.')
    const i = load().issues.find((y) => y.id === c.submission.issueId)
    return { ...c, resolution: i?.status === 'resolved' || i?.status === 'closed' ? i.resolution?.description : undefined }
  })
}

// ── Staff side ───────────────────────────────────────────────────────

export function listIssues(by: User): Promise<IssueView[]> {
  return mockRequest(() => {
    requireView(by)
    const s = load()
    return s.issues.map((i) => view(s, i)).filter((v) => v.reports > 0).sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority) || b.uniqueResidents - a.uniqueResidents || b.latestReportAt.localeCompare(a.latestReportAt))
  })
}

/** Submissions waiting for a person: unclear location or a medium-confidence match. */
export function listReviewQueue(by: User): Promise<ConcernSubmission[]> {
  return mockRequest(() => {
    requireManage(by)
    return load().submissions.filter((x) => x.needsReview)
  })
}

export interface IssueDetail { issue: IssueView; submissions: (ConcernSubmission & { residentName?: string })[] }

export function getIssue(id: string, by: User): Promise<IssueDetail> {
  return mockRequest(() => {
    requireView(by)
    const s = load()
    const i = s.issues.find((x) => x.id === id)
    if (!i) throw new ServiceError('not_found', 'Issue not found.')
    const showNames = can(by, 'concerns.manage')
    const submissions = s.submissions.filter((x) => x.issueId === id).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).map((x) => {
      const r = showNames ? mockResidents.find((y) => y.id === x.residentId) : undefined
      return { ...x, residentName: r ? `${r.firstName} ${r.lastName}` : undefined }
    })
    return { issue: view(s, i), submissions }
  })
}

function mutateIssue(id: string, by: User, fn: (i: ConcernIssue, s: Store) => string | void): Promise<IssueView> {
  return mockRequest(() => {
    requireManage(by)
    const s = load()
    const i = s.issues.find((x) => x.id === id)
    if (!i) throw new ServiceError('not_found', 'Issue not found.')
    const action = fn(i, s)
    if (action) {
      i.history.push({ at: new Date().toISOString(), byUserId: by.id, action })
      audit(by, `${action} (${i.ref})`, 'Community concerns')
    }
    save(s)
    return view(s, i)
  })
}

export function setIssueStatus(id: string, status: IssueStatus, by: User, resolution?: { description: string; actionTaken: string; evidenceFileId?: string }): Promise<IssueView> {
  return mutateIssue(id, by, (i, s) => {
    if (status === i.status) return
    if (status === 'resolved') {
      if (!resolution || resolution.description.trim().length < 5 || resolution.actionTaken.trim().length < 5) throw new ServiceError('resolution', 'Describe the resolution and the action taken.')
      i.resolution = { description: resolution.description.trim(), actionTaken: resolution.actionTaken.trim(), resolvedAt: new Date().toISOString(), byUserId: by.id, evidenceFileId: resolution.evidenceFileId }
      if (resolution.evidenceFileId) attachUploads([resolution.evidenceFileId], i.ref)
      notify(ownersOf(s, i.id), 'Community concern resolved', `${i.title}: ${i.resolution.description}`, '/my/complaints')
    }
    if (status === 'closed' && i.status !== 'resolved') throw new ServiceError('order', 'Resolve the issue first, with what was done.')
    const wasIdle = i.status === 'open' || i.status === 'under_review'
    if (wasIdle && (status === 'assigned' || status === 'in_progress')) {
      i.firstActionAt ??= new Date().toISOString()
      notify(ownersOf(s, i.id), 'The barangay is acting on your concern', i.title, '/my/complaints')
    }
    if ((i.status === 'resolved' || i.status === 'closed') && ACTIVE.includes(status)) i.resolution = undefined
    const from = ISSUE_STATUS_LABEL[i.status]
    i.status = status
    return `Status: ${from} → ${ISSUE_STATUS_LABEL[status]}`
  })
}

export function assignIssue(id: string, userId: string, expectedBy: string | undefined, by: User): Promise<IssueView> {
  return mutateIssue(id, by, (i) => {
    const u = mockUsers.find((x) => x.id === userId && x.status === 'active' && x.roleId !== 'resident')
    if (!u) throw new ServiceError('assignee', 'Choose barangay personnel.')
    i.assignedTo = u.id
    i.expectedBy = expectedBy || undefined
    if (i.status === 'open' || i.status === 'under_review') i.status = 'assigned'
    i.firstActionAt ??= new Date().toISOString()
    notify([u.id], 'Community issue assigned to you', `${i.ref} · ${i.title}`, `/concerns/${i.id}`)
    return `Assigned to ${u.fullName}${expectedBy ? ` (by ${expectedBy})` : ''}`
  })
}

export function setPriority(id: string, priority: Priority | null, reason: string, by: User): Promise<IssueView> {
  return mutateIssue(id, by, (i) => {
    if (priority === null) { i.priorityOverride = undefined; return 'Priority returned to the suggested level' }
    if (reason.trim().length < 5) throw new ServiceError('reason', 'Give the reason for the priority.')
    i.priorityOverride = { priority, reason: reason.trim(), byUserId: by.id, at: new Date().toISOString() }
    return `Priority set to ${priority}: ${reason.trim()}`
  })
}

export function addIssueNote(id: string, note: string, by: User): Promise<IssueView> {
  return mutateIssue(id, by, () => {
    if (note.trim().length < 3) throw new ServiceError('note', 'Write the note first.')
    return `Note: ${note.trim()}`
  })
}

/** Confirm a suggested match, move a report to another issue, or put it in a new issue of its own. */
export function moveSubmission(subId: string, target: string | 'new', by: User): Promise<void> {
  return mockRequest(() => {
    requireManage(by)
    const s = load()
    const sub = s.submissions.find((x) => x.id === subId)
    if (!sub) throw new ServiceError('not_found', 'Report not found.')
    const now = new Date().toISOString()
    const from = s.issues.find((i) => i.id === sub.issueId)
    let to: ConcernIssue | undefined
    if (target === 'new') {
      to = { id: `iss-${Date.now().toString(36)}`, ref: nextRef('ISS', s.issues.length + 1), title: sub.title, category: sub.category, street: sub.street, landmark: sub.landmark, status: 'open', createdAt: now, history: [{ at: now, byUserId: by.id, action: `Issue started from report ${sub.ref}` }] }
      s.issues.push(to)
    } else {
      to = s.issues.find((i) => i.id === target)
      if (!to) throw new ServiceError('not_found', 'Issue not found.')
    }
    if (from?.id === to.id && !sub.needsReview) return
    sub.issueId = to.id
    sub.suggestedIssueId = undefined
    sub.needsReview = undefined
    sub.match = { confidence: 'high', score: 1, reason: 'Confirmed by staff', by: by.id, at: now }
    from?.history.push({ at: now, byUserId: by.id, action: `Report ${sub.ref} moved to ${to.ref}` })
    to.history.push({ at: now, byUserId: by.id, action: `Report ${sub.ref} added${from ? ` from ${from.ref}` : ''}` })
    save(s)
    audit(by, `Report ${sub.ref} grouped into ${to.ref}`, 'Community concerns')
    if (s.submissions.filter((x) => x.issueId === to!.id).length > 1) notify([sub.userId], 'Your concern was linked to a community issue', 'Others reported the same problem. The barangay is reviewing it.', `/my/concerns/${sub.id}`)
  })
}

/** Merge issue B into A: B's reports move to A; B is kept as closed with a pointer (nothing deleted). */
export function mergeIssues(intoId: string, fromId: string, by: User): Promise<void> {
  return mockRequest(() => {
    requireManage(by)
    if (intoId === fromId) throw new ServiceError('same', 'Choose two different issues.')
    const s = load()
    const a = s.issues.find((i) => i.id === intoId)
    const b = s.issues.find((i) => i.id === fromId)
    if (!a || !b) throw new ServiceError('not_found', 'Issue not found.')
    const now = new Date().toISOString()
    for (const sub of s.submissions.filter((x) => x.issueId === b.id)) sub.issueId = a.id
    b.status = 'closed'
    b.history.push({ at: now, byUserId: by.id, action: `Merged into ${a.ref}` })
    a.history.push({ at: now, byUserId: by.id, action: `Merged ${b.ref} into this issue` })
    save(s)
    audit(by, `Merged ${b.ref} into ${a.ref}`, 'Community concerns')
  })
}

// ── Insights (only from real records) ────────────────────────────────

export function concernInsights(by: User) {
  requireView(by)
  const s = load()
  const views = s.issues.map((i) => view(s, i)).filter((v) => v.reports > 0)
  const month = (d: string) => d.slice(0, 7)
  const thisMonth = new Date().toISOString().slice(0, 7)
  const lastMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 15).toISOString().slice(0, 7)
  const byCat = (m: string) => {
    const map = new Map<string, number>()
    for (const x of s.submissions.filter((y) => month(y.submittedAt) === m)) map.set(x.category, (map.get(x.category) ?? 0) + 1)
    return map
  }
  const now = byCat(thisMonth)
  const prev = byCat(lastMonth)
  const comparisons = [...now.entries()].filter(([c]) => prev.has(c)).map(([c, n]) => ({ category: c, previous: prev.get(c)!, current: n }))
  const days = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000
  const acted = views.filter((v) => v.firstActionAt)
  const resolved = views.filter((v) => v.resolution)
  const streets = new Map<string, number>()
  for (const x of s.submissions) if (x.street) streets.set(x.street, (streets.get(x.street) ?? 0) + 1)
  return {
    totalIssues: views.length,
    resolvedShare: views.length ? Math.round((resolved.length / views.length) * 100) : null,
    avgDaysToAction: acted.length ? Math.round((acted.reduce((n, v) => n + days(v.createdAt, v.firstActionAt!), 0) / acted.length) * 10) / 10 : null,
    avgDaysToResolve: resolved.length ? Math.round((resolved.reduce((n, v) => n + days(v.createdAt, v.resolution!.resolvedAt), 0) / resolved.length) * 10) / 10 : null,
    topStreets: [...streets.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
    rising: views.filter((v) => v.trend === 'rising' && ACTIVE.includes(v.status)).map((v) => v.title),
    comparisons,
  }
}
