import { ServiceStandardsPanel } from './ServiceStandardsPanel'
import { StoragePanel } from './StoragePanel'
import { BarChart3, Boxes, Check, CheckCircle2, ChevronRight, Copy, FileText, Gavel, Info, KeyRound, Search, Users } from '@/icons'
import { useEffect, useState } from 'react'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/ui/Button'
import { Select, TextInput } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Panel'
import { Pagination, usePaged } from '@/components/ui/Pagination'
import { StatusLabel } from '@/components/ui/StatusLabel'
import { APP_CONFIG } from '@/config/app'
import { BORROWING, KP, OFFICIALS } from '@/config/barangay'
import { EDITABLE_ROLES, GRANTABLE_ROLES, GRANTABLE_STAFF_PERMISSIONS, PERMISSION_GROUPS, PERMISSION_LABELS, ROLES, ROLE_PERMISSIONS } from '@/config/permissions'
import { formatDateTime, initials } from '@/lib/format'
import { mockUsers } from '@/mocks/users'
import { listAudit } from '@/services/auditService'
import { ServiceError } from '@/services/mockApi'
import { verifyOwnPassword } from '@/services/authService'
import { ASSIGNABLE_ROLES, listUsers, resetPassword, setDisplayName, setExtraPermissions, setRole, setRolePermission, setStatus } from '@/services/userService'
import { Toggle } from '@/components/ui/Toggle'
import { getCredential, listResetRequests, type ResetRequest } from '@/services/credentialStore'
import { TEST_ACCOUNTS, testAccountByKey, testUserFor } from '@/config/testAccount'
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
    const isTest = !!testAccountByKey(u.id)
    const password = await resetPassword(
      { credentialKey: u.id, identifiers: [u.username, u.email], label: isTest ? `Test account (${u.email})` : u.username },
      me!,
    )
    setIssued({ label: u.fullName, password })
    setRequests(listResetRequests())
  }
  const accounts = [...TEST_ACCOUNTS.map((a) => ({ ...testUserFor('system_admin', a), id: a.credentialKey, position: 'Test account (all levels)' })), ...users]
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
      {err && <p className="mb-3 rounded-md bg-danger-tint px-3 py-2 text-[length:calc(14.5px*var(--fs))] text-danger-ink">{err}</p>}
      {issued && (
        <Card className="mb-4 border-success/40 bg-success-tint px-5 py-4">
          <p className="text-[length:calc(15px*var(--fs))] font-semibold text-navy-900">Temporary password for {issued.label}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="rounded-md bg-surface px-3 py-1.5 font-mono text-[length:calc(17px*var(--fs))] font-semibold tracking-wider text-navy-900">{issued.password}</code>
            <Button size="sm" variant="secondary" icon={<Copy className="size-3.5" />} onClick={() => navigator.clipboard?.writeText(issued.password)}>Copy</Button>
            <Button size="sm" variant="ghost" onClick={() => setIssued(null)}>Done</Button>
          </div>
          <p className="mt-2 text-[length:calc(14px*var(--fs))] text-ink-muted">Shown only once.</p>
        </Card>
      )}
      {pending.length > 0 && (
        <Card className="mb-4 overflow-hidden">
          <h2 className="bg-bar border-b border-sky-300 text-navy-900 px-5 py-3 font-display text-[length:calc(17px*var(--fs))] font-bold">Password reset requests</h2>
          <ul className="divide-y divide-line-soft">
            {pending.map((r) => {
              const u = matchFor(r)
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-[length:calc(15px*var(--fs))]">
                  <span>
                    <span className="block font-semibold text-navy-900">{r.identifier}</span>
                    <span className="block text-[length:calc(14px*var(--fs))] text-ink-muted">{accountTypeBySlug(r.accountType)?.title ?? r.accountType} · {formatDateTime(r.requestedAt)} · {u ? `matches ${u.fullName}` : 'no matching account'}</span>
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
              className={cn('inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-control)] border px-3.5 text-[length:calc(15px*var(--fs))] font-semibold', group === k ? 'border-navy-900 bg-navy-900 text-white' : 'border-line bg-surface text-navy-900 hover:bg-surface-muted')}
            >
              {label} <span className={group === k ? 'text-white/75' : 'text-ink-muted'}>({count(k)})</span>
            </button>
          ))}
        </div>
        <label className="relative block flex-1">
          <span className="sr-only">Search accounts</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, username, email or role" className="h-10 w-full rounded-[var(--radius-control)] border border-line bg-surface pr-3 pl-9 text-[length:calc(15.5px*var(--fs))] text-navy-900 placeholder:text-ink-subtle focus:border-navy-600 focus:outline-none" />
        </label>
      </div>
      <Card className="divide-y divide-line-soft">
        {shownAccounts.length === 0 && <p className="px-5 py-6 text-[length:calc(15px*var(--fs))] text-ink-muted">No accounts match your search.</p>}
        {shownAccounts.map((u) => (
          <div key={u.id} className="px-5 py-3">
            <div className="flex flex-wrap items-start gap-3 sm:flex-nowrap sm:items-center">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sky-100 text-[length:calc(13px*var(--fs))] font-semibold text-navy-900">{initials(u.fullName)}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[length:calc(15.5px*var(--fs))] font-semibold text-navy-900">{u.fullName}</span>
                <span className="block text-[length:calc(14px*var(--fs))] text-ink-muted">{u.position} · {u.username} · {ROLES[u.roleId].name}</span>
                <span className="block text-[length:calc(13.5px*var(--fs))] text-ink-muted">{getCredential(u.id)?.mustChange ? 'Temporary password issued' : testAccountByKey(u.id) || getCredential(u.id) ? 'Password set' : 'No password yet'}</span>
              </span>
              <span className="flex w-full items-center gap-3 pl-12 sm:w-auto sm:pl-0">
                <StatusLabel status={u.status === 'active' ? 'Active' : u.status === 'locked' ? 'Locked' : 'Inactive'} tone={u.status === 'active' ? 'success' : u.status === 'locked' ? 'danger' : 'danger'} />
                <button type="button" aria-expanded={open === u.id} onClick={() => setOpen(open === u.id ? null : u.id)} className="inline-flex min-h-9 items-center gap-0.5 rounded-md px-1 text-[length:calc(14.5px*var(--fs))] font-semibold text-info hover:underline">
                  {open === u.id ? 'Close' : <>Manage Account <ChevronRight className="size-4" /></>}
                </button>
              </span>
            </div>
            {open === u.id && (testAccountByKey(u.id) ? (
              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-[var(--radius-control)] bg-surface-muted p-4 text-[length:calc(14.5px*var(--fs))] text-navy-900">
                Test account for the project team. It can switch between every level after signing in.
                <Button size="sm" icon={<KeyRound className="size-3.5" />} onClick={() => reset(u)}>Reset password</Button>
              </div>
            ) : <ManageUser u={u} me={me!} run={run} onReset={() => reset(u)} onSaved={(m) => setToast(m)} />)}
          </div>
        ))}
      </Card>
      {toast && (
        <div role="status" className="fixed right-4 bottom-4 z-50 flex max-w-sm items-start gap-2 rounded-lg border border-success/40 bg-surface px-4 py-3 text-[length:calc(15px*var(--fs))] text-navy-900 shadow-[0_8px_24px_rgba(0,33,50,0.15)]">
          <CheckCircle2 className="mt-px size-4 shrink-0 text-success" /> {toast}
        </div>
      )}
    </>
  )
}

function ManageUser({ u, me, run, onReset, onSaved }: { u: User; me: User; run: (fn: () => Promise<unknown>) => Promise<void>; onReset: () => void; onSaved: (message: string) => void }) {
  const [name, setName] = useState(u.fullName)
  const [role, setRoleValue] = useState<RoleId>(u.roleId)
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
            <span className="mb-1 block text-[length:calc(14px*var(--fs))] font-semibold text-navy-900">Display name</span>
            <span className="flex gap-2"><TextInput value={name} onChange={(e) => setName(e.target.value)} /><Button size="md" variant="secondary" onClick={() => run(() => setDisplayName(u.id, name, me))}>Save</Button></span>
          </label>
        ) : null}
      </div>
      {ASSIGNABLE_ROLES.includes(u.roleId) && (
        <label className="block max-w-md border-t border-line pt-4">
          <span className="mb-1 block text-[length:calc(14px*var(--fs))] font-semibold text-navy-900">Position (role)</span>
          <span className="flex gap-2">
            <Select value={role} onChange={(e) => setRoleValue(e.target.value as RoleId)}>
              {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{ROLES[r].name}</option>)}
            </Select>
            <Button size="md" variant="secondary" disabled={role === u.roleId} onClick={async () => { await run(() => setRole(u.id, role, me)); onSaved(`${u.fullName} is now ${ROLES[role].name}.`) }}>Save</Button>
          </span>
        </label>
      )}
      {GRANTABLE_ROLES.includes(u.roleId) ? (
        <div className="border-t border-line pt-4">
          <p className="text-[length:calc(14.5px*var(--fs))] font-semibold text-navy-900">Additional permissions for this account</p>
          <ul className="divide-y divide-line-soft overflow-hidden rounded-[var(--radius-control)] border border-line bg-surface">
            {GRANTABLE_STAFF_PERMISSIONS.map((p) => (
              <li key={p} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="text-[length:calc(15px*var(--fs))] text-navy-900">{PERMISSION_LABELS[p]}</span>
                <Toggle
                  showState
                  offTone="danger"
                  checked={perms.has(p)}
                  label={PERMISSION_LABELS[p]}
                  onChange={(next) => setPerms((s) => { const n = new Set(s); if (next) n.add(p); else n.delete(p); return n })}
                />
              </li>
            ))}
          </ul>
          {confirming ? (
            <div className="mt-3 flex flex-col gap-2 rounded-[var(--radius-control)] border border-warning/40 bg-warning-tint/60 p-3 sm:flex-row sm:items-end sm:justify-end">
              <label className="block flex-1 sm:max-w-xs">
                <span className="mb-1 block text-[length:calc(14px*var(--fs))] font-semibold text-navy-900">Enter your password to confirm <span className="text-danger-ink">*</span></span>
                <TextInput type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
              </label>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => { setConfirming(false); setPassword(''); setPwError(null) }}>Cancel</Button>
                <Button disabled={!password} onClick={save}>Confirm and save</Button>
              </div>
              {pwError && <p role="alert" className="text-[length:calc(14px*var(--fs))] text-danger-ink sm:basis-full sm:text-right">{pwError}</p>}
            </div>
          ) : (
            <div className="mt-3 flex justify-end">
              <Button disabled={!changed} onClick={() => setConfirming(true)}>Save permissions</Button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

/** Read-only matrix of the proposed permissions per role (docs/PERMISSION_MATRIX.md). */
export function RolesPage() {
  const { user } = useAuth()
  const [, setTick] = useState(0)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [phoneRole, setPhoneRole] = useState<RoleId>(EDITABLE_ROLES[0])
  useEffect(() => {
    const on = () => setTick((t) => t + 1)
    window.addEventListener('bmis:roles-changed', on)
    return () => window.removeEventListener('bmis:roles-changed', on)
  }, [])
  const toggle = async (r: RoleId, p: Permission, next: boolean) => {
    setMsg(null)
    try {
      await setRolePermission(r, p, next, user!)
      setMsg({ ok: true, text: `${ROLES[r].name}: "${PERMISSION_LABELS[p]}" ${next ? 'enabled' : 'disabled'}.` })
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ServiceError ? e.message : 'Could not save.' })
    }
  }
  const icons: Record<string, React.ReactNode> = {
    residents: <Users className="size-[18px]" />,
    documents: <FileText className="size-[18px]" />,
    cases: <Gavel className="size-[18px]" />,
    equipment: <Boxes className="size-[18px]" />,
    reports: <BarChart3 className="size-[18px]" />,
  }
  return (
    <>
      <PageHeader title="Roles and Permissions" />
      {msg && <p role="status" className={cn('mb-3 rounded-[var(--radius-control)] px-4 py-2.5 text-[length:calc(14.5px*var(--fs))]', msg.ok ? 'bg-success-tint text-navy-900' : 'bg-danger-tint text-danger-ink')}>{msg.text}</p>}
      <Card className="md:hidden">
        <label className="block border-b border-line-soft px-4 py-3">
          <span className="sr-only">Role</span>
          <select value={phoneRole} onChange={(e) => setPhoneRole(e.target.value as RoleId)} className="h-11 w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 text-[length:calc(15.5px*var(--fs))] font-semibold text-navy-900">
            {EDITABLE_ROLES.map((r) => <option key={r} value={r}>{ROLES[r].name}</option>)}
          </select>
        </label>
        {PERMISSION_GROUPS.map((g) => (
          <section key={g.id}>
            <h2 className="flex items-center gap-2 bg-surface-muted px-4 py-2 text-[length:calc(14.5px*var(--fs))] font-bold text-navy-900">{icons[g.id]}{g.name}</h2>
            <ul className="divide-y divide-line-soft">
              {g.permissions.map((p) => (
                <li key={p} className="flex min-h-[52px] items-center justify-between gap-3 px-4 py-2">
                  <span className="text-[length:calc(15px*var(--fs))] text-navy-900">{PERMISSION_LABELS[p]}</span>
                  <Toggle size="sm" checked={ROLE_PERMISSIONS[phoneRole].includes(p)} onChange={(next) => void toggle(phoneRole, p, next)} label={`${ROLES[phoneRole].name}: ${PERMISSION_LABELS[p]}`} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </Card>
      <Card className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[960px] text-[length:calc(15px*var(--fs))]">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="px-5 py-3 text-[length:calc(14px*var(--fs))] font-semibold text-ink-nav">Actions</th>
              {EDITABLE_ROLES.map((r) => <th key={r} className="w-[118px] px-2 py-3 text-center text-[length:calc(14px*var(--fs))] font-semibold text-navy-900">{ROLES[r].name.replace('Barangay ', '')}</th>)}
            </tr>
          </thead>
          {PERMISSION_GROUPS.map((g) => (
            <tbody key={g.id}>
              <tr className="bg-surface-muted">
                <th colSpan={EDITABLE_ROLES.length + 1} className="px-5 py-2.5 text-left">
                  <span className="flex items-center gap-2.5 text-[length:calc(15px*var(--fs))] font-bold text-navy-900">{icons[g.id]}{g.name}</span>
                </th>
              </tr>
              {g.permissions.map((p) => (
                <tr key={p} className="border-t border-line-soft">
                  <td className="px-5 py-3 text-navy-900">{PERMISSION_LABELS[p]}</td>
                  {EDITABLE_ROLES.map((r) => (
                    <td key={r} className="px-2 py-3 text-center">
                      <Toggle size="sm" checked={ROLE_PERMISSIONS[r].includes(p)} onChange={(next) => void toggle(r, p, next)} label={`${ROLES[r].name}: ${PERMISSION_LABELS[p]}`} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
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
      <PageHeader title="Activity Log" />
      <Card className="overflow-hidden">
        {entries.length === 0 ? (
          <p className="px-5 py-6 text-[length:calc(15px*var(--fs))] text-ink-muted">No activity recorded yet.</p>
        ) : (
          <>
            <table className="hidden w-full text-[length:calc(15px*var(--fs))] xl:table">
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
            <ul className="divide-y divide-line-soft xl:hidden">
              {paged.slice.map((e) => (
                <li key={e.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[length:calc(15.5px*var(--fs))] font-semibold text-navy-900">{e.action}</p>
                    <StatusLabel status={e.outcome === 'success' ? 'Success' : 'Failed'} tone={e.outcome === 'success' ? 'success' : 'danger'} />
                  </div>
                  <p className="text-[length:calc(14.5px*var(--fs))] text-ink-nav">{who(e.userId)} · {ROLES[e.roleAtTime]?.name}</p>
                  <p className="text-[length:calc(14px*var(--fs))] text-ink-muted">{e.module}{e.recordRef ? ` · ${e.recordRef}` : ''} · {formatDateTime(e.timestamp)}</p>
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
        <table className="hidden w-full text-[length:calc(15px*var(--fs))] xl:table">
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
        <ul className="divide-y divide-line-soft xl:hidden">
          {paged.slice.map((o) => (
            <li key={o.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <span className="min-w-0">
                <span className="block text-[length:calc(16px*var(--fs))] font-semibold text-navy-900">{o.name}</span>
                <span className="block text-[length:calc(14.5px*var(--fs))] text-ink-nav">{o.position}</span>
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
      <PageHeader title="System Settings" />
      <Card className="divide-y divide-line-soft">
        {rows.map(([k, v]) => (
          <div key={k} className="flex flex-col gap-0.5 px-5 py-3 text-[length:calc(15px*var(--fs))] sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <span className="text-ink-nav">{k}</span>
            <strong className="text-navy-900 sm:text-right">{v}</strong>
          </div>
        ))}
      </Card>
      <ServiceStandardsPanel />
      <StoragePanel />
    </>
  )
}

export function HealthPage() {
  const items: [string, string, 'ok' | 'pending'][] = [
    ['Application', 'Running', 'ok'],
    ['Database', 'Not connected', 'pending'],
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
          <div key={k} className="flex flex-col gap-1 px-5 py-3 text-[length:calc(15px*var(--fs))] sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <span className="font-semibold text-navy-900">{k}</span>
            <span className={cn('flex items-center gap-2 sm:text-right', s === 'ok' ? 'text-success' : 'text-ink-muted')}>{s === 'ok' ? <Check className="size-4" /> : <Info className="size-4" />}{v}</span>
          </div>
        ))}
      </Card>
    </>
  )
}
