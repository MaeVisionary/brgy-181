/**
 * Barangay 181 configuration: single source for names, officials and service
 * settings used across the app. Sources:
 *  - Study: "Barangay 181 Information Management System" (SE Group 4, Oct 2026), §1.1 Organizational Structure
 *  - Official document templates supplied by the barangay (names as printed)
 *  - Functional requirements FR1–FR24
 * Where the sources are silent, standard Philippine barangay practice is used.
 */

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

/**
 * Barangay Hall contact details shown to residents.
 * PLACEHOLDER VALUES: replace them with the details the barangay confirms.
 */
export const BARANGAY_CONTACT = {
  hall: 'Barangay 181 Hall',
  address: 'Asa St., Gagalangin, Tondo, Manila',
  phone: '(02) 8254-0181',
  mobile: '0917 181 0181',
  email: 'barangay181@example.com',
  officeHours: 'Monday to Friday, 8:00 AM to 5:00 PM',
  saturdayHours: 'Saturday, 8:00 AM to 12:00 NN (document pickup only)',
} as const

export type OfficialPosition = 'Barangay Chairman' | 'Barangay Secretary' | 'Barangay Treasurer' | 'Barangay Kagawad' | 'Lupon Member'

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
 * Barangay officials. Study §1.1 lists the Chairman, Secretary, seven Kagawad;
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
  { id: 'off-treas', name: 'Mary Grace T. Dela Cruz', nameOnDocuments: 'MARY GRACE T. DELA CRUZ', position: 'Barangay Treasurer', source: 'Official document templates' },
  { id: 'off-lupon-1', name: 'Soledad De Dios', position: 'Lupon Member', source: 'Notice of Hearing example' },
  { id: 'off-lupon-2', name: 'Norbenita Mendoza', position: 'Lupon Member', source: 'Notice of Hearing example' },
]

export const officialByPosition = (p: OfficialPosition) => OFFICIALS.filter((o) => o.position === p)
export const CHAIRMAN = OFFICIALS[0]
export const SECRETARY = OFFICIALS[1]

/** FR22: borrowing period and grace period. */
export const BORROWING = {
  periodDays: 15,
  graceDays: 3,
  note: 'The due date is counted from the day the equipment is released.',
  /** Study §1.4: chairs, tables, ladders, nebulizers. */
  documentedEquipment: ['Chairs', 'Tables', 'Ladders', 'Nebulizers'],
} as const

/**
 * Katarungang Pambarangay periods. Chairman mediation: study §2.1 (15 days).
 * Lupon (Pangkat) conciliation: RA 7160 Sec. 410(e), 15 days, extendable by another 15.
 */
export const KP = {
  chairmanMediationDays: 15,
  luponMediationDays: 15,
  luponExtensionDays: 15,
  /** Reminders to the parties before each hearing (FR20). */
  reminderDaysBefore: 1,
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
