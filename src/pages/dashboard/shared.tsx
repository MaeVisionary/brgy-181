import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { Badge } from '@/components/ui/Badge'
import { PageHeader } from '@/components/ui/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { StatCard } from '@/components/ui/StatCard'
import { formatDateTime, greeting } from '@/lib/format'
import { useAsync } from '@/hooks/useAsync'
import { getAreaBreakdown, getPopulationSummary } from '@/services/residentService'
import { AREAS, SAMPLE_DATA_NOTICE } from '@/mocks/residents'
import { BarChart3, FileDown, Sheet } from 'lucide-react'
import { exportExcel, exportPdf, type ReportOutput } from '@/analytics/exporters'
import { AreaChart } from '@/components/charts/AreaChart'
import { StreetBarChart } from '@/components/charts/StreetBarChart'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Panel'
import { BARANGAY } from '@/config/barangay'
import { useState } from 'react'

export function DashHeader({ subtitle, actions }: { subtitle: string; actions?: ReactNode }) {
  const { user } = useAuth()
  const [now] = useState(() => new Date())
  if (!user) return null
  return (
    <PageHeader
      eyebrow={`${user.position} · As of ${formatDateTime(now)}`}
      title={`${greeting(now)}, ${user.fullName}`}
      subtitle={subtitle}
      actions={actions}
    />
  )
}

export function SampleBadge() {
  return (
    <span title={SAMPLE_DATA_NOTICE}>
      <Badge tone="neutral">Sample data</Badge>
    </span>
  )
}

/** Barangay population overview from resident records (FR15). */
export function PopulationCards({ compact }: { compact?: boolean }) {
  const s = useAsync(getPopulationSummary).data
  const items: [string, number | undefined][] = [
    ['Residents', s?.totalResidents],
    ['Households', s?.totalHouseholds],
    ['Families', s?.totalFamilies],
    ['Senior citizens', s?.seniorCitizens],
    ['PWDs', s?.pwds],
    ['Solo parents', s?.soloParents],
    ['4Ps members', s?.fourPsMembers],
    ['Program beneficiaries', s?.programBeneficiaries],
  ]
  return (
    <Panel title="Barangay overview" subtitle="Counts from the resident records" actions={<SampleBadge />} bodyClassName={compact ? 'px-4 py-3' : undefined}>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        {items.map(([label, v]) => (
          <div key={label}>
            <dt className="label-caps">{label}</dt>
            <dd className="mt-1 font-display text-[22px] leading-none font-extrabold text-navy-900">{v ?? '–'}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  )
}

export function ListPanel<T>({
  title,
  subtitle,
  items,
  render,
  empty,
  to,
  toLabel = 'View all',
}: {
  title: string
  subtitle?: string
  items: T[] | null
  render: (item: T) => ReactNode
  empty: string
  to?: string
  toLabel?: string
}) {
  return (
    <Panel
      title={title}
      subtitle={subtitle}
      bodyClassName="px-0 py-0"
      actions={to && <Link to={to} className="text-[12.5px] font-semibold text-info hover:underline">{toLabel}</Link>}
    >
      {items === null ? (
        <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <div key={i} className="h-9 animate-pulse rounded bg-surface-muted" />)}</div>
      ) : items.length === 0 ? (
        <p className="px-5 py-6 text-[13px] text-ink-muted">{empty}</p>
      ) : (
        <ul>{items.map((it, i) => <li key={i} className="border-b border-line-soft last:border-0">{render(it)}</li>)}</ul>
      )}
    </Panel>
  )
}

export function Row({ to, title, meta, right }: { to: string; title: ReactNode; meta?: ReactNode; right?: ReactNode }) {
  return (
    <Link to={to} className="flex items-center gap-3 px-5 py-3 hover:bg-sky-50">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-navy-900">{title}</span>
        {meta && <span className="block truncate text-[12px] text-ink-muted">{meta}</span>}
      </span>
      {right}
    </Link>
  )
}

export function Stat(props: Parameters<typeof StatCard>[0]) {
  return <StatCard {...props} />
}

/**
 * Barangay overview + residents/households chart with ONE street switch.
 * All streets → grouped bars per street; one street → horizontal bars of that
 * street's figures. Both can be exported (PDF / Excel) for the selected scope.
 */
export function PopulationByStreet() {
  const { can } = useAuth()
  const [street, setStreet] = useState('')
  const summary = useAsync(() => getPopulationSummary(street || undefined), [street]).data
  const areas = useAsync(getAreaBreakdown).data
  const canExport = can('reports.export') || can('reports.view')
  const year = new Date().getFullYear()

  const items: [string, number | undefined][] = [
    ['Residents', summary?.totalResidents],
    ['Households', summary?.totalHouseholds],
    ['Families', summary?.totalFamilies],
    ['Senior citizens', summary?.seniorCitizens],
    ['PWDs', summary?.pwds],
    ['Solo parents', summary?.soloParents],
    ['4Ps members', summary?.fourPsMembers],
    ['Program beneficiaries', summary?.programBeneficiaries],
  ]
  const scope = street || 'All streets'

  const report = (): ReportOutput => ({
    title: street ? `Population summary: ${street}` : 'Population summary by street',
    meta: [
      ['Barangay', BARANGAY.fullName],
      ['Scope', scope],
      ['Source', 'Resident records (sample data in this prototype)'],
      ['Generated', formatDateTime(new Date().toISOString())],
    ],
    summary: items.map(([k, v]) => [k, v ?? 0]),
    columns: ['Street', 'Residents', 'Households', 'Families', 'Senior citizens', 'PWDs', 'Solo parents', '4Ps members', 'Program beneficiaries'],
    rows: (areas ?? [])
      .filter((a) => !street || a.area === street)
      .map((a) => [a.area, a.residents, a.households, a.families, a.seniorCitizens, a.pwds, a.soloParents, a.fourPsMembers, a.programBeneficiaries]),
  })

  const controls = (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={street}
        onChange={(e) => setStreet(e.target.value)}
        aria-label="Street"
        className="h-9 rounded-full border border-line bg-surface px-3 text-[13px] font-semibold text-navy-900 focus:border-navy-600 focus:outline-none"
      >
        <option value="">All streets</option>
        {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
      </select>
      <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface-muted px-3 text-[12.5px] font-semibold text-ink-muted">
        <span className="size-1.5 rounded-full bg-ink-muted" /> {year}
      </span>
      {canExport && (
        <>
          <Button size="sm" variant="secondary" icon={<FileDown className="size-3.5" />} onClick={() => exportPdf(report())} disabled={!summary || !areas}>
            Export PDF
          </Button>
          <Button size="sm" variant="secondary" icon={<Sheet className="size-3.5" />} onClick={() => void exportExcel(report())} disabled={!summary || !areas}>
            Excel
          </Button>
        </>
      )}
    </div>
  )

  return (
    <div className="space-y-4">
      <Card className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-sky-100 text-navy-900"><BarChart3 className="size-5" /></span>
          <div>
            <h2 className="font-display text-[16px] font-bold text-navy-900">Population by street</h2>
            <p className="text-[12.5px] text-ink-muted">Registered residents and households per area · switch a street to filter everything below</p>
          </div>
        </div>
        {controls}
      </Card>
      <Panel title={street ? `Overview: ${street}` : 'Barangay overview'} subtitle="Counts from the resident records" actions={<SampleBadge />}>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          {items.map(([label, v]) => (
            <div key={label}>
              <dt className="label-caps">{label}</dt>
              <dd className="mt-1 font-display text-[22px] leading-none font-extrabold text-navy-900">{v ?? '–'}</dd>
            </div>
          ))}
        </dl>
      </Panel>
      <Panel title={street ? `${street}: population figures` : 'Residents and households per area'} subtitle="For community and ayuda planning" actions={<SampleBadge />}>
        {!areas || !summary ? (
          <div className="h-[244px] animate-pulse rounded bg-surface-muted" />
        ) : street ? (
          <StreetBarChart street={street} items={items.map(([k, v]) => [k, v ?? 0])} />
        ) : (
          <AreaChart data={areas} />
        )}
      </Panel>
    </div>
  )
}
