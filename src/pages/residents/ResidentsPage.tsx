import { ArrowDownUp, Search, Upload } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { ButtonLink } from '@/components/ui/Button'
import { Select, TextInput } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Panel'
import { useAsync } from '@/hooks/useAsync'
import { AREAS, SAMPLE_DATA_NOTICE } from '@/mocks/residents'
import { listHouseholds, listResidents } from '@/services/residentService'
import { SampleBadge } from '@/pages/dashboard/shared'
import { RegistrationBadge, SectorBadges, age, fullName } from './common'

const PAGE = 15
type Sort = 'name' | 'age' | 'area'

/** Resident master list (FR12): search, filter, sort, paginate. */
export function ResidentsPage() {
  const { can } = useAuth()
  const navigate = useNavigate()
  const residents = useAsync(listResidents).data
  const households = useAsync(listHouseholds).data
  const [q, setQ] = useState('')
  const [area, setArea] = useState('')
  const [sector, setSector] = useState('')
  const [voter, setVoter] = useState('')
  const [sort, setSort] = useState<Sort>('name')
  const [page, setPage] = useState(0)

  const hhNo = (id: string) => households?.find((h) => h.id === id)?.householdNo ?? ''

  const rows = useMemo(() => {
    let list = residents ?? []
    const t = q.trim().toLowerCase()
    if (t) list = list.filter((r) => `${fullName(r)} ${r.residentNo} ${r.houseNo} ${r.street}`.toLowerCase().includes(t))
    if (area) list = list.filter((r) => r.street === area)
    if (sector) list = list.filter((r) => r.sectors[sector as keyof typeof r.sectors])
    if (voter) list = list.filter((r) => (voter === 'yes' ? r.voter : !r.voter))
    const sorted = [...list]
    sorted.sort((a, b) => (sort === 'age' ? age(b) - age(a) : sort === 'area' ? a.street.localeCompare(b.street) || a.lastName.localeCompare(b.lastName) : a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)))
    return sorted
  }, [residents, q, area, sector, voter, sort])

  const reset = (fn: () => void) => {
    fn()
    setPage(0)
  }

  return (
    <>
      <PageHeader
        title="Resident Master List"
        subtitle="Official resident records of Barangay 181."
        actions={
          <>
            <SampleBadge />
            {can('residents.import') && <ButtonLink to="/residents/import" variant="secondary" icon={<Upload className="size-4" />}>Import CSV</ButtonLink>}
          </>
        }
      />
      <p className="mb-3 text-[12.5px] text-ink-muted">{SAMPLE_DATA_NOTICE}</p>
      <Card>
        <div className="grid gap-2 border-b border-line-soft p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle" />
            <TextInput className="pl-9" placeholder="Search name, resident no. or address" value={q} onChange={(e) => reset(() => setQ(e.target.value))} aria-label="Search residents" />
          </div>
          <Select aria-label="Area" value={area} onChange={(e) => reset(() => setArea(e.target.value))}>
            <option value="">All areas</option>
            {AREAS.map((a) => <option key={a}>{a}</option>)}
          </Select>
          <Select aria-label="Sector" value={sector} onChange={(e) => reset(() => setSector(e.target.value))}>
            <option value="">All sectors</option>
            <option value="seniorCitizen">Senior citizens</option>
            <option value="pwd">PWDs</option>
            <option value="soloParent">Solo parents</option>
            <option value="fourPs">4Ps members</option>
            <option value="programBeneficiary">Program beneficiaries</option>
          </Select>
          <Select aria-label="Voter" value={voter} onChange={(e) => reset(() => setVoter(e.target.value))}>
            <option value="">Voter: all</option>
            <option value="yes">Registered voter</option>
            <option value="no">Not a voter</option>
          </Select>
          <Select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="name">Sort: last name</option>
            <option value="age">Sort: oldest first</option>
            <option value="area">Sort: area</option>
          </Select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-[13px]">
            <thead>
              <tr className="bg-surface-muted text-left">
                {['Resident', 'Age', 'Address', 'Household', 'Contact', 'Sectors', 'Voter', 'Record'].map((h) => <th key={h} className="label-caps px-4 py-2.5">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.slice(page * PAGE, page * PAGE + PAGE).map((r) => (
                <tr key={r.id} onClick={() => navigate(`/residents/${r.id}`)} className="cursor-pointer border-t border-line-soft hover:bg-sky-50">
                  <td className="px-4 py-2.5">
                    <span className="block font-semibold text-navy-900">{r.lastName}, {r.firstName} {r.middleName}</span>
                    <span className="block text-[11.5px] text-ink-muted">{r.residentNo}</span>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">{age(r)}</td>
                  <td className="px-4 py-2.5">{r.houseNo} {r.street}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{hhNo(r.householdId)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{r.contactNo ?? <span className="text-ink-subtle">–</span>}</td>
                  <td className="px-4 py-2.5"><SectorBadges r={r} /></td>
                  <td className="px-4 py-2.5">{r.voter ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-2.5"><RegistrationBadge status={r.registrationStatus} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-line-soft px-4 py-3 text-[12.5px] text-ink-muted">
          <span className="flex items-center gap-1.5"><ArrowDownUp className="size-3.5" />{rows.length ? page * PAGE + 1 : 0}–{Math.min(rows.length, page * PAGE + PAGE)} of {rows.length} residents</span>
          <span className="flex gap-2">
            <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="rounded-md border border-line px-3 py-1 font-semibold text-navy-900 disabled:opacity-40">Previous</button>
            <button type="button" disabled={(page + 1) * PAGE >= rows.length} onClick={() => setPage((p) => p + 1)} className="rounded-md border border-line px-3 py-1 font-semibold text-navy-900 disabled:opacity-40">Next</button>
          </span>
        </div>
      </Card>
    </>
  )
}
