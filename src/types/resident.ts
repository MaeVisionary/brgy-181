export type Sex = 'male' | 'female'

export type CivilStatus = 'single' | 'married' | 'widowed' | 'separated' | 'live_in'

/** Sector flags used in analytics and community planning (FR15, FR16). */
export interface ResidentSectors {
  seniorCitizen: boolean
  pwd: boolean
  soloParent: boolean
  fourPs: boolean
  /** Other program beneficiaries; the specific programs are pending confirmation. */
  programBeneficiary: boolean
}

export type RegistrationStatus =
  | 'not_registered'
  | 'pending_verification'
  | 'manual_review'
  | 'verified'
  | 'rejected'

/** Relationship to the head of the resident's family (study: Family, Household). */
export type Relationship = 'Head' | 'Spouse' | 'Partner' | 'Son' | 'Daughter' | 'Mother' | 'Father' | 'Grandchild' | 'Sibling' | 'Relative'

export interface Resident {
  id: string
  /** Permanent resident number, RES-181-YYYY-NNNNNN (see src/lib/ids.ts). Never changes. */
  residentNo: string
  /** Number used before the standard (still searchable). */
  legacyNo?: string
  /** Household and family moves, newest last (kept for the record). */
  moves?: { at: string; byUserId: string; from: string; to: string; reason: string }[]
  firstName: string
  middleName?: string
  lastName: string
  suffix?: string
  sex: Sex
  birthDate: string
  civilStatus: CivilStatus
  houseNo: string
  street: string
  householdId: string
  familyId: string
  relationship: Relationship
  contactNo?: string
  /** Residency information: year they started living in the barangay. */
  residentSince: string
  voter: boolean
  employment: string
  education: string
  oscaId?: string
  sectors: ResidentSectors
  registrationStatus: RegistrationStatus
  createdAt: string
  updatedAt: string
}

export interface Family {
  id: string
  /** FAM-181-NNNNNN. */
  familyNo: string
  /** Display name, e.g. "Dizon family". */
  name: string
  headResidentId: string
  memberIds: string[]
}

/** A household is everyone living at one address; it can hold more than one family. */
export interface Household {
  id: string
  /** HH-181-NNNNNN. */
  householdNo: string
  /** Number used before the standard (still searchable). */
  legacyNo?: string
  houseNo: string
  street: string
  address: string
  families: Family[]
}

export type ReviewStatus = 'pending' | 'approved' | 'rejected'

export interface ResidentRegistration {
  id: string
  referenceNo: string
  submittedAt: string
  applicant: {
    firstName: string
    lastName: string
    birthDate: string
    address: string
    middleName?: string
    suffix?: string
    sex?: Sex
    civilStatus?: CivilStatus
    houseNo?: string
    street?: string
    contactNo?: string
    email?: string
    residentSince?: string
    voter?: boolean
    oscaId?: string
    pwd?: boolean
    soloParent?: boolean
    fourPs?: boolean
  }
  matchedResidentId?: string
  verification: {
    ocr: CheckResult
    masterListMatch: CheckResult
    faceMatch: CheckResult
    liveness: CheckResult
  }
  status: 'auto_approved' | 'manual_review' | 'approved' | 'rejected'
  privacyNoticeVersion: string
  decidedBy?: string
  decidedAt?: string
  decisionNote?: string
  /** Online self-registration evidence (prototype: kept in this browser only). */
  evidence?: RegistrationEvidence
  /** Account created with the registration; active once approved. */
  accountUserId?: string
  /** Secretary asked the applicant to come to the Barangay Hall. */
  inPerson?: InPersonVerification
  /** Everything that happened to the registration after it was submitted (who, when, what). */
  history?: { at: string; by: string; action: string; note?: string }[]
  /**
   * A problem reported on an already approved registration. The approval is never
   * changed silently: the Secretary reports, the Punong Barangay decides (no change,
   * suspend the account, or reinstate it), each with a reason, and every step is logged.
   */
  report?: {
    status: 'open' | 'no_change' | 'suspended' | 'reinstated'
    reason: string
    reportedBy: string
    reportedAt: string
    decision?: string
    decidedBy?: string
    decidedAt?: string
  }
}

export interface InPersonVerification {
  reason: string
  bring: string
  date?: string
  time?: string
  notes?: string
  requestedBy: string
  requestedAt: string
  /** Email ids (see emailService) sent about this request. */
  emailIds: string[]
  completedAt?: string
  completedBy?: string
  /** Documents the Secretary inspected at the Hall. */
  inspected?: string
  outcomeNotes?: string
}

export type CheckResult = 'passed' | 'failed' | 'inconclusive'

export interface RegistrationEvidence {
  idType: string
  idNumber: string
  /** Expiry date printed on the ID (ISO date); absent for IDs without one. */
  idExpiry?: string
  /** Downscaled JPEG data URLs. */
  idImage: string
  selfieImage: string
  /** Face similarity 0–100 (higher = more alike); undefined when no face was found. */
  faceSimilarity?: number
  /** Which record source matched: resident records or the OSCA masterlist. */
  recordSource?: 'resident_records' | 'osca_masterlist'
  /** What the ID text reader found. */
  ocrFound: { firstName: boolean; lastName: boolean; idNumber: boolean; birthDate?: boolean; expiry?: boolean }
  /** Plain-language reasons the registration needs manual review. */
  reasons: string[]
}

export interface ResidentChangeRequest {
  id: string
  /** Record to correct (the requester or a member of their household). */
  residentId: string
  /** Resident who asked, when it is not the record's owner. */
  requestedByResidentId?: string
  /** Supporting document for corrections that need proof. */
  proof?: { fileName?: string; url?: string; fileId?: string; bringOnsite?: boolean }
  /** On whose behalf: own record, a minor dependent, an authorized representative, or a household update. */
  basis?: 'self' | 'dependent' | 'representative' | 'household'
  /** Guardianship proof or representative authorization; verified by staff. */
  authorization?: { kind?: string; fileName?: string; url?: string; fileId?: string; bringOnsite?: boolean }
  submittedAt: string
  /** Automated check results at submission. */
  checks?: { name: string; result: 'passed' | 'failed' | 'needs_review' | 'not_applicable'; note?: string }[]
  /** auto = applied by the system; verification = a document must be checked; decision = Secretary decides; chairman = escalated. */
  route?: 'auto' | 'verification' | 'decision' | 'chairman'
  field: string
  originalValue: string
  requestedValue: string
  reason: string
  status: ReviewStatus
  decidedBy?: string
  decidedAt?: string
  decisionNote?: string
}
