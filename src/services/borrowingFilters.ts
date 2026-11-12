import type { Borrowing, BorrowingStatus } from '@/types/equipment'
import { returnState } from './equipmentService'

/**
 * ONE set of rules for borrowing lists and counts (Equipment Borrowing page
 * and the Property Custodian's dashboard). Each value is one list filter.
 */
export type BorrowFilter = '' | BorrowingStatus | 'overdue' | 'to_pickup' | 'due_today' | 'due_soon'
export const BORROW_FILTERS: { value: BorrowFilter; label: string }[] = [
  { value: '', label: 'All transactions' },
  { value: 'pending', label: 'New requests' },
  { value: 'to_pickup', label: 'Approved, awaiting pickup' },
  { value: 'approved', label: 'Approved: to prepare' },
  { value: 'ready', label: 'Ready for pickup' },
  { value: 'released', label: 'Borrowed' },
  { value: 'due_today', label: 'Borrowed: due today' },
  { value: 'due_soon', label: 'Borrowed: due within 48 hours or in grace period' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'returned', label: 'Damage review' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Not approved' },
  { value: 'cancelled', label: 'Cancelled' },
]
export const BORROW_FILTER_VALUES = BORROW_FILTERS.map((f) => f.value)

const manilaDay = (iso: string | Date) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })

export function matchesBorrowFilter(b: Borrowing, f: BorrowFilter, now = new Date()): boolean {
  switch (f) {
    case '': return true
    case 'overdue': return returnState(b, now) === 'overdue'
    case 'to_pickup': return b.status === 'approved' || b.status === 'ready'
    case 'due_today': return b.status === 'released' && !!b.dueAt && manilaDay(b.dueAt) === manilaDay(now)
    case 'due_soon': return ['due_soon', 'grace'].includes(returnState(b, now))
    default: return b.status === f
  }
}
export const filterBorrowings = (list: Borrowing[], f: BorrowFilter) => list.filter((b) => matchesBorrowFilter(b, f))
