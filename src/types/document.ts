import type { Permission, RoleId } from './auth'

export type DocumentTypeId =
  | 'first-time-job-seeker'
  | 'non-residency'
  | 'cohabitation'
  | 'no-partner'
  | 'residency'
  | 'indigency'
  | 'summon'
  | 'incident-record'
  | 'clearance-person'
  | 'business-clearance'
  | 'barangay-certificate'
  | 'blotter-report'
  | 'notice-of-hearing'

export type DocumentStatus =
  | 'submitted'
  | 'under_review'
  | 'needs_info'
  | 'for_assessment'
  | 'processing'
  | 'pending_approval'
  | 'approved'
  | 'for_signature'
  | 'ready_for_pickup'
  | 'released'
  | 'served'
  | 'recorded'
  | 'forwarded'
  | 'rejected'
  | 'cancelled'

export type WorkflowId = 'standard' | 'summon' | 'record' | 'notice'

/** Who may perform a transition: a permission, or the requesting resident. */
export type Actor = Permission | 'owner'

export interface Transition {
  from: DocumentStatus[]
  to: DocumentStatus
  label: string
  by: Actor
  /** Shown under the button so staff know what the step means. */
  hint?: string
  remarks?: 'required' | 'optional'
  /** Every required template field must be filled first. */
  requiresComplete?: boolean
  /** The document type's verification (e.g. ocular inspection) must be recorded first. */
  requiresVerification?: boolean
  tone?: 'primary' | 'secondary' | 'danger'
}

export interface Workflow {
  id: WorkflowId
  name: string
  /** Main path, for the progress tracker. */
  path: DocumentStatus[]
  /** Status a staff-encoded (walk-in) request starts in. */
  assistedStart: DocumentStatus
  transitions: Transition[]
  /** Entering this status stamps the issue date printed on the document. */
  issueOn: DocumentStatus
  /** Statuses in which the final document may be printed. */
  printableIn: DocumentStatus[]
  /** Statuses in which staff may still edit the document details. */
  editableIn: DocumentStatus[]
  /** Status names specific to this workflow (e.g. "Approved by Secretary"). */
  labels?: Partial<Record<DocumentStatus, string>>
}

export type FieldValue = string | string[] | boolean

export type FieldKind = 'text' | 'textarea' | 'number' | 'date' | 'choice' | 'multi' | 'check'

export interface FieldDef {
  key: string
  label: string
  kind: FieldKind
  options?: string[]
  required?: boolean
  /** Who normally supplies the value. "system" values are computed, never typed. */
  by: 'applicant' | 'staff' | 'system'
  help?: string
  /** Groups fields in forms (e.g. "Complainant"). */
  group?: string
  /** Hidden from the online (resident) form. */
  staffOnly?: boolean
}

export interface DocumentRequirement {
  label: string
  /** Where the requirement comes from, so nothing is invented. */
  source: string
}

export interface StatusEvent {
  status: DocumentStatus
  at: string
  byUserId: string
  byRole: RoleId
  action: string
  remarks?: string
}

export interface RequestMessage {
  id: string
  at: string
  byUserId: string
  fromResident: boolean
  text: string
}

export interface DocumentRequest {
  id: string
  referenceNo: string
  typeId: DocumentTypeId
  status: DocumentStatus
  /** Resident the document is for / who reported. Absent for non-residents. */
  residentId?: string
  /** Display name of the requester (resident or walk-in). */
  requesterName: string
  submittedAt: string
  updatedAt: string
  /** Stamped by the workflow; drives "Given this __ day of __". */
  issuedAt?: string
  values: Record<string, FieldValue>
  /** Requirement label → presented/attached. File contents are never stored in this prototype. */
  requirements: Record<string, { provided: boolean; note?: string }>
  assisted?: { encodedByUserId: string; at: string }
  /** Katarungang Pambarangay case this document belongs to (summon, notice of hearing). */
  caseId?: string
  /** Hearing this summons / notice is for. */
  hearingId?: string
  history: StatusEvent[]
  messages: RequestMessage[]
  /** Set by the Secretary with "Request more information": what the resident must send. */
  requestedItems?: string[]
  /** Verification or ocular inspection recorded by authorized personnel. */
  verification?: VerificationRecord
  /** Fee paid, recorded by the Treasurer (official receipt). */
  payment?: { orNo: string; amount: number; at: string; byUserId: string }
  /** Summons / notices: handed to the party (not the same as being received). */
  delivery?: { deliveredTo: string; method: string; on: string; byUserId: string; at: string }
  /** Summons / notices: the party signed or acknowledged receipt. */
  acknowledgment?: { receivedBy: string; on: string; byUserId: string; at: string }
  /** Official who gave the final approval. */
  approvedBy?: string
  approvedAt?: string
}

export interface VerificationRecord {
  result: 'confirmed' | 'not_confirmed'
  findings: string
  /** Date the check or inspection was done. */
  checkedOn: string
  byUserId: string
  at: string
}
