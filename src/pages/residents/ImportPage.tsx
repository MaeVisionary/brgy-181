import { AlertTriangle, CheckCircle2, FileUp, XCircle } from '@/icons'
import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Field'
import { Card, Panel } from '@/components/ui/Panel'
import { parseCsv } from '@/lib/csv'
import { readSheet } from 'read-excel-file/browser'
import { audit } from '@/services/auditService'
import { dupKey, findDuplicate, importResidents, type ImportRecord } from '@/services/residentService'
import { fullName } from './common'

/** Target fields for the master list import (study §1.4 resident information). */
const TARGETS = [
  { key: 'lastName', label: 'Last name', required: true, aliases: ['LAST NAME', 'SURNAME', 'APELYIDO'] },
  { key: 'firstName', label: 'First name', required: true, aliases: ['FIRST NAME', 'GIVEN NAME', 'PANGALAN'] },
  { key: 'middleName', label: 'Middle name', aliases: ['MIDDLE NAME'] },
  { key: 'suffix', label: 'Suffix', aliases: ['SUFFIX', 'EXT', 'EXTENSION'] },
  { key: 'birthDate', label: 'Birthdate', required: true, aliases: ['BIRTHDATE', 'BIRTH DATE', 'DATE OF BIRTH'] },
  { key: 'sex', label: 'Sex / gender', required: true, aliases: ['GENDER', 'SEX'] },
  { key: 'civilStatus', label: 'Civil status', aliases: ['CIVIL STATUS'] },
  { key: 'houseNo', label: 'House no.', aliases: ['HOUSE NO', 'HOUSE NO.', 'HOUSE NUMBER'] },
  { key: 'street', label: 'Street / address', required: true, aliases: ['STREET', 'FULL ADDRESS', 'ADDRESS'] },
  { key: 'contactNo', label: 'Contact no.', aliases: ['MOBILE / CONTACT NO.', 'CONTACT NO.', 'MOBILE NO.', 'CONTACT'] },
  { key: 'voter', label: 'Voter (YES/NO)', aliases: ['VOTER'] },
] as const
type TargetKey = (typeof TARGETS)[number]['key']

const normH = (s: string) => s.trim().toUpperCase().replace(/\s+/g, ' ')

function parseDate(s: string): string | null {
  const t = s.trim().toUpperCase().replace(/O/g, '0')
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
  return null
}

interface Checked {
  line: number
  record?: ImportRecord
  errors: string[]
  duplicateOf?: string
  duplicateInFile?: number
}

/** Import panel shown inside the Resident Master List (no separate page). */
export function ImportPanel({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [rows, setRows] = useState<string[][]>([])
  const [map, setMap] = useState<Partial<Record<TargetKey, number>>>({})
  const [keepDup, setKeepDup] = useState<Set<number>>(new Set())
  const [done, setDone] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  const header = rows[0] ?? []
  const body = rows.slice(1)

  const onFile = async (f?: File) => {
    if (!f) return
    // Excel (.xlsx) straight from the barangay's file, or a CSV saved from it.
    const parsed = /\.xlsx$/i.test(f.name)
      ? ((await readSheet(f)) as unknown[][]).map((r) => r.map((c) => (c instanceof Date ? c.toISOString().slice(0, 10) : c == null ? '' : String(c))))
      : parseCsv(await f.text())
    setFileName(f.name)
    setRows(parsed)
    setDone(null)
    setKeepDup(new Set())
    const h = (parsed[0] ?? []).map(normH)
    const auto: Partial<Record<TargetKey, number>> = {}
    for (const t of TARGETS) {
      const i = h.findIndex((x) => (t.aliases as readonly string[]).includes(x))
      if (i >= 0) auto[t.key] = i
    }
    setMap(auto)
  }

  const checked = useMemo<Checked[]>(() => {
    const seen = new Map<string, number>()
    return body.map((r, i) => {
      const get = (k: TargetKey) => (map[k] !== undefined ? (r[map[k]!] ?? '').trim() : '')
      const errors: string[] = []
      for (const t of TARGETS) if ('required' in t && t.required && !get(t.key)) errors.push(`Missing ${t.label.toLowerCase()}`)
      const birth = get('birthDate') ? parseDate(get('birthDate')) : null
      if (get('birthDate') && !birth) errors.push('Birthdate not recognized (use YYYY-MM-DD or MM/DD/YYYY)')
      const sexRaw = get('sex').toUpperCase()
      const sex = sexRaw.startsWith('M') ? 'male' : sexRaw.startsWith('F') ? 'female' : null
      if (get('sex') && !sex) errors.push('Sex must be MALE or FEMALE')
      // Address like "665 -GEN.LUKBAN , TONDO II" when only a full address column is mapped
      let houseNo = get('houseNo')
      let street = get('street')
      if (!houseNo && street) {
        const m = street.match(/^\s*([\w-]+?)\s*-\s*([^,]+)/)
        if (m) {
          houseNo = m[1]
          street = m[2].trim()
        }
      }
      if (errors.length || !birth || !sex) return { line: i + 2, errors }
      const cs = get('civilStatus').toLowerCase()
      const record: ImportRecord = {
        lastName: get('lastName'),
        firstName: get('firstName'),
        middleName: get('middleName') || undefined,
        suffix: get('suffix') || undefined,
        birthDate: birth,
        sex,
        civilStatus: cs.startsWith('mar') ? 'married' : cs.startsWith('wid') ? 'widowed' : cs.startsWith('sep') ? 'separated' : cs.includes('live') ? 'live_in' : 'single',
        houseNo: houseNo || 'Not recorded',
        street,
        contactNo: get('contactNo').replace(/O/gi, '0') || undefined,
        voter: get('voter').toUpperCase().startsWith('Y'),
      }
      const k = dupKey(record)
      const inFile = seen.get(k)
      seen.set(k, i + 2)
      const dup = findDuplicate(record)
      return { line: i + 2, record, errors, duplicateOf: dup ? fullName(dup) : undefined, duplicateInFile: inFile }
    })
  }, [body, map])

  const valid = checked.filter((c) => c.record && !c.duplicateOf && !c.duplicateInFile)
  const dups = checked.filter((c) => c.record && (c.duplicateOf || c.duplicateInFile))
  const invalid = checked.filter((c) => !c.record)
  const toImport = [...valid, ...dups.filter((d) => keepDup.has(d.line))]
  const missingRequired = TARGETS.filter((t) => 'required' in t && t.required && map[t.key] === undefined)

  const confirm = async () => {
    if (!user) return
    setBusy(true)
    const n = await importResidents(toImport.map((c) => c.record!), user)
    audit(user, 'Imported resident master list', 'Residents', `${n} records from ${fileName}`)
    setDone(n)
    setBusy(false)
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-[length:calc(19px*var(--fs))] font-bold text-navy-900">Import Master List</h2>
        </div>
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </div>

      <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <span className="text-[length:calc(15px*var(--fs))] text-navy-900">{fileName ? <><strong>{fileName}</strong> · {body.length} data rows</> : 'Choose the master list file (Excel or CSV). The first row must contain the column names.'}</span>
        <input ref={fileRef} type="file" accept=".xlsx,.csv,text/csv" className="sr-only" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} />
        <Button icon={<FileUp className="size-4" />} onClick={() => fileRef.current?.click()}>{fileName ? 'Choose another file' : 'Choose file'}</Button>
      </Card>

      {done !== null && (
        <Card className="mb-4 flex items-center gap-3 border-success/40 bg-success-tint px-5 py-4 text-[length:calc(15.5px*var(--fs))] text-navy-900">
          <CheckCircle2 className="size-5 text-success" /> {done} records added to the master list. <Link to="/residents" className="font-semibold text-info hover:underline">Open the master list</Link>
        </Card>
      )}

      {rows.length > 0 && done === null && (
        <>
          <Panel title="1. Column mapping" subtitle="Matched automatically where the column names are recognized. Adjust if needed.">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {TARGETS.map((t) => (
                <label key={t.key} className="block">
                  <span className="mb-1 block text-[length:calc(14.5px*var(--fs))] font-semibold text-navy-900">{t.label}{'required' in t && t.required && <span className="text-danger-ink"> *</span>}</span>
                  <Select value={map[t.key] ?? ''} onChange={(e) => setMap((m) => ({ ...m, [t.key]: e.target.value === '' ? undefined : Number(e.target.value) }))}>
                    <option value="">Not in file</option>
                    {header.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                  </Select>
                </label>
              ))}
            </div>
            {missingRequired.length > 0 && <p className="mt-3 text-[length:calc(14.5px*var(--fs))] text-danger-ink">Map the required fields: {missingRequired.map((t) => t.label).join(', ')}.</p>}
          </Panel>

          <section className="mt-4 grid grid-cols-3 gap-3">
            <Card className="px-5 py-4"><p className="label-caps">Ready to import</p><p className="font-display text-[length:calc(28px*var(--fs))] font-extrabold text-success">{valid.length}</p></Card>
            <Card className="px-5 py-4"><p className="label-caps">Possible duplicates</p><p className="font-display text-[length:calc(28px*var(--fs))] font-extrabold text-warning">{dups.length}</p></Card>
            <Card className="px-5 py-4"><p className="label-caps">Need fixing</p><p className="font-display text-[length:calc(28px*var(--fs))] font-extrabold text-danger-ink">{invalid.length}</p></Card>
          </section>

          {dups.length > 0 && (
            <Panel className="mt-4" title="2. Review possible duplicates" subtitle="Not merged automatically. Tick a row only if it is a different person." bodyClassName="px-0 py-0">
              <ul className="divide-y divide-line-soft">
                {dups.map((d) => (
                  <li key={d.line} className="flex items-center justify-between gap-3 px-5 py-2.5 text-[length:calc(15px*var(--fs))]">
                    <span>
                      <span className="font-semibold text-navy-900">Row {d.line}: {d.record!.lastName}, {d.record!.firstName}</span>
                      <span className="block text-[length:calc(14px*var(--fs))] text-ink-muted">{d.duplicateOf ? `Matches existing record: ${d.duplicateOf}` : `Same as row ${d.duplicateInFile} in this file`}</span>
                    </span>
                    <label className="flex items-center gap-2 text-[length:calc(14.5px*var(--fs))] text-navy-900">
                      <input type="checkbox" className="size-4 accent-[#002132]" checked={keepDup.has(d.line)} onChange={(e) => setKeepDup((s) => { const n = new Set(s); if (e.target.checked) n.add(d.line); else n.delete(d.line); return n })} />
                      Import as a different person
                    </label>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {invalid.length > 0 && (
            <Panel className="mt-4" title="Rows that need fixing" subtitle="Correct these in the file and upload again. They will not be imported." bodyClassName="px-0 py-0">
              <ul className="max-h-[240px] divide-y divide-line-soft overflow-y-auto">
                {invalid.map((c) => <li key={c.line} className="flex items-start gap-2 px-5 py-2 text-[length:calc(14.5px*var(--fs))] text-navy-900"><XCircle className="mt-px size-4 shrink-0 text-danger" /> Row {c.line}: {c.errors.join('; ')}</li>)}
              </ul>
            </Panel>
          )}

          <Panel className="mt-4" title="Preview" subtitle="First 10 rows as read from the file" bodyClassName="px-0 py-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-[length:calc(14.5px*var(--fs))]">
                <thead><tr className="bg-surface-muted text-left">{header.map((h, i) => <th key={i} className="label-caps px-3 py-2">{h}</th>)}<th className="label-caps px-3 py-2">Check</th></tr></thead>
                <tbody>
                  {body.slice(0, 10).map((r, i) => {
                    const c = checked[i]
                    return (
                      <tr key={i} className="border-t border-line-soft">
                        {header.map((_, j) => <td key={j} className="px-3 py-1.5 text-navy-900">{r[j]}</td>)}
                        <td className="px-3 py-1.5">{!c.record ? <Badge tone="danger">Fix</Badge> : c.duplicateOf || c.duplicateInFile ? <Badge tone="warning">Review</Badge> : <Badge tone="success">OK</Badge>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          <div className="mt-4 flex items-center gap-3">
            <Button onClick={confirm} loading={busy} disabled={toImport.length === 0 || missingRequired.length > 0}>Import {toImport.length} records</Button>
            {dups.length > 0 && <span className="flex items-center gap-1.5 text-[length:calc(14.5px*var(--fs))] text-warning"><AlertTriangle className="size-4" /> {dups.length - keepDup.size} possible duplicates will be skipped</span>}
          </div>
        </>
      )}
    </>
  )
}
