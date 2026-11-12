import type { RoleId } from './auth'

/** Katarungang Pambarangay case stages (study §2.1, KP process). */
export type CaseStage =
  | 'filed'
  | 'under_review'
  | 'for_assessment'
  | 'mediation_scheduled'
  | 'ongoing_mediation'
  | 'settled'
  | 'referred_to_lupon'
  | 'lupon_mediation'
  | 'closed'

export interface Party {
  residentId?: string
  name: string
  address: string
  contactNo?: string
}

export type HearingKind = 'chairman_mediation' | 'lupon_mediation'

/** Whether a person confirmed they can attend the scheduled hearing. */
export type Availability = 'unconfirmed' | 'confirmed' | 'unavailable'
export type AvailabilityWho = 'complainant' | 'respondent' | 'chairman'

export interface Attendance {
  name: string
  side: 'complainant' | 'respondent'
  present: boolean | null
  /** Absent with a valid reason. */
  excused?: boolean
}

export interface Hearing {
  id: string
  kind: HearingKind
  scheduledAt: string
  place: string
  status: 'scheduled' | 'held' | 'rescheduled' | 'cancelled'
  attendance: Attendance[]
  notes?: string
  /** Simulated reminders sent (FR20). */
  remindersSentAt: string[]
  /** Who confirmed they can attend (Chairman interview, 10 Nov 2026). */
  availability?: Record<AvailabilityWho, Availability>
}

export interface CaseEvent {
  at: string
  byUserId: string
  byRole: RoleId
  action: string
  stage: CaseStage
  remarks?: string
}

export interface KPCase {
  id: string
  caseNo: string
  /** Entry number in the barangay blotter. */
  blotterNo?: string
  /** Kagawads assigned to help with this complaint. */
  assignedTo?: string[]
  incidentDate?: string
  incidentPlace?: string
  /** Online complaint/report this case was recorded from. */
  sourceRequestId?: string
  /** "Complainant vs. Respondent" as written on notices. */
  title: string
  /** "For:" on the summons. */
  nature: string
  complainants: Party[]
  respondents: Party[]
  /** Confidential: complaint details (visible to authorized personnel and the complainant). */
  details: string
  filedAt: string
  filedVia: 'online' | 'walk_in'
  stage: CaseStage
  /** Start of the Chairman's mediation period (up to 15 days). */
  mediationStartedAt?: string
  luponStartedAt?: string
  hearings: Hearing[]
  history: CaseEvent[]
  outcome?: { type: 'settled' | 'not_settled' | 'dismissed' | 'withdrawn'; summary: string; at: string }
  /** Document requests tied to this case (summon, notice of hearing). */
  documentIds: string[]
  /** Restricted to personnel with cases.manage. */
  internalNotes: string[]
}
