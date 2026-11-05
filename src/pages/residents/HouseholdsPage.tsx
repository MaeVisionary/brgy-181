import { ArrowLeft, Home, Users } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
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
  return (
    <>
      <PageHeader title="Households" subtitle="A household is everyone living at one address. It can contain more than one family." actions={<SampleBadge />} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(households ?? []).map((h) => {
          const n = residents?.filter((r) => r.householdId === h.id).length ?? 0
          return (
            <Link key={h.id} to={`/residents/households/${h.id}`} className="block">
              <Card className="h-full px-5 py-4 transition-colors hover:bg-sky-50">
                <span className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-display text-[15px] font-extrabold text-navy-900"><Home className="size-4" /> {h.householdNo}</span>
                  {h.families.length > 1 && <Badge tone="info">{h.families.length} families</Badge>}
                </span>
                <span className="mt-1 block text-[13px] text-navy-900">{h.houseNo} {h.street}</span>
                <span className="mt-2 flex items-center gap-1.5 text-[12px] text-ink-muted"><Users className="size-3.5" /> {n} residents · {h.families.map((f) => f.name).join(', ')}</span>
              </Card>
            </Link>
          )
        })}
      </div>
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
