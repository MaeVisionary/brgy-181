export type Sex = 'male' | 'female'

export type CivilStatus = 'single' | 'married' | 'widowed' | 'separated' | 'live_in'

/** Sector flags used in analytics and ayuda planning (FR13–FR15). */
export interface ResidentSectors {
  seniorCitizen: boolean
  pwd: boolean
  soloParent: boolean
  fourPs: boolean
  /** Other program beneficiaries; exact programs to be confirmed. */
  programBeneficiary: boolean
}

export type RegistrationStatus =
  | 'not_registered'
  | 'pending_verification'
  | 'manual_review'
  | 'verified'
  | 'rejected'

export interface Resident {
  id: string
  /** Official barangay resident number (format to be confirmed). */
  residentNo: string
  firstName: string
  middleName?: string
  lastName: string
  suffix?: string
  sex: Sex
  birthDate: string
  civilStatus: CivilStatus
  /** Area grouping. Purok names follow the Figma reference; confirm with barangay. */
  purok: string
  street: string
  houseNo: string
  householdId: string
  contactNo?: string
  sectors: ResidentSectors
  registrationStatus: RegistrationStatus
  createdAt: string
  updatedAt: string
}

export interface Household {
  id: string
  householdNo: string
  purok: string
  address: string
  headResidentId: string
  memberIds: string[]
}

export type ReviewStatus = 'pending' | 'approved' | 'rejected'

export interface ResidentRegistration {
  id: string
  referenceNo: string
  submittedAt: string
  /** Name and details as typed by the applicant. */
  applicant: {
    firstName: string
    lastName: string
    birthDate: string
    address: string
  }
  /** Matched master-list record, if one was found. */
  matchedResidentId?: string
  verification: {
    ocr: 'passed' | 'failed' | 'inconclusive'
    masterListMatch: 'passed' | 'failed' | 'inconclusive'
    faceMatch: 'passed' | 'failed' | 'inconclusive'
    liveness: 'passed' | 'failed' | 'inconclusive'
  }
  status: 'auto_approved' | 'manual_review' | 'approved' | 'rejected'
  privacyNoticeVersion: string
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
}
