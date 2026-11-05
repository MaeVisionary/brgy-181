import { ROLE_PERMISSIONS } from '@/config/permissions'
import { getDocumentType } from '@/documents/catalog'
import { missingFields, systemValues } from '@/documents/fill'
import { WORKFLOWS } from '@/documents/workflows'
import { mockDocumentRequests, nextReference } from '@/mocks/documentRequests'
import { mockNotifications } from '@/mocks/notifications'
import { mockUsers } from '@/mocks/users'
import type { NotificationCategory } from '@/types/activity'
import type { Permission, User } from '@/types/auth'
import type { DocumentRequest, DocumentStatus, DocumentTypeId, FieldValue, Transition } from '@/types/document'
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

function canSee(req: DocumentRequest, actor: DocActor) {
  return actor.permissions.has('documents.view') || isOwner(req, actor)
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

export function createRequest(input: NewRequestInput, actor: DocActor): Promise<DocumentRequest> {
  return mockRequest(() => {
    const type = getDocumentType(input.typeId)
    const wf = WORKFLOWS[type.workflow]
    if (input.assisted) {
      if (!actor.permissions.has('documents.create')) throw new ServiceError('forbidden', 'You cannot encode requests.')
    } else {
      if (!actor.permissions.has('self.documents') && !actor.permissions.has('self.complaints')) throw new ServiceError('forbidden', 'Not allowed.')
      if (!type.online) throw new ServiceError('not_online', `${type.name} is not requested online. Please visit the Barangay Hall.`)
      if (input.residentId !== actor.user.residentId) throw new ServiceError('forbidden', 'You can only request documents for yourself.')
    }
    const now = new Date().toISOString()
    const status: DocumentStatus = input.assisted ? wf.assistedStart : 'submitted'
    // Applicants never set staff-only or system fields.
    const allowed = new Set(type.fields.filter((f) => input.assisted || (f.by !== 'system' && !f.staffOnly)).map((f) => f.key))
    const values = Object.fromEntries(Object.entries(input.values).filter(([k]) => allowed.has(k)))
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
  })
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

export function applyTransition(id: string, transition: Transition, remarks: string, actor: DocActor): Promise<DocumentRequest> {
  return mockRequest(() => {
    const req = find(id, actor)
    const allowed = availableTransitions(req, actor).find((t) => t.to === transition.to && t.label === transition.label && t.by === transition.by)
    if (!allowed) throw new ServiceError('invalid_transition', 'This step is not available for this request right now.')
    if (allowed.remarks === 'required' && !remarks.trim()) throw new ServiceError('remarks', 'Please add a note for this step.')
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
    req.history.push({ status: allowed.to, at: now, byUserId: actor.user.id, byRole: actor.user.roleId, action: allowed.label, remarks: remarks.trim() || undefined })
    if (allowed.by === 'owner' && remarks.trim()) {
      req.messages.push({ id: `msg-${Date.now()}`, at: now, byUserId: actor.user.id, fromResident: true, text: remarks.trim() })
    }

    // Notifications follow real events only.
    const owner = ownerUserId(req)
    const link = `/my/documents/${req.id}`
    const ownerMsg: Partial<Record<DocumentStatus, string>> = {
      needs_info: 'The barangay needs more information for your request.',
      approved: 'Your request was approved.',
      ready_for_pickup: 'Your document is ready for pickup at the Barangay Hall.',
      rejected: 'Your request was not approved.',
      released: 'Your document was released.',
      recorded: 'Your report was recorded.',
      forwarded: 'Your report was forwarded to the barangay official.',
      for_assessment: 'Your request was forwarded for assessment.',
    }
    if (owner && owner !== actor.user.id && ownerMsg[allowed.to]) {
      notify([owner], 'document', `${req.referenceNo}: ${type.name}`, ownerMsg[allowed.to]! + (remarks.trim() ? ` Note: ${remarks.trim()}` : ''), link)
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
