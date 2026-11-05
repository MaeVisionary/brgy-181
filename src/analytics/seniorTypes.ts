/**
 * Senior citizen (OSCA) masterlist records as parsed from the barangay's Excel file.
 * Every normalized value keeps its original next to it so changes stay traceable.
 * This is NOT the complete resident database.
 */

export type Gender = 'Male' | 'Female'
export type StatusGroup = 'Active' | 'Inactive' | 'Bedridden' | 'Other' | 'Missing'
export type VoterGroup = 'Yes' | 'No' | 'Missing'

export interface Normalization {
  field: string
  from: string
  to: string
  rule: string
}

export type IssueCode =
  | 'missing_birthdate'
  | 'invalid_birthdate'
  | 'below_60'
  | 'missing_address'
  | 'missing_gender'
  | 'missing_civil_status'
  | 'missing_osca_id'
  | 'missing_osca_date'
  | 'invalid_osca_date'
  | 'duplicate_osca_id'
  | 'possible_duplicate'
  | 'unrecognized_status'
  | 'missing_status'
  | 'age_column_mismatch'

export const ISSUE_LABELS: Record<IssueCode, string> = {
  missing_birthdate: 'Missing birthdate',
  invalid_birthdate: 'Invalid birthdate',
  below_60: 'Below 60 on the reporting date',
  missing_address: 'Missing address',
  missing_gender: 'Missing gender',
  missing_civil_status: 'Missing civil status',
  missing_osca_id: 'Missing OSCA ID no.',
  missing_osca_date: 'Missing OSCA date issued',
  invalid_osca_date: 'OSCA date could not be read',
  duplicate_osca_id: 'Duplicate OSCA ID no.',
  possible_duplicate: 'Possible duplicate record',
  unrecognized_status: 'Unrecognized status label',
  missing_status: 'Missing status',
  age_column_mismatch: 'AGE column differs from birthdate',
}

export interface SeniorRecord {
  /** Row number in the spreadsheet (1-based, header = 1). */
  sheetRow: number
  no: string
  lastName: string
  firstName: string
  middleName: string
  suffix: string
  fullName: string
  birthDate: Date | null
  birthDateRaw: string
  /** AGE column exactly as stored (not trusted). */
  ageColumnRaw: string
  addressRaw: string
  /** Whitespace/case-normalized full address. */
  address: string
  /** Street derived from the address for area grouping (see address rules). */
  street: string | null
  contactRaw: string
  contact: string
  oscaIdRaw: string
  oscaId: string
  oscaDateRaw: string
  oscaDate: Date | null
  genderRaw: string
  gender: Gender | null
  civilStatusRaw: string
  civilStatus: string | null
  voterRaw: string
  voter: VoterGroup
  statusRaw: string
  status: StatusGroup
  remarks: string
  /** Issues that do not depend on the reporting date. */
  issues: IssueCode[]
}

export interface ImportMessage {
  level: 'info' | 'warning' | 'error'
  text: string
}

export interface SeniorDataset {
  fileName: string
  loadedAt: string
  sheetName: string
  /** Rows in the sheet below the header, including blank and number-only rows. */
  sheetRows: number
  /** Rows skipped because they had no name (blank or only a row number). */
  skippedRows: number
  records: SeniorRecord[]
  normalizations: Normalization[]
  messages: ImportMessage[]
  /** Date written in the file name, if any (e.g. "JULY 30 2025"). */
  fileDate: Date | null
}
