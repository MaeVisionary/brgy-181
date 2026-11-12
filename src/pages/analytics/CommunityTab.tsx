import { RowList } from '@/components/ui/RowList'
import { useMemo, useState } from 'react'
import { AreaChart } from '@/components/charts/AreaChart'
import { Panel } from '@/components/ui/Panel'
import { StatCard } from '@/components/ui/StatCard'
import { useAsync } from '@/hooks/useAsync'
import { cn } from '@/lib/cn'
import { getAreaBreakdown, listHouseholds, listResidents } from '@/services/residentService'

/**
 * Community and ayuda planning (study §1.4, FR16): choose the affected areas and
 * see how many residents, households and vulnerable residents live there.
 * Uses the resident records only; no disaster or affected list is assumed.
 */
export function CommunityTab() {
  const residents = useAsync(listResidents).data
  const households = useAsync(listHouseholds).data
  const areas = useAsync(getAreaBreakdown).data
  const [selected, setSelected] = useState<string[]>([])

  const pick = (a: string) => setSelected((s) => (s.includes(a) ? s.filter((x) => x !== a) : [...s, a]))

  const totals = useMemo(() => {
    if (!residents || !households) return null
    const inArea = (street: string) => selected.length === 0 || selected.includes(street)
    const rs = residents.filter((r) => inArea(r.street))
    const hs = households.filter((h) => inArea(h.street))
    return {
      residents: rs.length,
      households: hs.length,
      families: hs.reduce((n, h) => n + h.families.length, 0),
      seniors: rs.filter((r) => r.sectors.seniorCitizen).length,
      pwds: rs.filter((r) => r.sectors.pwd).length,
      solo: rs.filter((r) => r.sectors.soloParent).length,
      fourPs: rs.filter((r) => r.sectors.fourPs).length,
      beneficiaries: rs.filter((r) => r.sectors.programBeneficiary).length,
    }
  }, [residents, households, selected])

  return (
    <>

      <Panel title="Affected Areas" subtitle="For example, the streets reached by flooding during a typhoon. No areas selected = whole barangay.">
        <div className="flex flex-wrap gap-2">
          {(areas ?? []).map((a) => (
            <button
              key={a.area}
              type="button"
              onClick={() => pick(a.area)}
              aria-pressed={selected.includes(a.area)}
              className={cn(
                'bmis-press rounded-full border px-3.5 py-1.5 text-[length:calc(15px*var(--fs))] font-semibold',
                selected.includes(a.area) ? 'border-navy-900 bg-navy-900 text-white' : 'border-line bg-surface text-navy-900 hover:bg-sky-50',
              )}
            >
              {a.area}
            </button>
          ))}
          {selected.length > 0 && (
            <button type="button" onClick={() => setSelected([])} className="px-2 text-[length:calc(14.5px*var(--fs))] font-semibold text-info hover:underline">
              Clear
            </button>
          )}
        </div>
      </Panel>

      <section className="mt-4">
        <p className="label-caps mb-2">Affected {selected.length ? `(${selected.join(', ')})` : '(whole barangay)'}</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Residents" value={totals?.residents ?? null} />
          <StatCard label="Households" value={totals?.households ?? null} />
          <StatCard label="Families" value={totals?.families ?? null} />
          <StatCard label="Senior Citizens" value={totals?.seniors ?? null} />
          <StatCard label="PWDs" value={totals?.pwds ?? null} />
          <StatCard label="Solo Parents" value={totals?.solo ?? null} />
          <StatCard label="4Ps Members" value={totals?.fourPs ?? null} />
          <StatCard label="Program Beneficiaries" value={totals?.beneficiaries ?? null} />
        </div>
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Panel title="Residents and Households by Area">
          {areas ? <AreaChart data={areas} /> : <div className="h-[244px] animate-pulse rounded bg-surface-muted" />}
        </Panel>
        <Panel title="Vulnerable Sectors by Area" bodyClassName="px-0 py-0">
          <RowList rows={(areas ?? []).map((a) => ({ key: a.area, title: a.area, subtitle: `Senior ${a.seniorCitizens} · PWD ${a.pwds} · Solo parent ${a.soloParents} · 4Ps ${a.fourPsMembers}` }))} />
          <table className="hidden w-full text-[length:calc(15px*var(--fs))] md:table">
            <thead>
              <tr className="bg-surface-muted text-left">
                {['Area', 'Senior', 'PWD', 'Solo P.', '4Ps'].map((h) => <th key={h} className="label-caps px-3 py-2.5 first:pl-5">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {(areas ?? []).map((a) => (
                <tr key={a.area} className={cn('border-t border-line-soft', selected.includes(a.area) && 'bg-sky-50')}>
                  <td className="px-3 py-2 pl-5 font-semibold text-navy-900">{a.area}</td>
                  <td className="px-3 py-2 tabular-nums">{a.seniorCitizens}</td>
                  <td className="px-3 py-2 tabular-nums">{a.pwds}</td>
                  <td className="px-3 py-2 tabular-nums">{a.soloParents}</td>
                  <td className="px-3 py-2 tabular-nums">{a.fourPsMembers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </section>
    </>
  )
}
