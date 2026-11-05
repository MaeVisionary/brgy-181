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
  /** Barangay resident number (format pending confirmation). */
  residentNo: string
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
  /** Display name, e.g. "Dizon family". */
  name: string
  headResidentId: string
  memberIds: string[]
}

/** A household is everyone living at one address; it can hold more than one family. */
export interface Household {
  id: string
  householdNo: string
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
  }
  matchedResidentId?: string
  verification: {
    ocr: 'passed' | 'failed' | 'inconclusive'
    masterListMatch: 'passed' | 'failed' | 'inconclusive'
    faceMatch: 'passed' | 'failed' | 'inconclusive'
    liveness: 'passed' | 'failed' | 'inconclusive'
  }
  status: 'auto_approved' | 'manual_review' | 'approved' | 'rejected'
  privacyNoticeVersion: string
  decidedBy?: string
  decidedAt?: string
  decisionNote?: string
}

export interface ResidentChangeRequest {
  id: string
  residentId: string
  submittedAt: string
  field: string
  originalValue: string
  requestedValue: string
  reason: string
  status: ReviewStatus
  decidedBy?: string
  decidedAt?: string
  decisionNote?: string
}
