import { Boxes, FileText, Gavel, Info, Package, UserRound, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { StatusBadge } from '@/components/documents/DocParts'
import { Badge } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { Card, Panel } from '@/components/ui/Panel'
import { CHAIRMAN, OFFICIALS, SECRETARY, officialByPosition } from '@/config/barangay'
import { NAVIGATION } from '@/config/navigation'
import { PERMISSION_LABELS, ROLES } from '@/config/permissions'
import { getDocumentType } from '@/documents/catalog'
import { useAsync } from '@/hooks/useAsync'
import { useDocActor } from '@/hooks/useDocActor'
import { formatDateTime, initials } from '@/lib/format'
import { mockUsers } from '@/mocks/users'
import { listAudit } from '@/services/auditService'
import { STAGE_LABEL, STAGE_TONE, listCases } from '@/services/caseService'
import { listRequests } from '@/services/documentService'
import { listBorrowings } from '@/services/equipmentService'
import { getResident } from '@/services/residentService'
import { BORROW_STATUS } from '@/pages/equipment/badges'
import type { RoleId } from '@/types/auth'
import { DashHeader, ListPanel, PopulationCards, Row, Stat } from './shared'

function CouncilList({ highlight }: { highlight?: string }) {
  const kagawads = officialByPosition('Barangay Kagawad')
  const Person = ({ name, position }: { name: string; position: string }) => (
    <li className={`flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-2 ${highlight === name ? 'bg-sky-100' : ''}`}>
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-navy-900 text-[11px] font-semibold text-white">{initials(name)}</span>
      <span>
        <span className="block text-[13px] font-semibold text-navy-900">{name}</span>
        <span className="block text-[11.5px] text-ink-muted">{position}</span>
      </span>
    </li>
  )
  return (
    <Panel title="Barangay officials" subtitle="Study §1.1, official templates and case documents">
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
  const { user, can } = useAuth()
  return (
    <>
      <DashHeader subtitle="Barangay Council member view: community summaries and reports permitted for your account." />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <PopulationCards />
          <Card className="flex items-start gap-3 px-5 py-4 text-[13px] text-navy-900">
            <Info className="mt-0.5 size-4 shrink-0 text-info" />
            <span>
              Your account shows community summaries and barangay reports. Access to other modules, such as cases or resident records for an assigned
              responsibility, is granted per account by the System Administrator.
            </span>
          </Card>
          <div className="flex flex-wrap gap-2">
            {can('analytics.view') && <ButtonLink to="/analytics" variant="secondary">Community analytics</ButtonLink>}
            {can('reports.view') && <ButtonLink to="/reports" variant="secondary">Reports</ButtonLink>}
          </div>
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
      <DashHeader subtitle="Accounts, roles and permissions, activity log and system configuration." />
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
              <li key={role} className="flex items-center justify-between text-[13px]">
                <span className="text-navy-900">{ROLES[role].name}</span>
                <span className="font-semibold tabular-nums text-navy-900">{n}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="System status">
          <dl className="space-y-2.5 text-[13px]">
            {[
              ['Application', 'Frontend prototype running'],
              ['Database', 'Not connected (backend phase)'],
              ['Backups', 'Not available until the backend is set up (NFR12)'],
              ['Email notifications', 'Not configured (FR23, backend phase)'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-ink-muted">{k}</dt>
                <dd className="text-right font-semibold text-navy-900">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </section>
      <ListPanel
        title="Recent activity"
        to="/admin/activity"
        items={audit}
        empty="No activity recorded in this session yet. Report generation, exports and record access appear here."
        render={(a) => <Row to="/admin/activity" title={a.action} meta={`${mockUsers.find((u) => u.id === a.userId)?.fullName ?? a.userId} · ${formatDateTime(a.timestamp)}`} />}
      />
    </>
  )
}

/** Resident portal home: own profile, requests, complaints and borrowing. */
export function ResidentDashboard() {
  const { user } = useAuth()
  const actor = useDocActor()!
  const me = useAsync(() => getResident(user!.residentId!), [user?.residentId]).data
  const docs = useAsync(() => listRequests(actor), [actor]).data
  const cases = useAsync(() => listCases(actor), [actor]).data
  const borrowings = useAsync(() => listBorrowings(actor), [actor]).data

  const services = [
    { to: '/my/documents/new', icon: FileText, label: 'Request a document', body: 'Certificates and clearances, claimed at the Barangay Hall.' },
    { to: '/my/documents/new', icon: Gavel, label: 'Report or complain', body: 'Incident reports, blotter reports and summons requests.' },
    { to: '/my/borrowing', icon: Package, label: 'Borrow equipment', body: 'Chairs, tables, ladders and nebulizers.' },
    { to: '/my/profile', icon: UserRound, label: 'My profile', body: 'Your record and correction requests.' },
  ]

  return (
    <>
      <DashHeader subtitle="Your Barangay 181 services in one place." />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {services.map(({ to, icon: Icon, label, body }) => (
          <Link key={label} to={to} className="rounded-[var(--radius-card)] border border-line bg-surface p-4 transition-colors hover:bg-sky-50">
            <span className="grid size-9 place-items-center rounded-lg bg-sky-100 text-navy-900"><Icon className="size-[18px]" /></span>
            <span className="mt-3 block font-display text-[15px] font-bold text-navy-900">{label}</span>
            <span className="mt-0.5 block text-[12.5px] text-ink-muted">{body}</span>
          </Link>
        ))}
      </section>
      <section className="mt-4 grid gap-4 xl:grid-cols-3">
        <ListPanel title="My document requests" to="/my/documents" items={docs?.filter((d) => getDocumentType(d.typeId).category !== 'case') ?? null} empty="No requests yet."
          render={(d) => <Row to={`/my/documents/${d.id}`} title={getDocumentType(d.typeId).name} meta={d.referenceNo} right={<StatusBadge status={d.status} />} />} />
        <ListPanel title="My complaints and reports" to="/my/complaints" items={[...(docs?.filter((d) => getDocumentType(d.typeId).category === 'case').map((d) => ({ kind: 'doc' as const, d })) ?? []), ...(cases?.map((c) => ({ kind: 'case' as const, c })) ?? [])]} empty="No complaints or reports."
          render={(x) => x.kind === 'doc'
            ? <Row to={`/my/documents/${x.d.id}`} title={getDocumentType(x.d.typeId).name} meta={x.d.referenceNo} right={<StatusBadge status={x.d.status} />} />
            : <Row to={`/my/complaints/${x.c.id}`} title={`${x.c.caseNo} · ${x.c.title}`} meta={x.c.nature} right={<Badge tone={STAGE_TONE[x.c.stage]}>{STAGE_LABEL[x.c.stage]}</Badge>} />} />
        <ListPanel title="My equipment borrowing" to="/my/borrowing" items={borrowings} empty="No borrowing requests."
          render={(b) => <Row to="/my/borrowing" title={b.refNo} meta={`Date of use ${b.dateOfUse}`} right={<Badge tone={BORROW_STATUS[b.status].tone}>{BORROW_STATUS[b.status].label}</Badge>} />} />
      </section>
      {me && (
        <Card className="mt-4 flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <span className="text-[13px] text-navy-900">
            <strong>{me.firstName} {me.lastName}</strong> · {me.houseNo} {me.street} · Resident since {me.residentSince}
          </span>
          <ButtonLink to="/my/profile" variant="secondary" size="sm">View profile</ButtonLink>
        </Card>
      )}
    </>
  )
}

/** Other authorized personnel: only the modules granted to this account. */
export function StaffDashboard() {
  const { role, canAny, permissions } = useAuth()
  const modules = role ? NAVIGATION[role.portal].flatMap((g) => (g.children ? g.children : g.path ? [{ label: g.label, path: g.path, anyOf: g.anyOf }] : [])).filter((l) => l.path !== '/dashboard' && l.path !== '/notifications' && (!l.anyOf || canAny(l.anyOf))) : []
  return (
    <>
      <DashHeader subtitle="Your access is configured per account by the System Administrator." />
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Your assigned modules">
          {modules.length === 0 ? <p className="text-[13px] text-ink-muted">No modules have been assigned to this account yet.</p> : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {modules.map((m) => (
                <li key={m.path}><Link to={m.path} className="flex items-center gap-2 rounded-[var(--radius-control)] border border-line px-3 py-2.5 text-[13px] font-semibold text-navy-900 hover:bg-sky-50"><Boxes className="size-4" />{m.label}</Link></li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Permissions on this account">
          <ul className="space-y-1.5 text-[13px] text-navy-900">
            {[...permissions].map((p) => <li key={p} className="flex items-center gap-2"><Users className="size-3.5 text-ink-subtle" />{PERMISSION_LABELS[p]}</li>)}
          </ul>
        </Panel>
      </div>
    </>
  )
}

export { CouncilList, OFFICIALS }
