import { RESIDENT_SERVICES } from '@/documents/catalog'
import { once } from '@/lib/idempotency'
import { addWorkingDays, estimateFor } from './serviceStandardService'
import { ROLE_PERMISSIONS } from '@/config/permissions'
import { getDocumentType } from '@/documents/catalog'
import { isFilled, missingFields, systemValues } from '@/documents/fill'
import { WORKFLOWS } from '@/documents/workflows'
import { mockDocumentRequests, nextReference } from '@/mocks/documentRequests'
import { mockNotifications } from '@/mocks/notifications'
import { mockUsers } from '@/mocks/users'
import type { NotificationCategory } from '@/types/activity'
import type { Permission, User } from '@/types/auth'
import type { DocumentRequest, DocumentStatus, DocumentTypeId, FieldValue, Transition } from '@/types/document'
import { cancelFor, completeFor, createAwaitingSchedule } from './appointmentService'
import { ServiceError, mockRequest } from './mockApi'

/**
 * Document requests (MOCK, in memory). Every rule here, workflow steps,
 * permissions and record ownership, must be enforced again by the backend.
 */

export interface DocActor {
  user: User
  permissions: ReadonlySet<Permission>
}

const isOwner = (req: DocumentRequest, actor: DocActor) => !!req.residentId && req.residentId === actor.user.residentId

/** An account that can only record fees sees fee-bearing documents only. */
const feeOnly = (actor: DocActor) =>
  actor.permissions.has('documents.payment') && !actor.permissions.has('documents.process') && !actor.permissions.has('documents.approve') && !actor.permissions.has('documents.create')

function canSee(req: DocumentRequest, actor: DocActor) {
  if (isOwner(req, actor)) return true
  if (!actor.permissions.has('documents.view')) return false
  return !feeOnly(actor) || !!getDocumentType(req.typeId).fee
}

/** Steps the actor may take now (pure; used by the UI and re-checked on submit). */
export function availableTransitions(req: DocumentRequest, actor: DocActor): Transition[] {
  const wf = WORKFLOWS[getDocumentType(req.typeId).workflow]
  return wf.transitions.filter(
    (t) => t.from.includes(req.status) && (t.by === 'owner' ? isOwner(req, actor) : actor.permissions.has(t.by)),
  )
}

export function canEditValues(req: DocumentRequest, actor: DocActor): boolean {
  const wf = WORKFLOWS[getDocumentType(req.typeId).workflow]
  return wf.editableIn.includes(req.status) && actor.permissions.has('documents.process')
}

export function isPrintable(req: DocumentRequest): boolean {
  const wf = WORKFLOWS[getDocumentType(req.typeId).workflow]
  return wf.printableIn.includes(req.status) && missingFields(req).length === 0
}

function notify(userIds: string[], category: NotificationCategory, title: string, body: string, link: string) {
  const now = new Date().toISOString()
  for (const userId of new Set(userIds)) {
    mockNotifications.push({ id: `ntf-${Math.random().toString(36).slice(2, 9)}`, userId, category, title, body, createdAt: now, read: false, link })
  }
  window.dispatchEvent(new Event('bmis:notifications-changed'))
}

/** Active accounts holding a permission (role permissions + per-account grants). */
const usersWith = (p: Permission) =>
  mockUsers
    .filter((u) => u.status === 'active' && (ROLE_PERMISSIONS[u.roleId].includes(p) || u.extraPermissions?.includes(p)))
    .map((u) => u.id)

const ownerUserId = (req: DocumentRequest) => mockUsers.find((u) => u.residentId && u.residentId === req.residentId)?.id

function find(id: string, actor: DocActor): DocumentRequest {
  const req = mockDocumentRequests.find((r) => r.id === id)
  if (!req || !canSee(req, actor)) throw new ServiceError('not_found', 'Request not found.')
  return req
}

export function listRequests(actor: DocActor): Promise<DocumentRequest[]> {
  return mockRequest(() =>
    mockDocumentRequests.filter((r) => canSee(r, actor)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  )
}

export function getRequest(id: string, actor: DocActor): Promise<DocumentRequest> {
  return mockRequest(() => find(id, actor))
}

export interface NewRequestInput {
  typeId: DocumentTypeId
  residentId?: string
  requesterName: string
  values: Record<string, FieldValue>
  requirements: DocumentRequest['requirements']
  /** True when barangay staff encode it for a walk-in resident. */
  assisted: boolean
}

export function createRequest(input: NewRequestInput, actor: DocActor, clientRequestId?: string): Promise<DocumentRequest> {
  return mockRequest(() => once(clientRequestId && `${actor.user.id}:${clientRequestId}`, (id) => mockDocumentRequests.find((r) => r.id === id), (r) => r.id, () => {
    const type = getDocumentType(input.typeId)
    const wf = WORKFLOWS[type.workflow]
    if (input.assisted) {
      if (!actor.permissions.has('documents.create')) throw new ServiceError('forbidden', 'You cannot encode requests.')
    } else {
      if (!actor.permissions.has('self.documents')) throw new ServiceError('forbidden', 'Not allowed.')
      if (!RESIDENT_SERVICES.has(type.id)) throw new ServiceError('forbidden', `${type.name} is prepared by Barangay Personnel and cannot be requested here.`)
      if (!type.online) throw new ServiceError('not_online', `${type.name} is not requested online. Please visit the Barangay Hall.`)
      if (input.residentId !== actor.user.residentId) throw new ServiceError('forbidden', 'You can only request documents for yourself.')
    }
    const now = new Date().toISOString()
    const status: DocumentStatus = input.assisted ? wf.assistedStart : 'submitted'
    // Applicants never set staff-only or system fields.
    const allowed = new Set(type.fields.filter((f) => input.assisted || (f.by !== 'system' && !f.staffOnly)).map((f) => f.key))
    const values = Object.fromEntries(Object.entries(input.values).filter(([k]) => allowed.has(k)))
    if (!input.assisted) {
      // Same rule as the form: every required field the resident fills in must have a value.
      const missing = type.fields.filter((f) => allowed.has(f.key) && f.required && !isFilled(values[f.key] as FieldValue | undefined))
      if (missing.length) throw new ServiceError('missing', `Please complete: ${missing.map((f) => f.label).join(', ')}.`)
    }
    const req: DocumentRequest = {
      id: `docreq-${Date.now().toString(36)}`,
      referenceNo: nextReference(input.typeId),
      typeId: input.typeId,
      status,
      residentId: input.residentId,
      requesterName: input.requesterName,
      submittedAt: now,
      updatedAt: now,
      values,
      requirements: input.requirements,
      assisted: input.assisted ? { encodedByUserId: actor.user.id, at: now } : undefined,
      history: [
        {
          status,
          at: now,
          byUserId: actor.user.id,
          byRole: actor.user.roleId,
          action: input.assisted ? 'Encoded at the Barangay Hall (assisted)' : 'Submitted online',
        },
      ],
      messages: [],
    }
    mockDocumentRequests.unshift(req)
    if (!input.assisted) {
      notify(usersWith('documents.process'), 'document', 'New document request', `${req.referenceNo}: ${type.name} from ${req.requesterName}.`, `/documents/${req.id}`)
    }
    return req
  }))
}

export function saveValues(id: string, values: Record<string, FieldValue>, actor: DocActor): Promise<DocumentRequest> {
  return mockRequest(() => {
    const req = find(id, actor)
    if (!canEditValues(req, actor)) throw new ServiceError('forbidden', 'These details can no longer be edited at this stage.')
    const system = new Set(getDocumentType(req.typeId).fields.filter((f) => f.by === 'system').map((f) => f.key))
    for (const [k, v] of Object.entries(values)) if (!system.has(k)) req.values[k] = v
    req.updatedAt = new Date().toISOString()
    return req
  })
}

export function setRequirement(id: string, label: string, provided: boolean, actor: DocActor): Promise<DocumentRequest> {
  return mockRequest(() => {
    const req = find(id, actor)
    if (!actor.permissions.has('documents.process')) throw new ServiceError('forbidden', 'Not allowed.')
    req.requirements[label] = { provided, note: provided ? `Checked by ${actor.user.fullName}` : undefined }
    return req
  })
}

export function applyTransition(
  id: string,
  transition: Transition,
  remarks: string,
  actor: DocActor,
  extra: { requestedItems?: string[]; files?: Record<string, string> } = {},
): Promise<DocumentRequest> {
  return mockRequest(() => {
    const req = find(id, actor)
    const allowed = availableTransitions(req, actor).find((t) => t.to === transition.to && t.label === transition.label && t.by === transition.by)
    if (!allowed) throw new ServiceError('invalid_transition', 'This step is not available for this request right now.')
    if (allowed.remarks === 'required' && !remarks.trim()) throw new ServiceError('remarks', 'Please add a note for this step.')
    if (allowed.requiresVerification && getDocumentType(req.typeId).verification && req.verification?.result !== 'confirmed') {
      throw new ServiceError('verification', `Record the ${getDocumentType(req.typeId).verification!.title.toLowerCase()} first (result: confirmed).`)
    }
    if (allowed.requiresComplete && missingFields(req).length > 0) {
      throw new ServiceError('incomplete', 'Complete the missing document details first.')
    }
    const type = getDocumentType(req.typeId)
    const wf = WORKFLOWS[type.workflow]
    const now = new Date().toISOString()
    req.status = allowed.to
    req.updatedAt = now
    if (allowed.to === wf.issueOn && !req.issuedAt) {
      req.issuedAt = now
      // Freeze computed values (issue date etc.) into the record.
      Object.assign(req.values, Object.fromEntries(Object.entries(systemValues(req)).filter(([k]) => type.fields.some((f) => f.key === k))))
    }
    if (allowed.to === 'approved' && allowed.by === 'documents.approve') {
      req.approvedBy = actor.user.id
      req.approvedAt = now
    }
    if (allowed.to === 'needs_info') req.requestedItems = extra.requestedItems?.filter(Boolean) ?? []
    if (allowed.by === 'owner' && allowed.to === 'under_review') {
      const missing = (req.requestedItems ?? []).filter((item) => !extra.files?.[item])
      if (missing.length) throw new ServiceError('files', `Attach: ${missing.join(', ')}.`)
      for (const [item, file] of Object.entries(extra.files ?? {})) req.requirements[item] = { provided: true, note: `Sent by the requester: ${file}` }
      req.requestedItems = undefined
    }
    req.history.push({ status: allowed.to, at: now, byUserId: actor.user.id, byRole: actor.user.roleId, action: allowed.label, remarks: remarks.trim() || undefined })
    if (allowed.by === 'owner' && remarks.trim()) {
      req.messages.push({ id: `msg-${Date.now()}`, at: now, byUserId: actor.user.id, fromResident: true, text: remarks.trim() })
    }

    // Notifications follow real events only.
    const owner = ownerUserId(req)
    // Claiming: a ready document gets a claiming appointment the resident books; release closes it.
    if (allowed.to === 'ready_for_pickup') createAwaitingSchedule({ kind: 'document_claim', subjectId: req.id, subjectRef: req.referenceNo, title: type.name, residentId: req.residentId, userId: owner, reason: `Claim your ${type.name}`, documents: ['Valid government-issued ID', `Your request reference number (${req.referenceNo})`] }, actor.user.id)
    if (allowed.to === 'released') completeFor('document_claim', req.id, 'Document released', actor.user.id)
    if (allowed.to === 'cancelled' || allowed.to === 'rejected') cancelFor('document_claim', req.id, allowed.to === 'cancelled' ? 'The request was cancelled' : 'The request was not approved', actor.user.id)
    const link = `/my/documents/${req.id}`
    const ownerMsg: Partial<Record<DocumentStatus, string>> = {
      needs_info: 'The barangay needs more information for your request.',
      approved: 'Your request was approved by the Barangay Chairman. It will now be printed and signed.',
      rejected: 'Your request was not approved.',
      released: 'Your document was released.',
      recorded: 'Your report was recorded.',
      forwarded: 'Your report was forwarded to the barangay official.',
      for_assessment: 'Your request was forwarded for assessment.',
    }
    if (owner && owner !== actor.user.id && ownerMsg[allowed.to]) {
      const items = allowed.to === 'needs_info' && req.requestedItems?.length ? ` Please send: ${req.requestedItems.join(', ')}.` : ''
      notify([owner], 'document', `${req.referenceNo}: ${type.name}`, ownerMsg[allowed.to]! + items + (remarks.trim() ? ` Note: ${remarks.trim()}` : ''), link)
    }
    if (allowed.by === 'documents.approve' && (allowed.to === 'processing' || allowed.to === 'under_review')) {
      notify(usersWith('documents.process'), 'document', 'Returned for revision by the Chairman', `${req.referenceNo}: ${remarks.trim()}`, `/documents/${req.id}`)
    }
    if (allowed.to === 'pending_approval' || allowed.to === 'for_assessment') {
      notify(usersWith('documents.approve'), 'document', allowed.to === 'for_assessment' ? 'Summons request for assessment' : 'Document awaiting your approval', `${req.referenceNo}: ${type.name} (${req.requesterName}).`, `/documents/${req.id}`)
    }
    if (allowed.by === 'owner' && allowed.to === 'under_review') {
      notify(usersWith('documents.process'), 'document', 'Requester replied', `${req.referenceNo}: ${remarks.trim()}`, `/documents/${req.id}`)
    }
    return req
  })
}

/** Record the verification or ocular inspection for a request (documents.inspect). */
export function recordVerification(
  id: string,
  input: { result: 'confirmed' | 'not_confirmed'; findings: string; checkedOn: string },
  actor: DocActor,
): Promise<DocumentRequest> {
  return mockRequest(() => {
    const req = find(id, actor)
    const def = getDocumentType(req.typeId).verification
    if (!def) throw new ServiceError('not_applicable', 'This document has no verification step.')
    if (!actor.permissions.has('documents.inspect')) throw new ServiceError('forbidden', 'You are not allowed to record verifications.')
    if (!['submitted', 'under_review', 'needs_info'].includes(req.status)) throw new ServiceError('stage', 'Verification can only be recorded while the request is being reviewed.')
    if (!input.findings.trim()) throw new ServiceError('findings', 'Describe what was found.')
    if (!input.checkedOn) throw new ServiceError('date', 'Enter the date of the check.')
    const now = new Date().toISOString()
    req.verification = { result: input.result, findings: input.findings.trim(), checkedOn: input.checkedOn, byUserId: actor.user.id, at: now }
    req.updatedAt = now
    req.history.push({ status: req.status, at: now, byUserId: actor.user.id, byRole: actor.user.roleId, action: `${def.title} recorded: ${input.result === 'confirmed' ? 'confirmed' : 'not confirmed'}`, remarks: input.findings.trim() })
    return req
  })
}

/** Record the fee paid at the Barangay Hall, with its official receipt (documents.payment). */
export function recordPayment(id: string, input: { orNo: string; amount: number }, actor: DocActor): Promise<DocumentRequest> {
  return mockRequest(() => {
    const req = find(id, actor)
    if (!getDocumentType(req.typeId).fee) throw new ServiceError('not_applicable', 'No fee is recorded for this document.')
    if (!actor.permissions.has('documents.payment')) throw new ServiceError('forbidden', 'You are not allowed to record payments.')
    if (req.payment) throw new ServiceError('paid', 'Payment was already recorded.')
    if (!input.orNo.trim()) throw new ServiceError('or', 'Enter the official receipt number.')
    if (!(input.amount > 0)) throw new ServiceError('amount', 'Enter the amount paid.')
    if (['rejected', 'cancelled'].includes(req.status)) throw new ServiceError('stage', 'This request is closed.')
    const now = new Date().toISOString()
    req.payment = { orNo: input.orNo.trim(), amount: input.amount, at: now, byUserId: actor.user.id }
    req.updatedAt = now
    req.history.push({ status: req.status, at: now, byUserId: actor.user.id, byRole: actor.user.roleId, action: `Fee paid: ₱${input.amount.toFixed(2)} (O.R. ${input.orNo.trim()})` })
    return req
  })
}

const SERVED_TYPES = ['summon', 'notice-of-hearing']
const canServe = (a: DocActor) => a.permissions.has('documents.release') || a.permissions.has('cases.manage')

/** Summons / notice handed to the party. Generating a document is not delivery. */
export function recordDelivery(id: string, input: { deliveredTo: string; method: string; on: string }, actor: DocActor): Promise<DocumentRequest> {
  return mockRequest(() => {
    const req = find(id, actor)
    if (!SERVED_TYPES.includes(req.typeId)) throw new ServiceError('not_applicable', 'Only summons and notices are delivered.')
    if (!canServe(actor)) throw new ServiceError('forbidden', 'Not allowed.')
    if (!['approved', 'served'].includes(req.status)) throw new ServiceError('stage', 'Deliver the document only after it is approved and signed.')
    if (!input.deliveredTo.trim() || !input.on) throw new ServiceError('fields', 'Enter who received it and the date.')
    const now = new Date().toISOString()
    req.delivery = { deliveredTo: input.deliveredTo.trim(), method: input.method, on: input.on, byUserId: actor.user.id, at: now }
    req.history.push({ status: req.status, at: now, byUserId: actor.user.id, byRole: actor.user.roleId, action: `Delivered to ${input.deliveredTo.trim()} (${input.method})` })
    req.updatedAt = now
    return req
  })
}

/** The party acknowledged receipt (signature on the receiving copy). */
export function recordAcknowledgment(id: string, input: { receivedBy: string; on: string }, actor: DocActor): Promise<DocumentRequest> {
  return mockRequest(() => {
    const req = find(id, actor)
    if (!SERVED_TYPES.includes(req.typeId)) throw new ServiceError('not_applicable', 'Only summons and notices are acknowledged.')
    if (!canServe(actor)) throw new ServiceError('forbidden', 'Not allowed.')
    if (!req.delivery) throw new ServiceError('order', 'Record the delivery first.')
    if (!input.receivedBy.trim() || !input.on) throw new ServiceError('fields', 'Enter who signed for it and the date.')
    const now = new Date().toISOString()
    req.acknowledgment = { receivedBy: input.receivedBy.trim(), on: input.on, byUserId: actor.user.id, at: now }
    req.history.push({ status: req.status, at: now, byUserId: actor.user.id, byRole: actor.user.roleId, action: `Receipt acknowledged by ${input.receivedBy.trim()}` })
    req.updatedAt = now
    return req
  })
}

/**
 * Summons (to the respondent) and Notice of Hearing (to the complainant) for a
 * scheduled hearing, filled from the case record. They then go through the
 * usual approval → signing → delivery → acknowledgment steps.
 */
export function prepareHearingDocuments(
  c: { id: string; caseNo: string; nature: string; details: string; complainants: { name: string; address: string }[]; respondents: { name: string; address: string }[] },
  hearing: { id: string; scheduledAt: string },
  actor: DocActor,
): Promise<DocumentRequest[]> {
  return mockRequest(() => {
    if (!actor.permissions.has('cases.manage')) throw new ServiceError('forbidden', 'Only case personnel prepare summons and notices.')
    if (mockDocumentRequests.some((r) => r.caseId === c.id && r.hearingId === hearing.id && !['cancelled', 'rejected'].includes(r.status))) {
      throw new ServiceError('exists', 'The summons and notice for this hearing were already prepared.')
    }
    const at = new Date(hearing.scheduledAt)
    const day = String(at.getDate())
    const month = at.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
    const time = at.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
    const join = (ps: { name: string }[]) => ps.map((p) => p.name).join(', ')
    const now = new Date().toISOString()
    const make = (typeId: DocumentTypeId, requesterName: string, values: Record<string, FieldValue>): DocumentRequest => {
      const type = getDocumentType(typeId)
      const keep = new Set(type.fields.filter((f) => f.by !== 'system').map((f) => f.key))
      const req: DocumentRequest = {
        id: `docreq-${Date.now().toString(36)}-${typeId}`,
        referenceNo: nextReference(typeId),
        typeId,
        status: 'processing',
        requesterName,
        submittedAt: now,
        updatedAt: now,
        values: Object.fromEntries(Object.entries(values).filter(([k]) => keep.has(k))),
        requirements: {},
        assisted: { encodedByUserId: actor.user.id, at: now },
        caseId: c.id,
        hearingId: hearing.id,
        history: [{ status: 'processing', at: now, byUserId: actor.user.id, byRole: actor.user.roleId, action: `Prepared from case ${c.caseNo}` }],
        messages: [],
      }
      mockDocumentRequests.unshift(req)
      return req
    }
    const common = { hearingDay: day, hearingMonth: month, hearingTime: time }
    const summon = make('summon', join(c.complainants), {
      ...common,
      complainantName: join(c.complainants),
      respondentName: join(c.respondents),
      respondentAddress: c.respondents[0]?.address ?? '',
      complaintDetails: c.details,
      caseNo: c.caseNo,
      caseFor: c.nature,
    })
    const notice = make('notice-of-hearing', join(c.complainants), {
      ...common,
      complainantNames: join(c.complainants),
      complainantAddress: c.complainants[0]?.address ?? '',
      respondentNames: join(c.respondents),
      respondentAddress: c.respondents[0]?.address ?? '',
    })
    return [summon, notice]
  })
}

/**
 * RA 11032: the processing time may be extended ONCE, for the same number of
 * working days, with written notice to the applicant stating the reason.
 */
export function extendProcessing(id: string, reason: string, actor: DocActor): Promise<DocumentRequest> {
  return mockRequest(() => {
    if (!actor.permissions.has('documents.process')) throw new ServiceError('forbidden', 'You cannot extend processing time.')
    const req = mockDocumentRequests.find((r) => r.id === id)
    if (!req) throw new ServiceError('not_found', 'Request not found.')
    if (req.extension) throw new ServiceError('extended', 'The processing time was already extended once.')
    if (['released', 'rejected', 'cancelled', 'ready_for_pickup'].includes(req.status)) throw new ServiceError('closed', 'This request is no longer being processed.')
    if (reason.trim().length < 10) throw new ServiceError('reason', 'Give the reason the resident will read.')
    const est = estimateFor(req)
    if (!est) throw new ServiceError('no_standard', 'This service has no processing time to extend.')
    const newDate = addWorkingDays(new Date(est.expectedBy + 'T18:00:00+08:00'), est.days)
    const now = new Date().toISOString()
    req.extension = { reason: reason.trim(), newDate, at: now, byUserId: actor.user.id }
    req.history.push({ status: req.status, at: now, byUserId: actor.user.id, byRole: actor.user.roleId, action: `Processing time extended to ${newDate}`, remarks: reason.trim() })
    req.updatedAt = now
    const owner = mockUsers.find((u) => u.residentId && u.residentId === req.residentId)
    if (owner) notify([owner.id], 'document', 'Processing time extended', `${req.referenceNo} · new expected date ${newDate}.`, `/my/documents/${req.id}`)
    return req
  })
}
