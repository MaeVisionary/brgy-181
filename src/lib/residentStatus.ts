import type { BadgeTone } from '@/components/ui/Badge'
import { returnState } from '@/services/equipmentService'
import type { CaseStage } from '@/types/case'
import type { DocumentStatus } from '@/types/document'
import type { Borrowing } from '@/types/equipment'

/**
 * Status labels residents see. The real workflow status stays on the record;
 * this is only how it is shown to residents, in words they can act on.
 * Each transaction type uses only the labels that can occur for it.
 *
 *  Documents:  Submitted → Processing (or Action Needed) → Ready → Completed · Unsuccessful
 *  Complaints: Submitted → Processing (or Action Needed) → Completed · Unsuccessful
 *  Borrowing:  Submitted → Ready → Borrowed (Action Needed when overdue) → Completed · Unsuccessful
 */
export type ResidentStatus = 'Submitted' | 'Processing' | 'Action Needed' | 'Ready' | 'Borrowed' | 'Completed' | 'Unsuccessful'

export const RESIDENT_STATUS_TONE: Record<ResidentStatus, BadgeTone> = {
  Submitted: 'neutral',
  Processing: 'info',
  'Action Needed': 'warning',
  Ready: 'success',
  Borrowed: 'info',
  Completed: 'neutral',
  Unsuccessful: 'danger',
}

/** Labels that can occur per transaction type, in order. */
export const STATUSES_BY_KIND = {
  document: ['Submitted', 'Processing', 'Action Needed', 'Ready', 'Completed', 'Unsuccessful'],
  complaint: ['Submitted', 'Processing', 'Action Needed', 'Completed', 'Unsuccessful'],
  borrowing: ['Submitted', 'Processing', 'Action Needed', 'Ready', 'Borrowed', 'Completed', 'Unsuccessful'],
} as const satisfies Record<string, readonly ResidentStatus[]>

export const ALL_RESIDENT_STATUSES = Object.keys(RESIDENT_STATUS_TONE) as ResidentStatus[]

export function documentStatusForResident(s: DocumentStatus): ResidentStatus {
  switch (s) {
    case 'submitted':
      return 'Submitted'
    case 'needs_info':
      return 'Action Needed'
    case 'under_review':
    case 'for_assessment':
    case 'processing':
    case 'pending_approval':
    case 'approved':
    case 'for_signature':
      return 'Processing'
    case 'ready_for_pickup':
      return 'Ready'
    case 'rejected':
    case 'cancelled':
      return 'Unsuccessful'
    default:
      // released, served, recorded, forwarded
      return 'Completed'
  }
}

export function caseStageForResident(s: CaseStage): ResidentStatus {
  switch (s) {
    case 'filed':
      return 'Submitted'
    case 'settled':
    case 'closed':
      return 'Completed'
    default:
      return 'Processing'
  }
}

export function borrowingStatusForResident(b: Borrowing, now = new Date()): ResidentStatus {
  switch (b.status) {
    case 'pending':
      return 'Submitted'
    case 'approved':
      return 'Ready'
    case 'released':
      return returnState(b, now) === 'overdue' ? 'Action Needed' : 'Borrowed'
    case 'returned':
      return 'Completed'
    default:
      // rejected, cancelled
      return 'Unsuccessful'
  }
}
