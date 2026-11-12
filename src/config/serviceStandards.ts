import type { DocumentTypeId } from '@/types/document'

/**
 * SERVICE STANDARDS (Citizen's Charter).
 *
 * RA 11032 sets the MAXIMUM processing time per classification: simple 3,
 * complex 7, highly technical 20 working days. The barangay's approved
 * Citizen's Charter may set a shorter time; until an administrator enters it
 * (`charterDays`), the legal maximum is used and labelled as such. No duration
 * or fee is invented here.
 *
 * Katarungang Pambarangay documents (summons, incident and blotter records)
 * follow the KP rules, not a charter processing time, so they have none.
 */
export type Classification = 'simple' | 'complex' | 'highly_technical'
export const CLASSIFICATION_MAX: Record<Classification, number> = { simple: 3, complex: 7, highly_technical: 20 }
export const CLASSIFICATION_LABEL: Record<Classification, string> = { simple: 'Simple', complex: 'Complex', highly_technical: 'Highly technical' }

export interface ServiceStandard {
  classification?: Classification
  /** Working days from the approved Citizen's Charter (must not exceed the classification maximum). */
  charterDays?: number
  /** How the resident receives the document. */
  release: 'pickup' | 'online' | 'none'
  /** Office responsible for processing. */
  office: string
  /** Extra conditions shown to the resident when relevant. */
  conditions?: string
}

const SECRETARY = 'Office of the Barangay Secretary'

export const DEFAULT_STANDARDS: Record<DocumentTypeId, ServiceStandard> = {
  'first-time-job-seeker': { classification: 'simple', release: 'pickup', office: SECRETARY },
  'non-residency': { classification: 'simple', release: 'pickup', office: SECRETARY },
  cohabitation: { classification: 'simple', release: 'pickup', office: SECRETARY },
  'no-partner': { classification: 'simple', release: 'pickup', office: SECRETARY },
  residency: { classification: 'simple', release: 'pickup', office: SECRETARY },
  indigency: { classification: 'simple', release: 'pickup', office: SECRETARY },
  'clearance-person': { classification: 'simple', release: 'pickup', office: SECRETARY },
  'business-clearance': { classification: 'simple', release: 'pickup', office: SECRETARY },
  'barangay-certificate': { classification: 'simple', release: 'pickup', office: SECRETARY },
  summon: { release: 'none', office: 'Lupong Tagapamayapa' },
  'incident-record': { release: 'none', office: SECRETARY },
  'blotter-report': { release: 'none', office: SECRETARY },
  'notice-of-hearing': { release: 'none', office: 'Lupong Tagapamayapa' },
}

/**
 * Non-working days (regular holidays and special non-working days). Movable
 * holidays change every year: administrators update this list from the yearly
 * presidential proclamation.
 */
export const DEFAULT_HOLIDAYS: { date: string; name: string }[] = [
  { date: '2026-01-01', name: "New Year's Day" },
  { date: '2026-04-02', name: 'Maundy Thursday' },
  { date: '2026-04-03', name: 'Good Friday' },
  { date: '2026-04-04', name: 'Black Saturday' },
  { date: '2026-04-09', name: 'Araw ng Kagitingan' },
  { date: '2026-05-01', name: 'Labor Day' },
  { date: '2026-06-12', name: 'Independence Day' },
  { date: '2026-08-21', name: 'Ninoy Aquino Day' },
  { date: '2026-08-31', name: 'National Heroes Day' },
  { date: '2026-11-01', name: "All Saints' Day" },
  { date: '2026-11-30', name: 'Bonifacio Day' },
  { date: '2026-12-08', name: 'Feast of the Immaculate Conception' },
  { date: '2026-12-24', name: 'Christmas Eve' },
  { date: '2026-12-25', name: 'Christmas Day' },
  { date: '2026-12-30', name: 'Rizal Day' },
  { date: '2026-12-31', name: "New Year's Eve" },
]

/** Office hours used for the "received after hours" rule (Asia/Manila). */
export const OFFICE_OPEN_HOUR = 8
export const OFFICE_CLOSE_HOUR = 17
