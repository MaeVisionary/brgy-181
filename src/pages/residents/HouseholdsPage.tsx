import { RowList } from '@/components/ui/RowList'
import { ChevronRight, Home, Search, Users } from '@/icons'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BackLink } from '@/components/ui/BackLink'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination, usePaged } from '@/components/ui/Pagination'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, Panel } from '@/components/ui/Panel'
import { useAsync } from '@/hooks/useAsync'
import { addFamily, createHousehold, getHousehold, listHouseholds, listResidents } from '@/services/residentService'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/ui/Button'
import { FieldLabel, Select, TextInput } from '@/components/ui/Field'
import { ServiceError } from '@/services/mockApi'
import { NotFound } from '@/pages/system/NotFound'
import { SectorBadges, age, fullName } from './common'
import { useStickyState } from '@/hooks/useStickyState'

/** Households: everyone at one address; one household can hold several families (study §1.4). */
export function HouseholdsPage() {
  const households = useAsync(listHouseholds).data
  const residents = useAsync(listResidents).data
  const navigate = useNavigate()
  const [query, setQuery] = useStickyState('query', '')
  const [street, setStreet] = useStickyState('street', '')

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
        [h.householdNo, h.legacyNo ?? '', `${h.houseNo} ${h.street}`, h.address, ...h.families.map((f) => f.name), ...h.families.map((f) => f.familyNo), ...members.map((m) => fullName(m)), ...members.map((m) => m.residentNo), ...members.map((m) => m.contactNo ?? '')].some((t) => t.toLowerCase().includes(q))),
  )
  const paged = usePaged(shown)
  const loading = !households || !residents

  return (
    <>
      <PageHeader title="Households" subtitle="A household is everyone living at one address. It can contain more than one family." />
      <NewHouseholdPanel streets={streets} onCreated={(id) => navigate(`/residents/households/${id}`)} />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line-soft p-4 sm:flex-row sm:items-center">
          <label className="relative block flex-1">
            <span className="sr-only">Search households</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search any number, address, name or contact"
              className="h-11 w-full rounded-[var(--radius-control)] border border-line bg-surface pr-3 pl-9 text-[length:calc(15.5px*var(--fs))] text-navy-900 placeholder:text-ink-subtle focus:border-navy-600 focus:outline-none"
            />
          </label>
          <select
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            aria-label="Filter by street"
            className="h-11 rounded-[var(--radius-control)] border border-line bg-surface px-3 text-[length:calc(15.5px*var(--fs))] text-navy-900 focus:border-navy-600 focus:outline-none sm:w-52"
          >
            <option value="">All streets</option>
            {streets.map((s) => <option key={s}>{s}</option>)}
          </select>
          <span className="text-[length:calc(14.5px*var(--fs))] whitespace-nowrap text-ink-muted">
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
            action={(q || street) ? <button type="button" onClick={() => { setQuery(''); setStreet('') }} className="text-[length:calc(15px*var(--fs))] font-semibold text-info hover:underline">Clear search</button> : undefined}
          />
        ) : (
          <>
            {/* Desktop and tablet: table */}
            <table className="hidden w-full text-[length:calc(15.5px*var(--fs))] xl:table">
              <thead>
                <tr className="bg-surface-muted text-left">
                  {['Household no.', 'Address', 'Families', 'Head of family', 'Residents', ''].map((t, i) => <th key={i} className="label-caps px-4 py-2.5 align-middle">{t}</th>)}
                </tr>
              </thead>
              <tbody>
                {paged.slice.map(({ h, members, heads }) => (
                  <tr key={h.id} onClick={() => navigate(`/residents/households/${h.id}`)} className="cursor-pointer border-t border-line-soft hover:bg-sky-50">
                    <td className="px-4 py-3.5 align-middle whitespace-nowrap">
                      <Link to={`/residents/households/${h.id}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-2 leading-none font-semibold text-navy-900 hover:underline">
                        <Home className="size-4 shrink-0 text-ink-muted" />
                        <span>{h.householdNo}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 align-middle text-navy-900">{h.houseNo} {h.street}</td>
                    <td className="px-4 py-3.5 align-middle">
                      {h.families.length > 1 && (
                        <span className="mb-1 inline-flex items-center gap-1 rounded-md bg-navy-900 px-2 py-0.5 text-[length:calc(14px*var(--fs))] font-semibold text-white">
                          <Users className="size-3.5" /> {h.families.length} families
                        </span>
                      )}
                      <span className="block text-navy-900">{h.families.map((f) => f.name).join(', ')}</span>
                    </td>
                    <td className="px-4 py-3.5 align-middle text-ink-nav">{heads.map((m) => fullName(m)).join(', ') || '–'}</td>
                    <td className="px-4 py-3.5 align-middle font-semibold tabular-nums text-navy-900">{members.length}</td>
                    <td className="px-3 py-3.5 align-middle text-ink-subtle"><ChevronRight className="size-4" /></td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Phones: one row per household */}
            <ul className="divide-y divide-line-soft xl:hidden">
              {paged.slice.map(({ h, members }) => (
                <li key={h.id}>
                  <Link to={`/residents/households/${h.id}`} className="flex items-center gap-3 px-4 py-3.5 active:bg-sky-50">
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 font-semibold text-navy-900">
                        <Home className="size-4 text-ink-muted" /> {h.householdNo}
                        {h.families.length > 1 && <span className="rounded-md bg-navy-900 px-2 py-0.5 text-[length:calc(13.5px*var(--fs))] font-semibold text-white">{h.families.length} families</span>}
                      </span>
                      <span className="block text-[length:calc(15px*var(--fs))] text-navy-900">{h.houseNo} {h.street}</span>
                      <span className="mt-0.5 flex items-start gap-1.5 text-[length:calc(14px*var(--fs))] text-ink-muted"><Users className="icon-line w-3.5" /> {members.length} residents · {h.families.map((f) => f.name).join(', ')}</span>
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

const hasSector = (m: { sectors: object }) => Object.values(m.sectors).some(Boolean)

export function HouseholdDetailPage() {
  const { id = '' } = useParams()
  const { user, can } = useAuth()
  const [tick, setTick] = useState(0)
  const { data, loading } = useAsync(() => getHousehold(id), [id, tick])
  const [famName, setFamName] = useState('')
  const [famError, setFamError] = useState('')
  const [busy, setBusy] = useState(false)
  if (loading) return <div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />
  if (!data) return <NotFound />
  const { household, members } = data
  return (
    <>
      <BackLink fallbackTo="/residents/households" fallbackLabel="Households" />
      <PageHeader eyebrow={`Household Number ${household.householdNo}`} title={household.address} subtitle={`${household.families.length} famil${household.families.length > 1 ? 'ies' : 'y'} · ${members.length} residents`} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {household.families.map((f) => (
          <Panel key={f.id} keepSubtitle title={f.name} subtitle={`${f.familyNo} · Head: ${members.find((m) => m.id === f.headResidentId) ? fullName(members.find((m) => m.id === f.headResidentId)!) : 'not set yet'}`} bodyClassName="px-0 py-0">
            <RowList rows={members.filter((m) => m.familyId === f.id).map((m) => ({ key: m.id, to: `/residents/${m.id}`, title: fullName(m), subtitle: `${m.relationship} · ${age(m)}` }))} />
            <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[460px] text-[length:calc(15px*var(--fs))]">
              <thead>
                <tr className="bg-surface-muted text-left">
                  {['Name', 'Relationship to the head', 'Age', 'Sectors'].map((h) => <th key={h} className="label-caps px-4 py-2 first:pl-5">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {members.filter((m) => m.familyId === f.id).map((m) => (
                  <tr key={m.id} className="border-t border-line-soft">
                    <td className="py-2.5 pr-4 pl-5"><Link to={`/residents/${m.id}`} className="font-semibold text-navy-900 hover:underline">{fullName(m)}</Link></td>
                    <td className="px-4 py-2.5 text-ink-nav">{m.relationship}</td>
                    <td className="px-4 py-2.5 tabular-nums text-navy-900">{age(m)}</td>
                    <td className="px-4 py-2.5">{hasSector(m) ? <SectorBadges r={m} /> : <span className="text-[length:calc(14px*var(--fs))] text-ink-muted">None</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </Panel>
        ))}
      </div>
      {can('residents.update') && user && (
        <Panel className="mt-4" title="Add a family to this household" subtitle="For another family living at the same address. It gets its own Family Number.">
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={async (e) => {
              e.preventDefault()
              setBusy(true); setFamError('')
              try { await addFamily(household.id, famName, user); setFamName(''); setTick((t) => t + 1) }
              catch (err) { setFamError(err instanceof ServiceError ? err.message : 'Could not add the family.') }
              finally { setBusy(false) }
            }}
          >
            <div className="flex-1"><FieldLabel label="Family name"><TextInput value={famName} onChange={(e) => setFamName(e.target.value)} placeholder="e.g. Santos family" /></FieldLabel></div>
            <Button type="submit" loading={busy}>Add family</Button>
          </form>
          {famError && <p role="alert" className="mt-2 text-[length:calc(15px*var(--fs))] text-danger-ink">{famError}</p>}
          <p className="mt-2 text-[length:calc(14.5px*var(--fs))] text-ink-muted">Add members by opening a resident's profile and choosing Change household.</p>
        </Panel>
      )}
    </>
  )
}

/** New household at an address not yet on record. One household per address; duplicates are refused. */
function NewHouseholdPanel({ streets, onCreated }: { streets: string[]; onCreated: (id: string) => void }) {
  const { user, can } = useAuth()
  const [open, setOpen] = useState(false)
  const [houseNo, setHouseNo] = useState('')
  const [street, setStreet] = useState('')
  const [familyName, setFamilyName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  if (!user || !can('residents.update')) return null
  if (!open) return <div className="mb-4"><Button variant="secondary" onClick={() => setOpen(true)}>New household</Button></div>
  return (
    <Panel className="mb-4" title="New household" subtitle="Use this only for an address that has no household yet. A Household Number and Family Number are given automatically.">
      <form
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true); setError('')
          try { const h = await createHousehold({ houseNo, street, familyName }, user); onCreated(h.id) }
          catch (err) { setError(err instanceof ServiceError ? err.message : 'Could not create the household.') }
          finally { setBusy(false) }
        }}
      >
        <FieldLabel label="House number" required><TextInput value={houseNo} onChange={(e) => setHouseNo(e.target.value)} /></FieldLabel>
        <FieldLabel label="Street" required>
          <Select value={street} onChange={(e) => setStreet(e.target.value)}>
            <option value="">Choose street</option>
            {streets.map((s) => <option key={s}>{s}</option>)}
          </Select>
        </FieldLabel>
        <FieldLabel label="First family name" required><TextInput value={familyName} onChange={(e) => setFamilyName(e.target.value)} placeholder="e.g. Reyes family" /></FieldLabel>
        {error && <p role="alert" className="text-[length:calc(15px*var(--fs))] text-danger-ink sm:col-span-3">{error}</p>}
        <div className="flex gap-2 sm:col-span-3">
          <Button type="submit" loading={busy}>Create household</Button>
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
        </div>
      </form>
    </Panel>
  )
}
