import { Boxes, Info, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { GreetingCard } from '@/components/ui/GreetingCard'
import { Card, Panel } from '@/components/ui/Panel'
import { CHAIRMAN, OFFICIALS, SECRETARY, officialByPosition } from '@/config/barangay'
import { NAVIGATION } from '@/config/navigation'
import { PERMISSION_LABELS, ROLES } from '@/config/permissions'
import { formatDateTime, initials } from '@/lib/format'
import { mockUsers } from '@/mocks/users'
import { listAudit } from '@/services/auditService'
import type { RoleId } from '@/types/auth'
import { DashHeader, ListPanel, PopulationByStreet, Row, Stat } from './shared'

function CouncilList({ highlight }: { highlight?: string }) {
  const kagawads = officialByPosition('Barangay Kagawad')
  const Person = ({ name, position }: { name: string; position: string }) => (
    <li className={`flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-2 ${highlight === name ? 'bg-sky-100' : ''}`}>
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-navy-900 text-[13px] font-semibold text-white">{initials(name)}</span>
      <span>
        <span className="block text-[15px] font-semibold text-navy-900">{name}</span>
        <span className="block text-[13.5px] text-ink-muted">{position}</span>
      </span>
    </li>
  )
  return (
    <Panel className="self-start" title="Barangay officials" subtitle="Elected and appointed officials of Barangay 181">
      <ul className="grid gap-1 sm:grid-cols-2">
        <Person name={CHAIRMAN.name} position="Barangay Chairman" />
        <Person name={SECRETARY.name} position="Barangay Secretary" />
        {kagawads.map((k) => <Person key={k.id} name={k.name} position="Barangay Kagawad" />)}
        {officialByPosition('Barangay Treasurer').map((t) => <Person key={t.id} name={t.name} position="Barangay Treasurer" />)}
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
      <DashHeader overview="Barangay Overview" subtitle="Barangay Council member view: community summaries and reports permitted for your account." />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <PopulationByStreet />
          <Card className="flex items-start gap-3 px-5 py-4 text-[15px] text-navy-900">
            <Info className="mt-0.5 size-4 shrink-0 text-info" />
            <span>
              Your account shows community summaries and barangay reports. Access to other modules, such as cases or resident records for an assigned
              responsibility, is granted per account by the System Administrator.
            </span>
          </Card>
        </div>
        <CouncilList highlight={user?.fullName} />
      </div>
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
      <section className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel title="Accounts per role">
          <ul className="space-y-2">
            {byRole.map(({ role, n }) => (
              <li key={role} className="flex items-center justify-between text-[15px]">
                <span className="text-navy-900">{ROLES[role].name}</span>
                <span className="font-semibold tabular-nums text-navy-900">{n}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="System status">
          <dl className="space-y-2.5 text-[15px]">
            {[
              ['Application', 'Running'],
              ['Database', 'Not connected'],
              ['Backups', 'Not yet set up'],
              ['Email notifications', 'Not configured'],
            ].map(([k, v]) => (
              <div key={k} className="border-b border-line-soft pb-2.5 last:border-0 last:pb-0">
                <dt className="text-[14px] text-ink-muted">{k}</dt>
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

/** Other authorized personnel: only the modules granted to this account. */
export function StaffDashboard() {
  const { role, canAny, permissions } = useAuth()
  const modules = role ? NAVIGATION[role.portal].flatMap((g) => (g.children ? g.children : g.path ? [{ label: g.label, path: g.path, anyOf: g.anyOf }] : [])).filter((l) => l.path !== '/dashboard' && l.path !== '/notifications' && (!l.anyOf || canAny(l.anyOf))) : []
  return (
    <>
      <DashHeader overview="Your Overview" subtitle="Your access is configured per account by the System Administrator." />
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Your assigned modules">
          {modules.length === 0 ? <p className="text-[15px] text-ink-muted">No modules have been assigned to this account yet.</p> : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {modules.map((m) => (
                <li key={m.path}><Link to={m.path} className="flex items-center gap-2 rounded-[var(--radius-control)] border border-line px-3 py-2.5 text-[15px] font-semibold text-navy-900 hover:bg-sky-50"><Boxes className="size-4" />{m.label}</Link></li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Permissions on this account">
          <ul className="space-y-1.5 text-[15px] text-navy-900">
            {[...permissions].map((p) => <li key={p} className="flex items-center gap-2"><Users className="size-3.5 text-ink-subtle" />{PERMISSION_LABELS[p]}</li>)}
          </ul>
        </Panel>
      </div>
    </>
  )
}

export { CouncilList, OFFICIALS }
