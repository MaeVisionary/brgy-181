/**
 * Builds the DE-IDENTIFIED senior citizen snapshot that the app loads
 * automatically (public/data/senior-snapshot.json).
 *
 *   node scripts/make-masterlist-snapshot.ts "<path to masterlist .xlsx>"
 *
 * The site and this repository are public, so the snapshot keeps ONLY what the
 * analytics need: birth month and year, gender, civil status, street, status,
 * voter, whether an OSCA ID exists (and the year it was issued) and the data
 * quality flags. Names, house numbers, OSCA ID numbers, contact numbers and
 * remarks never leave the Excel file. Name-level lists still need the full file.
 */
import { readSheet } from 'read-excel-file/node'
import { writeFileSync, mkdirSync } from 'node:fs'
import { basename } from 'node:path'
import { parseMasterlist } from '../src/analytics/parseMasterlist.ts'

const file = process.argv[2]
if (!file) throw new Error('Pass the masterlist .xlsx path.')

const rows = (await readSheet(file)) as (string | number | boolean | Date | null)[][]
const ds = parseMasterlist(rows, basename(file), 'Sheet 1')

const ym = (d: Date | null) => (d ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}` : null)

const snapshot = {
  version: 1,
  source: 'Senior citizen (OSCA) masterlist',
  fileDate: ds.fileDate ? ds.fileDate.toISOString().slice(0, 10) : null,
  generatedAt: new Date().toISOString().slice(0, 10),
  sheetRows: ds.sheetRows,
  skippedRows: ds.skippedRows,
  messages: ds.messages,
  normalizationCount: ds.normalizations.length,
  // One entry per person: [birth "YYYY-MM", gender, civil status, street, status label, status group, voter label, voter group, has OSCA ID, OSCA year, issue codes]
  records: ds.records.map((r) => [
    ym(r.birthDate),
    r.gender,
    r.civilStatus,
    r.street,
    r.statusRaw,
    r.status,
    r.voterRaw,
    r.voter,
    r.oscaId ? 1 : 0,
    r.oscaDate ? r.oscaDate.getUTCFullYear() : null,
    r.issues.filter((i) => i !== 'age_column_mismatch'),
  ]),
}

mkdirSync('public/data', { recursive: true })
writeFileSync('public/data/senior-snapshot.json', JSON.stringify(snapshot))
console.log(`Snapshot: ${snapshot.records.length} records (no names, addresses, IDs or contacts).`)
