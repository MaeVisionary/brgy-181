import type { ReactNode } from 'react'
import { ChevronRight, Inbox } from '@/icons'
import { GreetingCard } from '@/components/ui/GreetingCard'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { Panel } from '@/components/ui/Panel'
import { StatCard } from '@/components/ui/StatCard'
import { formatDateTime } from '@/lib/format'
import { useAsync } from '@/hooks/useAsync'
import { getAreaBreakdown, getPopulationSummary } from '@/services/residentService'
import { AREAS } from '@/mocks/residents'
import { BarChart3, FileDown, Sheet } from '@/icons'
import { exportExcel, exportPdf, type ReportOutput } from '@/analytics/exporters'
import { AreaChart } from '@/components/charts/AreaChart'
import { StreetBarChart } from '@/components/charts/StreetBarChart'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Panel'
import { BARANGAY } from '@/config/barangay'
import { useState } from 'react'
import { listAudit } from '@/services/auditService'
import { ensureSampleVisit } from '@/services/appointmentService'

/**
 * Dashboard top (Figma v3): greeting card, then an "… Overview" row that carries
 * the page's main action. With `actionInGreeting` the action sits in the
 * greeting card instead (Property Custodian).
 */
export function DashHeader({ subtitle, actions, overview, actionInGreeting }: { subtitle: string; actions?: ReactNode; overview?: string; actionInGreeting?: boolean }) {
  const { user } = useAuth()
  if (!user) return null
  return (
    <>
      <GreetingCard subtitle={subtitle} profileTo="/account" action={actionInGreeting ? actions : undefined} />
      {overview && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-[length:calc(20px*var(--fs))] font-extrabold text-navy-900">{overview}</h2>
          {!actionInGreeting && actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
    </>
  )
}

/** "View All >" link used in every panel header. */
export function ViewAll({ to, label = 'View All' }: { to: string; label?: string }) {
  return (
    <Link to={to} className="inline-flex min-h-11 shrink-0 items-center gap-0.5 text-[length:calc(15.5px*var(--fs))] font-semibold text-info hover:underline">
      {label} <ChevronRight className="size-4" />
    </Link>
  )
}

/** Empty container note: tells the user there is nothing here yet. */
export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 px-5 py-6 text-[length:calc(15px*var(--fs))] text-ink-muted">
      <Inbox className="size-4 shrink-0 text-ink-subtle" /> {children}
    </p>
  )
}

/** Kept for compatibility: the "Sample data" label is no longer shown. */
export function SampleBadge() {
  return null
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
            <dd className="mt-1.5 font-display text-[length:calc(30px*var(--fs))] leading-none font-extrabold text-navy-900">{v ?? '–'}</dd>
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
  toLabel = 'View All',
  dark,
  className,
}: {
  title: string
  subtitle?: string
  items: T[] | null
  render: (item: T) => ReactNode
  empty: string
  to?: string
  toLabel?: string
  /** Navy title bar (default). */
  dark?: boolean
  className?: string
}) {
  return (
    <Panel title={title} subtitle={subtitle} dark={dark ?? true} className={className} bodyClassName="px-0 py-0" actions={to && <ViewAll to={to} label={toLabel} />}>
      {items === null ? (
        <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <div key={i} className="h-9 animate-pulse rounded bg-surface-muted" />)}</div>
      ) : items.length === 0 ? (
        <EmptyNote>{empty}</EmptyNote>
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
        <span className="block truncate text-[length:calc(16px*var(--fs))] font-semibold text-navy-900">{title}</span>
        {meta && <span className="block truncate text-[length:calc(14.5px*var(--fs))] text-ink-muted">{meta}</span>}
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
      ['Source', 'Resident records'],
      ['Generated', formatDateTime(new Date().toISOString())],
    ],
    summary: items.map(([k, v]) => [k, v ?? 0]),
    columns: ['Street', 'Residents', 'Households', 'Families', 'Senior citizens', 'PWDs', 'Solo parents', '4Ps members', 'Program beneficiaries'],
    rows: (areas ?? [])
      .filter((a) => !street || a.area === street)
      .map((a) => [a.area, a.residents, a.households, a.families, a.seniorCitizens, a.pwds, a.soloParents, a.fourPsMembers, a.programBeneficiaries]),
  })

  return (
    <div className="space-y-4">
      {/* Header: navy title bar, then one toolbar row (filter left, exports right). */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 bg-bar border-b border-sky-300 text-navy-900 px-5 py-3.5">
          <BarChart3 className="size-5 shrink-0" />
          <h2 className="font-display text-[length:calc(19px*var(--fs))] font-bold">Population by street</h2>
          <span className="rounded-full bg-surface px-2 py-0.5 text-[length:calc(13.5px*var(--fs))] font-semibold">{year}</span>
        </div>
        <div className="flex flex-col gap-3 px-5 py-3.5 md:flex-row md:items-center md:justify-between">
          <label className="flex w-full items-center gap-2 text-[length:calc(15px*var(--fs))] font-semibold text-navy-900 md:w-auto">
            <span className="shrink-0">Street</span>
            <select
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              className="h-10 w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 text-[length:calc(15px*var(--fs))] font-semibold text-navy-900 focus:border-navy-600 focus:outline-none md:w-[240px]"
            >
              <option value="">All streets</option>
              {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          {canExport && (
            <div className="grid grid-cols-2 gap-2 md:flex">
              <Button variant="secondary" icon={<FileDown className="size-4" />} onClick={() => exportPdf(report())} disabled={!summary || !areas}>
                Export PDF
              </Button>
              <Button variant="secondary" icon={<Sheet className="size-4" />} onClick={() => void exportExcel(report())} disabled={!summary || !areas}>
                Export Excel
              </Button>
            </div>
          )}
        </div>
      </Card>
      <Panel title={street ? `Overview: ${street}` : 'Barangay overview'} subtitle="Counts from the resident records" >
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          {items.map(([label, v]) => (
            <div key={label}>
              <dt className="label-caps">{label}</dt>
              <dd className="mt-1.5 font-display text-[length:calc(30px*var(--fs))] leading-none font-extrabold text-navy-900">{v ?? '–'}</dd>
            </div>
          ))}
        </dl>
      </Panel>
      <Panel title={street ? `${street}: population figures` : 'Residents and households per area'} subtitle="For community and ayuda planning" >
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

/**
 * The signed-in official's own recent actions (from the activity log), so each
 * person can see what they recorded, scheduled or decided. The full log for
 * everyone stays with the System Administrator (Activity Log).
 */
export function MyRecentActivity({ className }: { className?: string }) {
  const { user } = useAuth()
  // Makes sure sample records are in the log before it is read.
  ensureSampleVisit()
  if (!user) return null
  const mine = listAudit().filter((e) => e.userId === user.id).slice(0, 6)
  return (
    <Panel className={className} title="My recent activity" subtitle="What you recorded in the system" bodyClassName="px-0 py-0">
      {mine.length === 0 ? <p className="px-5 py-4 text-[length:calc(15.5px*var(--fs))] text-ink-muted">Nothing recorded yet.</p> : (
        <ul className="divide-y divide-line-soft">
          {mine.map((e) => (
            <li key={e.id} className="flex flex-col gap-0.5 px-5 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
              <span className="min-w-0">
                <span className="block text-[length:calc(15.5px*var(--fs))] font-semibold break-words text-navy-900">{e.action}</span>
                <span className="block text-[length:calc(14.5px*var(--fs))] text-ink-nav">{e.module}</span>
              </span>
              <span className="shrink-0 text-[length:calc(14.5px*var(--fs))] text-ink-nav">{formatDateTime(e.timestamp)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
