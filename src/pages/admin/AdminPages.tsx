import { Check, ChevronRight, Copy, Info, KeyRound, Minus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/ui/Button'
import { TextInput } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Panel'
import { Pagination, usePaged } from '@/components/ui/Pagination'
import { StatusLabel } from '@/components/ui/StatusLabel'
import { APP_CONFIG } from '@/config/app'
import { BORROWING, KP, OFFICIALS } from '@/config/barangay'
import { GRANTABLE_ROLES, GRANTABLE_STAFF_PERMISSIONS, PERMISSION_LABELS, ROLES, ROLE_PERMISSIONS } from '@/config/permissions'
import { formatDateTime, initials } from '@/lib/format'
import { mockUsers } from '@/mocks/users'
import { listAudit } from '@/services/auditService'
import { ServiceError } from '@/services/mockApi'
import { listUsers, resetPassword, setDisplayName, setExtraPermissions, setStatus } from '@/services/userService'
import { getCredential, listResetRequests, type ResetRequest } from '@/services/credentialStore'
import { TEST_ACCOUNT, testUserFor } from '@/config/testAccount'
import { accountTypeBySlug } from '@/config/accountTypes'
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
  const [requests, setRequests] = useState<ResetRequest[]>(listResetRequests)
  const [issued, setIssued] = useState<{ label: string; password: string } | null>(null)
  const run = async (fn: () => Promise<unknown>) => {
    setErr(null)
    try { await fn(); await load() } catch (e) { setErr(e instanceof ServiceError ? e.message : 'Failed.') }
  }
  const reset = async (u: User) => {
    const isTest = u.id === 'usr-test'
    const password = await resetPassword(
      { credentialKey: isTest ? TEST_ACCOUNT.credentialKey : u.id, identifiers: [u.username, u.email], label: isTest ? 'Test account' : u.username },
      me!,
    )
    setIssued({ label: u.fullName, password })
    setRequests(listResetRequests())
  }
  const accounts = TEST_ACCOUNT.enabled
    ? [{ ...testUserFor('system_admin'), id: 'usr-test', position: 'Test account (all levels)' }, ...users]
    : users
  const pending = requests.filter((r) => r.status === 'pending')
  const matchFor = (r: ResetRequest) => accounts.find((u) => u.username.toLowerCase() === r.identifier || u.email.toLowerCase() === r.identifier)
  return (
    <>
      <PageHeader title="User Accounts" subtitle="Accounts for Barangay 181 officials, personnel and residents: status, names, permissions and password resets." />
      {err && <p className="mb-3 rounded-md bg-danger-tint px-3 py-2 text-[12.5px] text-danger-ink">{err}</p>}
      {issued && (
        <Card className="mb-4 border-success/40 bg-success-tint px-5 py-4">
          <p className="text-[13px] font-semibold text-navy-900">Temporary password for {issued.label}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="rounded-md bg-surface px-3 py-1.5 font-mono text-[15px] font-semibold tracking-wider text-navy-900">{issued.password}</code>
            <Button size="sm" variant="secondary" icon={<Copy className="size-3.5" />} onClick={() => navigator.clipboard?.writeText(issued.password)}>Copy</Button>
            <Button size="sm" variant="ghost" onClick={() => setIssued(null)}>Done</Button>
          </div>
          <p className="mt-2 text-[12px] text-ink-muted">Shown once. Give it to the account holder in person; they must choose a new password when they sign in.</p>
        </Card>
      )}
      {pending.length > 0 && (
        <Card className="mb-4">
          <p className="label-caps border-b border-line-soft px-5 py-3">Password reset requests</p>
          <ul className="divide-y divide-line-soft">
            {pending.map((r) => {
              const u = matchFor(r)
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-[13px]">
                  <span>
                    <span className="block font-semibold text-navy-900">{r.identifier}</span>
                    <span className="block text-[12px] text-ink-muted">{accountTypeBySlug(r.accountType)?.title ?? r.accountType} · {formatDateTime(r.requestedAt)} · {u ? `matches ${u.fullName}` : 'no matching account'}</span>
                  </span>
                  {u && <Button size="sm" icon={<KeyRound className="size-3.5" />} onClick={() => reset(u)}>Reset password</Button>}
                </li>
              )
            })}
          </ul>
        </Card>
      )}
      <Card className="divide-y divide-line-soft">
        {accounts.map((u) => (
          <div key={u.id} className="px-5 py-3">
            <div className="flex flex-wrap items-start gap-3 sm:flex-nowrap sm:items-center">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sky-100 text-[11px] font-semibold text-navy-900">{initials(u.fullName)}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold text-navy-900">{u.fullName}</span>
                <span className="block text-[12px] text-ink-muted">{u.position} · {u.username} · {ROLES[u.roleId].name}</span>
                <span className="block text-[11.5px] text-ink-muted">{getCredential(u.id === 'usr-test' ? TEST_ACCOUNT.credentialKey : u.id)?.mustChange ? 'Temporary password issued' : u.id === 'usr-test' || getCredential(u.id) ? 'Password set' : 'No password yet'}</span>
              </span>
              <span className="flex w-full items-center gap-3 pl-12 sm:w-auto sm:pl-0">
                <StatusLabel status={u.status === 'active' ? 'Active' : u.status === 'locked' ? 'Locked' : 'Inactive'} tone={u.status === 'active' ? 'success' : u.status === 'locked' ? 'danger' : 'danger'} />
                <button type="button" aria-expanded={open === u.id} onClick={() => setOpen(open === u.id ? null : u.id)} className="inline-flex min-h-9 items-center gap-0.5 rounded-md px-1 text-[12.5px] font-semibold text-info hover:underline">
                  {open === u.id ? 'Close' : <>Manage Account <ChevronRight className="size-4" /></>}
                </button>
              </span>
            </div>
            {open === u.id && (u.id === 'usr-test' ? (
              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-[var(--radius-control)] bg-surface-muted p-4 text-[12.5px] text-navy-900">
                Test account for the project team. It can switch between every level after signing in.
                <Button size="sm" icon={<KeyRound className="size-3.5" />} onClick={() => reset(u)}>Reset password</Button>
              </div>
            ) : <ManageUser u={u} me={me!} run={run} onReset={() => reset(u)} />)}
          </div>
        ))}
      </Card>
    </>
  )
}

function ManageUser({ u, me, run, onReset }: { u: User; me: User; run: (fn: () => Promise<unknown>) => Promise<void>; onReset: () => void }) {
  const [name, setName] = useState(u.fullName)
  const [perms, setPerms] = useState<Set<Permission>>(new Set(u.extraPermissions ?? []))
  const renamable = ['property_custodian', 'system_admin', 'staff'].includes(u.roleId)
  return (
    <div className="mt-3 grid gap-4 rounded-[var(--radius-control)] bg-surface-muted p-4 lg:grid-cols-2">
      <div className="space-y-3">
        <div className="flex gap-2">
          <Button size="sm" variant={u.status === 'active' ? 'danger' : 'primary'} disabled={u.id === me.id} onClick={() => run(() => setStatus(u.id, u.status === 'active' ? 'inactive' : 'active', me))}>{u.status === 'active' ? 'Deactivate' : 'Activate'}</Button>
          <Button size="sm" variant="secondary" icon={<KeyRound className="size-3.5" />} onClick={onReset}>Reset password</Button>
        </div>
        {renamable ? (
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-navy-900">Display name</span>
            <span className="flex gap-2"><TextInput value={name} onChange={(e) => setName(e.target.value)} /><Button size="md" variant="secondary" onClick={() => run(() => setDisplayName(u.id, name, me))}>Save</Button></span>
            <span className="mt-1 block text-[11.5px] text-ink-muted">Set the name of the person holding this position.</span>
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
      <PageHeader title="Roles and Permissions" subtitle="Proposed matrix, pending barangay review. Personnel and Kagawad accounts can receive extra permissions per account." />
      <p className="mb-2 text-[12px] text-ink-muted lg:hidden">Swipe sideways to see every role.</p>
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
  const paged = usePaged(entries)
  const who = (id: string) => mockUsers.find((u) => u.id === id)?.fullName ?? id
  return (
    <>
      <PageHeader title="Activity Log" subtitle="Record views, report generation, exports, imports and account changes made in this browser session. The permanent, tamper-protected log is a backend feature." />
      <Card className="overflow-hidden">
        {entries.length === 0 ? (
          <p className="px-5 py-6 text-[13px] text-ink-muted">No activity recorded in this session yet.</p>
        ) : (
          <>
            <table className="hidden w-full text-[13px] lg:table">
              <thead><tr className="bg-surface-muted text-left">{['When', 'User', 'Role at the time', 'Action', 'Module', 'Reference', 'Outcome'].map((h) => <th key={h} className="label-caps px-4 py-2.5">{h}</th>)}</tr></thead>
              <tbody>
                {paged.slice.map((e) => (
                  <tr key={e.id} className="border-t border-line-soft">
                    <td className="px-4 py-2.5 whitespace-nowrap text-ink-muted">{formatDateTime(e.timestamp)}</td>
                    <td className="px-4 py-2.5 text-navy-900">{who(e.userId)}</td>
                    <td className="px-4 py-2.5">{ROLES[e.roleAtTime]?.name}</td>
                    <td className="px-4 py-2.5 text-navy-900">{e.action}</td>
                    <td className="px-4 py-2.5">{e.module}</td>
                    <td className="px-4 py-2.5 text-ink-muted">{e.recordRef ?? '–'}</td>
                    <td className="px-4 py-2.5"><StatusLabel status={e.outcome === 'success' ? 'Success' : 'Failed'} tone={e.outcome === 'success' ? 'success' : 'danger'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="divide-y divide-line-soft lg:hidden">
              {paged.slice.map((e) => (
                <li key={e.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13.5px] font-semibold text-navy-900">{e.action}</p>
                    <StatusLabel status={e.outcome === 'success' ? 'Success' : 'Failed'} tone={e.outcome === 'success' ? 'success' : 'danger'} />
                  </div>
                  <p className="text-[12.5px] text-ink-nav">{who(e.userId)} · {ROLES[e.roleAtTime]?.name}</p>
                  <p className="text-[12px] text-ink-muted">{e.module}{e.recordRef ? ` · ${e.recordRef}` : ''} · {formatDateTime(e.timestamp)}</p>
                </li>
              ))}
            </ul>
            <Pagination page={paged.page} pages={paged.pages} total={paged.total} size={paged.size} onPage={paged.setPage} noun="entries" />
          </>
        )}
      </Card>
    </>
  )
}

/** Barangay officials as documented, with sources. */
export function PersonnelPage() {
  const rows = [
    ...OFFICIALS.map((o) => ({ id: o.id, name: o.name, position: o.position, source: o.source, account: !!o.userId })),
    { id: 'custodian', name: 'Not named in the study', position: 'Property Custodian', source: 'Study §1.5', account: true },
  ]
  const paged = usePaged(rows)
  return (
    <>
      <PageHeader title="Barangay Personnel" subtitle="Officials of Barangay 181, Zone 16, District II, Manila." />
      <Card className="overflow-hidden">
        <table className="hidden w-full text-[13px] md:table">
          <thead><tr className="bg-surface-muted text-left">{['Name', 'Position', 'Source', 'System account'].map((h) => <th key={h} className="label-caps px-4 py-2.5">{h}</th>)}</tr></thead>
          <tbody>
            {paged.slice.map((o) => (
              <tr key={o.id} className="border-t border-line-soft">
                <td className="px-4 py-3 font-semibold text-navy-900">{o.name}</td>
                <td className="px-4 py-3">{o.position}</td>
                <td className="px-4 py-3 text-ink-muted">{o.source}</td>
                <td className="px-4 py-3">{o.account ? <StatusLabel status="Yes" tone="success" /> : <StatusLabel status="None" tone="neutral" />}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="divide-y divide-line-soft md:hidden">
          {paged.slice.map((o) => (
            <li key={o.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <span className="min-w-0">
                <span className="block text-[14px] font-semibold text-navy-900">{o.name}</span>
                <span className="block text-[12.5px] text-ink-nav">{o.position}</span>
                <span className="block text-[12px] text-ink-muted">Source: {o.source}</span>
              </span>
              {o.account ? <StatusLabel status="Has account" tone="success" /> : <StatusLabel status="No account" tone="neutral" />}
            </li>
          ))}
        </ul>
        <Pagination page={paged.page} pages={paged.pages} total={paged.total} size={paged.size} onPage={paged.setPage} noun="officials" />
      </Card>
    </>
  )
}

/** Settings currently in effect. */
export function SettingsPage() {
  const rows: [string, string][] = [
    ['Failed sign-in attempts before lockout (NFR8)', String(APP_CONFIG.lockoutThreshold)],
    ['Idle session length', `${APP_CONFIG.sessionMinutes} minutes`],
    ['Equipment borrowing period (FR22)', `${BORROWING.periodDays} days from release`],
    ['Borrowing grace period (FR22)', `${BORROWING.graceDays} days`],
    ['Mediation under the Barangay Chairman', `Up to ${KP.chairmanMediationDays} days`],
    ['Lupon (Pangkat) conciliation, RA 7160 Sec. 410', `${KP.luponMediationDays} days, extendable by ${KP.luponExtensionDays}`],
    ['Hearing reminders (FR20)', `${KP.reminderDaysBefore} day before each hearing`],
  ]
  return (
    <>
      <PageHeader title="System Settings" subtitle="Values currently used by the prototype. Editing will be enabled with the backend." />
      <Card className="divide-y divide-line-soft">
        {rows.map(([k, v]) => (
          <div key={k} className="flex flex-col gap-0.5 px-5 py-3 text-[13px] sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <span className="text-ink-nav">{k}</span>
            <strong className="text-navy-900 sm:text-right">{v}</strong>
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
      <PageHeader title="Health and Backups" subtitle="Status of the services the BMIS depends on." />
      <Card className="divide-y divide-line-soft">
        {items.map(([k, v, s]) => (
          <div key={k} className="flex flex-col gap-1 px-5 py-3 text-[13px] sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <span className="font-semibold text-navy-900">{k}</span>
            <span className={cn('flex items-center gap-2 sm:text-right', s === 'ok' ? 'text-success' : 'text-ink-muted')}>{s === 'ok' ? <Check className="size-4" /> : <Info className="size-4" />}{v}</span>
          </div>
        ))}
      </Card>
    </>
  )
}
