import type { IssueCode, SeniorDataset, SeniorRecord, StatusGroup, VoterGroup } from './seniorTypes'

/**
 * All analytics come from these functions so the dashboard, drill-down tables
 * and reports always reconcile. Ages are computed from the birthdate as of the
 * chosen reporting date; the spreadsheet's AGE column is never used for figures.
 */

export const AGE_GROUPS = ['Below 60', '60–64', '65–69', '70–74', '75–79', '80–84', '85–89', '90 and above'] as const
export type AgeGroup = (typeof AGE_GROUPS)[number] | 'Unknown'

export function ageAt(birth: Date, on: Date): number {
  let age = on.getUTCFullYear() - birth.getUTCFullYear()
  const m = on.getUTCMonth() - birth.getUTCMonth()
  if (m < 0 || (m === 0 && on.getUTCDate() < birth.getUTCDate())) age--
  return age
}

export function ageGroupOf(age: number | null): AgeGroup {
  if (age === null) return 'Unknown'
  if (age < 60) return 'Below 60'
  if (age >= 90) return '90 and above'
  const lo = Math.floor(age / 5) * 5
  return `${lo}–${lo + 4}` as AgeGroup
}

export interface Row extends SeniorRecord {
  age: number | null
  ageGroup: AgeGroup
  /** Static issues plus reporting-date issues. */
  allIssues: IssueCode[]
  hasOsca: boolean
}

export function deriveRows(ds: SeniorDataset, reportingDate: Date): Row[] {
  return ds.records.map((r) => {
    const age = r.birthDate ? ageAt(r.birthDate, reportingDate) : null
    const allIssues = [...r.issues]
    if (age !== null && age < 60) allIssues.push('below_60')
    const stored = Number(r.ageColumnRaw)
    if (r.ageColumnRaw && age !== null && (!Number.isFinite(stored) || Math.abs(stored - age) > 1)) allIssues.push('age_column_mismatch')
    return { ...r, age, ageGroup: ageGroupOf(age), allIssues, hasOsca: !!r.oscaId }
  })
}

/** Issues that make a record "require verification" (the AGE column note alone does not). */
export const needsVerification = (r: Row) => r.allIssues.some((i) => i !== 'age_column_mismatch')

// ── Filters ──────────────────────────────────────────────────────────

export interface Filters {
  ageGroup?: AgeGroup
  gender?: 'Male' | 'Female' | 'Missing'
  civilStatus?: string
  street?: string
  osca?: 'with' | 'without'
  status?: StatusGroup
  voter?: VoterGroup
  verification?: 'needs'
  issue?: IssueCode
  search?: string
}

export const FILTER_LABELS: Record<keyof Filters, string> = {
  ageGroup: 'Age group',
  gender: 'Gender',
  civilStatus: 'Civil status',
  street: 'Address area',
  osca: 'OSCA ID',
  status: 'Status',
  voter: 'Voter',
  verification: 'Verification',
  issue: 'Data issue',
  search: 'Search',
}

export function applyFilters(rows: Row[], f: Filters, opts: { searchNames: boolean }): Row[] {
  const q = f.search?.trim().toUpperCase()
  return rows.filter(
    (r) =>
      (!f.ageGroup || r.ageGroup === f.ageGroup) &&
      (!f.gender || (f.gender === 'Missing' ? !r.gender : r.gender === f.gender)) &&
      (!f.civilStatus || (f.civilStatus === 'Missing' ? !r.civilStatus : r.civilStatus === f.civilStatus)) &&
      (!f.street || (f.street === 'Unparsed' ? !r.street : r.street === f.street)) &&
      (!f.osca || (f.osca === 'with' ? r.hasOsca : !r.hasOsca)) &&
      (!f.status || r.status === f.status) &&
      (!f.voter || r.voter === f.voter) &&
      (!f.verification || needsVerification(r)) &&
      (!f.issue || r.allIssues.includes(f.issue)) &&
      (!q || r.address.includes(q) || (opts.searchNames && `${r.lastName} ${r.firstName} ${r.middleName}`.toUpperCase().includes(q))),
  )
}

// ── Aggregations ─────────────────────────────────────────────────────

export interface Count {
  key: string
  count: number
  pct: number
}

export function countBy(rows: Row[], keyOf: (r: Row) => string, order?: readonly string[]): Count[] {
  const m = new Map<string, number>()
  for (const r of rows) m.set(keyOf(r), (m.get(keyOf(r)) ?? 0) + 1)
  const total = rows.length || 1
  let out = [...m.entries()].map(([key, count]) => ({ key, count, pct: (count / total) * 100 }))
  if (order) {
    out = order.map((key) => ({ key, count: m.get(key) ?? 0, pct: ((m.get(key) ?? 0) / total) * 100 })).concat(out.filter((c) => !order.includes(c.key)))
  } else out.sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
  return out
}

export interface Summary {
  total: number
  male: number
  female: number
  genderMissing: number
  active: number
  inactive: number
  bedridden: number
  statusOther: number
  statusMissing: number
  withOsca: number
  withoutOsca: number
  needsVerification: number
  validAges: number
  averageAge: number | null
  oldestAge: number | null
  voterYes: number
  voterNo: number
  voterMissing: number
}

export function summarize(rows: Row[]): Summary {
  const ages = rows.map((r) => r.age).filter((a): a is number => a !== null)
  const n = (p: (r: Row) => boolean) => rows.filter(p).length
  return {
    total: rows.length,
    male: n((r) => r.gender === 'Male'),
    female: n((r) => r.gender === 'Female'),
    genderMissing: n((r) => !r.gender),
    active: n((r) => r.status === 'Active'),
    inactive: n((r) => r.status === 'Inactive'),
    bedridden: n((r) => r.status === 'Bedridden'),
    statusOther: n((r) => r.status === 'Other'),
    statusMissing: n((r) => r.status === 'Missing'),
    withOsca: n((r) => r.hasOsca),
    withoutOsca: n((r) => !r.hasOsca),
    needsVerification: n(needsVerification),
    validAges: ages.length,
    averageAge: ages.length ? ages.reduce((a, b) => a + b, 0) / ages.length : null,
    oldestAge: ages.length ? Math.max(...ages) : null,
    voterYes: n((r) => r.voter === 'Yes'),
    voterNo: n((r) => r.voter === 'No'),
    voterMissing: n((r) => r.voter === 'Missing'),
  }
}

export const ageCounts = (rows: Row[]) => {
  const valid = rows.filter((r) => r.age !== null)
  return countBy(valid, (r) => r.ageGroup, AGE_GROUPS).filter((c) => c.key !== 'Below 60' || c.count > 0)
}

export const civilCounts = (rows: Row[]) => countBy(rows, (r) => r.civilStatus ?? 'Missing')
export const statusCounts = (rows: Row[]) => countBy(rows, (r) => r.status, ['Active', 'Inactive', 'Bedridden', 'Other', 'Missing'])
export const voterCounts = (rows: Row[]) => countBy(rows, (r) => r.voter, ['Yes', 'No', 'Missing'])
export const streetCounts = (rows: Row[]) => countBy(rows, (r) => r.street ?? 'Unparsed')
export const addressCounts = (rows: Row[]) => countBy(rows.filter((r) => r.address), (r) => r.address)

/** OSCA registrations by year issued (only dates that could be read). */
export function oscaByYear(rows: Row[]): Count[] {
  const dated = rows.filter((r) => r.oscaDate)
  return countBy(dated, (r) => String(r.oscaDate!.getUTCFullYear())).sort((a, b) => a.key.localeCompare(b.key))
}

/** Original STATUS spellings and the group each was counted under. */
export function statusGrouping(rows: Row[]): { raw: string; group: StatusGroup; count: number }[] {
  const m = new Map<string, { raw: string; group: StatusGroup; count: number }>()
  for (const r of rows) {
    const raw = r.statusRaw || '(blank)'
    const cur = m.get(raw) ?? { raw, group: r.status, count: 0 }
    cur.count++
    m.set(raw, cur)
  }
  return [...m.values()].sort((a, b) => b.count - a.count)
}

export function issueCounts(rows: Row[]): { code: IssueCode; count: number }[] {
  const m = new Map<IssueCode, number>()
  for (const r of rows) for (const i of new Set(r.allIssues)) m.set(i, (m.get(i) ?? 0) + 1)
  return [...m.entries()].map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count)
}

/** Per-area figures for planning: concentration, bedridden, records needing updates, no OSCA ID. */
export function areaInsights(rows: Row[]) {
  const areas = new Map<string, Row[]>()
  for (const r of rows) {
    const k = r.street ?? 'Unparsed'
    areas.set(k, [...(areas.get(k) ?? []), r])
  }
  return [...areas.entries()]
    .map(([area, rs]) => ({
      area,
      seniors: rs.length,
      bedridden: rs.filter((r) => r.status === 'Bedridden').length,
      needsUpdate: rs.filter(needsVerification).length,
      noOsca: rs.filter((r) => !r.hasOsca).length,
    }))
    .sort((a, b) => b.seniors - a.seniors)
}

export const pct = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(1)}%` : '–')
