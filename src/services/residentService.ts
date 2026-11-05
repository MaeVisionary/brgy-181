import { AREAS, mockChangeRequests, mockHouseholds, mockRegistrations, mockResidents } from '@/mocks/residents'
import type { User } from '@/types/auth'
import type { Household, Resident, ResidentChangeRequest } from '@/types/resident'
import { ServiceError, mockRequest } from './mockApi'

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
        const hay = `${r.firstName} ${r.middleName ?? ''} ${r.lastName} ${r.residentNo}`.toLowerCase()
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
}

export function listChangeRequests(): Promise<ResidentChangeRequest[]> {
  return mockRequest(() => [...mockChangeRequests].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)))
}

export function decideChangeRequest(id: string, decision: 'approved' | 'rejected', note: string, by: User): Promise<ResidentChangeRequest> {
  return mockRequest(() => {
    const cr = mockChangeRequests.find((c) => c.id === id)
    if (!cr) throw new ServiceError('not_found', 'Change request not found.')
    if (cr.status !== 'pending') throw new ServiceError('decided', 'This request was already decided.')
    if (decision === 'rejected' && !note.trim()) throw new ServiceError('note', 'Add the reason for rejecting.')
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
    return cr
  })
}

/** Resident-submitted correction request (own record only). */
export function submitChangeRequest(residentId: string, field: string, requestedValue: string, reason: string, by: User): Promise<ResidentChangeRequest> {
  return mockRequest(() => {
    if (by.residentId !== residentId) throw new ServiceError('forbidden', 'You can only request changes to your own record.')
    const res = mockResidents.find((r) => r.id === residentId)
    if (!res) throw new ServiceError('not_found', 'Record not found.')
    const current: Record<string, string> = {
      'Civil status': res.civilStatus,
      'Contact number': res.contactNo ?? '',
      Employment: res.employment,
      'Educational attainment': res.education,
    }
    const cr: ResidentChangeRequest = {
      id: `chg-${Date.now().toString(36)}`,
      residentId,
      submittedAt: new Date().toISOString(),
      field,
      originalValue: current[field] ?? '',
      requestedValue,
      reason,
      status: 'pending',
    }
    mockChangeRequests.unshift(cr)
    return cr
  })
}

export const CHANGEABLE_FIELDS = Object.keys(FIELD_SETTERS)

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
    hh = {
      id: `hh-imp-${Math.random().toString(36).slice(2, 8)}`,
      householdNo: `HH-181-I${String(mockHouseholds.length + 1).padStart(3, '0')}`,
      houseNo: rec.houseNo,
      street: rec.street,
      address: `${rec.houseNo} ${rec.street}, Gagalangin, Tondo, Manila`,
      families: [{ id: '', name: `${rec.lastName} family`, headResidentId: id, memberIds: [] }],
    }
    hh.families[0].id = `${hh.id}-f1`
    mockHouseholds.push(hh)
  }
  const fam = hh.families[0]
  fam.memberIds.push(id)
  const b = new Date(rec.birthDate)
  const n = new Date()
  const ageNow = n.getFullYear() - b.getFullYear() - (n < new Date(n.getFullYear(), b.getMonth(), b.getDate()) ? 1 : 0)
  const resident: Resident = {
    id,
    residentNo: `181-IMP-${String(mockResidents.length + 1).padStart(4, '0')}`,
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
