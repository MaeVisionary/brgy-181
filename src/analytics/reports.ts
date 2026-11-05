import {
  ageCounts,
  civilCounts,
  countBy,
  needsVerification,
  oscaByYear,
  statusCounts,
  statusGrouping,
  streetCounts,
  summarize,
  type Row,
} from './compute'
import { ISSUE_LABELS } from './seniorTypes'

/**
 * INTERNAL analytics reports built from the imported senior citizen (OSCA)
 * masterlist. Official DILG / OSCA / MADAO / Barangay Bureau formats will be
 * added only when the barangay supplies them.
 */

export interface ReportDef {
  id: string
  name: string
  description: string
  /** Contains names or other identifiable details: needs residents.view. */
  pii: boolean
  build: (rows: Row[], opts: { showPii: boolean }) => { summary: [string, string | number][]; columns: string[]; rows: (string | number)[][] }
}

const fmtDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '')
const p = (n: number) => `${n.toFixed(1)}%`

export const SENIOR_REPORTS: ReportDef[] = [
  {
    id: 'masterlist',
    name: 'Senior Citizen Masterlist',
    description: 'Every record with age as of the reporting date. Contact numbers are not included.',
    pii: true,
    build: (rows) => ({
      summary: [['Records', rows.length]],
      columns: ['Sheet row', 'Name', 'Birthdate', 'Age', 'Address', 'Gender', 'Civil status', 'OSCA ID no.', 'OSCA date issued', 'Status', 'Voter'],
      rows: rows.map((r) => [r.sheetRow, r.fullName, fmtDate(r.birthDate), r.age ?? '', r.addressRaw, r.gender ?? '', r.civilStatusRaw, r.oscaId, r.oscaDate ? fmtDate(r.oscaDate) : r.oscaDateRaw, r.statusRaw, r.voterRaw]),
    }),
  },
  {
    id: 'summary',
    name: 'Senior Citizen Population Summary',
    description: 'Totals by gender, status, OSCA ID and voter information.',
    pii: false,
    build: (rows) => {
      const s = summarize(rows)
      return {
        summary: [
          ['Total records', s.total],
          ['Male', s.male],
          ['Female', s.female],
          ['Gender missing', s.genderMissing],
          ['Active', s.active],
          ['Inactive', s.inactive],
          ['Bedridden', s.bedridden],
          ['Other / missing status', s.statusOther + s.statusMissing],
          ['With OSCA ID', s.withOsca],
          ['Without OSCA ID', s.withoutOsca],
          ['Records requiring verification', s.needsVerification],
          ['Average age (valid birthdates)', s.averageAge === null ? '–' : s.averageAge.toFixed(1)],
          ['Oldest recorded age', s.oldestAge ?? '–'],
          ['Voter: YES (within these records)', s.voterYes],
          ['Voter: NO', s.voterNo],
          ['Voter: missing', s.voterMissing],
        ],
        columns: [],
        rows: [],
      }
    },
  },
  {
    id: 'age',
    name: 'Senior Citizen Age Distribution Report',
    description: 'Age groups computed from birthdates as of the reporting date.',
    pii: false,
    build: (rows) => {
      const c = ageCounts(rows)
      const s = summarize(rows)
      return {
        summary: [['Records with a valid birthdate', s.validAges], ['Records without a valid birthdate', rows.length - s.validAges], ['Average age', s.averageAge?.toFixed(1) ?? '–'], ['Oldest recorded age', s.oldestAge ?? '–']],
        columns: ['Age group', 'Count', '% of valid records'],
        rows: c.map((x) => [x.key, x.count, p(x.pct)]),
      }
    },
  },
  {
    id: 'gender',
    name: 'Senior Citizen Gender Distribution Report',
    description: 'Male and female counts; missing values shown separately.',
    pii: false,
    build: (rows) => {
      const c = countBy(rows, (r) => r.gender ?? 'Missing / unclassified', ['Male', 'Female', 'Missing / unclassified'])
      return { summary: [['Total records', rows.length]], columns: ['Gender', 'Count', '%'], rows: c.map((x) => [x.key, x.count, p(x.pct)]) }
    },
  },
  {
    id: 'address',
    name: 'Senior Citizen Address Distribution Report',
    description: 'Records per street (area), grouped by the address rules shown in Analytics.',
    pii: false,
    build: (rows) => {
      const c = streetCounts(rows)
      return { summary: [['Total records', rows.length], ['Areas', c.length]], columns: ['Area (street)', 'Count', '%'], rows: c.map((x) => [x.key, x.count, p(x.pct)]) }
    },
  },
  {
    id: 'osca',
    name: 'OSCA Registration Report',
    description: 'Records with and without OSCA IDs and registrations per year issued.',
    pii: false,
    build: (rows) => {
      const s = summarize(rows)
      const missingDate = rows.filter((r) => !r.oscaDateRaw).length
      const unreadable = rows.filter((r) => r.oscaDateRaw && !r.oscaDate).length
      return {
        summary: [['With OSCA ID', s.withOsca], ['Without OSCA ID', s.withoutOsca], ['Missing date issued', missingDate], ['Date issued could not be read', unreadable]],
        columns: ['Year issued', 'Registrations', '% of readable dates'],
        rows: oscaByYear(rows).map((x) => [x.key, x.count, p(x.pct)]),
      }
    },
  },
  {
    id: 'status',
    name: 'Senior Citizen Status Report',
    description: 'Active, inactive, bedridden and other recorded statuses, with the original labels.',
    pii: false,
    build: (rows) => ({
      summary: statusCounts(rows).map((x) => [x.key, `${x.count} (${p(x.pct)})`]),
      columns: ['Original STATUS value', 'Counted as', 'Records'],
      rows: statusGrouping(rows).map((g) => [g.raw, g.group, g.count]),
    }),
  },
  {
    id: 'bedridden',
    name: 'Bedridden Senior Citizen Report',
    description: 'Records with a bedridden status, for outreach planning.',
    pii: true,
    build: (rows) => {
      const b = rows.filter((r) => r.status === 'Bedridden')
      return {
        summary: [['Bedridden records', b.length], ...countBy(b, (r) => r.street ?? 'Unparsed').map((x) => [`Area: ${x.key}`, x.count] as [string, number])],
        columns: ['Sheet row', 'Name', 'Age', 'Address', 'OSCA ID no.', 'Remarks'],
        rows: b.map((r) => [r.sheetRow, r.fullName, r.age ?? '', r.addressRaw, r.oscaId, r.remarks]),
      }
    },
  },
  {
    id: 'quality',
    name: 'Senior Citizen Data Quality Report',
    description: 'Missing, invalid and possibly duplicate information to verify. Records are never removed automatically.',
    pii: false,
    build: (rows, { showPii }) => {
      const counts = new Map<string, number>()
      for (const r of rows) for (const i of new Set(r.allIssues)) counts.set(ISSUE_LABELS[i], (counts.get(ISSUE_LABELS[i]) ?? 0) + 1)
      const flagged = rows.filter(needsVerification)
      return {
        summary: [['Records requiring verification', flagged.length], ...[...counts.entries()].sort((a, b) => b[1] - a[1])],
        columns: showPii ? ['Sheet row', 'Name', 'Issues'] : ['Issue', 'Records'],
        rows: showPii
          ? flagged.map((r) => [r.sheetRow, r.fullName, r.allIssues.map((i) => ISSUE_LABELS[i]).join('; ')])
          : [...counts.entries()].map(([k, v]) => [k, v]),
      }
    },
  },
]

export { civilCounts }
