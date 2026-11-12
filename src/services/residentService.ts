import { AREAS, mockChangeRequests, mockHouseholds, mockRegistrations, mockResidents } from '@/mocks/residents'
import { once } from '@/lib/idempotency'
import { MSG, isMobile } from '@/lib/validation'
import type { User } from '@/types/auth'
import type { Family, Household, Relationship, Resident, ResidentChangeRequest } from '@/types/resident'
import { familyNumber, householdNumber, nextNumber, residentNumber } from '@/lib/ids'
import { ServiceError, mockRequest } from './mockApi'
import { appointmentForRequest } from './appointmentService'
import { audit } from './auditService'
import { mockNotifications } from '@/mocks/notifications'
import { mockUsers } from '@/mocks/users'
import { ROLE_PERMISSIONS } from '@/config/permissions'

/** Resident records (SAMPLE DATA, in memory). The backend must enforce access again. */

export interface PopulationSummary {
  totalResidents: number
  totalHouseholds: number
  totalFamilies: number
  seniorCitizens: number
  pwds: number
  soloParents: number
  fourPsMembers: number
  programBeneficiaries: number
  voters: number
}

export interface AreaBreakdown {
  area: string
  residents: number
  households: number
  families: number
  seniorCitizens: number
  pwds: number
  soloParents: number
  fourPsMembers: number
  programBeneficiaries: number
}

function summarize(residents: Resident[], households: Household[]): PopulationSummary {
  return {
    totalResidents: residents.length,
    totalHouseholds: households.length,
    totalFamilies: households.reduce((n, h) => n + h.families.length, 0),
    seniorCitizens: residents.filter((r) => r.sectors.seniorCitizen).length,
    pwds: residents.filter((r) => r.sectors.pwd).length,
    soloParents: residents.filter((r) => r.sectors.soloParent).length,
    fourPsMembers: residents.filter((r) => r.sectors.fourPs).length,
    programBeneficiaries: residents.filter((r) => r.sectors.programBeneficiary).length,
    voters: residents.filter((r) => r.voter).length,
  }
}

/** Population figures computed from the resident records (never hardcoded); optionally for one street. */
export function getPopulationSummary(street?: string): Promise<PopulationSummary> {
  return mockRequest(() =>
    street ? summarize(mockResidents.filter((r) => r.street === street), mockHouseholds.filter((h) => h.street === street)) : summarize(mockResidents, mockHouseholds),
  )
}

export function getAreaBreakdown(): Promise<AreaBreakdown[]> {
  return mockRequest(() =>
    AREAS.map((area) => {
      const rs = mockResidents.filter((r) => r.street === area)
      const s = summarize(rs, mockHouseholds.filter((h) => h.street === area))
      return { area, residents: s.totalResidents, households: s.totalHouseholds, families: s.totalFamilies, seniorCitizens: s.seniorCitizens, pwds: s.pwds, soloParents: s.soloParents, fourPsMembers: s.fourPsMembers, programBeneficiaries: s.programBeneficiaries }
    }).filter((a) => a.residents > 0),
  )
}

export interface ResidentQueueCounts {
  registrationsForReview: number
  pendingChangeRequests: number
}

export function getResidentQueueCounts(): Promise<ResidentQueueCounts> {
  return mockRequest(() => ({
    registrationsForReview: mockRegistrations.filter((r) => r.status === 'manual_review').length,
    pendingChangeRequests: mockChangeRequests.filter((c) => c.status === 'pending').length,
  }))
}

export function listResidents(): Promise<Resident[]> {
  return mockRequest(() => mockResidents)
}

export function listHouseholds(): Promise<Household[]> {
  return mockRequest(() => mockHouseholds)
}

/** Name or resident-number search (staff with residents.search). */
export function searchResidents(query: string, limit = 8): Promise<Resident[]> {
  return mockRequest(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
    if (terms.length === 0) return []
    return mockResidents
      .filter((r) => {
        const hay = `${r.firstName} ${r.middleName ?? ''} ${r.lastName} ${r.residentNo} ${r.legacyNo ?? ''} ${r.contactNo ?? ''}`.toLowerCase()
        return terms.every((t) => hay.includes(t))
      })
      .slice(0, limit)
  })
}

export function getResident(id: string): Promise<Resident | undefined> {
  return mockRequest(() => mockResidents.find((r) => r.id === id))
}

export function getHousehold(id: string): Promise<{ household: Household; members: Resident[] } | undefined> {
  return mockRequest(() => {
    const household = mockHouseholds.find((h) => h.id === id)
    if (!household) return undefined
    return { household, members: mockResidents.filter((r) => r.householdId === id) }
  })
}

// ── Change requests (FR11): official record changes only after review ─

const FIELD_SETTERS: Record<string, (r: Resident, v: string) => void> = {
  'Civil status': (r, v) => {
    const map: Record<string, Resident['civilStatus']> = { single: 'single', married: 'married', widowed: 'widowed', separated: 'separated', 'live-in': 'live_in' }
    const c = map[v.toLowerCase()]
    if (c) r.civilStatus = c
  },
  'Contact number': (r, v) => (r.contactNo = v),
  Employment: (r, v) => (r.employment = v),
  'Educational attainment': (r, v) => (r.education = v),
  // "First|Middle|Last|Suffix" (shown to the Secretary with spaces)
  'Full name': (r, v) => {
    const [first, middle, last, suffix] = v.split('|').map((x) => x.trim())
    if (first) r.firstName = first
    r.middleName = middle || undefined
    if (last) r.lastName = last
    r.suffix = suffix || undefined
  },
  // Age is always computed from the birthdate, so it updates by itself.
  Birthdate: (r, v) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return
    r.birthDate = v
    const b = new Date(`${v}T00:00:00`)
    const n = new Date()
    const age = n.getFullYear() - b.getFullYear() - (n < new Date(n.getFullYear(), b.getMonth(), b.getDate()) ? 1 : 0)
    r.sectors.seniorCitizen = age >= 60
  },
  'Relationship in the family': (r, v) => (r.relationship = v as Resident['relationship']),
}

/**
 * Corrections that change the official record in a way that needs proof. The
 * resident attaches the document or promises to bring the original to the Hall.
 * Name, birthdate and contact number fixes are simple corrections (no proof).
 */
export const PROOF_REQUIRED: Record<string, string> = {
  'Civil status': 'PSA marriage certificate, death certificate of the spouse, or court decree (annulment)',
  'Educational attainment': 'Diploma, Transcript of Records or certificate from the school',
  Employment: 'Certificate of employment, company ID or business permit',
  'Relationship in the family': 'PSA birth certificate or marriage certificate showing the relationship',
}

/** Fields a resident may ask to correct, in the order shown. */
export const CORRECTABLE_FIELDS = ['Full name', 'Birthdate', 'Civil status', 'Contact number', 'Employment', 'Educational attainment', 'Relationship in the family'] as const

export const displayRequestedValue = (field: string, v: string) => (field === 'Full name' ? v.split('|').filter(Boolean).join(' ') : v)

export function listChangeRequests(): Promise<ResidentChangeRequest[]> {
  return mockRequest(() => [...mockChangeRequests].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)))
}

export function decideChangeRequest(id: string, decision: 'approved' | 'rejected', note: string, by: User): Promise<ResidentChangeRequest> {
  return mockRequest(() => {
    const cr = mockChangeRequests.find((c) => c.id === id)
    if (!cr) throw new ServiceError('not_found', 'Change request not found.')
    if (!(ROLE_PERMISSIONS[by.roleId]?.includes('residents.approve') || by.extraPermissions?.includes('residents.approve'))) throw new ServiceError('forbidden', 'You cannot approve corrections.')
    if (cr.status !== 'pending') throw new ServiceError('decided', 'This request was already decided.')
    if (decision === 'rejected' && !note.trim()) throw new ServiceError('note', 'Add the reason for rejecting.')
    // A visit that is still open or failed blocks approval (rejecting stays possible).
    const visit = appointmentForRequest(cr.id)
    if (decision === 'approved' && visit && visit.status !== 'cancelled' && visit.verification?.result !== 'verified')
      throw new ServiceError('visit', visit.verification?.result === 'not_verified' ? 'The documents were not verified at the visit. Reject, or schedule another visit.' : 'Finish the in-person visit before approving.')
    cr.status = decision
    cr.decidedBy = by.id
    cr.decidedAt = new Date().toISOString()
    cr.decisionNote = note.trim() || undefined
    if (decision === 'approved') {
      const res = mockResidents.find((r) => r.id === cr.residentId)
      if (res) {
        FIELD_SETTERS[cr.field]?.(res, cr.requestedValue)
        res.updatedAt = cr.decidedAt
      }
    }
    audit(by, decision === 'approved' ? 'Correction approved' : 'Correction rejected', 'Residents', cr.residentId)
    const requester = cr.requestedByResidentId ?? cr.residentId
    notifyUserOfResident(requester, decision === 'approved' ? 'Correction approved' : 'Correction not approved', `${cr.field}${decision === 'rejected' && cr.decisionNote ? ` · ${cr.decisionNote}` : ''}`, '/my/profile')
    if (decision === 'approved' && cr.requestedByResidentId) notifyUserOfResident(cr.residentId, 'Your record was updated', `${cr.field} · approved by the Barangay Secretary.`, '/my/profile')
    return cr
  })
}

/** On whose behalf a correction is requested. */
export type CorrectionBasis = 'self' | 'dependent' | 'representative' | 'household'

/** Legal bases a representative can rely on (staff verify the document). */
export const REPRESENTATION_KINDS = ['Signed authorization letter with a copy of their ID', 'Special Power of Attorney (SPA)', 'Court-appointed guardianship'] as const

/** Proof that the requester is the parent or guardian of a minor. */
export const GUARDIAN_PROOF = 'PSA birth certificate of the child, or guardianship papers'

/** Household-level changes (handled apart from personal corrections; only the family head may ask). */
export const HOUSEHOLD_UPDATES = ['New member living here', 'Member moved out', 'Household address'] as const

const ageYears = (birthDate: string) => {
  const b = new Date(birthDate)
  const n = new Date()
  return n.getFullYear() - b.getFullYear() - (n < new Date(n.getFullYear(), b.getMonth(), b.getDate()) ? 1 : 0)
}

/** Who the signed-in resident may request corrections for, and on what basis. */
export function correctionTargets(by: User): { self?: Resident; dependents: Resident[]; adults: Resident[]; isHead: boolean } {
  const me = mockResidents.find((r) => r.id === by.residentId)
  if (!me) return { dependents: [], adults: [], isHead: false }
  const family = mockResidents.filter((r) => r.familyId === me.familyId && r.id !== me.id)
  return {
    self: me,
    // Minors only; the relationship is verified by staff from the proof.
    dependents: family.filter((r) => ageYears(r.birthDate) < 18),
    adults: family.filter((r) => ageYears(r.birthDate) >= 18),
    isHead: me.relationship === 'Head',
  }
}

function notifyUserOfResident(residentId: string, title: string, body: string, link: string) {
  const u = mockUsers.find((x) => x.residentId === residentId && x.status === 'active')
  if (!u) return
  mockNotifications.push({ id: `ntf-${Math.random().toString(36).slice(2, 9)}`, userId: u.id, category: 'resident_change', title, body, createdAt: new Date().toISOString(), read: false, link })
}

export interface CorrectionInput {
  basis: CorrectionBasis
  residentId: string
  field: string
  requestedValue: string
  reason: string
  proof?: ResidentChangeRequest['proof']
  /** Representative or guardian evidence. */
  authorization?: ResidentChangeRequest['authorization']
}

/**
 * Resident-submitted correction. Rules (RA 10173): own record; a minor child
 * with proof of guardianship; another adult only with a specific authorization
 * that staff verify; household-level updates only by the family head. Nothing
 * changes until staff approve, and the previous value is kept.
 */
/**
 * Correction routing policy (configurable; confirm with the barangay).
 *  auto            applied at once, own record only, after format/duplicate/conflict checks
 *  self_reported   applied at once but marked self-reported (not officially verified)
 *  review          Secretary decides (identity or legally significant fields)
 * Contact numbers would need a one-time code sent to the new number; with no
 * SMS service connected they are applied and marked "not verified".
 */
export const CORRECTION_POLICY: Record<string, 'auto' | 'self_reported' | 'review'> = {
  'Contact number': 'auto',
  Employment: 'self_reported',
  'Educational attainment': 'self_reported',
  'Full name': 'review',
  Birthdate: 'review',
  'Civil status': 'review',
  'Relationship in the family': 'review',
}

export type CheckResult = 'passed' | 'failed' | 'needs_review' | 'not_applicable'
export interface CorrectionCheck { name: string; result: CheckResult; note?: string }

function correctionChecks(input: CorrectionInput, res: Resident, me: Resident): CorrectionCheck[] {
  const checks: CorrectionCheck[] = []
  const v = input.requestedValue.trim()
  const fmt = input.field === 'Contact number' ? /^09\d{9}$/.test(v.replace(/[\s-]/g, '')) : input.field === 'Birthdate' ? !Number.isNaN(Date.parse(v)) && new Date(v) < new Date() : v.replace(/\|/g, '').trim().length > 0
  checks.push({ name: 'Format', result: fmt ? 'passed' : 'failed', note: fmt ? undefined : input.field === 'Contact number' ? 'Use an 11-digit mobile number starting with 09.' : 'Check the value.' })
  const pending = mockChangeRequests.some((c) => c.residentId === res.id && c.field === input.field && c.status === 'pending')
  checks.push({ name: 'No pending request for this field', result: pending ? 'failed' : 'passed', note: pending ? 'There is already a pending request for this.' : undefined })
  if (input.field === 'Contact number') {
    // One number per resident record (re-checked again just before saving).
    const n = v.replace(/[\s-]/g, '')
    const taken = mockResidents.some((r) => r.id !== res.id && (r.contactNo ?? '').replace(/[\s-]/g, '') === n)
    checks.push({ name: 'Number not used by another resident', result: taken ? 'failed' : 'passed', note: taken ? 'This contact number is already registered to another resident. Please check the number and try again.' : undefined })
  }
  if (input.field === 'Full name' || input.field === 'Birthdate') {
    const [first, , last] = input.field === 'Full name' ? v.split('|') : [res.firstName, '', res.lastName]
    const birth = input.field === 'Birthdate' ? v : res.birthDate
    const clash = mockResidents.some((r) => r.id !== res.id && r.firstName.toLowerCase() === (first ?? '').trim().toLowerCase() && r.lastName.toLowerCase() === (last ?? '').trim().toLowerCase() && r.birthDate === birth)
    checks.push({ name: 'No other resident with the same name and birthdate', result: clash ? 'needs_review' : 'passed', note: clash ? 'Another record has the same name and birthdate.' : undefined })
  } else checks.push({ name: 'Conflicting records', result: 'not_applicable' })
  if (input.field === 'Relationship in the family') {
    const heads = mockResidents.filter((r) => r.familyId === res.familyId && r.relationship === 'Head' && r.id !== res.id).length
    checks.push({ name: 'Household consistency', result: v === 'Head' && heads > 0 ? 'needs_review' : 'passed', note: v === 'Head' && heads > 0 ? 'The family already has a head.' : undefined })
  }
  const proof = PROOF_REQUIRED[input.field]
  checks.push({ name: 'Supporting document', result: !proof ? 'not_applicable' : input.proof?.fileId || input.proof?.fileName ? 'needs_review' : input.proof?.bringOnsite ? 'needs_review' : 'failed', note: proof && input.proof?.bringOnsite ? 'Original to be shown at the Barangay Hall.' : undefined })
  checks.push({ name: 'Own record', result: res.id === me.id ? 'passed' : 'needs_review', note: res.id === me.id ? undefined : 'Submitted for someone else.' })
  checks.push({ name: 'One-time code to the new number', result: input.field === 'Contact number' ? 'needs_review' : 'not_applicable', note: input.field === 'Contact number' ? 'No SMS service connected; number not verified.' : undefined })
  return checks
}

export function submitCorrection(input: CorrectionInput, by: User, clientRequestId?: string): Promise<ResidentChangeRequest> {
  return mockRequest(() => once(clientRequestId && `${by.id}:${clientRequestId}`, (id) => mockChangeRequests.find((c) => c.id === id), (c) => c.id, () => {
    const me = mockResidents.find((r) => r.id === by.residentId)
    const res = mockResidents.find((r) => r.id === input.residentId)
    if (!res || !me) throw new ServiceError('not_found', 'Record not found.')
    const { basis, field } = input
    const sameFamily = res.familyId === me.familyId
    if (basis === 'self' && res.id !== me.id) throw new ServiceError('forbidden', 'Choose who this correction is for.')
    if (basis === 'dependent') {
      if (!sameFamily || res.id === me.id) throw new ServiceError('forbidden', 'You can only request corrections for your own child or dependent.')
      if (ageYears(res.birthDate) >= 18) throw new ServiceError('forbidden', 'Adults request their own corrections, or authorize a representative.')
      if (!input.authorization?.fileName && !input.authorization?.bringOnsite) throw new ServiceError('proof', `Attach proof that you are the parent or guardian (${GUARDIAN_PROOF}).`)
    }
    if (basis === 'representative') {
      if (res.id === me.id) throw new ServiceError('forbidden', 'Use "My own record" for your own corrections.')
      if (!sameFamily) throw new ServiceError('forbidden', 'Representation for residents outside your family is handled at the Barangay Hall.')
      if (!input.authorization?.kind || !REPRESENTATION_KINDS.includes(input.authorization.kind as (typeof REPRESENTATION_KINDS)[number])) throw new ServiceError('auth', 'Choose the basis of your authorization.')
      if (!input.authorization.fileName && !input.authorization.bringOnsite) throw new ServiceError('auth', 'Attach the authorization, or choose to bring it to the Barangay Hall.')
    }
    if (basis === 'household') {
      if (me.relationship !== 'Head') throw new ServiceError('forbidden', 'Only the head of the family can request household updates.')
      if (!HOUSEHOLD_UPDATES.includes(field as (typeof HOUSEHOLD_UPDATES)[number])) throw new ServiceError('field', 'Choose a household update.')
    } else if (!CORRECTABLE_FIELDS.includes(field as (typeof CORRECTABLE_FIELDS)[number])) {
      throw new ServiceError('field', 'Choose what needs correcting.')
    }
    if (!input.requestedValue.replace(/\|/g, '').trim()) throw new ServiceError('value', 'Enter the correct information.')
    if (field === 'Full name') {
      const [first, , last] = input.requestedValue.split('|')
      if (!first?.trim() || !last?.trim()) throw new ServiceError('value', 'Please enter both the first name and the last name.')
    }
    if (field === 'Contact number' && !isMobile(input.requestedValue)) throw new ServiceError('value', MSG.mobile)
    if (field === 'Birthdate' && (Number.isNaN(new Date(input.requestedValue).getTime()) || new Date(input.requestedValue) > new Date())) throw new ServiceError('value', 'Please enter a real birthdate that is not in the future.')
    if (!input.reason.trim()) throw new ServiceError('reason', 'Add the reason.')
    if (basis !== 'household' && PROOF_REQUIRED[field] && !input.proof?.fileName && !input.proof?.bringOnsite) throw new ServiceError('proof', `Attach proof (${PROOF_REQUIRED[field]}) or choose to bring it to the Barangay Hall.`)
    const current: Record<string, string> = {
      'Full name': [res.firstName, res.middleName, res.lastName, res.suffix].filter(Boolean).join(' '),
      Birthdate: res.birthDate,
      'Civil status': res.civilStatus,
      'Contact number': res.contactNo ?? '',
      Employment: res.employment,
      'Educational attainment': res.education,
      'Relationship in the family': res.relationship,
      'Household address': `${res.houseNo} ${res.street}`,
    }
    const cr: ResidentChangeRequest = {
      id: `chg-${Date.now().toString(36)}`,
      residentId: res.id,
      submittedAt: new Date().toISOString(),
      field,
      originalValue: current[field] ?? '',
      requestedValue: input.requestedValue.trim(),
      reason: input.reason.trim(),
      status: 'pending',
      basis,
      requestedByResidentId: res.id !== me.id ? me.id : undefined,
      proof: PROOF_REQUIRED[field] ? input.proof : undefined,
      authorization: basis === 'dependent' || basis === 'representative' ? input.authorization : undefined,
    }
    // Automated checks and routing.
    const checks = correctionChecks(input, res, me)
    const failed = checks.find((c) => c.result === 'failed' && c.name !== 'Supporting document')
    if (failed) throw new ServiceError('check', failed.note ?? `${failed.name} check failed.`)
    cr.checks = checks
    const sameLetters = (x: string) => x.replace(/[|\s]+/g, ' ').trim().toLowerCase()
    const formattingOnly = field === 'Full name' && sameLetters(cr.requestedValue) === sameLetters([res.firstName, res.middleName ?? '', res.lastName, res.suffix ?? ''].join('|'))
    if (formattingOnly) checks.push({ name: 'Only spacing or capital letters change', result: 'passed' })
    const policy = formattingOnly ? 'auto' : CORRECTION_POLICY[field] ?? 'review'
    const clean = basis === 'self' && !checks.some((c) => c.result === 'needs_review' && c.name !== 'One-time code to the new number' && !(formattingOnly && c.name === 'Supporting document'))
    if (basis !== 'household' && policy !== 'review' && clean) {
      const now = new Date().toISOString()
      if (field === 'Contact number' && mockResidents.some((r) => r.id !== res.id && (r.contactNo ?? '').replace(/[\s-]/g, '') === cr.requestedValue.replace(/[\s-]/g, '')))
        throw new ServiceError('taken', 'This contact number is already registered to another resident. Please check the number and try again.')
      if (field === 'Contact number') cr.requestedValue = cr.requestedValue.replace(/[\s-]/g, '')
      FIELD_SETTERS[field]?.(res, cr.requestedValue)
      res.updatedAt = now
      cr.status = 'approved'
      cr.decidedBy = 'system'
      cr.decidedAt = now
      cr.route = 'auto'
      cr.decisionNote = formattingOnly ? 'Spelling kept; spacing or capital letters corrected automatically.' : field === 'Contact number' ? 'Updated automatically. Number not verified (no SMS service yet).' : policy === 'self_reported' ? 'Updated automatically as self-reported information.' : 'Updated automatically.'
      mockChangeRequests.unshift(cr)
      audit(by, `Correction applied automatically: ${field}`, 'Residents', `${res.id}: "${cr.originalValue}" → "${displayRequestedValue(field, cr.requestedValue)}"`)
      notifyUserOfResident(me.id, 'Your record was updated', `${field} · ${cr.decisionNote}`, '/my/profile')
      return cr
    }
    cr.route = checks.some((c) => c.result === 'needs_review' && c.name === 'Supporting document') ? 'verification' : 'decision'
    mockChangeRequests.unshift(cr)
    audit(by, `Correction requested (${basis})`, 'Residents', res.id)
    notifyUserOfResident(me.id, 'Correction request received', `${field} · under review by the Barangay Secretary.`, '/my/profile')
    // The affected adult is told someone asked to change their record (no values in the preview).
    if (basis === 'representative') notifyUserOfResident(res.id, 'A correction was requested for your record', `${field} · submitted by ${me.firstName} ${me.lastName}. Contact the Barangay Hall if you did not authorize this.`, '/my/profile')
    return cr
  }))
}

/** Kept for older callers: own record or a minor dependent. */
export function submitChangeRequest(residentId: string, field: string, requestedValue: string, reason: string, by: User, proof?: ResidentChangeRequest['proof']): Promise<ResidentChangeRequest> {
  return submitCorrection({ basis: residentId === by.residentId ? 'self' : 'dependent', residentId, field, requestedValue, reason, proof }, by)
}

export const CHANGEABLE_FIELDS: string[] = [...CORRECTABLE_FIELDS]

// ── CSV import (FR4–FR5) ──────────────────────────────────────────────

export interface ImportRecord {
  lastName: string
  firstName: string
  middleName?: string
  suffix?: string
  birthDate: string
  sex: Resident['sex']
  civilStatus: Resident['civilStatus']
  houseNo: string
  street: string
  contactNo?: string
  voter: boolean
}

const norm = (s: string | undefined) => (s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
export const dupKey = (r: { firstName: string; lastName: string; middleName?: string; birthDate: string; houseNo: string; street: string }) =>
  [norm(r.lastName), norm(r.firstName), r.birthDate, norm(r.houseNo), norm(r.street)].join('|')

/** Existing resident that matches on full name + birthdate + address (study §1.4 rule). */
export function findDuplicate(r: ImportRecord): Resident | undefined {
  const k = dupKey(r)
  return mockResidents.find((x) => dupKey(x) === k) ?? mockResidents.find((x) => norm(x.lastName) === norm(r.lastName) && norm(x.firstName) === norm(r.firstName) && x.birthDate === r.birthDate)
}

/** Extra details known for a single new record (e.g. from an online registration). */
export interface NewResidentExtras {
  id?: string
  residentSince?: string
  oscaId?: string
  sectors?: Partial<Resident['sectors']>
  registrationStatus?: Resident['registrationStatus']
}

/** Adds one record (in memory). A new address becomes a household with one family. */
export function addResident(rec: ImportRecord, extra: NewResidentExtras = {}): Resident {
  const existing = extra.id ? mockResidents.find((r) => r.id === extra.id) : undefined
  if (existing) return existing
  const now = new Date().toISOString()
  let hh = mockHouseholds.find((h) => norm(h.houseNo) === norm(rec.houseNo) && norm(h.street) === norm(rec.street))
  const id = extra.id ?? `res-imp-${Math.random().toString(36).slice(2, 8)}`
  if (!hh) {
    const created: Household = {
      id: `hh-imp-${Math.random().toString(36).slice(2, 8)}`,
      householdNo: householdNumber(nextNumber('HH', mockHouseholds.map((h) => h.householdNo))),
      houseNo: rec.houseNo,
      street: rec.street,
      address: `${rec.houseNo} ${rec.street}, Gagalangin, Tondo, Manila`,
      families: [],
    }
    created.families.push({ id: `${created.id}-f1`, familyNo: familyNumber(nextNumber('FAM', allFamilyNos())), name: `${rec.lastName} family`, headResidentId: id, memberIds: [] })
    mockHouseholds.push(created)
    hh = created
  }
  const fam = hh.families[0]
  fam.memberIds.push(id)
  const b = new Date(rec.birthDate)
  const n = new Date()
  const ageNow = n.getFullYear() - b.getFullYear() - (n < new Date(n.getFullYear(), b.getMonth(), b.getDate()) ? 1 : 0)
  const resident: Resident = {
    id,
    residentNo: residentNumber(new Date().getFullYear(), nextNumber('RES', mockResidents.map((r) => r.residentNo))),
    ...rec,
    householdId: hh.id,
    familyId: fam.id,
    relationship: fam.headResidentId === id ? 'Head' : 'Relative',
    residentSince: extra.residentSince || 'Not recorded',
    employment: 'Not recorded',
    education: 'Not recorded',
    oscaId: extra.oscaId || undefined,
    sectors: { seniorCitizen: ageNow >= 60, pwd: false, soloParent: false, fourPs: false, programBeneficiary: false, ...extra.sectors },
    registrationStatus: extra.registrationStatus ?? 'not_registered',
    createdAt: now,
    updatedAt: now,
  }
  mockResidents.push(resident)
  return resident
}

/** Adds reviewed records (in memory only). Each new address becomes a household with one family. */
export function importResidents(records: ImportRecord[], by: User): Promise<number> {
  return mockRequest(() => {
    if (!by) throw new ServiceError('forbidden', 'Not allowed.')
    for (const rec of records) addResident(rec)
    return records.length
  })
}

// ── Identifiers and household records ────────────────────────────────
const allFamilyNos = () => mockHouseholds.flatMap((h) => h.families.map((f) => f.familyNo))
const isAdult = (birthDate: string) => { const b = new Date(birthDate + 'T00:00:00+08:00'); const t = new Date(); t.setFullYear(t.getFullYear() - 18); return b <= t }
const canEdit = (u: User) => !!ROLE_PERMISSIONS[u.roleId]?.includes('residents.update') || !!u.extraPermissions?.includes('residents.update')

/**
 * Possible duplicates before a new resident is added. Shown to Barangay
 * Personnel; never merged automatically (matching names alone prove nothing).
 */
export function possibleDuplicates(p: { firstName: string; lastName: string; birthDate?: string; contactNo?: string; houseNo?: string; street?: string }): { resident: Resident; reasons: string[] }[] {
  const n = (x?: string) => (x ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const out: { resident: Resident; reasons: string[] }[] = []
  for (const r of mockResidents) {
    const reasons: string[] = []
    const sameName = n(r.firstName) === n(p.firstName) && n(r.lastName) === n(p.lastName)
    if (sameName && p.birthDate && r.birthDate === p.birthDate) reasons.push('Same name and birthdate')
    else if (sameName && p.street && n(r.street) === n(p.street)) reasons.push('Same name on the same street')
    if (p.contactNo && r.contactNo && n(r.contactNo) === n(p.contactNo)) reasons.push('Same contact number')
    if (reasons.length) out.push({ resident: r, reasons })
  }
  return out
}

/** New household at an address that is not yet recorded (one per address). */
export function createHousehold(input: { houseNo: string; street: string; familyName: string }, by: User): Promise<Household> {
  return mockRequest(() => {
    if (!canEdit(by)) throw new ServiceError('forbidden', 'You cannot change household records.')
    if (!input.houseNo.trim() || !input.street.trim()) throw new ServiceError('address', 'Enter the house number and street.')
    const dup = mockHouseholds.find((h) => norm(h.houseNo) === norm(input.houseNo) && norm(h.street) === norm(input.street))
    if (dup) throw new ServiceError('duplicate', `This address is already household ${dup.householdNo}. Add the family there instead.`)
    const h: Household = { id: `hh-${Date.now().toString(36)}`, householdNo: householdNumber(nextNumber('HH', mockHouseholds.map((x) => x.householdNo))), houseNo: input.houseNo.trim(), street: input.street.trim(), address: `${input.houseNo.trim()} ${input.street.trim()}, Gagalangin, Tondo, Manila`, families: [] }
    if (input.familyName.trim()) h.families.push({ id: `${h.id}-f1`, familyNo: familyNumber(nextNumber('FAM', allFamilyNos())), name: input.familyName.trim(), headResidentId: '', memberIds: [] })
    mockHouseholds.push(h)
    audit(by, `Household created: ${h.householdNo}`, 'Residents', h.address)
    return h
  })
}

/** Another family living at the same household address. */
export function addFamily(householdId: string, name: string, by: User): Promise<Family> {
  return mockRequest(() => {
    if (!canEdit(by)) throw new ServiceError('forbidden', 'You cannot change household records.')
    const h = mockHouseholds.find((x) => x.id === householdId)
    if (!h) throw new ServiceError('not_found', 'Household not found.')
    if (name.trim().length < 3) throw new ServiceError('name', 'Give the family name.')
    if (h.families.some((f) => f.name.toLowerCase() === name.trim().toLowerCase())) throw new ServiceError('duplicate', 'This household already has a family with that name.')
    const f: Family = { id: `${h.id}-f${h.families.length + 1}-${Date.now().toString(36).slice(-3)}`, familyNo: familyNumber(nextNumber('FAM', allFamilyNos())), name: name.trim(), headResidentId: '', memberIds: [] }
    h.families.push(f)
    audit(by, `Family added: ${f.familyNo} in ${h.householdNo}`, 'Residents', f.name)
    return f
  })
}

/** Move a resident to another household and family. The resident number never changes; the move is kept. */
export function moveResident(residentId: string, toFamilyId: string, relationship: Relationship, reason: string, by: User): Promise<Resident> {
  return mockRequest(() => {
    if (!canEdit(by)) throw new ServiceError('forbidden', 'You cannot change household records.')
    if (reason.trim().length < 5) throw new ServiceError('reason', 'Give the reason for the move.')
    const r = mockResidents.find((x) => x.id === residentId)
    const toHh = mockHouseholds.find((h) => h.families.some((f) => f.id === toFamilyId))
    const toFam = toHh?.families.find((f) => f.id === toFamilyId)
    if (!r || !toHh || !toFam) throw new ServiceError('not_found', 'Resident or family not found.')
    if (r.familyId === toFamilyId) throw new ServiceError('same', 'Already in this family.')
    const fromHh = mockHouseholds.find((h) => h.id === r.householdId)
    const fromFam = fromHh?.families.find((f) => f.id === r.familyId)
    if (fromFam?.headResidentId === r.id && fromFam.memberIds.length > 1) throw new ServiceError('head', 'Choose a new head for the current family first.')
    if (relationship === 'Head' && toFam.headResidentId && toFam.memberIds.includes(toFam.headResidentId)) throw new ServiceError('head', 'That family already has a head.')
    if (relationship === 'Head' && !isAdult(r.birthDate)) throw new ServiceError('head', 'A family head must be 18 or older.')
    if (fromFam) { fromFam.memberIds = fromFam.memberIds.filter((x) => x !== r.id); if (fromFam.headResidentId === r.id) fromFam.headResidentId = '' }
    toFam.memberIds.push(r.id)
    if (relationship === 'Head') toFam.headResidentId = r.id
    const now = new Date().toISOString()
    const from = `${fromHh?.householdNo ?? '?'} / ${fromFam?.familyNo ?? '?'}`
    const to = `${toHh.householdNo} / ${toFam.familyNo}`
    Object.assign(r, { householdId: toHh.id, familyId: toFam.id, relationship, houseNo: toHh.houseNo, street: toHh.street, updatedAt: now })
    r.moves = [...(r.moves ?? []), { at: now, byUserId: by.id, from, to, reason: reason.trim() }]
    audit(by, `Resident moved: ${r.residentNo}`, 'Residents', `${from} → ${to}: ${reason.trim()}`)
    return r
  })
}

/** Set who heads a family (must be a member). */
export function setFamilyHead(familyId: string, residentId: string, by: User): Promise<Family> {
  return mockRequest(() => {
    if (!canEdit(by)) throw new ServiceError('forbidden', 'You cannot change household records.')
    const h = mockHouseholds.find((x) => x.families.some((f) => f.id === familyId))
    const f = h?.families.find((x) => x.id === familyId)
    if (!f || !f.memberIds.includes(residentId)) throw new ServiceError('member', 'The head must be a member of the family.')
    const r = mockResidents.find((x) => x.id === residentId)
    if (r && !isAdult(r.birthDate)) throw new ServiceError('head', 'A family head must be 18 or older.')
    const prev = f.headResidentId
    f.headResidentId = residentId
    if (r) r.relationship = 'Head'
    const old = mockResidents.find((x) => x.id === prev)
    if (old && old.id !== residentId) old.relationship = 'Relative'
    audit(by, `Family head set: ${f.familyNo}`, 'Residents', r?.residentNo)
    return f
  })
}

/** Find by any number (resident, household, family, earlier numbers), name, address, or contact (Barangay Personnel). */
export function findByAny(query: string): { residents: Resident[]; households: Household[] } {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return { residents: [], households: [] }
  const hhMatch = mockHouseholds.filter((h) => [h.householdNo, h.legacyNo, h.address, ...h.families.map((f) => f.familyNo), ...h.families.map((f) => f.name)].some((v) => v?.toLowerCase().includes(q)))
  const famIds = new Set(hhMatch.flatMap((h) => h.families.filter((f) => f.familyNo.toLowerCase().includes(q)).map((f) => f.id)))
  const residents = mockResidents.filter((r) => famIds.has(r.familyId) || [r.residentNo, r.legacyNo, `${r.firstName} ${r.middleName ?? ''} ${r.lastName}`, `${r.houseNo} ${r.street}`, r.contactNo].some((v) => v?.toLowerCase().includes(q)))
  return { residents, households: hhMatch }
}
