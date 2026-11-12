import { BORROWING } from '@/config/barangay'
import { ROLE_PERMISSIONS } from '@/config/permissions'
import { mockBorrowings, mockEquipment } from '@/mocks/equipment'
import { mockNotifications } from '@/mocks/notifications'
import { mockUsers } from '@/mocks/users'
import type { Permission, User } from '@/types/auth'
import type { Borrowing, BorrowItem, Equipment, EquipmentCategory } from '@/types/equipment'
import { cancelFor, completeFor, createAwaitingSchedule } from './appointmentService'
import { audit } from './auditService'
import { sendEmail } from './emailService'
import { ServiceError, mockRequest } from './mockApi'
import { addWorkingDays, isWorkingDay } from './serviceStandardService'

/**
 * EQUIPMENT BORROWING LIFECYCLE.
 *
 * Request → automatic availability check and estimate → custodian approves
 * (reserves stock, resident books a pickup time) → prepared → released
 * (deadline calculated from the actual release) → reminders → overdue
 * detection → return and inspection → completed, or a damage review first.
 *
 * Availability is counted per period: stock minus damaged, missing and
 * maintenance units, minus every approved, prepared or borrowed request whose
 * period overlaps. Equipment that is overdue counts as out until returned.
 * Approval re-checks in the same step as the save, so two approvals cannot
 * over-allocate (database version: docs/supabase/equipment.sql).
 *
 * Borrowing period and grace come from the borrowing policy. The default
 * (15 days plus a 3-day grace) is the study's FR22 and is flagged until the
 * barangay confirms it. No fines or penalties are computed.
 */

// ── Policy ───────────────────────────────────────────────────────────
export interface BorrowingPolicy {
  periodDays: number
  graceDays: number
  /** Time of day the return is due, "HH:MM". */
  returnTime: string
  /** Working days the custodian needs to review and prepare. */
  processingDays: number
  reminderHours: number[]
  /** Repeat overdue notices every N days. */
  overdueRepeatDays: number
  /** True once the barangay has confirmed these numbers. */
  confirmed: boolean
}
const POLICY_KEY = 'bmis.borrowingPolicy'
export const DEFAULT_POLICY: BorrowingPolicy = { periodDays: BORROWING.periodDays, graceDays: BORROWING.graceDays, returnTime: '16:00', processingDays: 1, reminderHours: [48, 24], overdueRepeatDays: 2, confirmed: false }
export function borrowingPolicy(): BorrowingPolicy {
  try { return { ...DEFAULT_POLICY, ...(JSON.parse(localStorage.getItem(POLICY_KEY) ?? '{}') as Partial<BorrowingPolicy>) } } catch { return DEFAULT_POLICY }
}
const can = (u: User, p: Permission) => !!ROLE_PERMISSIONS[u.roleId]?.includes(p) || !!u.extraPermissions?.includes(p)
export function saveBorrowingPolicy(p: BorrowingPolicy, by: User) {
  if (!can(by, 'system.settings')) throw new ServiceError('forbidden', 'Only the System Administrator can change the borrowing rules.')
  if (!(p.periodDays >= 1 && p.periodDays <= 60) || !(p.graceDays >= 0 && p.graceDays <= 30) || !/^\d{2}:\d{2}$/.test(p.returnTime) || !(p.processingDays >= 0 && p.processingDays <= 10) || !(p.overdueRepeatDays >= 1)) throw new ServiceError('policy', 'Check the borrowing days, grace days, return time and processing days.')
  localStorage.setItem(POLICY_KEY, JSON.stringify(p))
  audit(by, `Borrowing rules: ${p.periodDays} days, ${p.graceDays} grace days, due ${p.returnTime}${p.confirmed ? ' (confirmed by the barangay)' : ''}`, 'Settings')
}

// ── Storage (prototype: this browser) ────────────────────────────────
const B_KEY = 'bmis.borrowings'
const E_KEY = 'bmis.equipment'
try {
  const b = JSON.parse(localStorage.getItem(B_KEY) ?? 'null') as Borrowing[] | null
  if (b) mockBorrowings.splice(0, mockBorrowings.length, ...b)
  const e = JSON.parse(localStorage.getItem(E_KEY) ?? 'null') as Equipment[] | null
  if (e) mockEquipment.splice(0, mockEquipment.length, ...e)
} catch { /* sample data */ }
const persist = () => { try { localStorage.setItem(B_KEY, JSON.stringify(mockBorrowings)); localStorage.setItem(E_KEY, JSON.stringify(mockEquipment)) } catch { /* ignore */ } }

export interface EqActor { user: User; permissions: ReadonlySet<Permission> }

// ── Dates ────────────────────────────────────────────────────────────
const DAY = 86_400_000
const manila = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
const today = () => manila(new Date().toISOString())
const addDays = (date: string, n: number) => new Date(new Date(`${date}T12:00:00+08:00`).getTime() + n * DAY).toISOString().slice(0, 10)
const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00+08:00`).getTime() - new Date(`${a}T12:00:00+08:00`).getTime()) / DAY)
const nextOpenDay = (date: string) => { let d = date; for (let i = 0; i < 30 && !isWorkingDay(d); i++) d = addDays(d, 1); return d }
const atTime = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+08:00`).toISOString()

// ── Quantities and periods ───────────────────────────────────────────
export const qtyOf = (i: BorrowItem) => i.approvedQty ?? i.qty
export const outstanding = (i: BorrowItem) => qtyOf(i) - (i.returnedGood ?? 0) - (i.returnedDamaged ?? 0) - (i.missing ?? 0)
const HOLDING: Borrowing['status'][] = ['approved', 'ready', 'released']
const usable = (e: Equipment) => Math.max(0, e.totalQty - e.damagedQty - e.missingQty - (e.maintenanceQty ?? 0))

/** Days the borrower may keep it: the policy, or fewer if they said they would return it sooner. */
export function approvedDaysFor(b: Pick<Borrowing, 'dateOfUse' | 'statedReturnDate'>, p = borrowingPolicy()) {
  if (!b.statedReturnDate) return p.periodDays
  return Math.max(1, Math.min(p.periodDays, daysBetween(b.dateOfUse, b.statedReturnDate) + 1))
}
/** The dates a request holds the stock: planned period, or until actually returned once released and late. */
function holdPeriod(b: Borrowing, now = Date.now()): [string, string] {
  const p = borrowingPolicy()
  if (b.status === 'released') {
    const start = manila(b.releasedAt!)
    const end = b.graceEndsAt ? manila(b.graceEndsAt) : addDays(start, b.approvedDays ?? p.periodDays)
    return [start, now > new Date(b.graceEndsAt ?? b.dueAt ?? 0).getTime() ? '9999-12-31' : end]
  }
  return [b.dateOfUse, addDays(b.dateOfUse, approvedDaysFor(b, p) + p.graceDays)]
}
const overlaps = (a: [string, string], b: [string, string]) => a[0] <= b[1] && b[0] <= a[1]

/** Units free for a period (counts approved, prepared and borrowed requests that overlap it). */
export function availableFor(equipmentId: string, from: string, to: string, excludeId?: string): number {
  const e = mockEquipment.find((x) => x.id === equipmentId)
  if (!e) return 0
  const held = mockBorrowings.filter((b) => b.id !== excludeId && HOLDING.includes(b.status) && overlaps(holdPeriod(b), [from, to]))
    .flatMap((b) => b.items).filter((i) => i.equipmentId === equipmentId).reduce((n, i) => n + outstanding(i), 0)
  return Math.max(0, usable(e) - held)
}

/** Units free today (inventory screen). */
export function availableQty(e: Equipment, excludeId?: string) { return availableFor(e.id, today(), today(), excludeId) }
export const borrowedQty = (equipmentId: string) => mockBorrowings.filter((b) => b.status === 'released').flatMap((b) => b.items).filter((i) => i.equipmentId === equipmentId).reduce((n, i) => n + outstanding(i), 0)
/** Units reserved or out. */
export const committedQty = (equipmentId: string, excludeId?: string) => mockBorrowings.filter((b) => b.id !== excludeId && HOLDING.includes(b.status)).flatMap((b) => b.items).filter((i) => i.equipmentId === equipmentId).reduce((n, i) => n + outstanding(i), 0)

/** Total, available, reserved, borrowed, overdue, unavailable for one item. */
export function equipmentStatus(e: Equipment) {
  const sum = (pred: (b: Borrowing) => boolean, f: (i: BorrowItem) => number = qtyOf) => mockBorrowings.filter(pred).flatMap((b) => b.items).filter((i) => i.equipmentId === e.id).reduce((n, i) => n + f(i), 0)
  return {
    total: e.totalQty,
    available: availableQty(e),
    pending: sum((b) => b.status === 'pending', (i) => i.qty),
    reserved: sum((b) => b.status === 'approved' || b.status === 'ready'),
    borrowed: sum((b) => b.status === 'released', outstanding),
    overdue: sum((b) => b.status === 'released' && returnState(b) === 'overdue', outstanding),
    maintenance: e.maintenanceQty ?? 0,
    unavailable: e.damagedQty + e.missingQty + (e.maintenanceQty ?? 0),
  }
}

// ── Return state and resident-facing stage ───────────────────────────
export type ReturnState = 'not_released' | 'on_time' | 'due_soon' | 'grace' | 'overdue' | 'returned'
export function returnState(b: Borrowing, now = new Date()): ReturnState {
  if (b.status === 'returned' || b.status === 'completed') return 'returned'
  if (b.status !== 'released' || !b.dueAt) return 'not_released'
  const t = now.getTime()
  const due = new Date(b.dueAt).getTime()
  const graceEnd = new Date(b.graceEndsAt ?? b.dueAt).getTime()
  if (t > graceEnd) return 'overdue'
  if (t > due) return 'grace'
  if (due - t <= 48 * 3600_000) return 'due_soon'
  return 'on_time'
}

export type BorrowingStage = 'Request Submitted' | 'Availability Checking' | 'Approved' | 'Ready for Pickup' | 'Borrowed' | 'Return Due Soon' | 'Overdue' | 'Returned' | 'Completed' | 'Rejected' | 'Cancelled'
/** The one status a resident sees for this request. */
export function borrowingStage(b: Borrowing, now = new Date()): BorrowingStage {
  switch (b.status) {
    case 'pending': return b.estimate && !b.estimate.ok ? 'Availability Checking' : 'Request Submitted'
    case 'approved': return 'Approved'
    case 'ready': return 'Ready for Pickup'
    case 'released': { const r = returnState(b, now); return r === 'overdue' ? 'Overdue' : r === 'due_soon' || r === 'grace' ? 'Return Due Soon' : 'Borrowed' }
    case 'returned': return 'Returned'
    case 'completed': return 'Completed'
    case 'rejected': return 'Rejected'
    default: return 'Cancelled'
  }
}
export const STAGE_ORDER: BorrowingStage[] = ['Request Submitted', 'Approved', 'Ready for Pickup', 'Borrowed', 'Returned', 'Completed']

// ── Estimate (never a promise) ───────────────────────────────────────
/**
 * Earliest date the request could be ready, from real stock, reservations,
 * expected returns, processing days and office days. No date when the system
 * cannot tell within 30 days.
 */
export function estimateFor(b: Pick<Borrowing, 'id' | 'items' | 'dateOfUse' | 'statedReturnDate'>, now = Date.now()): NonNullable<Borrowing['estimate']> {
  const p = borrowingPolicy()
  const len = approvedDaysFor(b, p) + p.graceDays
  const lines = b.items.map((i) => ({ equipmentId: i.equipmentId, requested: i.qty, available: availableFor(i.equipmentId, b.dateOfUse, addDays(b.dateOfUse, len), b.id) }))
  const processed = nextOpenDay(addWorkingDays(new Date(now), p.processingDays).slice(0, 10))
  const at = new Date(now).toISOString()
  if (lines.every((l) => l.available >= l.requested)) {
    // Available on the date of use, unless review and preparation take longer.
    const readyBy = processed > b.dateOfUse ? processed : nextOpenDay(b.dateOfUse)
    return { ok: true, readyBy, note: readyBy > b.dateOfUse ? 'It may not be ready by your date of use.' : 'Enough equipment for your dates.', lines, at }
  }
  for (let i = 1; i <= 30; i++) {
    const start = addDays(b.dateOfUse, i)
    if (b.items.every((it) => availableFor(it.equipmentId, start, addDays(start, len), b.id) >= it.qty)) {
      const readyBy = nextOpenDay(start > processed ? start : processed)
      return { ok: false, readyBy, note: `Not enough on your date. Enough is expected from ${readyBy}.`, lines, at }
    }
  }
  return { ok: false, note: 'Your estimated availability is being determined. We will notify you once your request has been reviewed.', lines, at }
}

// ── Notifications ────────────────────────────────────────────────────
const usersWith = (p: Permission) => mockUsers.filter((u) => u.status === 'active' && can(u, p)).map((u) => u.id)
const ownerUser = (b: Borrowing) => mockUsers.find((u) => u.residentId && u.residentId === b.residentId && u.status === 'active')?.id
function notify(userIds: (string | undefined)[], title: string, body: string, link: string) {
  const now = new Date().toISOString()
  for (const userId of new Set(userIds.filter(Boolean) as string[])) mockNotifications.push({ id: `ntf-${Math.random().toString(36).slice(2, 9)}`, userId, category: 'borrowing', title, body, createdAt: now, read: false, link })
  window.dispatchEvent(new Event('bmis:notifications-changed'))
}
function tellOwner(b: Borrowing, title: string, body: string, email = false) {
  const u = ownerUser(b)
  notify([u], title, body, `/my/borrowing/${b.id}`)
  const to = mockUsers.find((x) => x.id === u)?.email
  if (email && to) void sendEmail({ to, subject: `${title} (${b.refNo})`, body: `${body}\n\nBarangay 181 Hall\nReference: ${b.refNo}`, ref: b.refNo })
}
const custodians = () => usersWith('borrowing.release')
export const fmtDue = (iso: string) => new Date(iso).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })

// ── Reading ──────────────────────────────────────────────────────────
const canManage = (a: EqActor) => a.permissions.has('borrowing.approve') || a.permissions.has('borrowing.release') || a.permissions.has('inventory.view')
const isOwner = (b: Borrowing, a: EqActor) => !!b.residentId && b.residentId === a.user.residentId
/** Residents never see staff-only history notes. */
const forViewer = (b: Borrowing, a: EqActor): Borrowing => (canManage(a) ? { ...b } : { ...b, history: b.history.filter((h) => !h.internal) })

export function listEquipment(): Promise<Equipment[]> { return mockRequest(() => mockEquipment) }
export function listBorrowings(a: EqActor): Promise<Borrowing[]> {
  return mockRequest(() => mockBorrowings.filter((b) => canManage(a) || isOwner(b, a)).map((b) => forViewer(b, a)).sort((x, y) => y.requestedAt.localeCompare(x.requestedAt)))
}
export function getBorrowing(id: string, a: EqActor): Promise<Borrowing> {
  return mockRequest(() => {
    const b = mockBorrowings.find((x) => x.id === id)
    if (!b || !(canManage(a) || isOwner(b, a))) throw new ServiceError('not_found', 'Borrowing record not found.')
    return forViewer(b, a)
  })
}

// ── Inventory ────────────────────────────────────────────────────────
export function addEquipment(input: { name: string; category: EquipmentCategory; description: string; totalQty: number; location?: string }, a: EqActor): Promise<Equipment> {
  return mockRequest(() => {
    if (!a.permissions.has('inventory.manage')) throw new ServiceError('forbidden', 'Not allowed.')
    if (!input.name.trim() || input.totalQty < 1) throw new ServiceError('invalid', 'Enter a name and a quantity of at least 1.')
    if (mockEquipment.some((e) => e.name.trim().toLowerCase() === input.name.trim().toLowerCase())) throw new ServiceError('duplicate', 'This equipment is already in the inventory. Change its quantity instead.')
    const next = Math.max(0, ...mockEquipment.map((e) => Number(e.refNo.split('-').pop()) || 0)) + 1
    const e: Equipment = { id: `eq-${Date.now().toString(36)}`, refNo: `EQ-181-${String(next).padStart(3, '0')}`, ...input, damagedQty: 0, missingQty: 0, maintenanceQty: 0, history: [{ at: new Date().toISOString(), byUserId: a.user.id, action: 'Added to inventory', detail: `Quantity ${input.totalQty}` }] }
    mockEquipment.push(e)
    persist()
    audit(a.user, `Equipment added: ${e.name}`, 'Equipment', e.refNo)
    return e
  })
}

export function updateEquipment(id: string, patch: Partial<Pick<Equipment, 'name' | 'category' | 'description' | 'totalQty' | 'damagedQty' | 'missingQty' | 'maintenanceQty' | 'location'>>, a: EqActor): Promise<Equipment> {
  return mockRequest(() => {
    if (!a.permissions.has('inventory.manage')) throw new ServiceError('forbidden', 'Not allowed.')
    const e = mockEquipment.find((x) => x.id === id)
    if (!e) throw new ServiceError('not_found', 'Equipment not found.')
    if (patch.name !== undefined && !patch.name.trim()) throw new ServiceError('name', 'Enter the equipment name.')
    if (patch.category !== undefined && !patch.category.trim()) throw new ServiceError('category', 'Enter a category.')
    const total = patch.totalQty ?? e.totalQty
    const out = (patch.damagedQty ?? e.damagedQty) + (patch.missingQty ?? e.missingQty) + (patch.maintenanceQty ?? e.maintenanceQty ?? 0)
    if (out > total) throw new ServiceError('qty', 'Damaged, missing and maintenance units cannot be more than the total.')
    if (total - out < borrowedQty(e.id)) throw new ServiceError('qty', 'The total is lower than the units currently borrowed.')
    const changes = Object.entries(patch).filter(([k, v]) => (e as unknown as Record<string, unknown>)[k] !== v)
    Object.assign(e, patch)
    if (changes.length) {
      e.history.push({ at: new Date().toISOString(), byUserId: a.user.id, action: 'Record updated', detail: changes.map(([k, v]) => `${k}: ${v}`).join(', ') })
      audit(a.user, `Equipment updated: ${e.name}`, 'Equipment', changes.map(([k, v]) => `${k}: ${v}`).join(', '))
      recheckPending(a.user.id)
    }
    persist()
    return e
  })
}

// ── Lifecycle ────────────────────────────────────────────────────────
export function requestBorrowing(input: { residentId?: string; borrowerName: string; address: string; items: BorrowItem[]; dateOfUse: string; statedReturnDate?: string; assisted: boolean }, a: EqActor): Promise<Borrowing> {
  return mockRequest(() => {
    if (input.assisted ? !a.permissions.has('borrowing.approve') && !a.permissions.has('documents.create') : !a.permissions.has('self.borrowing')) throw new ServiceError('forbidden', 'Not allowed.')
    if (!input.assisted && input.residentId !== a.user.residentId) throw new ServiceError('forbidden', 'You can only borrow under your own name.')
    const items = input.items.filter((i) => i.qty > 0).map((i) => ({ equipmentId: i.equipmentId, qty: Math.floor(i.qty) }))
    if (!items.length) throw new ServiceError('invalid', 'Choose at least one item and quantity.')
    if (!input.dateOfUse) throw new ServiceError('invalid', 'Enter the date of use.')
    if (input.dateOfUse < today()) throw new ServiceError('invalid', 'The date of use cannot be in the past.')
    if (input.statedReturnDate && input.statedReturnDate < input.dateOfUse) throw new ServiceError('invalid', 'The return date must be on or after the date of use.')
    for (const i of items) {
      const e = mockEquipment.find((x) => x.id === i.equipmentId)
      if (!e) throw new ServiceError('invalid', 'Unknown equipment.')
      if (i.qty > usable(e)) throw new ServiceError('invalid', `The barangay has only ${usable(e)} usable ${e.name}.`)
    }
    // One open request per resident per date of use (prevents double submissions).
    if (input.residentId && mockBorrowings.some((b) => b.residentId === input.residentId && b.dateOfUse === input.dateOfUse && ['pending', 'approved', 'ready'].includes(b.status)))
      throw new ServiceError('duplicate', 'You already have a request for this date. Open it to make changes or cancel it.')
    const now = new Date().toISOString()
    const next = Math.max(0, ...mockBorrowings.map((b) => Number(b.refNo.split('-').pop()) || 0)) + 1
    const b: Borrowing = {
      id: `brw-${Date.now().toString(36)}`, refNo: `BRW-${new Date().getFullYear()}-${String(next).padStart(3, '0')}`,
      residentId: input.residentId, borrowerName: input.borrowerName, address: input.address, items, dateOfUse: input.dateOfUse,
      statedReturnDate: input.statedReturnDate || undefined, requestedAt: now, status: 'pending', remindersSent: [],
      history: [{ at: now, byUserId: a.user.id, byRole: a.user.roleId, action: input.assisted ? 'Encoded at the Barangay Hall' : 'Request submitted online' }],
    }
    b.estimate = estimateFor(b)
    b.history.push({ at: now, byUserId: 'system', byRole: 'system_admin', action: b.estimate.ok ? 'Availability checked: enough equipment' : 'Availability checked: not enough on the requested date' })
    mockBorrowings.unshift(b)
    persist()
    tellOwner(b, 'Borrowing request received', b.estimate.readyBy ? `Estimated availability: ${b.estimate.readyBy}. ${b.estimate.note}` : b.estimate.note)
    notify(usersWith('borrowing.approve'), 'New borrowing request', `${b.refNo} from ${b.borrowerName}${b.estimate.ok ? '' : ' (not enough stock on the requested date)'}.`, `/borrowing/${b.id}`)
    return { ...b }
  })
}

type Action = 'approve' | 'reject' | 'ready' | 'release' | 'return' | 'cancel' | 'close_review'
export interface ActOptions {
  remarks?: string
  condition?: string
  /** Approve fewer than requested (needs remarks). */
  approvedQty?: Record<string, number>
  /** Release checks. */
  idPresented?: boolean
  acknowledged?: boolean
  /** Return: counts per item; anything not listed stays with the borrower. */
  returns?: { equipmentId: string; good: number; damaged: number; missing: number }[]
}

export function actOnBorrowing(id: string, action: Action, a: EqActor, opts: ActOptions = {}): Promise<Borrowing> {
  return mockRequest(() => {
    const b = mockBorrowings.find((x) => x.id === id)
    if (!b) throw new ServiceError('not_found', 'Borrowing record not found.')
    const now = new Date().toISOString()
    const log = (label: string, remarks?: string, internal?: boolean) => b.history.push({ at: now, byUserId: a.user.id, byRole: a.user.roleId, action: label, remarks, internal })
    const need = (p: Permission) => { if (!a.permissions.has(p)) throw new ServiceError('forbidden', 'You are not allowed to do this.') }
    const state = (...s: Borrowing['status'][]) => { if (!s.includes(b.status)) throw new ServiceError('state', 'This step is not available for this request now.') }
    const p = borrowingPolicy()
    const name = (eid: string) => mockEquipment.find((e) => e.id === eid)?.name ?? eid

    if (action === 'approve') {
      need('borrowing.approve'); state('pending')
      const partial = b.items.filter((it) => opts.approvedQty?.[it.equipmentId] !== undefined && opts.approvedQty[it.equipmentId] < it.qty)
      if (partial.length && (opts.remarks?.trim().length ?? 0) < 5) throw new ServiceError('remarks', 'Explain why fewer items are approved.')
      const len = approvedDaysFor(b, p) + p.graceDays
      for (const it of b.items) {
        const q = opts.approvedQty?.[it.equipmentId] ?? it.qty
        if (q < 1 || q > it.qty) throw new ServiceError('qty', 'Approved quantity must be between 1 and the quantity requested.')
        const free = availableFor(it.equipmentId, b.dateOfUse, addDays(b.dateOfUse, len), b.id)
        if (free < q) throw new ServiceError('unavailable', `Only ${free} ${name(it.equipmentId)} free for these dates. Approve fewer, or reject with a reason.`)
      }
      for (const it of partial) it.approvedQty = opts.approvedQty![it.equipmentId]
      b.status = 'approved'
      b.approvedDays = approvedDaysFor(b, p)
      log(partial.length ? 'Approved with fewer items' : 'Approved: equipment reserved', opts.remarks)
      const what = b.items.map((i) => `${qtyOf(i)} ${name(i.equipmentId)}`).join(', ')
      tellOwner(b, partial.length ? 'Request approved with fewer items' : 'Borrowing request approved', `${what}. Please choose a pickup time in My Appointments.${partial.length ? ` Reason: ${opts.remarks!.trim()}` : ''}`, true)
      createAwaitingSchedule({ kind: 'equipment_pickup', subjectId: b.id, subjectRef: b.refNo, title: what, residentId: b.residentId, userId: ownerUser(b), reason: `Pick up ${what}`, documents: ['Valid government-issued ID', `Your borrowing reference number (${b.refNo})`] }, a.user.id)
    } else if (action === 'reject') {
      need('borrowing.approve'); state('pending')
      if ((opts.remarks?.trim().length ?? 0) < 5) throw new ServiceError('remarks', 'Give the reason. The resident will see it.')
      b.status = 'rejected'
      log('Not approved', opts.remarks)
      tellOwner(b, 'Borrowing request not approved', opts.remarks!.trim(), true)
    } else if (action === 'ready') {
      need('borrowing.release'); state('approved')
      b.status = 'ready'
      log('Prepared and inspected: ready for pickup', opts.condition)
      tellOwner(b, 'Ready for pickup', 'Your equipment is prepared. Please come at your pickup time and bring a valid ID.')
    } else if (action === 'release') {
      need('borrowing.release'); state('approved', 'ready')
      if (!opts.idPresented) throw new ServiceError('id', 'Check the borrower’s ID first.')
      if (!opts.acknowledged) throw new ServiceError('ack', 'The borrower must confirm they received the items.')
      for (const it of b.items) if (availableFor(it.equipmentId, today(), today(), b.id) < qtyOf(it)) throw new ServiceError('unavailable', `Not enough ${name(it.equipmentId)} in storage right now (an earlier borrower may not have returned theirs).`)
      const days = b.approvedDays ?? approvedDaysFor(b, p)
      const dueDate = nextOpenDay(addDays(today(), days))
      const graceDate = p.graceDays ? nextOpenDay(addDays(dueDate, p.graceDays)) : dueDate
      Object.assign(b, { status: 'released', releasedAt: now, approvedDays: days, dueAt: atTime(dueDate, p.returnTime), graceEndsAt: atTime(graceDate, p.returnTime), conditionOnRelease: opts.condition?.trim() || 'Good', release: { idPresented: true, acknowledged: true, byUserId: a.user.id }, remindersSent: [] })
      log('Released to the borrower', `Condition: ${b.conditionOnRelease}. ID checked; receipt confirmed.`)
      completeFor('equipment_pickup', b.id, 'Equipment released', a.user.id)
      tellOwner(b, 'Equipment released to you', `Please return it by ${fmtDue(b.dueAt!)}${p.graceDays ? ` (grace period until ${fmtDue(b.graceEndsAt!)})` : ''}.`, true)
      createAwaitingSchedule({ kind: 'equipment_return', subjectId: b.id, subjectRef: b.refNo, title: b.refNo, residentId: b.residentId, userId: ownerUser(b), reason: `Return the equipment by ${fmtDue(b.dueAt!)}`, documents: [`Your borrowing reference number (${b.refNo})`] }, a.user.id)
    } else if (action === 'return') {
      need('borrowing.release'); state('released')
      const rs = opts.returns ?? []
      if (!rs.length || rs.every((r) => r.good + r.damaged + r.missing === 0)) throw new ServiceError('invalid', 'Enter what was returned.')
      for (const r of rs) {
        const it = b.items.find((i) => i.equipmentId === r.equipmentId)
        if (!it) throw new ServiceError('invalid', 'Unknown item.')
        if ([r.good, r.damaged, r.missing].some((n) => n < 0 || !Number.isInteger(n))) throw new ServiceError('invalid', 'Use whole numbers.')
        if (r.good + r.damaged + r.missing > outstanding(it)) throw new ServiceError('invalid', 'That is more than the borrower still has.')
      }
      for (const r of rs) {
        const it = b.items.find((i) => i.equipmentId === r.equipmentId)!
        it.returnedGood = (it.returnedGood ?? 0) + r.good
        it.returnedDamaged = (it.returnedDamaged ?? 0) + r.damaged
        it.missing = (it.missing ?? 0) + r.missing
        const e = mockEquipment.find((x) => x.id === r.equipmentId)!
        e.damagedQty += r.damaged
        e.missingQty += r.missing
        if (r.damaged || r.missing) e.history.push({ at: now, byUserId: a.user.id, action: 'Return inspection', detail: `${b.refNo}: ${r.damaged} damaged, ${r.missing} missing` })
      }
      const counts = rs.filter((r) => r.good + r.damaged + r.missing > 0).map((r) => `${name(r.equipmentId)}: ${r.good} good${r.damaged ? `, ${r.damaged} damaged` : ''}${r.missing ? `, ${r.missing} missing` : ''}`).join('; ')
      const left = b.items.reduce((n, i) => n + outstanding(i), 0)
      const issues = b.items.some((i) => (i.returnedDamaged ?? 0) + (i.missing ?? 0) > 0)
      if (left > 0) {
        log('Partly returned', counts)
        tellOwner(b, 'Part of your equipment was returned', `Recorded: ${counts}. ${left} item(s) are still with you; please return them by ${fmtDue(b.dueAt!)}.`)
      } else {
        b.returnedAt = now
        b.returnNotes = opts.remarks?.trim() || undefined
        completeFor('equipment_return', b.id, 'Equipment returned', a.user.id)
        if (issues) {
          b.status = 'returned'
          b.review = { open: true }
          log('Returned: damaged or missing items to review', counts)
          tellOwner(b, 'Return recorded', 'Thank you. Some items were damaged or missing; the Property Custodian will contact you.')
        } else {
          b.status = 'completed'
          log('Returned and inspected: complete', counts)
          tellOwner(b, 'Return recorded', 'Thank you. Everything was returned in good condition.')
        }
      }
      recheckPending(a.user.id)
    } else if (action === 'close_review') {
      need('borrowing.approve'); state('returned')
      if ((opts.remarks?.trim().length ?? 0) < 5) throw new ServiceError('remarks', 'Write how it was settled.')
      b.status = 'completed'
      b.review = { open: false, note: opts.remarks!.trim(), closedAt: now, closedBy: a.user.id }
      log('Damage review closed', opts.remarks, true)
    } else if (action === 'cancel') {
      const own = isOwner(b, a)
      if (!own && !a.permissions.has('borrowing.approve')) throw new ServiceError('forbidden', 'You are not allowed to do this.')
      state('pending', 'approved', 'ready')
      if (!own && (opts.remarks?.trim().length ?? 0) < 5) throw new ServiceError('remarks', 'Give the reason. The resident will see it.')
      b.status = 'cancelled'
      log(own ? 'Cancelled by the borrower' : 'Cancelled by the barangay', opts.remarks)
      cancelFor('equipment_pickup', b.id, own ? 'You cancelled the borrowing request' : opts.remarks!.trim(), a.user.id)
      if (!own) tellOwner(b, 'Borrowing request cancelled', opts.remarks!.trim())
      recheckPending(a.user.id)
    }
    persist()
    audit(a.user, `Borrowing ${action}: ${b.refNo}`, 'Equipment', opts.remarks)
    return { ...b }
  })
}

/** Custodian moves the return deadline (with reason); never silently. */
export function extendReturn(id: string, newDate: string, reason: string, a: EqActor): Promise<Borrowing> {
  return mockRequest(() => {
    if (!a.permissions.has('borrowing.approve')) throw new ServiceError('forbidden', 'You are not allowed to do this.')
    const b = mockBorrowings.find((x) => x.id === id)
    if (!b || b.status !== 'released' || !b.dueAt) throw new ServiceError('state', 'Only borrowed equipment can get a new return date.')
    if (reason.trim().length < 5) throw new ServiceError('reason', 'Give the reason.')
    if (newDate <= manila(b.dueAt)) throw new ServiceError('date', 'Choose a later date than the current deadline.')
    if (!isWorkingDay(newDate)) throw new ServiceError('date', 'The Barangay Hall is closed on that day.')
    const p = borrowingPolicy()
    const from = b.dueAt
    b.dueAt = atTime(newDate, p.returnTime)
    b.graceEndsAt = atTime(p.graceDays ? nextOpenDay(addDays(newDate, p.graceDays)) : newDate, p.returnTime)
    b.remindersSent = (b.remindersSent ?? []).filter((k) => !k.startsWith('due-') && !k.startsWith('overdue'))
    b.extensions = [...(b.extensions ?? []), { from, to: b.dueAt, reason: reason.trim(), byUserId: a.user.id, at: new Date().toISOString() }]
    b.history.push({ at: new Date().toISOString(), byUserId: a.user.id, byRole: a.user.roleId, action: `Return date moved to ${fmtDue(b.dueAt)}`, remarks: reason.trim() })
    persist()
    audit(a.user, `Return date changed: ${b.refNo}`, 'Equipment', `${from} → ${b.dueAt}: ${reason.trim()}`)
    tellOwner(b, 'New return date', `Please return it by ${fmtDue(b.dueAt)}. Reason: ${reason.trim()}`, true)
    recheckPending(a.user.id)
    return { ...b }
  })
}

/** A manual reminder in addition to the automatic ones. */
export function sendLateNotice(id: string, a: EqActor): Promise<Borrowing> {
  return mockRequest(() => {
    const b = mockBorrowings.find((x) => x.id === id)
    if (!b || !a.permissions.has('borrowing.release') || b.status !== 'released') throw new ServiceError('invalid', 'Not available.')
    tellOwner(b, 'Please return the borrowed equipment', `It was due on ${fmtDue(b.dueAt!)}. Please return it to the Barangay 181 Hall as soon as possible.`, true)
    b.history.push({ at: new Date().toISOString(), byUserId: a.user.id, byRole: a.user.roleId, action: 'Reminder sent by the Property Custodian' })
    persist()
    return { ...b }
  })
}

/** Pending requests are re-estimated when stock frees up or is taken; residents hear only when their outlook changes. */
function recheckPending(byUserId: string) {
  for (const b of mockBorrowings.filter((x) => x.status === 'pending')) {
    const before = b.estimate
    const now = estimateFor(b)
    if (before?.ok !== now.ok || before?.readyBy !== now.readyBy) {
      b.estimate = now
      b.history.push({ at: new Date().toISOString(), byUserId, byRole: 'system_admin', action: now.ok ? 'Availability rechecked: enough equipment now' : 'Availability rechecked: not enough on the requested date' })
      tellOwner(b, 'Update on your borrowing request', now.readyBy ? `Estimated availability: ${now.readyBy}. ${now.note}` : now.note)
    }
  }
}

/**
 * Automatic checks (page loads here; a scheduled server job on Supabase):
 * reminders before the deadline and on the day, overdue after the grace
 * period (resident and custodian), repeated every few days, and a warning when
 * a late return puts an upcoming reservation at risk. Each notice is sent
 * once (keys in remindersSent).
 */
export function runBorrowingJobs(nowMs = Date.now()) {
  const p = borrowingPolicy()
  let changed = false
  const stamp = new Date(nowMs).toISOString()
  // Older requests without an estimate get one (no notice: nothing changed for the resident).
  for (const b of mockBorrowings.filter((x) => x.status === 'pending' && !x.estimate)) { b.estimate = estimateFor(b, nowMs); changed = true }
  for (const b of mockBorrowings.filter((x) => x.status === 'released' && x.dueAt)) {
    const sent = (b.remindersSent ??= [])
    const due = new Date(b.dueAt!).getTime()
    const graceEnd = new Date(b.graceEndsAt ?? b.dueAt!).getTime()
    if (nowMs < due) {
      const pending = p.reminderHours.filter((h) => !sent.includes(`due-${h}h`) && due - nowMs <= h * 3600_000).sort((x, y) => x - y)
      if (pending.length) { sent.push(...pending.map((h) => `due-${h}h`)); tellOwner(b, pending[0] >= 48 ? 'Return due in 2 days' : pending[0] >= 24 ? 'Return due tomorrow' : 'Return due soon', `Please return it by ${fmtDue(b.dueAt!)}.`); changed = true }
      if (manila(stamp) === manila(b.dueAt!) && !sent.includes('due-day')) { sent.push('due-day'); tellOwner(b, 'Return due today', `Please return it by ${fmtDue(b.dueAt!)}.`); changed = true }
    } else if (nowMs > graceEnd) {
      const days = Math.floor((nowMs - graceEnd) / DAY)
      const key = `overdue-${Math.floor(days / p.overdueRepeatDays)}`
      if (!sent.includes(key)) {
        sent.push(key)
        if (key === 'overdue-0') b.history.push({ at: stamp, byUserId: 'system', byRole: 'system_admin', action: `Overdue (deadline was ${fmtDue(b.dueAt!)})` })
        tellOwner(b, 'Your borrowed equipment is overdue', `Your borrowed equipment is overdue. Please return it to the Barangay Hall as soon as possible. It was due on ${fmtDue(b.dueAt!)}.`, key === 'overdue-0')
        notify(custodians(), `Overdue: ${b.refNo}`, `${b.borrowerName} · due ${fmtDue(b.dueAt!)} · ${days + 1} day(s) overdue`, `/borrowing/${b.id}`)
        changed = true
      }
      for (const r of mockBorrowings.filter((x) => (x.status === 'approved' || x.status === 'ready') && x.dateOfUse >= manila(stamp))) {
        const short = r.items.some((it) => b.items.some((bi) => bi.equipmentId === it.equipmentId) && availableFor(it.equipmentId, r.dateOfUse, r.dateOfUse, r.id) < qtyOf(it))
        const rkey = `at-risk-${b.id}`
        if (short && !(r.remindersSent ??= []).includes(rkey)) {
          r.remindersSent.push(rkey)
          r.history.push({ at: stamp, byUserId: 'system', byRole: 'system_admin', action: 'Pickup at risk: an earlier borrower has not returned the equipment', internal: true })
          notify(custodians(), `Pickup at risk: ${r.refNo}`, `${b.refNo} is overdue and ${r.refNo} needs the same equipment on ${r.dateOfUse}.`, `/borrowing/${r.id}`)
          tellOwner(r, 'Your pickup may be delayed', 'Equipment you reserved has not been returned yet. The Property Custodian will contact you if your pickup needs to move.')
          changed = true
        }
      }
    }
  }
  if (changed) persist()
}
