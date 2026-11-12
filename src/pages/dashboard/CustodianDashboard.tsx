import { RowList } from '@/components/ui/RowList'
import { PackagePlus } from '@/icons'
import { Link } from 'react-router-dom'
import { useEffect } from 'react'
import { Badge } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { Panel } from '@/components/ui/Panel'
import { useAsync } from '@/hooks/useAsync'
import { useDocActor } from '@/hooks/useDocActor'
import { formatDate, formatShortDate } from '@/lib/format'
import { availableQty, borrowedQty, borrowingPolicy, fmtDue, listBorrowings, listEquipment, returnState, runBorrowingJobs } from '@/services/equipmentService'
import { matchesBorrowFilter, type BorrowFilter } from '@/services/borrowingFilters'
import { BORROW_STATUS, RETURN_BADGE } from '@/pages/equipment/badges'
import { itemsText } from '@/pages/equipment/BorrowingPages'
import { TodayAppointmentsPanel } from '@/pages/appointments/AppointmentPages'
import { DashHeader, ListPanel, Row, Stat, ViewAll, MyRecentActivity } from './shared'

/** Property Custodian: barangay equipment and borrowing transactions. */
export function CustodianDashboard() {
  const actor = useDocActor()!
  const equipment = useAsync(listEquipment).data
  const borrowings = useAsync(() => listBorrowings(actor), [actor]).data

  // Overdue checks write records and send notices: run after drawing, never during it.
  useEffect(() => { runBorrowingJobs() }, [])
  const sum = (f: (e: NonNullable<typeof equipment>[number]) => number) => (equipment ? equipment.reduce((n, e) => n + f(e), 0) : null)
  const by = (pred: (b: NonNullable<typeof borrowings>[number]) => boolean) => borrowings?.filter(pred) ?? null
  // Each card counts with the same filter its link opens (services/borrowingFilters).
  const f = (v: BorrowFilter) => by((b) => matchesBorrowFilter(b, v))
  const link = (v: BorrowFilter) => `/borrowing?status=${v}`
  const released = f('released')
  const overdue = f('overdue')
  const dueToday = f('due_today')
  const due48 = f('due_soon')
  const pending = f('pending')
  const toPickup = f('to_pickup')
  const review = f('returned')
  const needsAction = [...(overdue ?? []), ...(pending ?? []), ...(review ?? []), ...(toPickup?.filter((b) => b.status === 'approved') ?? [])]

  return (
    <>
      <DashHeader
        actionInGreeting
        subtitle=""
        actions={<ButtonLink to="/inventory" icon={<PackagePlus className="size-4" />}>Equipment Records</ButtonLink>}
      />
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Overdue" value={overdue?.length ?? null} attention={!!overdue?.length} to={link('overdue')} />
        <Stat label="Requests to review" value={pending?.length ?? null} attention={!!pending?.length} to={link('pending')} />
        <Stat label="Approved, awaiting pickup" value={toPickup?.length ?? null} to={link('to_pickup')} />
        <Stat label="Borrowed now" value={released?.length ?? null} to={link('released')} />
        <Stat label="Returns due today" value={dueToday?.length ?? null} to={link('due_today')} />
        <Stat label="Due soon or in grace period" value={due48?.length ?? null} to={link('due_soon')} />
        <Stat label="Under maintenance" value={sum((e) => e.maintenanceQty ?? 0)} to="/inventory" />
        <Stat label="Available now" value={sum((e) => availableQty(e))} to="/inventory" />
      </section>
      {!borrowingPolicy().confirmed && <p className="mt-3 rounded-[var(--radius-control)] bg-warning-tint px-4 py-3 text-[length:calc(16px*var(--fs))] text-navy-900">Borrowing period and grace days are not yet confirmed by the barangay.</p>}

      <TodayAppointmentsPanel />

      <ListPanel
        dark
        className="mt-4"
        title="Needs your action"
        items={borrowings ? needsAction : null}
        to="/borrowing"
        empty="Nothing needs your action."
        render={(b) => {
          const st = b.status === 'released' ? RETURN_BADGE[returnState(b)] : BORROW_STATUS[b.status]
          return <Row to={`/borrowing/${b.id}`} title={`${b.borrowerName} · ${itemsText(b)}`} meta={b.status === 'released' ? `Due ${fmtDue(b.dueAt!)}` : `Date of use ${formatDate(b.dateOfUse)}`} right={<Badge tone={st.tone}>{st.label}</Badge>} />
        }}
      />

      <Panel className="mt-4" title="Equipment records" actions={<ViewAll to="/inventory" />} bodyClassName="px-0 py-0">
        <RowList rows={(equipment ?? []).map((e) => ({ key: e.id, to: '/inventory', title: e.name, subtitle: `${e.totalQty} total · ${availableQty(e)} available` }))} />
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[560px] text-[length:calc(15px*var(--fs))]">
            <thead>
              <tr className="bg-surface-muted text-left">
                {['Equipment', 'Total', 'Available', 'Borrowed', 'Damaged', 'Missing'].map((h) => <th key={h} className="label-caps px-4 py-2.5">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {(equipment ?? []).map((e) => (
                <tr key={e.id} className="border-t border-line-soft">
                  <td className="px-4 py-2.5 font-semibold text-navy-900">{e.name}</td>
                  <td className="px-4 py-2.5 tabular-nums">{e.totalQty}</td>
                  <td className="px-4 py-2.5 tabular-nums">{availableQty(e)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{borrowedQty(e.id)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{e.damagedQty}</td>
                  <td className="px-4 py-2.5 tabular-nums">{e.missingQty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel className="mt-4" title="Recent transactions" actions={<ViewAll to="/borrowing" />} bodyClassName="px-0 py-0">
        {!borrowings ? (
          <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <div key={i} className="h-9 animate-pulse rounded bg-surface-muted" />)}</div>
        ) : (
          <ul className="divide-y divide-line-soft">
            {borrowings
              .flatMap((b) => b.history.map((h) => ({ b, h })))
              .sort((x, y) => y.h.at.localeCompare(x.h.at))
              .slice(0, 10)
              .map(({ b, h }, i) => {
                const st = activityStatus(h.action)
                return (
                  <li key={`${b.id}-${i}`}>
                    <Link to={`/borrowing/${b.id}`} className="grid min-h-11 grid-cols-[1fr_auto] items-center gap-x-3 px-5 py-2 hover:bg-sky-50">
                      <span className="font-semibold text-navy-900">{b.refNo}</span>
                      <span className={`justify-self-end rounded px-1.5 text-[length:calc(12.5px*var(--fs))] leading-6 font-semibold ${st.cls}`}>{st.label}</span>
                      <span className="truncate text-[length:calc(13.5px*var(--fs))] text-ink-muted">{b.borrowerName}</span>
                      <span className="justify-self-end text-[length:calc(13.5px*var(--fs))] whitespace-nowrap text-ink-muted">{formatShortDate(h.at)}</span>
                    </Link>
                  </li>
                )
              })}
          </ul>
        )}
      </Panel>
      <MyRecentActivity className="mt-4" />
    </>
  )
}

/** Short status for a borrowing history step, with its colour. */
function activityStatus(action: string): { label: string; cls: string } {
  const a = action.toLowerCase()
  if (a.startsWith('request submitted')) return { label: 'Submitted', cls: 'bg-info-tint text-info' }
  if (a.startsWith('encoded')) return { label: 'Encoded', cls: 'bg-neutral-tint text-ink-nav' }
  if (a.startsWith('approved')) return { label: 'Approved', cls: 'bg-success-tint text-success' }
  if (a.startsWith('released')) return { label: 'Released', cls: 'bg-[#f1ecfb] text-[#6a3fb5]' }
  if (a.startsWith('returned')) return { label: 'Returned', cls: 'bg-neutral-tint text-ink-nav' }
  if (a.startsWith('rejected')) return { label: 'Rejected', cls: 'bg-danger-tint text-danger-ink' }
  if (a.startsWith('late-return')) return { label: 'Late notice', cls: 'bg-danger-tint text-danger-ink' }
  if (a.startsWith('cancel')) return { label: 'Cancelled', cls: 'bg-neutral-tint text-ink-nav' }
  return { label: action.split(':')[0], cls: 'bg-neutral-tint text-ink-nav' }
}

