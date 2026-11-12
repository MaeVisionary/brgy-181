import type { DocumentRequest, FieldDef, FieldValue } from '@/types/document'
import type { Resident } from '@/types/resident'
import { getDocumentType } from './catalog'

const TZ = 'Asia/Manila'

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

const monthName = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', timeZone: TZ })
const dayOfMonth = (d: Date) => Number(d.toLocaleDateString('en-US', { day: 'numeric', timeZone: TZ }))
const longDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: TZ })
const dateTime = (d: Date) =>
  `${d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', timeZone: TZ })} ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ })}`

export function ageOn(birthDate: string, on = new Date()): number {
  const b = new Date(birthDate)
  let age = on.getFullYear() - b.getFullYear()
  const m = on.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && on.getDate() < b.getDate())) age--
  return age
}

export const residentFullName = (r: Resident) =>
  [r.firstName, r.middleName, r.lastName, r.suffix].filter(Boolean).join(' ')

/** Address format used on documents. Purok is internal grouping, so it is not printed. */
export const residentAddress = (r: Resident) => `${r.houseNo} ${r.street}, Gagalangin, Tondo, Manila`

/**
 * Values computed by the system, never typed: issue day/month, validity dates,
 * record timestamps, and combined values some templates print in one cell.
 * Issue-based values stay empty until the workflow stamps `issuedAt`.
 */
export function systemValues(req: DocumentRequest): Record<string, FieldValue> {
  const out: Record<string, FieldValue> = {}
  const v = req.values
  if (req.issuedAt) {
    const d = new Date(req.issuedAt)
    out.issueDay = ordinal(dayOfMonth(d))
    out.issueMonth = monthName(d)
    out.issueDate = longDate(d)
    const next = new Date(d)
    next.setFullYear(next.getFullYear() + 1)
    out.validUntil = longDate(next)
    out.recordedAt = dateTime(d)
  }
  out.reportedAt = dateTime(new Date(req.submittedAt))

  // Incident Record Form combined cells
  const join = (...parts: (FieldValue | undefined)[]) => parts.filter((p) => typeof p === 'string' && p.trim()).join(' ')
  if (v.incidentDate || v.incidentTime) out.incidentDateTime = join(v.incidentDate, v.incidentTime)
  const reporterName = join(v.reporterGivenName, v.reporterMiddleName, v.reporterLastName, v.reporterExtension)
  if (reporterName) out.reporterFullName = reporterName
  const reporterAddress = [v.reporterAddress, v.reporterBarangay && `Brgy. ${v.reporterBarangay}`, v.reporterTown]
    .filter((p) => typeof p === 'string' && p.trim())
    .join(', ')
  if (reporterAddress) out.reporterFullAddress = reporterAddress
  return out
}

export function effectiveValues(req: DocumentRequest): Record<string, FieldValue> {
  return { ...req.values, ...systemValues(req) }
}

export const isFilled = (v: FieldValue | undefined) =>
  Array.isArray(v) ? v.length > 0 : typeof v === 'boolean' ? true : typeof v === 'string' ? v.trim().length > 0 : false

/** Required, non-system fields that are still empty. */
export function missingFields(req: DocumentRequest): FieldDef[] {
  const type = getDocumentType(req.typeId)
  const values = effectiveValues(req)
  return type.fields.filter((f) => f.required && f.by !== 'system' && !isFilled(values[f.key]))
}

const CIVIL: Record<Resident['civilStatus'], string> = {
  single: 'Single',
  married: 'Married',
  widowed: 'Widowed',
  separated: 'Separated',
  live_in: 'Live-in',
}

/** Prefill a new request from the resident record. Only fields the template actually has. */
export function prefillFromResident(typeId: DocumentRequest['typeId'], r: Resident): Record<string, FieldValue> {
  const keys = new Set(getDocumentType(typeId).fields.map((f) => f.key))
  const all: Record<string, FieldValue> = {
    fullName: residentFullName(r),
    age: String(ageOn(r.birthDate)),
    address: residentAddress(r),
    birthDate: longDate(new Date(r.birthDate)),
    partner1Name: residentFullName(r),
    ownerName: residentFullName(r),
    partner1Age: String(ageOn(r.birthDate)),
    houseStreet: `${r.houseNo} ${r.street}`,
    complainantName: residentFullName(r),
    complainantAge: String(ageOn(r.birthDate)),
    complainantAddress: residentAddress(r),
    complainantContact: r.contactNo ?? '',
    complainantCivilStatus: CIVIL[r.civilStatus],
    reporterCivilStatus: CIVIL[r.civilStatus],
    reporterLastName: r.lastName,
    reporterGivenName: r.firstName,
    reporterMiddleName: r.middleName ?? '',
    reporterExtension: r.suffix ?? '',
    reporterGender: r.sex === 'male' ? 'Male' : 'Female',
    reporterBirthDate: new Date(r.birthDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
    reporterAge: String(ageOn(r.birthDate)),
    reporterAddress: `${r.houseNo} ${r.street}`,
    reporterBarangay: '181',
    reporterTown: 'Manila',
    reporterContact: r.contactNo ?? '',
    reporterCitizenship: 'Filipino',
    reporterEducation: r.education ?? '',
    reporterOccupation: r.employment ?? '',
    reporterProvince: 'Metro Manila',
    residingSince: r.residentSince ?? '',
  }
  return Object.fromEntries(Object.entries(all).filter(([k]) => keys.has(k)))
}
