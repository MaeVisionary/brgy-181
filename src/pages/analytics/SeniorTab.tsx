import { Download, FilterX, Lock, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAuth } from '@/auth/useAuth'
import { useAnalytics } from '@/analytics/AnalyticsContext'
import {
  AGE_GROUPS,
  FILTER_LABELS,
  addressCounts,
  ageCounts,
  applyFilters,
  areaInsights,
  civilCounts,
  deriveRows,
  issueCounts,
  needsVerification,
  oscaByYear,
  pct,
  statusCounts,
  statusGrouping,
  streetCounts,
  summarize,
  voterCounts,
  type Filters,
} from '@/analytics/compute'
import { exportExcel } from '@/analytics/exporters'
import { STREET_ALIASES } from '@/analytics/parseMasterlist'
import { ISSUE_LABELS } from '@/analytics/seniorTypes'
import { SimpleBar } from '@/components/charts/SimpleBar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Select, TextInput } from '@/components/ui/Field'
import { Panel } from '@/components/ui/Panel'
import { StatCard } from '@/components/ui/StatCard'
import { BARANGAY } from '@/config/barangay'
import { audit } from '@/services/auditService'
import { DataSource } from './DataSource'
import { FileSpreadsheet } from 'lucide-react'

const PAGE = 25

export function SeniorTab() {
  const { user, can } = useAuth()
  const { dataset, reportingDate, filters, setFilters } = useAnalytics()
  const showPii = can('residents.view')
  const canExport = can('reports.export')
  const [addrQuery, setAddrQuery] = useState('')
  const [page, setPage] = useState(0)

  const all = useMemo(() => (dataset ? deriveRows(dataset, reportingDate) : []), [dataset, reportingDate])
  const rows = useMemo(() => applyFilters(all, filters, { searchNames: showPii }), [all, filters, showPii])
  const s = useMemo(() => summarize(rows), [rows])
  // Senior status is decided by age on the reporting date (RA 9994: 60 and above), not by the list itself.
  const seniors = rows.filter((r) => r.age !== null && r.age >= 60).length
  const belowSixty = rows.filter((r) => r.age !== null && r.age < 60).length
  const turningSixty = rows.filter((r) => r.age === 59).length

  if (!dataset) {
    return (
      <>
        <DataSource />
        <EmptyState icon={<FileSpreadsheet className="size-5" />} title="Load the senior citizen masterlist to begin" body="All figures are computed from the file you load. Nothing is shown until real records are available." />
      </>
    )
  }

  const set = (patch: Filters) => {
    setPage(0)
    setFilters((f) => {
      const next = { ...f, ...patch }
      for (const k of Object.keys(patch) as (keyof Filters)[]) if (f[k] === patch[k]) delete next[k]
      return next
    })
  }
  const active = Object.entries(filters).filter(([, v]) => v) as [keyof Filters, string][]
  const ages = ageCounts(rows)
  const streets = streetCounts(rows)
  const addresses = addressCounts(rows).filter((a) => a.key.includes(addrQuery.trim().toUpperCase()))
  const civil = civilCounts(rows)
  const status = statusCounts(rows)
  const voter = voterCounts(rows)
  const osca = oscaByYear(rows)
  const issues = issueCounts(rows)
  const areas = areaInsights(rows)
  const allCivil = civilCounts(all).map((c) => c.key)

  const exportFiltered = async () => {
    if (!user) return
    audit(user, showPii ? 'Exported filtered senior records (identifiable)' : 'Exported filtered senior summary', 'Analytics', `${rows.length} records`)
    await exportExcel({
      title: 'Senior citizen records (filtered)',
      meta: [
        ['Source dataset', dataset.fileName],
        ['Reporting date', reportingDate.toISOString().slice(0, 10)],
        ['Generated', new Date().toLocaleString('en-PH')],
        ['Barangay', BARANGAY.fullName],
        ['Filters', active.map(([k, v]) => `${FILTER_LABELS[k]}: ${v}`).join('; ') || 'None'],
      ],
      summary: [['Records', s.total], ['Male', s.male], ['Female', s.female], ['Bedridden', s.bedridden], ['With OSCA ID', s.withOsca]],
      columns: showPii ? ['Sheet row', 'Name', 'Age', 'Area', 'Gender', 'Civil status', 'Status', 'OSCA ID'] : ['Age group', 'Area', 'Gender', 'Status'],
      rows: rows.map((r) => (showPii ? [r.sheetRow, r.fullName, r.age ?? '', r.street ?? '', r.gender ?? '', r.civilStatusRaw, r.statusRaw, r.oscaId] : [r.ageGroup, r.street ?? '', r.gender ?? '', r.status])),
    })
  }

  return (
    <>
      <DataSource />

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative sm:col-span-2 lg:col-span-4">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle" />
            <TextInput className="pl-9" placeholder={showPii ? 'Search name or address' : 'Search address'} value={filters.search ?? ''} onChange={(e) => { setPage(0); setFilters((f) => ({ ...f, search: e.target.value || undefined })) }} aria-label="Search records" />
          </div>
          <FilterSelect label="Age group" value={filters.ageGroup} options={[...AGE_GROUPS, 'Unknown']} onChange={(v) => set({ ageGroup: v as Filters['ageGroup'] })} />
          <FilterSelect label="Gender" value={filters.gender} options={['Male', 'Female', 'Missing']} onChange={(v) => set({ gender: v as Filters['gender'] })} />
          <FilterSelect label="Civil status" value={filters.civilStatus} options={allCivil} onChange={(v) => set({ civilStatus: v })} />
          <FilterSelect label="Area" value={filters.street} options={streetCounts(all).map((c) => c.key)} onChange={(v) => set({ street: v })} />
          <FilterSelect label="OSCA ID" value={filters.osca} options={['with', 'without']} labels={{ with: 'With OSCA ID', without: 'Without OSCA ID' }} onChange={(v) => set({ osca: v as Filters['osca'] })} />
          <FilterSelect label="Status" value={filters.status} options={['Active', 'Inactive', 'Bedridden', 'Other', 'Missing']} onChange={(v) => set({ status: v as Filters['status'] })} />
          <FilterSelect label="Voter" value={filters.voter} options={['Yes', 'No', 'Missing']} onChange={(v) => set({ voter: v as Filters['voter'] })} />
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-line-soft pt-3">
          <span className="text-[14.5px] text-ink-muted">
            Showing <strong className="text-navy-900">{rows.length}</strong> of {all.length} records
          </span>
          {active.map(([k, v]) => (
            <button key={k} type="button" onClick={() => set({ [k]: v } as Filters)} className="rounded-full bg-sky-100 px-2.5 py-1 text-[14px] font-semibold text-navy-900 hover:bg-sky-300/40">
              {FILTER_LABELS[k]}: {k === 'issue' ? ISSUE_LABELS[v as keyof typeof ISSUE_LABELS] : v} ×
            </button>
          ))}
          <div className="ml-auto flex gap-2">
            {active.length > 0 && (
              <Button variant="ghost" size="sm" icon={<FilterX className="size-3.5" />} onClick={() => { setPage(0); setFilters({}) }}>
                Clear filters
              </Button>
            )}
            {canExport && (
              <Button variant="secondary" size="sm" icon={<Download className="size-3.5" />} onClick={exportFiltered}>
                Export filtered (Excel)
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Senior citizens (60+)" value={seniors} hint={`by age as of ${reportingDate.toISOString().slice(0, 10)}`} onClick={() => setFilters({})} />
        <Kpi label="Below 60 (not yet senior)" value={belowSixty} hint={`of ${s.total} records`} attention={belowSixty > 0} onClick={() => set({ ageGroup: 'Below 60' })} />
        <Kpi label="Turning 60 within a year" value={turningSixty} hint="becoming eligible soon" onClick={() => set({ ageGroup: 'Below 60' })} />
        <Kpi label="Male" value={s.male} hint={pct(s.male, s.total)} onClick={() => set({ gender: 'Male' })} />
        <Kpi label="Female" value={s.female} hint={pct(s.female, s.total)} onClick={() => set({ gender: 'Female' })} />
        <Kpi label="Active" value={s.active} onClick={() => set({ status: 'Active' })} />
        <Kpi label="Inactive" value={s.inactive} onClick={() => set({ status: 'Inactive' })} />
        <Kpi label="Bedridden" value={s.bedridden} onClick={() => set({ status: 'Bedridden' })} />
        <Kpi label="With OSCA ID" value={s.withOsca} hint={pct(s.withOsca, s.total)} onClick={() => set({ osca: 'with' })} />
        <Kpi label="Requiring verification" value={s.needsVerification} attention={s.needsVerification > 0} onClick={() => set({ verification: 'needs' })} />
      </section>

      {/* Age and gender */}
      <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel title="Age distribution" subtitle={`Computed from birthdates as of ${reportingDate.toISOString().slice(0, 10)} · click a bar to filter`}>
          <SimpleBar labels={ages.map((a) => a.key)} values={ages.map((a) => a.count)} selected={filters.ageGroup} onSelect={(l) => set({ ageGroup: l as Filters['ageGroup'] })} />
          <dl className="mt-3 grid grid-cols-3 gap-3 text-[14.5px]">
            <Fact label="Valid birthdates" value={`${s.validAges} of ${s.total}`} />
            <Fact label="Average age" value={s.averageAge === null ? '–' : s.averageAge.toFixed(1)} />
            <Fact label="Oldest recorded age" value={s.oldestAge ?? '–'} />
          </dl>
          <CountTable rows={ages.map((a) => [a.key, a.count, `${a.pct.toFixed(1)}% of valid`])} />
        </Panel>
        <Panel title="Gender distribution" subtitle="Only MALE / FEMALE values are classified">
          <SimpleBar labels={['Male', 'Female', 'Missing']} values={[s.male, s.female, s.genderMissing]} selected={filters.gender} onSelect={(l) => set({ gender: l as Filters['gender'] })} height={180} />
          <CountTable rows={[['Male', s.male, pct(s.male, s.total)], ['Female', s.female, pct(s.female, s.total)], ['Missing / unclassified', s.genderMissing, pct(s.genderMissing, s.total)]]} />
        </Panel>
      </section>

      {/* Address */}
      <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Panel title="Top 10 areas" subtitle="Records per street · click a bar to filter. An address is not treated as a household.">
          <SimpleBar labels={streets.slice(0, 10).map((c) => c.key)} values={streets.slice(0, 10).map((c) => c.count)} selected={filters.street} onSelect={(l) => set({ street: l })} horizontal height={Math.max(180, Math.min(10, streets.length) * 30)} />
          <details className="mt-3 text-[14px] text-ink-muted">
            <summary className="cursor-pointer font-semibold text-navy-900">How addresses were grouped into areas</summary>
            <p className="mt-1">The street is read from the text after the house number ("665-D -GEN.LUKBAN , TONDO II" → GEN.LUKBAN). "ST." is dropped. These spelling variants were merged:</p>
            <ul className="mt-1 list-disc pl-5">{Object.entries(STREET_ALIASES).map(([a, b]) => <li key={a}>{a} → {b}</li>)}</ul>
            <p className="mt-1">Addresses the rule could not read are counted as "Unparsed".</p>
          </details>
        </Panel>
        <Panel title="Address breakdown" subtitle="Full addresses as recorded (normalized spacing and case)" bodyClassName="px-0 py-0">
          <div className="border-b border-line-soft p-3">
            <TextInput placeholder="Search address" value={addrQuery} onChange={(e) => setAddrQuery(e.target.value)} aria-label="Search address breakdown" />
          </div>
          <div className="max-h-[320px] overflow-y-auto">
            <table className="w-full text-[14.5px]">
              <thead className="sticky top-0 bg-surface-muted">
                <tr className="text-left"><th className="label-caps px-4 py-2">Address</th><th className="label-caps px-2 py-2 text-right">Records</th><th className="label-caps px-4 py-2 text-right">%</th></tr>
              </thead>
              <tbody>
                {addresses.map((a) => (
                  <tr key={a.key} className="border-t border-line-soft">
                    <td className="px-4 py-1.5 text-navy-900">{a.key}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{a.count}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums text-ink-muted">{a.pct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </section>

      {/* Civil status, status, voter */}
      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Civil status">
          <CountTable rows={civil.map((c) => [c.key === 'Missing' ? 'Missing / unclassified' : c.key, c.count, `${c.pct.toFixed(1)}%`])} onRow={(k) => set({ civilStatus: k.startsWith('Missing') ? 'Missing' : k })} />
        </Panel>
        <Panel title="Record status">
          <CountTable rows={status.map((c) => [c.key, c.count, `${c.pct.toFixed(1)}%`])} onRow={(k) => set({ status: k as Filters['status'] })} />
          <details className="mt-3 text-[14px] text-ink-muted">
            <summary className="cursor-pointer font-semibold text-navy-900">Original labels and grouping</summary>
            <ul className="mt-1 space-y-0.5">{statusGrouping(rows).map((g) => <li key={g.raw}>"{g.raw}" → {g.group} ({g.count})</li>)}</ul>
          </details>
        </Panel>
        <Panel title="Voter information" subtitle="Within these senior citizen records only, not the barangay's voter population">
          <CountTable rows={voter.map((c) => [c.key === 'Yes' ? 'Marked YES' : c.key === 'No' ? 'Marked NO' : 'Missing', c.count, `${c.pct.toFixed(1)}%`])} onRow={(k) => set({ voter: k.includes('YES') ? 'Yes' : k.includes('NO') ? 'No' : 'Missing' })} />
        </Panel>
      </section>

      {/* OSCA */}
      <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Panel title="OSCA registration" subtitle="A populated ID field is not proof that the ID is valid">
          <CountTable
            rows={[
              ['With OSCA ID no.', s.withOsca, pct(s.withOsca, s.total)],
              ['Without OSCA ID no.', s.withoutOsca, pct(s.withoutOsca, s.total)],
              ['Missing date issued', rows.filter((r) => !r.oscaDateRaw).length, ''],
              ['Date issued could not be read', rows.filter((r) => r.oscaDateRaw && !r.oscaDate).length, ''],
              ['Duplicate OSCA ID no.', rows.filter((r) => r.allIssues.includes('duplicate_osca_id')).length, ''],
            ]}
          />
        </Panel>
        <Panel title="OSCA registrations by year issued" subtitle="Only dates that could be read reliably">
          {osca.length ? <SimpleBar labels={osca.map((o) => o.key)} values={osca.map((o) => o.count)} height={200} label="Registrations" /> : <p className="text-[15px] text-ink-muted">No readable issue dates in the current selection.</p>}
        </Panel>
      </section>

      {/* Community planning insights */}
      <Panel className="mt-4" title="Community planning insights" subtitle="Where registered senior citizens are, for assistance and outreach planning. No conclusions about poverty, health or eligibility are drawn." bodyClassName="px-0 py-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-[15px]">
            <thead>
              <tr className="bg-surface-muted text-left">
                {['Area', 'Senior records', 'Bedridden', 'Records needing updates', 'Without OSCA ID'].map((h) => <th key={h} className="label-caps px-4 py-2.5">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {areas.map((a) => (
                <tr key={a.area} className="cursor-pointer border-t border-line-soft hover:bg-sky-50" onClick={() => set({ street: a.area })}>
                  <td className="px-4 py-2 font-semibold text-navy-900">{a.area}</td>
                  <td className="px-4 py-2 tabular-nums">{a.seniors}</td>
                  <td className="px-4 py-2 tabular-nums">{a.bedridden || <span className="text-ink-subtle">0</span>}</td>
                  <td className="px-4 py-2 tabular-nums">{a.needsUpdate}</td>
                  <td className="px-4 py-2 tabular-nums">{a.noOsca}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Data quality */}
      <Panel className="mt-4" title="Data quality" subtitle="Flagged for review by authorized personnel. Nothing is deleted or merged automatically.">
        {issues.length === 0 ? (
          <p className="text-[15px] text-ink-muted">No issues found in the current selection.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {issues.map((i) => (
              <li key={i.code}>
                <button type="button" onClick={() => set({ issue: i.code })} className="flex w-full items-center justify-between gap-3 rounded-[var(--radius-control)] border border-line px-3 py-2 text-left hover:bg-sky-50">
                  <span className="text-[15px] text-navy-900">{ISSUE_LABELS[i.code]}</span>
                  <Badge dot={false} tone={i.code === 'age_column_mismatch' ? 'neutral' : 'warning'}>{i.count}</Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[14px] text-ink-muted">
          "AGE column differs from birthdate" is informational: ages in this module always come from the birthdate. {dataset.normalizations.length} values were normalized
          for analysis (letter O typed as zero, spacing, status spelling); originals are kept{showPii ? ' and listed below' : ''}.
        </p>
        {showPii && dataset.normalizations.length > 0 && (
          <details className="mt-2 text-[14px]">
            <summary className="cursor-pointer font-semibold text-navy-900">Normalization log ({dataset.normalizations.length})</summary>
            <div className="mt-2 max-h-[240px] overflow-y-auto rounded-md border border-line-soft">
              <table className="w-full">
                <tbody>
                  {dataset.normalizations.map((n, i) => (
                    <tr key={i} className="border-b border-line-soft last:border-0">
                      <td className="px-3 py-1 text-ink-muted">{n.field}</td>
                      <td className="px-3 py-1">{n.from} → {n.to}</td>
                      <td className="px-3 py-1 text-ink-muted">{n.rule}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </Panel>

      {/* Drill-down */}
      <Panel className="mt-4" title="Records in this selection" subtitle={showPii ? 'Identifiable details are limited to what the analysis needs. Contact numbers and full birthdates are not shown.' : undefined} bodyClassName="px-0 py-0">
        {!showPii ? (
          <p className="flex items-center gap-2 px-5 py-5 text-[15px] text-ink-muted">
            <Lock className="size-4" /> Individual records are only visible to personnel with access to resident records. You can still use all aggregate figures above.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-[14.5px]">
                <thead>
                  <tr className="bg-surface-muted text-left">
                    {['Row', 'Name', 'Age', 'Area', 'Gender', 'Status', 'OSCA ID', 'Needs'].map((h) => <th key={h} className="label-caps px-3 py-2">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(page * PAGE, page * PAGE + PAGE).map((r) => (
                    <tr key={r.sheetRow} className="border-t border-line-soft">
                      <td className="px-3 py-1.5 tabular-nums text-ink-muted">{r.sheetRow}</td>
                      <td className="px-3 py-1.5 font-semibold text-navy-900">{r.fullName}</td>
                      <td className="px-3 py-1.5 tabular-nums">{r.age ?? '–'}</td>
                      <td className="px-3 py-1.5">{r.street ?? 'Unparsed'}</td>
                      <td className="px-3 py-1.5">{r.gender ?? '–'}</td>
                      <td className="px-3 py-1.5">{r.statusRaw || '–'}</td>
                      <td className="px-3 py-1.5">{r.oscaId || '–'}</td>
                      <td className="px-3 py-1.5">{needsVerification(r) ? <Badge tone="warning">{r.allIssues.filter((i) => i !== 'age_column_mismatch').length} issue(s)</Badge> : <span className="text-ink-subtle">–</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-line-soft px-4 py-2.5 text-[14.5px] text-ink-muted">
              <span>
                {rows.length ? page * PAGE + 1 : 0}–{Math.min(rows.length, page * PAGE + PAGE)} of {rows.length}
              </span>
              <span className="flex gap-2">
                <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <Button size="sm" variant="secondary" disabled={(page + 1) * PAGE >= rows.length} onClick={() => { setPage((p) => p + 1); if (user && page === 0) audit(user, 'Viewed senior citizen records', 'Analytics') }}>Next</Button>
              </span>
            </div>
          </>
        )}
      </Panel>
    </>
  )
}

function Kpi(props: { label: string; value: number; hint?: string; attention?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={props.onClick} className="text-left">
      <StatCard label={props.label} value={props.value} hint={props.hint} attention={props.attention} />
    </button>
  )
}

function Fact({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-surface-muted px-3 py-2">
      <dt className="text-[13px] text-ink-muted">{label}</dt>
      <dd className="font-display text-[18px] font-extrabold text-navy-900">{value}</dd>
    </div>
  )
}

function CountTable({ rows, onRow }: { rows: (string | number)[][]; onRow?: (key: string) => void }) {
  return (
    <table className="mt-3 w-full text-[15px]">
      <tbody>
        {rows.map((r) => (
          <tr key={String(r[0])} onClick={onRow ? () => onRow(String(r[0])) : undefined} className={`border-t border-line-soft ${onRow ? 'cursor-pointer hover:bg-sky-50' : ''}`}>
            <td className="py-1.5 pr-2 text-navy-900">{r[0]}</td>
            <td className="py-1.5 text-right font-semibold tabular-nums text-navy-900">{r[1]}</td>
            <td className="py-1.5 pl-3 text-right text-[14px] text-ink-muted">{r[2]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function FilterSelect({ label, value, options, labels, onChange }: { label: string; value?: string; options: string[]; labels?: Record<string, string>; onChange: (v: string | undefined) => void }) {
  return (
    <Select aria-label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value || (value as string))}>
      <option value="">{label}: all</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {labels?.[o] ?? o}
        </option>
      ))}
    </Select>
  )
}
