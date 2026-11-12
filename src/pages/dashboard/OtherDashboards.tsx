import { ChevronRight } from '@/icons'
import { Link } from 'react-router-dom'
import { STAGE_LABEL, listCases } from '@/services/caseService'
import { useAuth } from '@/auth/useAuth'
import { GreetingCard } from '@/components/ui/GreetingCard'
import { Panel } from '@/components/ui/Panel'
import { CHAIRMAN, OFFICIALS, SECRETARY, officialByPosition } from '@/config/barangay'
import { ROLES } from '@/config/permissions'
import { formatDateTime, initials } from '@/lib/format'
import { mockUsers } from '@/mocks/users'
import { listAudit } from '@/services/auditService'
import type { RoleId } from '@/types/auth'
import { DashHeader, ListPanel, PopulationByStreet, Row, Stat, MyRecentActivity } from './shared'
import { useAsync } from '@/hooks/useAsync'
import { useDocActor } from '@/hooks/useDocActor'

function CouncilList({ highlight }: { highlight?: string }) {
  const kagawads = officialByPosition('Barangay Kagawad')
  const Person = ({ name, position }: { name: string; position: string }) => (
    <li className={`flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-2 ${highlight === name ? 'bg-sky-100' : ''}`}>
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-navy-900 text-[length:calc(13px*var(--fs))] font-semibold text-white">{initials(name)}</span>
      <span className="min-w-0">
        <span className="block truncate text-[length:calc(15px*var(--fs))] font-semibold text-navy-900">{name}</span>
        <span className="block text-[length:calc(13.5px*var(--fs))] text-ink-muted">{position}</span>
      </span>
    </li>
  )
  return (
    <Panel title="Barangay officials">
      <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        <Person name={CHAIRMAN.name} position="Barangay Chairman" />
        <Person name={SECRETARY.name} position="Barangay Secretary" />
        {kagawads.map((k) => <Person key={k.id} name={k.name} position="Barangay Kagawad" />)}
        {officialByPosition('Lupon Member').map((l) => <Person key={l.id} name={l.name} position="Lupon Member" />)}
      </ul>
    </Panel>
  )
}

/** Kagawad: member of the Barangay Council; no committee assignments are documented. */
export function KagawadDashboard() {
  const { user } = useAuth()
  return (
    <>
      <DashHeader overview="Barangay Overview" subtitle="" />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <AssignedComplaints />
          <PopulationByStreet />
        </div>
        <CouncilList highlight={user?.fullName} />
      </div>
      <MyRecentActivity className="mt-4" />
    </>
  )
}

/** System Administrator: accounts, roles, activity log, system status. No resident data. */
export function AdminDashboard() {
  const active = mockUsers.filter((u) => u.status === 'active').length
  const byRole = Object.keys(ROLES).map((r) => ({ role: r as RoleId, n: mockUsers.filter((u) => u.roleId === r).length }))
  const audit = listAudit().slice(0, 6)
  return (
    <>
      <GreetingCard subtitle="Accounts, roles and permissions, activity log and system configuration." profileTo="/account" />
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="User accounts" value={mockUsers.length} to="/admin/users" />
        <Stat label="Active" value={active} to="/admin/users" />
        <Stat label="Inactive" value={mockUsers.length - active} to="/admin/users" />
        <Stat label="Roles" value={Object.keys(ROLES).length} to="/admin/roles" />
      </section>
      <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Accounts per role">
          <ul className="space-y-2">
            {byRole.map(({ role, n }) => (
              <li key={role} className="flex items-center justify-between text-[length:calc(15px*var(--fs))]">
                <span className="text-navy-900">{ROLES[role].name}</span>
                <span className="font-semibold tabular-nums text-navy-900">{n}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="System status">
          <dl className="space-y-2.5 text-[length:calc(15px*var(--fs))]">
            {[
              ['Application', 'Running'],
              ['Database', 'Not connected'],
              ['Backups', 'Not yet set up'],
              ['Email notifications', 'Not configured'],
            ].map(([k, v]) => (
              <div key={k} className="border-b border-line-soft pb-2.5 last:border-0 last:pb-0">
                <dt className="text-[length:calc(14px*var(--fs))] text-ink-muted">{k}</dt>
                <dd className="font-semibold text-navy-900">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </section>
      <ListPanel
        className="mt-4"
        title="Recent activity"
        to="/admin/activity"
        items={audit}
        empty="No activity recorded in this session yet. Report generation, exports and record access appear here."
        render={(a) => <Row to="/admin/activity" title={a.action} meta={`${mockUsers.find((u) => u.id === a.userId)?.fullName ?? a.userId} · ${formatDateTime(a.timestamp)}`} />}
      />
    </>
  )
}


export { CouncilList, OFFICIALS }


/** Complaints the Kagawad was assigned to (shown only when there are any). */
function AssignedComplaints() {
  const actor = useDocActor()!
  const cases = useAsync(() => listCases(actor), [actor]).data?.filter((c) => c.assignedTo?.includes(actor.user.id)) ?? []
  if (!cases.length) return null
  return (
    <Panel title="Assigned complaints" bodyClassName="px-0 py-0">
      <ul className="divide-y divide-line-soft">
        {cases.map((c) => (
          <li key={c.id}>
            <Link to={`/cases/${c.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-sky-50">
              <span className="min-w-0 flex-1"><span className="block truncate font-semibold text-navy-900">{c.nature}</span><span className="block text-[length:calc(14px*var(--fs))] text-ink-muted">{c.caseNo} · {STAGE_LABEL[c.stage]}</span></span>
              <ChevronRight className="size-4 shrink-0 text-ink-subtle" />
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
