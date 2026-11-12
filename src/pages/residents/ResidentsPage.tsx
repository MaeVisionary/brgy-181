import { RowList } from '@/components/ui/RowList'
import { Pagination } from '@/components/ui/Pagination'
import { Search, Upload } from '@/icons'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/ui/Button'
import { Select, TextInput } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Panel'
import { useAsync } from '@/hooks/useAsync'
import { AREAS } from '@/mocks/residents'
import { listHouseholds, listResidents, findByAny } from '@/services/residentService'
import { ImportPanel } from './ImportPage'
import { RegistrationBadge, SectorBadges, age, fullName } from './common'
import { useStickyState } from '@/hooks/useStickyState'

const PAGE = 15
type Sort = 'name' | 'age' | 'area'

/** Resident master list (FR12): search, filter, sort, paginate. */
export function ResidentsPage() {
  const { can } = useAuth()
  const navigate = useNavigate()
  const residents = useAsync(listResidents).data
  const households = useAsync(listHouseholds).data
  const [q, setQ] = useStickyState('q', '')
  const [area, setArea] = useState('')
  const [sector, setSector] = useState('')
  const [voter, setVoter] = useState('')
  const [sort, setSort] = useStickyState<Sort>('sort', 'name')
  const [page, setPage] = useStickyState('page', 0)

  const hhNo = (id: string) => households?.find((h) => h.id === id)?.householdNo ?? ''

  const rows = useMemo(() => {
    let list = residents ?? []
    const t = q.trim().toLowerCase()
    if (t) {
      // Any number (resident, household, family, earlier numbers), name, address or contact.
      const hit = new Set(findByAny(t).residents.map((r) => r.id))
      list = list.filter((r) => hit.has(r.id) || `${fullName(r)} ${r.residentNo} ${hhNo(r.householdId)} ${r.houseNo} ${r.street}`.toLowerCase().includes(t))
    }
    if (area) list = list.filter((r) => r.street === area)
    if (sector) list = list.filter((r) => r.sectors[sector as keyof typeof r.sectors])
    if (voter) list = list.filter((r) => (voter === 'yes' ? r.voter : !r.voter))
    const sorted = [...list]
    sorted.sort((a, b) => (sort === 'age' ? age(b) - age(a) : sort === 'area' ? a.street.localeCompare(b.street) || a.lastName.localeCompare(b.lastName) : a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)))
    return sorted
  }, [residents, q, area, sector, voter, sort])

  const [importing, setImporting] = useState(false)
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
          can('residents.import') && (
            <Button variant={importing ? 'secondary' : 'primary'} icon={<Upload className="size-4" />} onClick={() => setImporting((x) => !x)}>
              {importing ? 'Hide import' : 'Import Master List'}
            </Button>
          )
        }
      />
      {importing && (
        <Card className="mb-4 p-4">
          <ImportPanel onClose={() => setImporting(false)} />
        </Card>
      )}
      <Card>
        <div className="grid grid-cols-1 gap-2 border-b border-line-soft p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle" />
            <TextInput className="pl-9" placeholder="Search any number, name, address or contact" value={q} onChange={(e) => reset(() => setQ(e.target.value))} aria-label="Search residents" />
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
        <RowList rows={rows.slice(page * PAGE, page * PAGE + PAGE).map((r) => ({ key: r.id, to: `/residents/${r.id}`, title: fullName(r), subtitle: r.residentNo }))} />
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[900px] text-[length:calc(15px*var(--fs))]">
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
                    <span className="block text-[length:calc(13.5px*var(--fs))] text-ink-muted">{r.residentNo}</span>
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
        <Pagination page={page} pages={Math.max(1, Math.ceil(rows.length / PAGE))} total={rows.length} size={PAGE} onPage={setPage} noun="residents" />
      </Card>
    </>
  )
}
