import { Check, Info, Minus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '@/auth/useAuth'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { TextInput } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, Panel } from '@/components/ui/Panel'
import { APP_CONFIG } from '@/config/app'
import { BORROWING, KP, OFFICIALS, OFFICIAL_NOTES } from '@/config/barangay'
import { GRANTABLE_ROLES, GRANTABLE_STAFF_PERMISSIONS, PERMISSION_LABELS, ROLES, ROLE_PERMISSIONS } from '@/config/permissions'
import { formatDateTime, initials } from '@/lib/format'
import { mockUsers } from '@/mocks/users'
import { listAudit } from '@/services/auditService'
import { ServiceError } from '@/services/mockApi'
import { listUsers, setDisplayName, setExtraPermissions, setStatus } from '@/services/userService'
import type { Permission, RoleId, User } from '@/types/auth'
import { cn } from '@/lib/cn'

/** FR3: create, deactivate and assign roles to user accounts. */
export function UsersPage() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [open, setOpen] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const load = () => listUsers().then((u) => setUsers([...u]))
  useEffect(() => {
    load()
  }, [])
  const run = async (fn: () => Promise<unknown>) => {
    setErr(null)
    try { await fn(); await load() } catch (e) { setErr(e instanceof ServiceError ? e.message : 'Failed.') }
  }
  return (
    <>
      <PageHeader title="User Accounts" subtitle="Accounts for Barangay 181 officials, personnel and residents. New accounts and password resets need the backend; this screen manages status, names and permissions." />
      {err && <p className="mb-3 rounded-md bg-danger-tint px-3 py-2 text-[12.5px] text-danger-ink">{err}</p>}
      <Card className="divide-y divide-line-soft">
        {users.map((u) => (
          <div key={u.id} className="px-5 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-navy-900 text-[11px] font-semibold text-white">{initials(u.fullName)}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold text-navy-900">{u.fullName}</span>
                <span className="block text-[12px] text-ink-muted">{u.position} · {u.username} · {ROLES[u.roleId].name}</span>
              </span>
              <span className="text-[11.5px] text-ink-muted">{u.lastLoginAt ? `Last sign-in ${formatDateTime(u.lastLoginAt)}` : 'Never signed in'}</span>
              <Badge tone={u.status === 'active' ? 'success' : 'neutral'}>{u.status === 'active' ? 'Active' : u.status === 'locked' ? 'Locked' : 'Inactive'}</Badge>
              <Button size="sm" variant="ghost" onClick={() => setOpen(open === u.id ? null : u.id)}>{open === u.id ? 'Close' : 'Manage'}</Button>
            </div>
            {open === u.id && <ManageUser u={u} me={me!} run={run} />}
          </div>
        ))}
      </Card>
    </>
  )
}

function ManageUser({ u, me, run }: { u: User; me: User; run: (fn: () => Promise<unknown>) => Promise<void> }) {
  const [name, setName] = useState(u.fullName)
  const [perms, setPerms] = useState<Set<Permission>>(new Set(u.extraPermissions ?? []))
  const renamable = ['property_custodian', 'system_admin', 'staff'].includes(u.roleId)
  return (
    <div className="mt-3 grid gap-4 rounded-[var(--radius-control)] bg-surface-muted p-4 lg:grid-cols-2">
      <div className="space-y-3">
        <div className="flex gap-2">
          <Button size="sm" variant={u.status === 'active' ? 'danger' : 'primary'} disabled={u.id === me.id} onClick={() => run(() => setStatus(u.id, u.status === 'active' ? 'inactive' : 'active', me))}>{u.status === 'active' ? 'Deactivate' : 'Activate'}</Button>
        </div>
        {renamable ? (
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-navy-900">Display name</span>
            <span className="flex gap-2"><TextInput value={name} onChange={(e) => setName(e.target.value)} /><Button size="md" variant="secondary" onClick={() => run(() => setDisplayName(u.id, name, me))}>Save</Button></span>
            <span className="mt-1 block text-[11.5px] text-ink-muted">The study does not name this position's holder, so the administrator sets it.</span>
          </label>
        ) : (
          <p className="text-[12px] text-ink-muted">This is an official's account; the name comes from the barangay's records.</p>
        )}
      </div>
      {GRANTABLE_ROLES.includes(u.roleId) ? (
        <div>
          <p className="mb-1.5 text-[12px] font-semibold text-navy-900">Additional permissions for this account</p>
          <div className="grid gap-1 sm:grid-cols-2">
            {GRANTABLE_STAFF_PERMISSIONS.map((p) => (
              <label key={p} className="flex items-center gap-2 text-[12.5px] text-navy-900">
                <input type="checkbox" className="size-4 accent-[#002132]" checked={perms.has(p)} onChange={(e) => setPerms((s) => { const n = new Set(s); if (e.target.checked) n.add(p); else n.delete(p); return n })} />
                {PERMISSION_LABELS[p]}
              </label>
            ))}
          </div>
          <Button className="mt-2" size="sm" onClick={() => run(() => setExtraPermissions(u.id, [...perms], me))}>Save permissions</Button>
        </div>
      ) : (
        <p className="text-[12px] text-ink-muted">Permissions for this account come from its role ({ROLES[u.roleId].name}). See Roles and Permissions.</p>
      )}
    </div>
  )
}

/** Read-only matrix of the proposed permissions per role (docs/PERMISSION_MATRIX.md). */
export function RolesPage() {
  const roles = Object.keys(ROLES) as RoleId[]
  const perms = Object.keys(PERMISSION_LABELS) as Permission[]
  return (
    <>
      <PageHeader title="Roles and Permissions" subtitle="Proposed matrix, pending barangay review. Personnel, Kagawad and SK accounts can receive extra permissions per account." />
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-[12.5px]">
          <thead>
            <tr className="bg-surface-muted text-left">
              <th className="label-caps px-4 py-2.5">Permission</th>
              {roles.map((r) => <th key={r} className="label-caps px-2 py-2.5 text-center">{ROLES[r].name}</th>)}
            </tr>
          </thead>
          <tbody>
            {perms.map((p) => (
              <tr key={p} className="border-t border-line-soft">
                <td className="px-4 py-1.5 text-navy-900">{PERMISSION_LABELS[p]}</td>
                {roles.map((r) => (
                  <td key={r} className="px-2 py-1.5 text-center">
                    {ROLE_PERMISSIONS[r].includes(p) ? <Check className="mx-auto size-4 text-success" /> : GRANTABLE_ROLES.includes(r) && GRANTABLE_STAFF_PERMISSIONS.includes(p) ? <span className="text-[11px] font-semibold text-info">per account</span> : <Minus className="mx-auto size-3.5 text-line" />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  )
}

/** FR24: who did what and when. In memory for this session; the backend keeps the protected log. */
export function ActivityPage() {
  const entries = listAudit()
  return (
    <>
      <PageHeader title="Activity Log" subtitle="Record views, report generation, exports, imports and account changes made in this browser session. The permanent, tamper-protected log is a backend feature." />
      <Card>
        {entries.length === 0 ? (
          <p className="px-5 py-6 text-[13px] text-ink-muted">No activity recorded in this session yet.</p>
        ) : (
          <table className="w-full text-[13px]">
            <thead><tr className="bg-surface-muted text-left">{['When', 'User', 'Role at the time', 'Action', 'Module', 'Reference', 'Outcome'].map((h) => <th key={h} className="label-caps px-4 py-2.5">{h}</th>)}</tr></thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-line-soft">
                  <td className="px-4 py-2 whitespace-nowrap text-ink-muted">{formatDateTime(e.timestamp)}</td>
                  <td className="px-4 py-2 text-navy-900">{mockUsers.find((u) => u.id === e.userId)?.fullName}</td>
                  <td className="px-4 py-2">{ROLES[e.roleAtTime].name}</td>
                  <td className="px-4 py-2 text-navy-900">{e.action}</td>
                  <td className="px-4 py-2">{e.module}</td>
                  <td className="px-4 py-2 text-ink-muted">{e.recordRef ?? '–'}</td>
                  <td className="px-4 py-2"><Badge tone={e.outcome === 'success' ? 'success' : 'danger'}>{e.outcome}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  )
}

/** Barangay officials as documented, with sources and open questions. */
export function PersonnelPage() {
  return (
    <>
      <PageHeader title="Barangay Personnel" subtitle="Officials of Barangay 181, Zone 16, District II, Manila." />
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[13px]">
          <thead><tr className="bg-surface-muted text-left">{['Name', 'Position', 'Name as printed on documents', 'Source', 'System account'].map((h) => <th key={h} className="label-caps px-4 py-2.5">{h}</th>)}</tr></thead>
          <tbody>
            {OFFICIALS.map((o) => (
              <tr key={o.id} className="border-t border-line-soft">
                <td className="px-4 py-2.5 font-semibold text-navy-900">{o.name}</td>
                <td className="px-4 py-2.5">{o.position}</td>
                <td className="px-4 py-2.5 text-ink-muted">{o.nameOnDocuments ?? '–'}</td>
                <td className="px-4 py-2.5 text-ink-muted">{o.source}</td>
                <td className="px-4 py-2.5">{o.userId ? <Badge tone="success">Yes</Badge> : <Badge tone="neutral">None</Badge>}</td>
              </tr>
            ))}
            <tr className="border-t border-line-soft"><td className="px-4 py-2.5 font-semibold text-navy-900">Not named in the study</td><td className="px-4 py-2.5">Property Custodian</td><td className="px-4 py-2.5 text-ink-muted">–</td><td className="px-4 py-2.5 text-ink-muted">Study §1.5</td><td className="px-4 py-2.5"><Badge tone="success">Yes</Badge></td></tr>
          </tbody>
        </table>
      </Card>
      <Panel className="mt-4" title="Open questions">
        <ul className="list-disc space-y-1 pl-5 text-[13px] text-navy-900">{OFFICIAL_NOTES.map((n) => <li key={n}>{n}</li>)}</ul>
      </Panel>
    </>
  )
}

/** Settings currently in effect; values marked pending need barangay confirmation. */
export function SettingsPage() {
  const rows: [string, string, boolean][] = [
    ['Failed sign-in attempts before lockout (NFR8)', String(APP_CONFIG.lockoutThreshold), true],
    ['Idle session length', `${APP_CONFIG.sessionMinutes} minutes`, true],
    ['Equipment borrowing period (FR22)', `${BORROWING.periodDays} days from release`, false],
    ['Borrowing grace period (FR22)', `${BORROWING.graceDays} days`, false],
    ['Mediation under the Barangay Chairman', `Up to ${KP.chairmanMediationDays} days`, false],
    ['Lupon mediation period', KP.luponMediationDays ? `${KP.luponMediationDays} days` : 'Not stated in the study', true],
    ['Hearing reminder timing (FR20)', 'Not specified', true],
  ]
  return (
    <>
      <PageHeader title="System Settings" subtitle="Values currently used by the prototype. Editing will be enabled with the backend." />
      <Card className="divide-y divide-line-soft">
        {rows.map(([k, v, pending]) => (
          <div key={k} className="flex items-center justify-between gap-4 px-5 py-3 text-[13px]">
            <span className="text-navy-900">{k}</span>
            <span className="flex items-center gap-2"><strong className="text-navy-900">{v}</strong>{pending && <Badge tone="warning">Pending confirmation</Badge>}</span>
          </div>
        ))}
      </Card>
    </>
  )
}

export function HealthPage() {
  const items: [string, string, 'ok' | 'pending'][] = [
    ['Application (frontend)', 'Running', 'ok'],
    ['Database', 'Not connected: backend phase', 'pending'],
    ['Regular database backups (NFR12)', 'Available once the backend and database are set up', 'pending'],
    ['Desktop backup for internet outages (NFR11)', 'Procedure to be written in the maintenance guide (NFR15)', 'pending'],
    ['Email notifications (FR23)', 'Not configured', 'pending'],
    ['HTTPS (NFR5)', 'Configured at deployment', 'pending'],
  ]
  return (
    <>
      <PageHeader title="System Health and Backups" subtitle="Status of the services the BMIS depends on." />
      <Card className="divide-y divide-line-soft">
        {items.map(([k, v, s]) => (
          <div key={k} className="flex items-center justify-between gap-4 px-5 py-3 text-[13px]">
            <span className="text-navy-900">{k}</span>
            <span className={cn('flex items-center gap-2', s === 'ok' ? 'text-success' : 'text-ink-muted')}>{s === 'ok' ? <Check className="size-4" /> : <Info className="size-4" />}{v}</span>
          </div>
        ))}
      </Card>
    </>
  )
}
