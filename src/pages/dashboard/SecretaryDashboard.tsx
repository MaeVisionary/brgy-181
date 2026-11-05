import { BarChart3, FileClock, ShieldCheck, UserRoundPen } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/auth/useAuth'
import { PurokChart } from '@/components/charts/PurokChart'
import { ButtonLink } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { StatCard, TaskTile } from '@/components/ui/StatCard'
import { useAsync } from '@/hooks/useAsync'
import { formatDateTime, formatNumber, greeting } from '@/lib/format'
import { getPopulationSummary, getPurokBreakdown, getResidentQueueCounts } from '@/services/residentService'

/**
 * Barangay Secretary dashboard (matches the Final Inspo frame).
 * Every figure is computed from the resident records via the service layer.
 * Document, case and equipment counters join this page as those modules are built.
 */
export function SecretaryDashboard() {
  const { user } = useAuth()
  const [asOf] = useState(() => new Date())
  const summary = useAsync(getPopulationSummary)
  const puroks = useAsync(getPurokBreakdown)
  const queues = useAsync(getResidentQueueCounts)

  const s = summary.data
  const q = queues.data
  const pending = q ? q.registrationsForReview + q.pendingChangeRequests : null
  const firstName = user?.fullName.split(' ')[0] ?? ''

  return (
    <>
      <PageHeader
        eyebrow={`Overview · As of ${formatDateTime(asOf)}`}
        title={`${greeting(asOf)}, ${firstName}`}
        subtitle="Barangay-wide summary of residents, programs and pending work."
        actions={
          <ButtonLink to="/reports" icon={<BarChart3 className="size-4" />}>
            Reports
          </ButtonLink>
        }
      />

      <section aria-label="Population summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard label="Total residents" value={s?.totalResidents ?? null} />
        <StatCard label="Households" value={s?.totalHouseholds ?? null} />
        <StatCard label="Senior citizens" value={s?.seniorCitizens ?? null} />
        <StatCard label={<>PWD<span className="normal-case">s</span></>} value={s?.pwds ?? null} />
        <StatCard label="Solo parents" value={s?.soloParents ?? null} />
        <StatCard label={<>4P<span className="normal-case">s</span> members</>} value={s?.fourPsMembers ?? null} />
        <StatCard label="Program beneficiaries" value={s?.programBeneficiaries ?? null} />
        <StatCard label="Pending actions" value={pending} attention={!!pending} to="/residents/registrations" />
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <Panel title="Population by Purok" subtitle="Registered residents and households per area" icon={<BarChart3 className="size-[18px]" />}>
          {puroks.data ? <PurokChart data={puroks.data} /> : <div className="h-[244px] animate-pulse rounded bg-surface-muted" />}
        </Panel>

        <Panel
          title="Ayuda Planning"
          subtitle="Vulnerable residents per purok"
          icon={<ShieldCheck className="size-[18px]" />}
          bodyClassName="px-0 py-0"
          footer={
            <div className="flex items-center justify-between gap-3">
              <p className="text-[12.5px] font-semibold text-navy-900">
                Total: {s ? formatNumber(s.totalResidents) : '–'} residents · {s ? formatNumber(s.totalHouseholds) : '–'} households
              </p>
              <ButtonLink to="/analytics" size="sm">
                Open planning
              </ButtonLink>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left">
                  <th className="label-caps px-5 py-2.5 font-semibold">Area</th>
                  <th className="label-caps px-2 py-2.5 text-right font-semibold">Senior</th>
                  <th className="label-caps px-2 py-2.5 text-right font-semibold">PWD</th>
                  <th className="label-caps px-2 py-2.5 text-right font-semibold">Solo P.</th>
                  <th className="label-caps px-5 py-2.5 text-right font-semibold">
                    4P<span className="normal-case">s</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {(puroks.data ?? []).map((p) => (
                  <tr key={p.purok} className="border-t border-line-soft">
                    <td className="px-5 py-2.5 font-display font-bold text-navy-900">{p.purok}</td>
                    <td className="px-2 py-2.5 text-right font-semibold text-navy-900 tabular-nums">{p.seniorCitizens}</td>
                    <td className="px-2 py-2.5 text-right font-semibold text-navy-900 tabular-nums">{p.pwds}</td>
                    <td className="px-2 py-2.5 text-right font-semibold text-navy-900 tabular-nums">{p.soloParents}</td>
                    <td className="px-5 py-2.5 text-right font-semibold text-navy-900 tabular-nums">{p.fourPsMembers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </section>

      <section aria-label="Work queues" className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TaskTile
          icon={<ShieldCheck className="size-4" />}
          label="Verification Queue"
          count={q?.registrationsForReview ?? null}
          to="/residents/registrations"
        />
        <TaskTile
          icon={<UserRoundPen className="size-4" />}
          label="Change Requests"
          count={q?.pendingChangeRequests ?? null}
          to="/residents/change-requests"
        />
        <div className="hidden items-center gap-2 rounded-[10px] border border-dashed border-line px-4 py-3 text-[12px] text-ink-muted sm:col-span-2 sm:flex">
          <FileClock className="size-4 shrink-0" />
          Document, KP hearing and equipment counters appear here once those modules are built (Phases 5–7).
        </div>
      </section>
    </>
  )
}
