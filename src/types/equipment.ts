import type { RoleId } from './auth'

/** Equipment categories documented in the study (§1.4): chairs, tables, ladders, nebulizers. */
/** Chairs, Tables, Ladders, Nebulizers, or any category the Property Custodian adds. */
export type EquipmentCategory = string

export interface Equipment {
  id: string
  refNo: string
  name: string
  category: EquipmentCategory
  description: string
  totalQty: number
  damagedQty: number
  missingQty: number
  /** Units set aside for repair or maintenance (not lendable). */
  maintenanceQty?: number
  /** Where it is kept (e.g. Barangay Hall storage room). */
  location?: string
  history: { at: string; byUserId: string; action: string; detail?: string }[]
}

/**
 * pending: submitted, availability checked automatically, waiting for the custodian.
 * approved: reserved; resident books a pickup time.  ready: prepared and inspected.
 * released: with the borrower.  returned: back, but damaged or missing items are under review.
 * completed: everything accounted for.  rejected / cancelled: closed.
 */
export type BorrowingStatus = 'pending' | 'approved' | 'ready' | 'released' | 'returned' | 'completed' | 'rejected' | 'cancelled'

export interface BorrowItem {
  equipmentId: string
  qty: number
  /** Set when the custodian approves fewer than requested (with a reason). */
  approvedQty?: number
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
  /** Automatic availability check and estimate, recomputed when inventory changes. Never a promise. */
  estimate?: { ok: boolean; readyBy?: string; note: string; lines: { equipmentId: string; requested: number; available: number }[]; at: string }
  /** Borrowing days granted (policy, or fewer if the borrower asked to return earlier). */
  approvedDays?: number
  release?: { idPresented: boolean; acknowledged: boolean; byUserId: string }
  /** Damaged or missing items: open until the custodian closes it with a note. */
  review?: { open: boolean; note?: string; closedAt?: string; closedBy?: string }
  extensions?: { from: string; to: string; reason: string; byUserId: string; at: string }[]
  /** Reminder and overdue notice keys already sent (no duplicates). */
  remindersSent?: string[]
  history: { at: string; byUserId: string; byRole: RoleId; action: string; remarks?: string; internal?: boolean }[]
}
