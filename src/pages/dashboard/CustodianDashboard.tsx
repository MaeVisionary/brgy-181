import { ChevronRight, PackagePlus } from '@/icons'
import { Badge } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { Panel } from '@/components/ui/Panel'
import { BORROWING } from '@/config/barangay'
import { useAsync } from '@/hooks/useAsync'
import { useDocActor } from '@/hooks/useDocActor'
import { formatDate, formatDateTime } from '@/lib/format'
import { availableQty, borrowedQty, listBorrowings, listEquipment, returnState } from '@/services/equipmentService'
import { RETURN_BADGE } from '@/pages/equipment/badges'
import { DashHeader, ListPanel, Row, Stat, ViewAll } from './shared'

/** Property Custodian: barangay equipment and borrowing transactions. */
export function CustodianDashboard() {
  const actor = useDocActor()!
  const equipment = useAsync(listEquipment).data
  const borrowings = useAsync(() => listBorrowings(actor), [actor]).data

  const sum = (f: (e: NonNullable<typeof equipment>[number]) => number) => (equipment ? equipment.reduce((n, e) => n + f(e), 0) : null)
  const released = borrowings?.filter((b) => b.status === 'released') ?? null
  const overdue = released?.filter((b) => returnState(b) === 'overdue') ?? null
  const upcoming = released?.filter((b) => ['due_soon', 'grace'].includes(returnState(b))) ?? null
  const pending = borrowings?.filter((b) => b.status === 'pending') ?? null

  return (
    <>
      <DashHeader
        actionInGreeting
        subtitle={`Barangay equipment and borrowing. Borrowing period ${BORROWING.periodDays} days plus a ${BORROWING.graceDays}-day grace period.`}
        actions={<ButtonLink to="/inventory" icon={<PackagePlus className="size-4" />}>Equipment Records</ButtonLink>}
      />
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total equipment units" value={sum((e) => e.totalQty)} to="/inventory" />
        <Stat label="Available now" value={sum((e) => availableQty(e))} to="/inventory" />
        <Stat label="Currently borrowed" value={sum((e) => borrowedQty(e.id))} to="/borrowing" />
        <Stat label="Pending requests" value={pending?.length ?? null} attention={!!pending?.length} to="/borrowing" />
        <Stat label="Upcoming returns" value={upcoming?.length ?? null} to="/borrowing" />
        <Stat label="Overdue returns" value={overdue?.length ?? null} attention={!!overdue?.length} to="/borrowing" />
        <Stat label="Damaged units" value={sum((e) => e.damagedQty)} to="/inventory" />
        <Stat label="Missing units" value={sum((e) => e.missingQty)} to="/inventory" />
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-2">
        <ListPanel
          dark
          title="Requests to review"
          subtitle="Check availability, then approve"
          items={pending}
          to="/borrowing"
          empty="No pending requests."
          render={(b) => <Row to={`/borrowing/${b.id}`} title={`${b.refNo} · ${b.borrowerName}`} meta={`Date of use ${formatDate(b.dateOfUse)}`} right={<Badge tone="warning">Pending</Badge>} />}
        />
        <ListPanel
          title="Returns to watch"
          subtitle="Due soon, in grace period, or overdue"
          items={released?.filter((b) => returnState(b) !== 'on_time') ?? null}
          to="/borrowing"
          empty="No returns due soon."
          render={(b) => {
            const s = returnState(b)
            return <Row to={`/borrowing/${b.id}`} title={`${b.refNo} · ${b.borrowerName}`} meta={`Due ${formatDate(b.dueAt!)} · grace ends ${formatDate(b.graceEndsAt!)}`} right={<Badge tone={RETURN_BADGE[s].tone}>{RETURN_BADGE[s].label}</Badge>} />
          }}
        />
      </section>

      <Panel className="mt-4" title="Equipment records" actions={<ViewAll to="/inventory" />} bodyClassName="px-0 py-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-[15px]">
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

      <ListPanel
        className="mt-4"
        title="Recent transactions"
        items={borrowings ? borrowings.flatMap((b) => b.history.map((h) => ({ b, h }))).sort((x, y) => y.h.at.localeCompare(x.h.at)).slice(0, 6) : null}
        empty="No transactions yet."
        render={({ b, h }) => <Row to={`/borrowing/${b.id}`} title={`${h.action} · ${b.refNo}`} meta={`${b.borrowerName} · ${formatDateTime(h.at)}`} right={<ChevronRight className="size-4 text-ink-subtle" />} />}
      />
    </>
  )
}
