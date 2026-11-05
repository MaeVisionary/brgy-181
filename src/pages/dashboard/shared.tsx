import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { Badge } from '@/components/ui/Badge'
import { PageHeader } from '@/components/ui/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { StatCard } from '@/components/ui/StatCard'
import { formatDateTime, greeting } from '@/lib/format'
import { useAsync } from '@/hooks/useAsync'
import { getPopulationSummary } from '@/services/residentService'
import { SAMPLE_DATA_NOTICE } from '@/mocks/residents'
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
