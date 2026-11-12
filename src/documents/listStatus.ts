import type { BadgeTone } from '@/components/ui/Badge'
import { availableTransitions } from '@/services/documentService'
import type { DocActor } from '@/services/documentService'
import type { DocumentRequest } from '@/types/document'

/**
 * Status shown in staff request LISTS: only when it helps someone decide what
 * to open. Requests moving along normally show nothing; the full workflow
 * status stays on the request's own page.
 */
export function listStatus(r: DocumentRequest, actor: DocActor): { label: string; tone: BadgeTone } | null {
  if (availableTransitions(r, actor).some((t) => t.by !== 'owner' && !t.label.startsWith('Cancel'))) return { label: 'Needs review', tone: 'warning' }
  switch (r.status) {
    case 'needs_info':
      return { label: 'Waiting on resident', tone: 'neutral' }
    case 'ready_for_pickup':
      return { label: 'Ready', tone: 'success' }
    case 'rejected':
      return { label: 'Rejected', tone: 'danger' }
    case 'cancelled':
      return { label: 'Cancelled', tone: 'neutral' }
    case 'released':
    case 'served':
    case 'recorded':
    case 'forwarded':
      return { label: 'Completed', tone: 'neutral' }
    default:
      return null
  }
}
