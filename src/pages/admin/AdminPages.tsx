import { Check, CheckCircle2, ChevronRight, Copy, Info, KeyRound, Minus, Search } from 'lucide-react'
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
import { verifyOwnPassword } from '@/services/authService'
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
  const [group, setGroup] = useState<'all' | 'personnel' | 'residents'>('all')
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 3500)
    return () => window.clearTimeout(t)
  }, [toast])
  const q = query.trim().toLowerCase()
  const inGroup = (u: User) => group === 'all' || (group === 'residents' ? u.roleId === 'resident' : u.roleId !== 'resident')
  const shownAccounts = accounts.filter((u) => inGroup(u) && (!q || [u.fullName, u.username, u.email, u.position, ROLES[u.roleId].name].some((x) => x.toLowerCase().includes(q))))
  const count = (g: typeof group) => accounts.filter((u) => g === 'all' || (g === 'residents' ? u.roleId === 'resident' : u.roleId !== 'resident')).length
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
      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div role="tablist" aria-label="Account group" className="flex flex-wrap gap-2">
          {([
            ['all', 'All'],
            ['personnel', 'Barangay Personnel'],
            ['residents', 'Residents'],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              role="tab"
              type="button"
              aria-selected={group === k}
              onClick={() => setGroup(k)}
              className={cn('inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-control)] border px-3.5 text-[13px] font-semibold', group === k ? 'border-navy-900 bg-navy-900 text-white' : 'border-line bg-surface text-navy-900 hover:bg-surface-muted')}
            >
              {label} <span className={group === k ? 'text-white/75' : 'text-ink-muted'}>({count(k)})</span>
            </button>
          ))}
        </div>
        <label className="relative block flex-1">
          <span className="sr-only">Search accounts</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, username, email or role" className="h-10 w-full rounded-[var(--radius-control)] border border-line bg-surface pr-3 pl-9 text-[13.5px] text-navy-900 placeholder:text-ink-subtle focus:border-navy-600 focus:outline-none" />
        </label>
      </div>
      <Card className="divide-y divide-line-soft">
        {shownAccounts.length === 0 && <p className="px-5 py-6 text-[13px] text-ink-muted">No accounts match your search.</p>}
        {shownAccounts.map((u) => (
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
            ) : <ManageUser u={u} me={me!} run={run} onReset={() => reset(u)} onSaved={(m) => setToast(m)} />)}
          </div>
        ))}
      </Card>
      {toast && (
        <div role="status" className="fixed right-4 bottom-4 z-50 flex max-w-sm items-start gap-2 rounded-xl border border-success/40 bg-surface px-4 py-3 text-[13px] text-navy-900 shadow-[0_8px_24px_rgba(0,33,50,0.15)]">
          <CheckCircle2 className="mt-px size-4 shrink-0 text-success" /> {toast}
        </div>
      )}
    </>
  )
}

function ManageUser({ u, me, run, onReset, onSaved }: { u: User; me: User; run: (fn: () => Promise<unknown>) => Promise<void>; onReset: () => void; onSaved: (message: string) => void }) {
  const [name, setName] = useState(u.fullName)
  const [perms, setPerms] = useState<Set<Permission>>(new Set(u.extraPermissions ?? []))
  const [confirming, setConfirming] = useState(false)
  const [password, setPassword] = useState('')
  const [pwError, setPwError] = useState<string | null>(null)
  const renamable = ['property_custodian', 'system_admin', 'staff'].includes(u.roleId)
  const changed = [...perms].sort().join() !== [...(u.extraPermissions ?? [])].sort().join()
  const save = async () => {
    setPwError(null)
    if (!(await verifyOwnPassword(me, password))) {
      setPwError('That is not your current password.')
      return
    }
    await run(() => setExtraPermissions(u.id, [...perms], me))
    setConfirming(false)
    setPassword('')
    onSaved(`Permissions saved for ${u.fullName}.`)
  }
  return (
    <div className="mt-3 space-y-4 rounded-[var(--radius-control)] bg-surface-muted p-4">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={u.status === 'active' ? 'danger' : 'primary'} disabled={u.id === me.id} onClick={() => run(() => setStatus(u.id, u.status === 'active' ? 'inactive' : 'active', me))}>{u.status === 'active' ? 'Deactivate' : 'Activate'}</Button>
          <Button size="sm" variant="secondary" icon={<KeyRound className="size-3.5" />} onClick={onReset}>Reset password</Button>
        </div>
        {renamable ? (
          <label className="block max-w-md">
            <span className="mb-1 block text-[12px] font-semibold text-navy-900">Display name</span>
            <span className="flex gap-2"><TextInput value={name} onChange={(e) => setName(e.target.value)} /><Button size="md" variant="secondary" onClick={() => run(() => setDisplayName(u.id, name, me))}>Save</Button></span>
            <span className="mt-1 block text-[11.5px] text-ink-muted">Set the name of the person holding this position.</span>
          </label>
        ) : (
          <p className="text-[12.5px] text-ink-muted">This is an official's account; the name comes from the barangay's records.</p>
        )}
      </div>
      {GRANTABLE_ROLES.includes(u.roleId) ? (
        <div className="border-t border-line pt-4">
          <p className="text-[12.5px] font-semibold text-navy-900">Additional permissions for this account</p>
          <p className="mb-2 text-[12px] text-ink-muted">On top of what the {ROLES[u.roleId].name} role already allows.</p>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {GRANTABLE_STAFF_PERMISSIONS.map((p) => (
              <label key={p} className="flex min-h-10 items-center gap-2.5 rounded-[var(--radius-control)] border border-line bg-surface px-3 py-2 text-[12.5px] text-navy-900 hover:border-navy-600">
                <input type="checkbox" className="size-4 shrink-0 accent-[#002132]" checked={perms.has(p)} onChange={(e) => setPerms((s) => { const n = new Set(s); if (e.target.checked) n.add(p); else n.delete(p); return n })} />
                {PERMISSION_LABELS[p]}
              </label>
            ))}
          </div>
          {confirming ? (
            <div className="mt-3 flex flex-col gap-2 rounded-[var(--radius-control)] border border-warning/40 bg-warning-tint/60 p-3 sm:flex-row sm:items-end sm:justify-end">
              <label className="block flex-1 sm:max-w-xs">
                <span className="mb-1 block text-[12px] font-semibold text-navy-900">Enter your password to confirm <span className="text-danger-ink">*</span></span>
                <TextInput type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
              </label>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => { setConfirming(false); setPassword(''); setPwError(null) }}>Cancel</Button>
                <Button disabled={!password} onClick={save}>Confirm and save</Button>
              </div>
              {pwError && <p role="alert" className="text-[12px] text-danger-ink sm:basis-full sm:text-right">{pwError}</p>}
            </div>
          ) : (
            <div className="mt-3 flex justify-end">
              <Button disabled={!changed} onClick={() => setConfirming(true)}>Save permissions</Button>
            </div>
          )}
        </div>
      ) : (
        <p className="border-t border-line pt-3 text-[12.5px] text-ink-muted">Permissions for this account come from its role ({ROLES[u.roleId].name}). See Roles and Permissions.</p>
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
      <PageHeader title="Roles and Permissions" subtitle="What each role can do. Extra permissions for a barangay official's account are set in User Accounts → Manage Account." />
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
    { id: 'custodian', name: 'Property Custodian', position: 'Property Custodian', source: '', account: true },
  ]
  const paged = usePaged(rows)
  return (
    <>
      <PageHeader title="Barangay Personnel" subtitle="Officials of Barangay 181, Zone 16, District II, Manila." />
      <Card className="overflow-hidden">
        <table className="hidden w-full text-[13px] md:table">
          <thead><tr className="bg-surface-muted text-left">{['Name', 'Position', 'System account'].map((h) => <th key={h} className="label-caps px-4 py-2.5">{h}</th>)}</tr></thead>
          <tbody>
            {paged.slice.map((o) => (
              <tr key={o.id} className="border-t border-line-soft">
                <td className="px-4 py-3 font-semibold text-navy-900">{o.name}</td>
                <td className="px-4 py-3">{o.position}</td>
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
    ['Failed sign-in attempts before lockout', String(APP_CONFIG.lockoutThreshold)],
    ['Idle session length', `${APP_CONFIG.sessionMinutes} minutes`],
    ['Equipment borrowing period', `${BORROWING.periodDays} days from release`],
    ['Borrowing grace period', `${BORROWING.graceDays} days`],
    ['Mediation under the Barangay Chairman', `Up to ${KP.chairmanMediationDays} days`],
    ['Lupon (Pangkat) conciliation, RA 7160 Sec. 410', `${KP.luponMediationDays} days, extendable by ${KP.luponExtensionDays}`],
    ['Hearing reminders', `${KP.reminderDaysBefore} day before each hearing`],
  ]
  return (
    <>
      <PageHeader title="System Settings" subtitle="Rules the system follows for sign-in, borrowing and Katarungang Pambarangay deadlines." />
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
    ['Regular database backups', 'Not yet set up', 'pending'],
    ['Desktop backup for internet outages', 'Not yet set up', 'pending'],
    ['Email notifications', 'Not configured', 'pending'],
    ['Secure connection (HTTPS)', 'Active', 'ok'],
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
