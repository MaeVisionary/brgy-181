import type { BadgeTone } from '@/components/ui/Badge'
import type { ReturnState } from '@/services/equipmentService'
import type { BorrowingStatus } from '@/types/equipment'

export const RETURN_BADGE: Record<ReturnState, { label: string; tone: BadgeTone }> = {
  not_released: { label: 'Not released', tone: 'neutral' },
  on_time: { label: 'On loan', tone: 'info' },
  due_soon: { label: 'Due soon', tone: 'warning' },
  grace: { label: 'In grace period', tone: 'warning' },
  overdue: { label: 'Overdue', tone: 'danger' },
  returned: { label: 'Returned', tone: 'success' },
}

export const BORROW_STATUS: Record<BorrowingStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: 'Pending', tone: 'warning' },
  approved: { label: 'Approved: to claim', tone: 'success' },
  rejected: { label: 'Not approved', tone: 'danger' },
  released: { label: 'Released', tone: 'info' },
  returned: { label: 'Returned', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
}
