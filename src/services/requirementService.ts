import { DOCUMENT_TYPES, getDocumentType, writeRequirementOverride } from '@/documents/catalog'
import type { User } from '@/types/auth'
import type { DocumentTypeId } from '@/types/document'
import { ROLE_PERMISSIONS } from '@/config/permissions'
import { audit } from './auditService'
import { ServiceError, mockRequest } from './mockApi'

/**
 * Requirements per document are set by the barangay, not by the system
 * (Chairman interview, 10 Nov 2026: the official list is still to be confirmed).
 * Prototype: saved in this browser. Backend: a requirements table edited by
 * authorized personnel, with the change logged.
 */
const allowed = (u: User) =>
  ['documents.process', 'system.settings'].some((p) => ROLE_PERMISSIONS[u.roleId].includes(p as never) || u.extraPermissions?.includes(p as never))

export function canEditRequirements(u: User | null | undefined): boolean {
  return !!u && allowed(u)
}

export function saveRequirements(typeId: DocumentTypeId, labels: string[], by: User): Promise<void> {
  return mockRequest(() => {
    if (!allowed(by)) throw new ServiceError('forbidden', 'You are not allowed to change requirements.')
    const clean = labels.map((l) => l.trim()).filter(Boolean)
    if (new Set(clean.map((l) => l.toLowerCase())).size !== clean.length) throw new ServiceError('duplicate', 'Each requirement must be listed once.')
    writeRequirementOverride(typeId, clean.map((label) => ({ label, source: `Set by ${by.fullName}` })))
    audit(by, 'Requirements updated', 'Documents', getDocumentType(typeId).name)
  })
}

export function resetRequirements(typeId: DocumentTypeId, by: User): Promise<void> {
  return mockRequest(() => {
    if (!allowed(by)) throw new ServiceError('forbidden', 'You are not allowed to change requirements.')
    writeRequirementOverride(typeId, null)
    audit(by, 'Requirements reset', 'Documents', getDocumentType(typeId).name)
  })
}

export const DOCUMENT_TYPE_IDS = DOCUMENT_TYPES.map((d) => d.id)
