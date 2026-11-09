import type { BadgeTone } from '@/components/ui/Badge'
import { returnState } from '@/services/equipmentService'
import type { CaseStage } from '@/types/case'
import type { DocumentStatus } from '@/types/document'
import type { Borrowing } from '@/types/equipment'

/**
 * Status labels residents see (Figma Resident Portal Revision v2). Staff keep the
 * detailed workflow statuses; residents see one short label per step, and each
 * label always uses the same colour.
 *
 *  Documents:  Submitted → Under Review (incl. Needs Additional Information) → Approved → Ready for Pickup → Completed (or Rejected / Cancelled)
 *  Complaints: Submitted → Under Review → Scheduled → Completed
 *  Borrowing:  Submitted → Approved → Borrowed (Overdue after the grace period) → Completed (or Rejected / Cancelled)
 */
export type ResidentStatus =
  | 'Submitted'
  | 'Under Review'
  | 'Needs Additional Information'
  | 'Approved'
  | 'Ready for Pickup'
  | 'Scheduled'
  | 'Borrowed'
  | 'Overdue'
  | 'Completed'
  | 'Rejected'
  | 'Cancelled'

export const RESIDENT_STATUS_TONE: Record<ResidentStatus, BadgeTone> = {
  Submitted: 'neutral',
  'Under Review': 'info',
  'Needs Additional Information': 'warning',
  Approved: 'info',
  'Ready for Pickup': 'success',
  Scheduled: 'info',
  Borrowed: 'info',
  Overdue: 'danger',
  Completed: 'success',
  Rejected: 'danger',
  Cancelled: 'neutral',
}

export const ALL_RESIDENT_STATUSES = Object.keys(RESIDENT_STATUS_TONE) as ResidentStatus[]

export function documentStatusForResident(s: DocumentStatus): ResidentStatus {
  switch (s) {
    case 'submitted':
      return 'Submitted'
    case 'needs_info':
      return 'Needs Additional Information'
    case 'under_review':
    case 'for_assessment':
    case 'processing':
    case 'pending_approval':
      return 'Under Review'
    case 'approved':
      return 'Approved'
    case 'ready_for_pickup':
      return 'Ready for Pickup'
    case 'rejected':
      return 'Rejected'
    case 'cancelled':
      return 'Cancelled'
    default:
      // released, served, recorded, forwarded
      return 'Completed'
  }
}

export function caseStageForResident(s: CaseStage): ResidentStatus {
  switch (s) {
    case 'filed':
      return 'Submitted'
    case 'under_review':
    case 'for_assessment':
      return 'Under Review'
    case 'mediation_scheduled':
    case 'ongoing_mediation':
    case 'referred_to_lupon':
    case 'lupon_mediation':
      return 'Scheduled'
    default:
      return 'Completed'
  }
}

export function borrowingStatusForResident(b: Borrowing, now = new Date()): ResidentStatus {
  switch (b.status) {
    case 'pending':
      return 'Submitted'
    case 'approved':
      return 'Approved'
    case 'released':
      return returnState(b, now) === 'overdue' ? 'Overdue' : 'Borrowed'
    case 'returned':
      return 'Completed'
    case 'rejected':
      return 'Rejected'
    default:
      return 'Cancelled'
  }
}
