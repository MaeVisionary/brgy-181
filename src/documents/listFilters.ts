import { getDocumentType } from '@/documents/catalog'
import { TERMINAL, WORKFLOWS } from '@/documents/workflows'
import { claimFor } from '@/services/appointmentService'
import { availableTransitions, type DocActor } from '@/services/documentService'
import type { DocumentRequest, DocumentStatus } from '@/types/document'

/**
 * ONE set of rules for document-request lists and counts. The Document
 * Requests page and every dashboard card that counts requests use these, so
 * a card's number is the number of rows its link shows.
 */
export type DocTab = 'action' | 'open' | 'all'
export type DocStage = 'new' | 'review' | 'processing' | 'waiting' | 'ready' | 'pickup' | 'done' | 'rejected'
export type DocKind = 'documents' | 'cases'
export type DocView = 'approved'
export const DOC_TABS: readonly DocTab[] = ['action', 'open', 'all']
export const DOC_KINDS: readonly DocKind[] = ['documents', 'cases']
export const DOC_VIEWS: readonly DocView[] = ['approved']
export const STAGES: [DocStage, string][] = [
  ['new', 'New'], ['review', 'Under review'], ['processing', 'Processing'], ['waiting', 'Awaiting requirements'],
  ['ready', 'Ready for pickup'], ['pickup', 'Pickup scheduled'], ['done', 'Completed'], ['rejected', 'Rejected or cancelled'],
]
export const KIND_LABEL: Record<DocKind, string> = { documents: 'Certificates and clearances', cases: 'Complaints and reports' }
export const VIEW_LABEL: Record<DocView, string> = { approved: 'Approved by the Punong Barangay, not yet finished' }

/** Finished: rejected or cancelled, or at the last step of its own workflow (e.g. a report that was recorded and forwarded). */
export function isFinished(r: DocumentRequest): boolean {
  if (TERMINAL.includes(r.status)) return true
  const path = WORKFLOWS[getDocumentType(r.typeId).workflow].path
  return path[path.length - 1] === r.status
}
export const isOpen = (r: DocumentRequest) => !isFinished(r)

/** Where a request is, in the words the Secretary works with. Pickup counts come from the linked pickup booking. */
export function stageOf(r: DocumentRequest): DocStage {
  if (r.status === 'rejected' || r.status === 'cancelled') return 'rejected'
  if (isFinished(r)) return 'done'
  switch (r.status) {
    case 'submitted': return 'new'
    case 'under_review': case 'for_assessment': return 'review'
    case 'needs_info': return 'waiting'
    case 'ready_for_pickup': return claimFor(r.id)?.date ? 'pickup' : 'ready'
    default: return 'processing'
  }
}
export const kindOf = (r: DocumentRequest): DocKind => (getDocumentType(r.typeId).category === 'case' ? 'cases' : 'documents')

export interface DocFilter { tab?: DocTab; stage?: DocStage | ''; status?: DocumentStatus | ''; type?: string; kind?: DocKind | ''; view?: DocView | '' }

/** The rows a filter shows (search is applied by the page on top). `needsMe` = the signed-in person can act on it. */
export function filterRequests(list: DocumentRequest[], f: DocFilter, needsMe: (r: DocumentRequest) => boolean): DocumentRequest[] {
  return list.filter((r) =>
    (f.tab === 'action' ? needsMe(r) : f.tab === 'open' ? isOpen(r) : true)
    && (!f.type || r.typeId === f.type)
    && (!f.status || r.status === f.status)
    && (!f.stage || stageOf(r) === f.stage)
    && (!f.kind || kindOf(r) === f.kind)
    && (f.view !== 'approved' || (!!r.approvedBy && isOpen(r))))
}

/** Requests waiting for the Punong Barangay's decision (the Approvals page). */
export const awaitingDecision = (r: DocumentRequest) => r.status === 'pending_approval' || r.status === 'for_assessment'

/** "Needs my action": the signed-in person can move the request on (not just cancel it). Same rule on the page and the dashboards. */
export const needsActionBy = (actor: DocActor) => (r: DocumentRequest) =>
  availableTransitions(r, actor).some((t) => t.by !== 'owner' && !t.label.startsWith('Cancel'))
