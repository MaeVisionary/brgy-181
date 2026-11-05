import type { BadgeTone } from '@/components/ui/Badge'
import type { DocumentStatus, Workflow, WorkflowId } from '@/types/document'

export const STATUS_META: Record<DocumentStatus, { label: string; tone: BadgeTone }> = {
  submitted: { label: 'Submitted', tone: 'info' },
  under_review: { label: 'Under Review', tone: 'info' },
  needs_info: { label: 'Needs Additional Information', tone: 'warning' },
  for_assessment: { label: 'For Assessment', tone: 'warning' },
  processing: { label: 'Processing', tone: 'info' },
  pending_approval: { label: 'Pending Approval', tone: 'warning' },
  approved: { label: 'Approved', tone: 'success' },
  ready_for_pickup: { label: 'Ready for Pickup', tone: 'success' },
  released: { label: 'Released', tone: 'neutral' },
  served: { label: 'Served', tone: 'neutral' },
  recorded: { label: 'Recorded', tone: 'success' },
  forwarded: { label: 'Forwarded', tone: 'neutral' },
  rejected: { label: 'Rejected', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
}

/** Steps shared by workflows that start with Secretary review. */
const reviewSteps = [
  { from: ['submitted' as const], to: 'under_review' as const, label: 'Start review', by: 'documents.process' as const, hint: 'Check the requester and the submitted requirements.' },
  { from: ['under_review' as const], to: 'needs_info' as const, label: 'Request more information', by: 'documents.process' as const, remarks: 'required' as const, tone: 'secondary' as const, hint: 'The requester is notified with your note.' },
  { from: ['needs_info' as const], to: 'under_review' as const, label: 'Resume review', by: 'documents.process' as const, tone: 'secondary' as const, hint: 'Use when the information was given in person.' },
  { from: ['needs_info' as const], to: 'under_review' as const, label: 'Send reply', by: 'owner' as const, remarks: 'required' as const },
]

const cancel = (from: Workflow['path']) => [
  { from, to: 'cancelled' as const, label: 'Cancel request', by: 'owner' as const, remarks: 'optional' as const, tone: 'danger' as const },
  { from, to: 'cancelled' as const, label: 'Cancel request', by: 'documents.process' as const, remarks: 'required' as const, tone: 'danger' as const },
]

export const WORKFLOWS: Record<WorkflowId, Workflow> = {
  /**
   * Proposed process (workflows docx): resident requests → Secretary receives,
   * verifies and processes → Chairman approves → signing and sealing →
   * ready for pick-up at the Barangay Hall.
   */
  standard: {
    id: 'standard',
    name: 'Secretary verification → Chairman approval → pickup',
    path: ['submitted', 'under_review', 'processing', 'pending_approval', 'approved', 'ready_for_pickup', 'released'],
    assistedStart: 'under_review',
    issueOn: 'approved',
    printableIn: ['approved', 'ready_for_pickup', 'released'],
    editableIn: ['submitted', 'under_review', 'needs_info', 'processing'],
    transitions: [
      ...reviewSteps,
      { from: ['under_review'], to: 'processing', label: 'Mark as verified', by: 'documents.process', hint: 'Identity and records checked. Prepare the document details.' },
      { from: ['processing'], to: 'pending_approval', label: 'Forward to Chairman', by: 'documents.process', requiresComplete: true, hint: 'All document details must be complete.' },
      { from: ['pending_approval'], to: 'approved', label: 'Approve', by: 'documents.approve', remarks: 'optional', hint: 'Stamps today as the issue date. Signing and sealing follow.' },
      { from: ['pending_approval'], to: 'rejected', label: 'Reject', by: 'documents.reject', remarks: 'required', tone: 'danger' },
      { from: ['approved'], to: 'ready_for_pickup', label: 'Signed and sealed: ready for pickup', by: 'documents.process', hint: 'The requester is told to claim it at the Barangay Hall.' },
      { from: ['ready_for_pickup'], to: 'released', label: 'Record release', by: 'documents.release', remarks: 'optional', hint: 'Note who received the document.' },
      ...cancel(['submitted', 'under_review', 'needs_info']),
    ],
  },

  /**
   * Barangay Summon: complainant requests → Secretary reviews → forwarded to the
   * authorized official for assessment → if necessary, Secretary prepares the
   * summons → official approves and signs → printed and served.
   */
  summon: {
    id: 'summon',
    name: 'Review → official assessment → preparation → approval → service',
    path: ['submitted', 'under_review', 'for_assessment', 'processing', 'pending_approval', 'approved', 'served'],
    assistedStart: 'under_review',
    issueOn: 'approved',
    printableIn: ['approved', 'served'],
    editableIn: ['submitted', 'under_review', 'needs_info', 'processing'],
    transitions: [
      ...reviewSteps,
      { from: ['under_review'], to: 'for_assessment', label: 'Forward for assessment', by: 'documents.process', hint: 'The authorized official decides whether a summons is necessary.' },
      { from: ['for_assessment'], to: 'processing', label: 'Summons is necessary', by: 'documents.approve', remarks: 'optional', hint: 'The Secretary then prepares the summons.' },
      { from: ['for_assessment'], to: 'rejected', label: 'No summons needed', by: 'documents.approve', remarks: 'required', tone: 'danger' },
      { from: ['processing'], to: 'pending_approval', label: 'Submit summons for approval', by: 'documents.process', requiresComplete: true },
      { from: ['pending_approval'], to: 'approved', label: 'Approve and sign', by: 'documents.approve', remarks: 'optional' },
      { from: ['pending_approval'], to: 'processing', label: 'Return for correction', by: 'documents.approve', remarks: 'required', tone: 'secondary' },
      { from: ['approved'], to: 'served', label: 'Record service', by: 'documents.release', remarks: 'required', hint: 'Who served it, to whom, and when.' },
      ...cancel(['submitted', 'under_review', 'needs_info']),
    ],
  },

  /**
   * Incident Record Form and Blotter Report: resident reports → Secretary reviews,
   * verifies and contacts the reporter if needed → recorded → forwarded to the
   * appropriate official. Personal appearance is requested through "needs info".
   */
  record: {
    id: 'record',
    name: 'Review → record → forward to official',
    path: ['submitted', 'under_review', 'recorded', 'forwarded'],
    assistedStart: 'under_review',
    issueOn: 'recorded',
    printableIn: ['recorded', 'forwarded'],
    editableIn: ['submitted', 'under_review', 'needs_info'],
    transitions: [
      ...reviewSteps,
      { from: ['under_review'], to: 'recorded', label: 'Record entry', by: 'documents.process', requiresComplete: true, hint: 'Stamps the date and time recorded.' },
      { from: ['recorded'], to: 'forwarded', label: 'Forward to official', by: 'documents.process', remarks: 'required', hint: 'Name the official and the action requested.' },
      ...cancel(['submitted', 'under_review', 'needs_info']),
    ],
  },

  /**
   * Notice of Hearing: Secretary prepares it from the case record and approved
   * schedule → authorized official approves → printed, signed, served → recorded.
   */
  notice: {
    id: 'notice',
    name: 'Preparation → approval → service',
    path: ['processing', 'pending_approval', 'approved', 'served'],
    assistedStart: 'processing',
    issueOn: 'approved',
    printableIn: ['approved', 'served'],
    editableIn: ['processing'],
    transitions: [
      { from: ['processing'], to: 'pending_approval', label: 'Submit for approval', by: 'documents.process', requiresComplete: true },
      { from: ['pending_approval'], to: 'approved', label: 'Approve', by: 'documents.approve', remarks: 'optional' },
      { from: ['pending_approval'], to: 'processing', label: 'Return for correction', by: 'documents.approve', remarks: 'required', tone: 'secondary' },
      { from: ['approved'], to: 'served', label: 'Record issuance and service', by: 'documents.release', remarks: 'required' },
      { from: ['processing'], to: 'cancelled', label: 'Cancel notice', by: 'documents.process', remarks: 'required', tone: 'danger' },
    ],
  },
}

export const TERMINAL: DocumentStatus[] = ['released', 'served', 'forwarded', 'rejected', 'cancelled']
