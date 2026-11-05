import type { RoleId } from './auth'

/** Equipment categories documented in the study (§1.4): chairs, tables, ladders, nebulizers. */
export type EquipmentCategory = 'Chairs' | 'Tables' | 'Ladders' | 'Nebulizers'

export interface Equipment {
  id: string
  refNo: string
  name: string
  category: EquipmentCategory
  description: string
  totalQty: number
  damagedQty: number
  missingQty: number
  history: { at: string; byUserId: string; action: string; detail?: string }[]
}

export type BorrowingStatus = 'pending' | 'approved' | 'rejected' | 'released' | 'returned' | 'cancelled'

export interface BorrowItem {
  equipmentId: string
  qty: number
  /** Recorded on return. */
  returnedGood?: number
  returnedDamaged?: number
  missing?: number
}

export interface Borrowing {
  id: string
  refNo: string
  residentId?: string
  borrowerName: string
  address: string
  items: BorrowItem[]
  dateOfUse: string
  /** What the borrower stated; the due date itself follows the fixed 15-day period (FR22). */
  statedReturnDate?: string
  requestedAt: string
  status: BorrowingStatus
  releasedAt?: string
  /** releasedAt + 15 days. */
  dueAt?: string
  /** dueAt + 3 days. */
  graceEndsAt?: string
  returnedAt?: string
  conditionOnRelease?: string
  returnNotes?: string
  history: { at: string; byUserId: string; byRole: RoleId; action: string; remarks?: string }[]
}
