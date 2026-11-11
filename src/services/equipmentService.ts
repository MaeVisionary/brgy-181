import { BORROWING } from '@/config/barangay'
import { ROLE_PERMISSIONS } from '@/config/permissions'
import { mockBorrowings, mockEquipment } from '@/mocks/equipment'
import { mockNotifications } from '@/mocks/notifications'
import { mockUsers } from '@/mocks/users'
import type { Permission, User } from '@/types/auth'
import type { Borrowing, BorrowItem, Equipment, EquipmentCategory } from '@/types/equipment'
import { ServiceError, mockRequest } from './mockApi'

/**
 * Equipment inventory and borrowing (SAMPLE DATA, in memory). FR21–FR22:
 * fixed 15-day borrowing period + 3-day grace period; late returns notify both
 * borrower and Property Custodian. No fines are computed (barangay policy applies).
 */

export interface EqActor {
  user: User
  permissions: ReadonlySet<Permission>
}

const ACTIVE: Borrowing['status'][] = ['approved', 'released']

/** Units currently out or reserved for approved requests. */
export function committedQty(equipmentId: string, excludeId?: string) {
  return mockBorrowings
    .filter((b) => b.id !== excludeId && ACTIVE.includes(b.status))
    .flatMap((b) => b.items)
    .filter((i) => i.equipmentId === equipmentId)
    .reduce((n, i) => n + i.qty, 0)
}

export const borrowedQty = (equipmentId: string) =>
  mockBorrowings.filter((b) => b.status === 'released').flatMap((b) => b.items).filter((i) => i.equipmentId === equipmentId).reduce((n, i) => n + i.qty, 0)

export function availableQty(e: Equipment, excludeId?: string) {
  return Math.max(0, e.totalQty - e.damagedQty - e.missingQty - (e.maintenanceQty ?? 0) - committedQty(e.id, excludeId))
}

/** Units by status for one item (Available, Pending Request, Reserved, Borrowed, Overdue, Under Maintenance). */
export function equipmentStatus(e: Equipment) {
  const sum = (pred: (b: Borrowing) => boolean) =>
    mockBorrowings.filter(pred).flatMap((b) => b.items).filter((i) => i.equipmentId === e.id).reduce((n, i) => n + i.qty, 0)
  return {
    available: availableQty(e),
    pending: sum((b) => b.status === 'pending'),
    reserved: sum((b) => b.status === 'approved'),
    borrowed: sum((b) => b.status === 'released'),
    overdue: sum((b) => b.status === 'released' && returnState(b) === 'overdue'),
    maintenance: e.maintenanceQty ?? 0,
  }
}

export type ReturnState = 'not_released' | 'on_time' | 'due_soon' | 'grace' | 'overdue' | 'returned'

export function returnState(b: Borrowing, now = new Date()): ReturnState {
  if (b.status === 'returned') return 'returned'
  if (b.status !== 'released' || !b.dueAt || !b.graceEndsAt) return 'not_released'
  const t = now.getTime()
  if (t > new Date(b.graceEndsAt).getTime()) return 'overdue'
  if (t > new Date(b.dueAt).getTime()) return 'grace'
  if (new Date(b.dueAt).getTime() - t < 3 * 86400000) return 'due_soon'
  return 'on_time'
}

const usersWith = (p: Permission) => mockUsers.filter((u) => u.status === 'active' && (ROLE_PERMISSIONS[u.roleId].includes(p) || u.extraPermissions?.includes(p))).map((u) => u.id)
const ownerUser = (b: Borrowing) => mockUsers.find((u) => u.residentId && u.residentId === b.residentId)?.id

function notify(userIds: (string | undefined)[], title: string, body: string, link: string) {
  const now = new Date().toISOString()
  for (const userId of new Set(userIds.filter(Boolean) as string[])) {
    mockNotifications.push({ id: `ntf-${Math.random().toString(36).slice(2, 9)}`, userId, category: 'borrowing', title, body, createdAt: now, read: false, link })
  }
  window.dispatchEvent(new Event('bmis:notifications-changed'))
}

const canManage = (a: EqActor) => a.permissions.has('borrowing.approve') || a.permissions.has('borrowing.release') || a.permissions.has('inventory.view')
const isOwner = (b: Borrowing, a: EqActor) => !!b.residentId && b.residentId === a.user.residentId

export function listEquipment(): Promise<Equipment[]> {
  return mockRequest(() => mockEquipment)
}

export function listBorrowings(a: EqActor): Promise<Borrowing[]> {
  return mockRequest(() =>
    mockBorrowings.filter((b) => canManage(a) || isOwner(b, a)).sort((x, y) => y.requestedAt.localeCompare(x.requestedAt)),
  )
}

export function getBorrowing(id: string, a: EqActor): Promise<Borrowing> {
  return mockRequest(() => {
    const b = mockBorrowings.find((x) => x.id === id)
    if (!b || !(canManage(a) || isOwner(b, a))) throw new ServiceError('not_found', 'Borrowing record not found.')
    return b
  })
}

export function addEquipment(input: { name: string; category: EquipmentCategory; description: string; totalQty: number; location?: string }, a: EqActor): Promise<Equipment> {
  return mockRequest(() => {
    if (!a.permissions.has('inventory.manage')) throw new ServiceError('forbidden', 'Not allowed.')
    if (!input.name.trim() || input.totalQty < 1) throw new ServiceError('invalid', 'Enter a name and a quantity of at least 1.')
    const e: Equipment = {
      id: `eq-${Date.now().toString(36)}`,
      refNo: `EQ-181-${String(mockEquipment.length + 1).padStart(3, '0')}`,
      ...input,
      damagedQty: 0,
      missingQty: 0,
      maintenanceQty: 0,
      history: [{ at: new Date().toISOString(), byUserId: a.user.id, action: 'Added to inventory', detail: `Quantity ${input.totalQty}` }],
    }
    mockEquipment.push(e)
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
    if (changes.length) e.history.push({ at: new Date().toISOString(), byUserId: a.user.id, action: 'Record updated', detail: changes.map(([k, v]) => `${k}: ${v}`).join(', ') })
    return e
  })
}

export function requestBorrowing(input: { residentId?: string; borrowerName: string; address: string; items: BorrowItem[]; dateOfUse: string; statedReturnDate?: string; assisted: boolean }, a: EqActor): Promise<Borrowing> {
  return mockRequest(() => {
    if (input.assisted ? !a.permissions.has('borrowing.approve') && !a.permissions.has('documents.create') : !a.permissions.has('self.borrowing')) throw new ServiceError('forbidden', 'Not allowed.')
    if (!input.assisted && input.residentId !== a.user.residentId) throw new ServiceError('forbidden', 'You can only borrow under your own name.')
    const items = input.items.filter((i) => i.qty > 0)
    if (!items.length) throw new ServiceError('invalid', 'Choose at least one item and quantity.')
    if (!input.dateOfUse) throw new ServiceError('invalid', 'Enter the date of use.')
    const now = new Date().toISOString()
    const b: Borrowing = {
      id: `brw-${Date.now().toString(36)}`,
      refNo: `BRW-2026-${String(42 + mockBorrowings.length).padStart(3, '0')}`,
      residentId: input.residentId,
      borrowerName: input.borrowerName,
      address: input.address,
      items,
      dateOfUse: input.dateOfUse,
      statedReturnDate: input.statedReturnDate || undefined,
      requestedAt: now,
      status: 'pending',
      history: [{ at: now, byUserId: a.user.id, byRole: a.user.roleId, action: input.assisted ? 'Encoded at the Barangay Hall' : 'Request submitted online' }],
    }
    mockBorrowings.unshift(b)
    notify(usersWith('borrowing.approve'), 'New borrowing request', `${b.refNo} from ${b.borrowerName}.`, `/borrowing/${b.id}`)
    return b
  })
}

type Action = 'approve' | 'reject' | 'release' | 'return' | 'cancel'

export function actOnBorrowing(
  id: string,
  action: Action,
  a: EqActor,
  opts: { remarks?: string; condition?: string; returns?: { equipmentId: string; good: number; damaged: number; missing: number }[] } = {},
): Promise<Borrowing> {
  return mockRequest(() => {
    const b = mockBorrowings.find((x) => x.id === id)
    if (!b) throw new ServiceError('not_found', 'Borrowing record not found.')
    const now = new Date().toISOString()
    const log = (label: string, remarks?: string) => b.history.push({ at: now, byUserId: a.user.id, byRole: a.user.roleId, action: label, remarks })
    const ownerLink = `/my/borrowing`

    if (action === 'approve' || action === 'reject') {
      if (!a.permissions.has('borrowing.approve') || b.status !== 'pending') throw new ServiceError('invalid', 'Not available.')
      if (action === 'approve') {
        for (const it of b.items) {
          const e = mockEquipment.find((x) => x.id === it.equipmentId)!
          if (availableQty(e, b.id) < it.qty) throw new ServiceError('unavailable', `Only ${availableQty(e, b.id)} ${e.name} available.`)
        }
        b.status = 'approved'
        log('Approved: equipment available', opts.remarks)
        notify([ownerUser(b)], `${b.refNo} approved`, 'Please claim the equipment at the Barangay 181 Hall.', ownerLink)
      } else {
        if (!opts.remarks?.trim()) throw new ServiceError('remarks', 'Add the reason.')
        b.status = 'rejected'
        log('Rejected', opts.remarks)
        notify([ownerUser(b)], `${b.refNo} not approved`, opts.remarks!, ownerLink)
      }
    } else if (action === 'release') {
      if (!a.permissions.has('borrowing.release') || b.status !== 'approved') throw new ServiceError('invalid', 'Not available.')
      const due = new Date()
      due.setDate(due.getDate() + BORROWING.periodDays)
      const grace = new Date(due)
      grace.setDate(grace.getDate() + BORROWING.graceDays)
      Object.assign(b, { status: 'released', releasedAt: now, dueAt: due.toISOString(), graceEndsAt: grace.toISOString(), conditionOnRelease: opts.condition?.trim() || 'Good' })
      log('Released', `Condition: ${b.conditionOnRelease}`)
    } else if (action === 'return') {
      if (!a.permissions.has('borrowing.release') || b.status !== 'released') throw new ServiceError('invalid', 'Not available.')
      for (const r of opts.returns ?? []) {
        const it = b.items.find((i) => i.equipmentId === r.equipmentId)!
        if (r.good + r.damaged + r.missing !== it.qty) throw new ServiceError('invalid', 'Good + damaged + missing must equal the quantity borrowed.')
        it.returnedGood = r.good
        it.returnedDamaged = r.damaged
        it.missing = r.missing
        const e = mockEquipment.find((x) => x.id === r.equipmentId)!
        e.damagedQty += r.damaged
        e.missingQty += r.missing
        if (r.damaged || r.missing) e.history.push({ at: now, byUserId: a.user.id, action: 'Return inspection', detail: `${b.refNo}: ${r.damaged} damaged, ${r.missing} missing` })
      }
      b.status = 'returned'
      b.returnedAt = now
      b.returnNotes = opts.remarks?.trim() || undefined
      log('Returned and inspected', (opts.returns ?? []).map((r) => `${r.good} good, ${r.damaged} damaged, ${r.missing} missing`).join('; '))
    } else if (action === 'cancel') {
      if (!(isOwner(b, a) || a.permissions.has('borrowing.approve')) || !['pending', 'approved'].includes(b.status)) throw new ServiceError('invalid', 'Not available.')
      b.status = 'cancelled'
      log('Cancelled', opts.remarks)
    }
    return b
  })
}

/** FR22: late-return notices to borrower and Property Custodian (simulated). */
export function sendLateNotice(id: string, a: EqActor): Promise<Borrowing> {
  return mockRequest(() => {
    const b = mockBorrowings.find((x) => x.id === id)
    if (!b || !a.permissions.has('borrowing.release')) throw new ServiceError('invalid', 'Not available.')
    notify([ownerUser(b), ...usersWith('borrowing.release')], `Overdue: ${b.refNo}`, `The borrowed equipment was due on ${new Date(b.dueAt!).toLocaleDateString('en-PH', { dateStyle: 'long' })}. Please return it to the Barangay 181 Hall.`, '/my/borrowing')
    b.history.push({ at: new Date().toISOString(), byUserId: a.user.id, byRole: a.user.roleId, action: 'Late-return notice sent' })
    return b
  })
}
