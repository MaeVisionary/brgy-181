/**
 * Government-issued IDs accepted for barangay transactions, with whether the
 * card carries an expiration date. IDs without one are never treated as
 * expired; no expiry date is ever assumed or invented.
 */
export interface IdTypeRule {
  name: string
  hasExpiry: boolean
}

export const ID_TYPE_RULES: IdTypeRule[] = [
  { name: 'PhilSys National ID / ePhilID', hasExpiry: false },
  { name: "Driver's License (LTO)", hasExpiry: true },
  { name: 'Philippine Passport', hasExpiry: true },
  { name: 'UMID', hasExpiry: false },
  { name: 'SSS ID', hasExpiry: false },
  { name: 'PhilHealth ID', hasExpiry: false },
  { name: 'Postal ID', hasExpiry: true },
  { name: "Voter's ID / Voter's Certification", hasExpiry: false },
  { name: 'PRC ID', hasExpiry: true },
  { name: 'Senior Citizen ID (OSCA)', hasExpiry: false },
  { name: 'PWD ID', hasExpiry: true },
  { name: 'TIN ID', hasExpiry: false },
  { name: 'Barangay ID', hasExpiry: true },
]

export const ID_TYPES = ID_TYPE_RULES.map((t) => t.name)

/** Unknown types (older records) are treated as having no printed expiry. */
export const idHasExpiry = (type: string) => ID_TYPE_RULES.find((t) => t.name === type)?.hasExpiry ?? false

/** Days before expiry when the resident is reminded to renew. */
export const EXPIRING_SOON_DAYS = 30

/** Upload limits for ID photos. */
export const ID_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const ID_FILE_MAX_BYTES = 8 * 1024 * 1024

/** "•••• 4821": only the last four characters are ever shown. */
export function maskIdNumber(n: string) {
  const s = n.replace(/[^A-Za-z0-9]/g, '')
  return s.length <= 4 ? '••••' : `•••• ${s.slice(-4)}`
}
