/**
 * Barangay 181 configuration: single source for names, officials and service
 * settings used across the app. Sources:
 *  - Study: "Barangay 181 Information Management System" (SE Group 4, Oct 2026), §1.1 Organizational Structure
 *  - Official document templates supplied by the barangay (names as printed)
 *  - Functional requirements FR1–FR24
 * Anything not in those sources is marked PENDING_CONFIRMATION.
 */

export const PENDING_CONFIRMATION = 'Pending Barangay Confirmation'

export const BARANGAY = {
  number: '181',
  zone: '16',
  district: 'II',
  city: 'Manila',
  name: 'Barangay 181',
  fullName: 'Barangay 181, Zone 16, District II, Manila',
  locality: 'Gagalangin, Tondo, Manila',
  systemName: 'Information Management System',
  motto: 'Glorify God by serving the People.',
} as const

export type OfficialPosition = 'Barangay Chairman' | 'Barangay Secretary' | 'Barangay Treasurer' | 'Barangay Kagawad' | 'SK Chairman' | 'Lupon Member'

export interface Official {
  id: string
  /** Name as written in the study's organizational structure. */
  name: string
  /** Name as printed on the official templates, when shown there. */
  nameOnDocuments?: string
  position: OfficialPosition
  /** Account in the prototype. Officials without a documented system role have none. */
  userId?: string
  /** Where the name comes from. */
  source: 'Study §1.1' | 'Official document templates' | 'Notice of Hearing example'
}

/**
 * Barangay officials. Study §1.1 lists the Chairman, Secretary, seven Kagawad and the SK Chairman;
 * the official templates add the Barangay Treasurer; a supplied Notice of Hearing names two Lupon members.
 * Kagawad committee assignments are not documented, so none are shown.
 */
export const OFFICIALS: Official[] = [
  { id: 'off-chair', name: 'Robert Atad', nameOnDocuments: 'Hon. ROBERT M. ATAD', position: 'Barangay Chairman', userId: 'usr-chair', source: 'Study §1.1' },
  { id: 'off-sec', name: 'Ana Manila Salvador', nameOnDocuments: 'ANA MANILA A. SALVADOR', position: 'Barangay Secretary', userId: 'usr-sec', source: 'Study §1.1' },
  { id: 'off-k1', name: 'Angelito Dela Cruz', nameOnDocuments: 'ANGELITO B. DELA CRUZ', position: 'Barangay Kagawad', userId: 'usr-kag-1', source: 'Study §1.1' },
  { id: 'off-k2', name: 'Renz Alpher Cunanan', nameOnDocuments: 'RENZ ALPHER A. CUNANAN', position: 'Barangay Kagawad', userId: 'usr-kag-2', source: 'Study §1.1' },
  { id: 'off-k3', name: 'Manuel Cadiapa', nameOnDocuments: 'MANUEL G. CADIAPA', position: 'Barangay Kagawad', userId: 'usr-kag-3', source: 'Study §1.1' },
  { id: 'off-k4', name: 'Mario Antonio', nameOnDocuments: 'MARIO M. ANTONIO JR.', position: 'Barangay Kagawad', userId: 'usr-kag-4', source: 'Study §1.1' },
  { id: 'off-k5', name: 'Cecilia Espinosa', nameOnDocuments: 'CECILIA B. ESPINOSA', position: 'Barangay Kagawad', userId: 'usr-kag-5', source: 'Study §1.1' },
  { id: 'off-k6', name: 'Alver Joseph Domingo', nameOnDocuments: 'ALVER JOSEPH F. DOMINGO', position: 'Barangay Kagawad', userId: 'usr-kag-6', source: 'Study §1.1' },
  { id: 'off-k7', name: 'Rogelio Cristobal', nameOnDocuments: 'ROGELIO V. CRISTOBAL', position: 'Barangay Kagawad', userId: 'usr-kag-7', source: 'Study §1.1' },
  { id: 'off-sk', name: 'Kriscelli Ann Reyes', nameOnDocuments: 'KRISCELLIE ANN F. REYES (SK CHAIRPERSON)', position: 'SK Chairman', userId: 'usr-sk', source: 'Study §1.1' },
  { id: 'off-treas', name: 'Mary Grace T. Dela Cruz', nameOnDocuments: 'MARY GRACE T. DELA CRUZ', position: 'Barangay Treasurer', source: 'Official document templates' },
  { id: 'off-lupon-1', name: 'Soledad De Dios', position: 'Lupon Member', source: 'Notice of Hearing example' },
  { id: 'off-lupon-2', name: 'Norbenita Mendoza', position: 'Lupon Member', source: 'Notice of Hearing example' },
]

export const officialByPosition = (p: OfficialPosition) => OFFICIALS.filter((o) => o.position === p)
export const CHAIRMAN = OFFICIALS[0]
export const SECRETARY = OFFICIALS[1]

/** Open points about the officials list, shown on the Barangay Personnel page. */
export const OFFICIAL_NOTES = [
  'The Barangay Treasurer is named on the official certificate templates but not in the study, and no system role is documented for the position.',
  'Two Lupon members are named on a supplied Notice of Hearing. The complete Lupong Tagapamayapa membership is pending barangay confirmation; the Lupon is chaired by the Punong Barangay.',
  'The study spells the SK Chairman\'s name "Kriscelli Ann Reyes"; the certificate templates print "KRISCELLIE ANN F. REYES". Please confirm the correct spelling.',
  'The Property Custodian\'s name is not given in the study, so the account shows the position only. The System Administrator can set the name.',
  'Kagawad committee assignments and individual responsibilities are not documented, so none are shown.',
]

/** FR22: borrowing period and grace period. */
export const BORROWING = {
  periodDays: 15,
  graceDays: 3,
  /** Study: "subject to final confirmation by the Property Custodian and the Barangay Chairman". */
  note: 'Subject to final confirmation by the Property Custodian and the Barangay Chairman.',
  /** Study §1.4: chairs, tables, ladders, nebulizers. */
  documentedEquipment: ['Chairs', 'Tables', 'Ladders', 'Nebulizers'],
} as const

/** Katarungang Pambarangay periods (study §1.4 and §2.1). */
export const KP = {
  chairmanMediationDays: 15,
  /** The study does not state the Lupon period. */
  luponMediationDays: null as number | null,
} as const

/** Report recipients and recurring report subjects (workflows docx, study §2.1). */
export const REPORT_CATEGORIES = [
  { id: 'dilg', name: 'DILG', full: 'Department of the Interior and Local Government' },
  { id: 'osca', name: 'OSCA', full: 'Office for Senior Citizens Affairs' },
  { id: 'madao', name: 'MADAO', full: 'Manila Anti-Drug Abuse Office' },
  { id: 'bureau', name: 'Barangay Bureau', full: 'Barangay Bureau' },
] as const

export const RECURRING_REPORTS = [
  { id: 'cleanup', name: 'Clean-up activities report', schedule: 'Weekly / monthly (format pending)' },
  { id: 'senior-masterlist', name: 'Monthly senior citizen masterlist (OSCA)', schedule: 'Monthly' },
  { id: 'kp', name: 'Katarungang Pambarangay report', schedule: 'Format pending' },
  { id: 'personnel', name: 'Barangay personnel report', schedule: 'Format pending' },
] as const
