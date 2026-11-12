import { ROLE_PERMISSIONS } from '@/config/permissions'
import type { User } from '@/types/auth'
import { audit } from './auditService'
import { ServiceError, mockRequest } from './mockApi'

/**
 * BARANGAY 181 VERIFICATION POLICY for residents without a valid government ID.
 *
 * These are the barangay's own rules, not legal requirements: every value is
 * an initial proposal marked "awaiting approval" until the Punong Barangay
 * confirms it (after checking applicable laws, NPC guidance and barangay
 * resolutions). No document or endorsement is treated as sufficient by itself:
 * Barangay Personnel always verify identity and residency separately.
 *
 * Changes need the Punong Barangay's authority (residents.override), a
 * reason, and are logged. The System Administrator can read but not change it.
 */

export interface VerificationPolicy {
  /** Supporting documents residents may submit (for review, never automatic proof). */
  documentCategories: string[]
  /** Who may endorse a resident with no documents. */
  endorsementSources: string[]
  /** When an in-person visit is required. */
  inPersonWhen: 'always' | 'no_documents' | 'when_needed'
  /** Shown to personnel: who verifies, who approves, what evidence, escalation. */
  verifiedBy: string
  approvedBy: string
  requiredEvidence: string
  escalation: string
  status: 'proposed' | 'approved'
  version: number
  updatedAt?: string
  updatedBy?: string
  reason?: string
}

export const DEFAULT_POLICY: VerificationPolicy = {
  documentCategories: [
    'PSA or Local Civil Registry birth certificate',
    'School ID',
    'Company or employee ID',
    'PhilSys digital National ID or ePhilID',
    'Other supporting identity document',
  ],
  endorsementSources: [
    'Barangay official (Punong Barangay or Kagawad)',
    'Purok leader',
    'Homeowners association representative',
    'Resident known to barangay officials',
  ],
  inPersonWhen: 'no_documents',
  verifiedBy: 'Barangay Secretary',
  approvedBy: 'Barangay Secretary; the Punong Barangay decides reported or disputed cases',
  requiredEvidence: 'Identity and residency are each verified and recorded separately (method, evidence reviewed, date, personnel). A document, endorsement or household record supports a finding; none is conclusive alone.',
  escalation: 'Cases the Secretary cannot settle (conflicting records, possible duplicates, disputed identity) go to the Punong Barangay.',
  status: 'proposed',
  version: 1,
}

const KEY = 'bmis.verificationPolicy'
export function verificationPolicy(): VerificationPolicy {
  try { return { ...DEFAULT_POLICY, ...(JSON.parse(localStorage.getItem(KEY) ?? 'null') ?? {}) } } catch { return DEFAULT_POLICY }
}
export const IN_PERSON_WHEN_LABEL: Record<VerificationPolicy['inPersonWhen'], string> = {
  always: 'Always, for every registration without a valid ID',
  no_documents: 'When the resident has no supporting document',
  when_needed: 'Only when personnel need it',
}
export const canSetPolicy = (u: User) => !!(ROLE_PERMISSIONS[u.roleId]?.includes('residents.override') || u.extraPermissions?.includes('residents.override'))

export function saveVerificationPolicy(next: Partial<VerificationPolicy>, approve: boolean, reason: string, by: User): Promise<VerificationPolicy> {
  return mockRequest(() => {
    if (!canSetPolicy(by)) throw new ServiceError('forbidden', 'Only the Punong Barangay can change the verification rules.')
    if (reason.trim().length < 10) throw new ServiceError('reason', 'Give the reason or the barangay resolution for this change (at least 10 characters).')
    const cur = verificationPolicy()
    const list = (l: string[] | undefined, f: string[]) => (l ?? f).map((x) => x.trim()).filter(Boolean)
    const out: VerificationPolicy = {
      ...cur, ...next,
      documentCategories: list(next.documentCategories, cur.documentCategories),
      endorsementSources: list(next.endorsementSources, cur.endorsementSources),
      status: approve ? 'approved' : cur.status,
      version: cur.version + 1, updatedAt: new Date().toISOString(), updatedBy: by.id, reason: reason.trim(),
    }
    if (!out.documentCategories.length) throw new ServiceError('categories', 'Keep at least one supporting document type.')
    localStorage.setItem(KEY, JSON.stringify(out))
    audit(by, approve ? `Verification rules approved (version ${out.version})` : `Verification rules changed (version ${out.version})`, 'Settings', reason.trim())
    return out
  })
}
