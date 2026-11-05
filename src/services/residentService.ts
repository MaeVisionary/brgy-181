import { PUROKS, mockChangeRequests, mockHouseholds, mockRegistrations, mockResidents } from '@/mocks/residents'
import type { Resident } from '@/types/resident'
import { mockRequest } from './mockApi'

export interface PopulationSummary {
  totalResidents: number
  totalHouseholds: number
  seniorCitizens: number
  pwds: number
  soloParents: number
  fourPsMembers: number
  programBeneficiaries: number
}

export interface PurokBreakdown {
  purok: string
  residents: number
  households: number
  seniorCitizens: number
  pwds: number
  soloParents: number
  fourPsMembers: number
}

function summarize(residents: Resident[], householdCount: number): PopulationSummary {
  return {
    totalResidents: residents.length,
    totalHouseholds: householdCount,
    seniorCitizens: residents.filter((r) => r.sectors.seniorCitizen).length,
    pwds: residents.filter((r) => r.sectors.pwd).length,
    soloParents: residents.filter((r) => r.sectors.soloParent).length,
    fourPsMembers: residents.filter((r) => r.sectors.fourPs).length,
    programBeneficiaries: residents.filter((r) => r.sectors.programBeneficiary).length,
  }
}

/** Population figures computed from the resident records (never hardcoded). */
export function getPopulationSummary(): Promise<PopulationSummary> {
  return mockRequest(() => summarize(mockResidents, mockHouseholds.length))
}

export function getPurokBreakdown(): Promise<PurokBreakdown[]> {
  return mockRequest(() =>
    PUROKS.map((purok) => {
      const rs = mockResidents.filter((r) => r.purok === purok)
      const s = summarize(rs, mockHouseholds.filter((h) => h.purok === purok).length)
      return {
        purok,
        residents: s.totalResidents,
        households: s.totalHouseholds,
        seniorCitizens: s.seniorCitizens,
        pwds: s.pwds,
        soloParents: s.soloParents,
        fourPsMembers: s.fourPsMembers,
      }
    }),
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

export function getResident(id: string): Promise<Resident | undefined> {
  return mockRequest(() => mockResidents.find((r) => r.id === id))
}
