import type { ImportMessage, IssueCode, Normalization, SeniorDataset, SeniorRecord, StatusGroup, VoterGroup } from './seniorTypes'

/**
 * Parses the OSCA senior citizen masterlist (Excel → rows) into traceable records.
 * Rules:
 *  - a row counts as a record only if it has a last or first name;
 *  - originals are kept; every normalization is logged;
 *  - nothing is guessed: unreadable values become null and are flagged.
 */

type Cell = string | number | boolean | Date | null | undefined

const COLUMNS = {
  no: ['NO'],
  brgy: ['BRGY'],
  zone: ['ZONE'],
  lastName: ['LAST NAME'],
  firstName: ['FIRST NAME'],
  middleName: ['MIDDLE NAME'],
  suffix: ['SUFFIX'],
  birthMonth: ['BIRTH MONTH'],
  birthDay: ['BIRTH DAY'],
  birthYear: ['BIRTH YEAR'],
  birthDate: ['BIRTHDATE', 'BIRTH DATE'],
  age: ['AGE'],
  address: ['FULL ADDRESS', 'ADDRESS'],
  contact: ['MOBILE / CONTACT NO.', 'MOBILE/CONTACT NO.', 'CONTACT NO.', 'MOBILE NO.'],
  oscaId: ['OSCA ID NO.', 'OSCA ID NO', 'OSCA ID'],
  oscaDate: ['OSCA DATE ISSUED', 'DATE ISSUED'],
  gender: ['GENDER', 'SEX'],
  civilStatus: ['CIVIL STATUS'],
  voter: ['VOTER'],
  status: ['STATUS'],
  remarks: ['REMARKS'],
} as const

type ColKey = keyof typeof COLUMNS
const REQUIRED: ColKey[] = ['lastName', 'firstName', 'birthDate', 'address', 'gender']

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

const clean = (v: Cell): string => {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v)
  return String(v).replace(/\s+/g, ' ').trim()
}

const normHeader = (h: Cell) => clean(h).toUpperCase().replace(/\s+/g, ' ')

/** Excel serial date → UTC date (1900 date system). */
function fromSerial(n: number): Date | null {
  if (!Number.isFinite(n) || n < 1 || n > 80000) return null
  return new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000)
}

function validDate(y: number, m: number, d: number): Date | null {
  if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31 || y < 1890 || y > 2100) return null
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCMonth() === m - 1 ? dt : null
}

/** Reads a date from a cell. Text with the letter O typed for zero is fixed and logged. */
function parseDate(v: Cell, log: (to: string, rule: string) => void): Date | null {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()))
  if (typeof v === 'number') return fromSerial(v)
  let s = clean(v).toUpperCase()
  if (!s) return null
  if (/^[\dO/.\-\s]+$/.test(s) && s.includes('O')) {
    const fixed = s.replace(/O/g, '0')
    log(fixed, 'Letter O read as zero in a date')
    s = fixed
  }
  if (/^\d+(\.0+)?$/.test(s)) return fromSerial(Number(s))
  let m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/)
  if (m) return validDate(+m[3], +m[1], +m[2])
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return validDate(+m[1], +m[2], +m[3])
  m = s.match(/^([A-Z]{3,9})\.?\s*(\d{1,2}),?\s*(\d{4})$/)
  if (m) {
    const mi = MONTHS.indexOf(m[1].slice(0, 3))
    if (mi >= 0) return validDate(+m[3], mi + 1, +m[2])
  }
  return null
}

/**
 * Street grouping. Spelling variants are merged only through this visible list,
 * which the barangay should confirm.
 */
export const STREET_ALIASES: Record<string, string> = {
  'J.LUNA': 'JUAN LUNA',
  'J. LUNA': 'JUAN LUNA',
  'GEN.LUBAN': 'GEN.LUKBAN',
  'GEN. LUKBAN': 'GEN.LUKBAN',
  'GEN LUKBAN': 'GEN.LUKBAN',
}

function streetOf(address: string): string | null {
  // Masterlist format: "<house no.> -<STREET> , TONDO II , MANILA"
  const m = address.match(/-\s*([A-Z][A-Z .'Ñ]*?)\s*(,|$)/)
  if (!m) return null
  let st = m[1].replace(/\s+(ST|STREET)\.?$/, '').replace(/\.\s+/g, '.').trim()
  st = STREET_ALIASES[st] ?? st
  return st || null
}

function normStatus(raw: string): StatusGroup {
  const s = raw.toUpperCase().replace(/[\s\-_]/g, '')
  if (!s) return 'Missing'
  if (s === 'ACTIVE') return 'Active'
  if (s === 'INACTIVE') return 'Inactive'
  if (s === 'BEDRIDDEN') return 'Bedridden'
  return 'Other'
}

function normVoter(raw: string): VoterGroup {
  const s = raw.toUpperCase()
  if (!s) return 'Missing'
  if (s === 'YES' || s === 'Y') return 'Yes'
  if (s === 'NO' || s === 'N') return 'No'
  return 'Missing'
}

/** Detects the date written in names like "...FOR THE MONTH OF JULY 30 2025". */
export function dateFromFileName(name: string): Date | null {
  const m = name.toUpperCase().match(/(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+(\d{1,2})\s*,?\s*(\d{4})/)
  if (!m) return null
  return validDate(+m[3], MONTHS.indexOf(m[1].slice(0, 3)) + 1, +m[2])
}

export function parseMasterlist(rows: Cell[][], fileName: string, sheetName: string): SeniorDataset {
  const messages: ImportMessage[] = []
  const normalizations: Normalization[] = []

  // Header row: the first row that contains LAST NAME and FIRST NAME.
  const headerIdx = rows.findIndex((r) => {
    const hs = r.map(normHeader)
    return hs.includes('LAST NAME') && hs.includes('FIRST NAME')
  })
  if (headerIdx < 0) {
    return {
      fileName,
      sheetName,
      loadedAt: new Date().toISOString(),
      sheetRows: rows.length,
      skippedRows: rows.length,
      records: [],
      normalizations,
      messages: [{ level: 'error', text: 'No header row with "LAST NAME" and "FIRST NAME" was found. Is this the senior citizen masterlist?' }],
      fileDate: dateFromFileName(fileName),
    }
  }
  const header = rows[headerIdx].map(normHeader)
  const col = {} as Record<ColKey, number>
  for (const key of Object.keys(COLUMNS) as ColKey[]) {
    col[key] = header.findIndex((h) => (COLUMNS[key] as readonly string[]).includes(h))
  }
  const missingCols = (Object.keys(COLUMNS) as ColKey[]).filter((k) => col[k] < 0)
  for (const k of missingCols) {
    messages.push({
      level: REQUIRED.includes(k) ? 'error' : 'warning',
      text: `Column "${COLUMNS[k][0]}" was not found${REQUIRED.includes(k) ? '. Related figures will be missing.' : '.'}`,
    })
  }

  const get = (r: Cell[], k: ColKey): Cell => (col[k] >= 0 ? r[col[k]] : null)
  const records: SeniorRecord[] = []
  let skipped = 0
  const body = rows.slice(headerIdx + 1)

  body.forEach((r, i) => {
    const sheetRow = headerIdx + 2 + i
    const lastName = clean(get(r, 'lastName'))
    const firstName = clean(get(r, 'firstName'))
    if (!lastName && !firstName) {
      skipped++
      return
    }
    const logFor = (field: string, from: string) => (to: string, rule: string) => normalizations.push({ field: `Row ${sheetRow} · ${field}`, from, to, rule })
    const issues: IssueCode[] = []

    // Birthdate: BIRTHDATE column first, then the separate month/day/year columns.
    const birthRaw = clean(get(r, 'birthDate'))
    let birthDate = parseDate(get(r, 'birthDate'), logFor('BIRTHDATE', birthRaw))
    if (!birthDate) {
      const y = Number(clean(get(r, 'birthYear')))
      const mo = Number(clean(get(r, 'birthMonth')))
      const d = Number(clean(get(r, 'birthDay')))
      const fromParts = validDate(y, mo, d)
      if (fromParts) {
        birthDate = fromParts
        normalizations.push({ field: `Row ${sheetRow} · BIRTHDATE`, from: birthRaw || '(blank)', to: fromParts.toISOString().slice(0, 10), rule: 'Built from BIRTH MONTH / DAY / YEAR' })
      }
    }
    if (!birthDate) issues.push(birthRaw ? 'invalid_birthdate' : 'missing_birthdate')

    const addressRaw = clean(get(r, 'address'))
    const address = addressRaw.toUpperCase().replace(/\s*,\s*/g, ', ').replace(/,\s*$/, '').replace(/\s+/g, ' ').trim()
    if (!address) issues.push('missing_address')

    const contactRaw = clean(get(r, 'contact'))
    let contact = contactRaw.toUpperCase().replace(/O/g, '0').replace(/[^\d]/g, '')
    if (/^9\d{9}$/.test(contact)) contact = `0${contact}`
    if (contact !== contactRaw && contactRaw) normalizations.push({ field: `Row ${sheetRow} · CONTACT NO.`, from: contactRaw, to: contact, rule: 'Letter O read as zero / leading 0 restored' })

    const oscaIdRaw = clean(get(r, 'oscaId'))
    let oscaId = oscaIdRaw.toUpperCase().replace(/\.0+$/, '')
    if (/^[\dO]+$/.test(oscaId) && oscaId.includes('O')) oscaId = oscaId.replace(/O/g, '0')
    if (oscaId !== oscaIdRaw && oscaIdRaw) normalizations.push({ field: `Row ${sheetRow} · OSCA ID NO.`, from: oscaIdRaw, to: oscaId, rule: 'Letter O read as zero / decimal removed' })
    if (!oscaId) issues.push('missing_osca_id')

    const oscaDateCell = get(r, 'oscaDate')
    const oscaDateRaw = clean(oscaDateCell)
    const oscaDate = parseDate(oscaDateCell, logFor('OSCA DATE ISSUED', oscaDateRaw))
    if (!oscaDateRaw) issues.push('missing_osca_date')
    else if (!oscaDate) issues.push('invalid_osca_date')

    const genderRaw = clean(get(r, 'gender'))
    const g = genderRaw.toUpperCase()
    const gender = g === 'MALE' || g === 'M' ? 'Male' : g === 'FEMALE' || g === 'F' ? 'Female' : null
    if (!gender) issues.push('missing_gender')

    const civilStatusRaw = clean(get(r, 'civilStatus'))
    const civilStatus = civilStatusRaw ? civilStatusRaw.toUpperCase() : null
    if (!civilStatus) issues.push('missing_civil_status')

    const statusRaw = clean(get(r, 'status'))
    const status = normStatus(statusRaw)
    if (status === 'Missing') issues.push('missing_status')
    if (status === 'Other') issues.push('unrecognized_status')
    if (status !== 'Missing' && statusRaw.toUpperCase() !== status.toUpperCase()) {
      normalizations.push({ field: `Row ${sheetRow} · STATUS`, from: statusRaw, to: status, rule: 'Spelling/spacing variant grouped' })
    }

    const voterRaw = clean(get(r, 'voter'))
    const middleName = clean(get(r, 'middleName'))
    const suffix = clean(get(r, 'suffix'))

    records.push({
      sheetRow,
      no: clean(get(r, 'no')),
      lastName,
      firstName,
      middleName,
      suffix,
      fullName: [lastName + ',', firstName, middleName, suffix].filter(Boolean).join(' '),
      birthDate,
      birthDateRaw: birthRaw,
      ageColumnRaw: clean(get(r, 'age')),
      addressRaw,
      address,
      street: address ? streetOf(address) : null,
      contactRaw,
      contact,
      oscaIdRaw,
      oscaId,
      oscaDateRaw,
      oscaDate,
      genderRaw,
      gender,
      civilStatusRaw,
      civilStatus,
      voterRaw,
      voter: normVoter(voterRaw),
      statusRaw,
      status,
      remarks: clean(get(r, 'remarks')),
      issues,
    })
  })

  // Duplicate OSCA IDs and possible duplicate people: flagged, never removed.
  const byOsca = new Map<string, SeniorRecord[]>()
  const byPerson = new Map<string, SeniorRecord[]>()
  for (const rec of records) {
    if (rec.oscaId) byOsca.set(rec.oscaId, [...(byOsca.get(rec.oscaId) ?? []), rec])
    const key = [rec.lastName, rec.firstName, rec.birthDate ? rec.birthDate.toISOString().slice(0, 10) : rec.middleName].join('|').toUpperCase().replace(/\s+/g, ' ')
    byPerson.set(key, [...(byPerson.get(key) ?? []), rec])
  }
  for (const group of byOsca.values()) if (group.length > 1) group.forEach((r) => r.issues.push('duplicate_osca_id'))
  for (const group of byPerson.values()) if (group.length > 1) group.forEach((r) => r.issues.push('possible_duplicate'))

  messages.unshift({
    level: 'info',
    text: `${records.length} records read from sheet "${sheetName}". ${skipped} rows without a name were skipped (blank or number-only rows).`,
  })
  if (normalizations.length) messages.push({ level: 'info', text: `${normalizations.length} values were normalized for analysis. Originals are kept and listed under Data quality.` })

  return {
    fileName,
    sheetName,
    loadedAt: new Date().toISOString(),
    sheetRows: body.length,
    skippedRows: skipped,
    records,
    normalizations,
    messages,
    fileDate: dateFromFileName(fileName),
  }
}
