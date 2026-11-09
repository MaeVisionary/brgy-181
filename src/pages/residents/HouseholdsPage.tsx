import { ArrowLeft, ChevronRight, Home, Search, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination, usePaged } from '@/components/ui/Pagination'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, Panel } from '@/components/ui/Panel'
import { useAsync } from '@/hooks/useAsync'
import { getHousehold, listHouseholds, listResidents } from '@/services/residentService'
import { NotFound } from '@/pages/system/NotFound'
import { SampleBadge } from '@/pages/dashboard/shared'
import { SectorBadges, age, fullName } from './common'

/** Households: everyone at one address; one household can hold several families (study §1.4). */
export function HouseholdsPage() {
  const households = useAsync(listHouseholds).data
  const residents = useAsync(listResidents).data
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [street, setStreet] = useState('')

  const rows = useMemo(
    () =>
      (households ?? []).map((h) => {
        const members = residents?.filter((r) => r.householdId === h.id) ?? []
        const heads = h.families.map((f) => members.find((m) => m.id === f.headResidentId)).filter((m): m is NonNullable<typeof m> => !!m)
        return { h, members, heads }
      }),
    [households, residents],
  )
  const streets = useMemo(() => [...new Set((households ?? []).map((h) => h.street))].sort(), [households])

  // Search matches household no., address, family names and the names of everyone in the household.
  const q = query.trim().toLowerCase()
  const shown = rows.filter(
    ({ h, members }) =>
      (!street || h.street === street) &&
      (!q ||
        [h.householdNo, `${h.houseNo} ${h.street}`, h.address, ...h.families.map((f) => f.name), ...members.map((m) => fullName(m))].some((t) => t.toLowerCase().includes(q))),
  )
  const paged = usePaged(shown)
  const loading = !households || !residents

  return (
    <>
      <PageHeader title="Households" subtitle="A household is everyone living at one address. It can contain more than one family." actions={<SampleBadge />} />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line-soft p-4 sm:flex-row sm:items-center">
          <label className="relative block flex-1">
            <span className="sr-only">Search households</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search household no., address, family or resident name"
              className="h-11 w-full rounded-[var(--radius-control)] border border-line bg-surface pr-3 pl-9 text-[13.5px] text-navy-900 placeholder:text-ink-subtle focus:border-navy-600 focus:outline-none"
            />
          </label>
          <select
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            aria-label="Filter by street"
            className="h-11 rounded-[var(--radius-control)] border border-line bg-surface px-3 text-[13.5px] text-navy-900 focus:border-navy-600 focus:outline-none sm:w-52"
          >
            <option value="">All streets</option>
            {streets.map((s) => <option key={s}>{s}</option>)}
          </select>
          <span className="text-[12.5px] whitespace-nowrap text-ink-muted">
            {shown.length} of {rows.length} households
          </span>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-11 animate-pulse rounded bg-surface-muted" />)}</div>
        ) : shown.length === 0 ? (
          <EmptyState
            icon={<Home className="size-5" />}
            title="No households found"
            body="Try another name, address or household number, or choose All streets."
            action={(q || street) ? <button type="button" onClick={() => { setQuery(''); setStreet('') }} className="text-[13px] font-semibold text-info hover:underline">Clear search</button> : undefined}
          />
        ) : (
          <>
            {/* Desktop and tablet: table */}
            <table className="hidden w-full text-[13px] md:table">
              <thead>
                <tr className="bg-surface-muted text-left">
                  {['Household no.', 'Address', 'Families', 'Head of family', 'Residents', ''].map((t, i) => <th key={i} className="label-caps px-4 py-2.5">{t}</th>)}
                </tr>
              </thead>
              <tbody>
                {paged.slice.map(({ h, members, heads }) => (
                  <tr key={h.id} onClick={() => navigate(`/residents/households/${h.id}`)} className="cursor-pointer border-t border-line-soft hover:bg-sky-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link to={`/residents/households/${h.id}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-2 font-semibold text-navy-900 hover:underline">
                        <Home className="size-4 text-ink-muted" /> {h.householdNo}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-navy-900">{h.houseNo} {h.street}</td>
                    <td className="px-4 py-3">
                      <span className="text-navy-900">{h.families.map((f) => f.name).join(', ')}</span>
                      {h.families.length > 1 && <Badge tone="info" className="ml-2">{h.families.length} families</Badge>}
                    </td>
                    <td className="px-4 py-3 text-ink-nav">{heads.map((m) => fullName(m)).join(', ') || '–'}</td>
                    <td className="px-4 py-3 tabular-nums text-navy-900">{members.length}</td>
                    <td className="px-3 py-3 text-ink-subtle"><ChevronRight className="size-4" /></td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Phones: one row per household */}
            <ul className="divide-y divide-line-soft md:hidden">
              {paged.slice.map(({ h, members }) => (
                <li key={h.id}>
                  <Link to={`/residents/households/${h.id}`} className="flex items-center gap-3 px-4 py-3.5 active:bg-sky-50">
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 font-semibold text-navy-900">
                        <Home className="size-4 text-ink-muted" /> {h.householdNo}
                        {h.families.length > 1 && <Badge tone="info">{h.families.length} families</Badge>}
                      </span>
                      <span className="block text-[13px] text-navy-900">{h.houseNo} {h.street}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink-muted"><Users className="size-3.5" /> {members.length} residents · {h.families.map((f) => f.name).join(', ')}</span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-ink-subtle" />
                  </Link>
                </li>
              ))}
            </ul>
            <Pagination page={paged.page} pages={paged.pages} total={paged.total} size={paged.size} onPage={paged.setPage} noun="households" />
          </>
        )}
      </Card>
    </>
  )
}

export function HouseholdDetailPage() {
  const { id = '' } = useParams()
  const { data, loading } = useAsync(() => getHousehold(id), [id])
  if (loading) return <div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />
  if (!data) return <NotFound />
  const { household, members } = data
  return (
    <>
      <Link to="/residents/households" className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-muted hover:text-navy-900"><ArrowLeft className="size-4" /> Households</Link>
      <PageHeader eyebrow={household.householdNo} title={household.address} subtitle={`${household.families.length} famil${household.families.length > 1 ? 'ies' : 'y'} · ${members.length} residents`} actions={<SampleBadge />} />
      <div className="grid gap-4 lg:grid-cols-2">
        {household.families.map((f) => (
          <Panel key={f.id} title={f.name} subtitle={`Head: ${fullName(members.find((m) => m.id === f.headResidentId)!)}`} bodyClassName="px-0 py-0">
            <table className="w-full text-[13px]">
              <tbody>
                {members.filter((m) => m.familyId === f.id).map((m) => (
                  <tr key={m.id} className="border-t border-line-soft first:border-0">
                    <td className="px-5 py-2.5"><Link to={`/residents/${m.id}`} className="font-semibold text-navy-900 hover:underline">{fullName(m)}</Link></td>
                    <td className="px-2 py-2.5 text-ink-muted">{m.relationship}</td>
                    <td className="px-2 py-2.5 tabular-nums">{age(m)}</td>
                    <td className="px-5 py-2.5"><SectorBadges r={m} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        ))}
      </div>
    </>
  )
}
