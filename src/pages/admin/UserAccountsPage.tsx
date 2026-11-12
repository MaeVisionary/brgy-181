import { CheckCircle2, ChevronDown, Download, KeyRound, MoreHorizontal, Pencil, Plus, Search, UserCheck, UserX, X } from '@/icons'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/auth/useAuth'
import { Button, IconButton } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FieldLabel, Select, TextInput } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Panel'
import { Pagination, usePaged } from '@/components/ui/Pagination'
import { StatusLabel } from '@/components/ui/StatusLabel'
import { OFFICIALS } from '@/config/barangay'
import { ROLES } from '@/config/permissions'
import { TEST_ACCOUNTS, testAccountByKey, testUserFor } from '@/config/testAccount'
import { useStickyState } from '@/hooks/useStickyState'
import { cn } from '@/lib/cn'
import { formatDate, formatDateTime, initials } from '@/lib/format'
import { residentById } from '@/mocks/residents'
import { audit } from '@/services/auditService'
import { getCredential } from '@/services/credentialStore'
import { sendResetLinkFor } from '@/services/passwordResetService'
import { ServiceError } from '@/services/mockApi'
import { listRegistrations } from '@/services/registrationService'
import { CREATABLE_ROLES, createPersonnelAccount, listUsers, newAccountErrors, setStatus, type NewPersonnelAccount } from '@/services/userService'
import type { ResidentRegistration } from '@/types/resident'
import type { User } from '@/types/auth'
import { ManageUser } from './AdminPages'

/**
 * User Accounts. Desktop (≥1280px): a table with selectable, expandable rows.
 * Smaller screens: a list of account cards with the same details and actions.
 * Status changes, password resets and role requests go through the existing
 * services (administrator only, logged); bulk status changes are confirmed first.
 */

type Group = 'all' | 'personnel' | 'residents'
type Row = User & { test?: boolean }

const STATUS: Record<string, { label: string; tone: 'success' | 'danger' | 'warning' | 'neutral' }> = {
  active: { label: 'Active', tone: 'success' },
  inactive: { label: 'Inactive', tone: 'neutral' },
  locked: { label: 'Locked', tone: 'danger' },
  pending: { label: 'Pending verification', tone: 'warning' },
}
const VERIFICATION: Record<ResidentRegistration['status'], string> = {
  auto_approved: 'Verified (records matched)',
  approved: 'Verified by the Barangay Secretary',
  manual_review: 'Waiting for review',
  rejected: 'Not approved',
}
const NOT_ON_FILE = 'Not on file'

export function UsersPage() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [regs, setRegs] = useState<ResidentRegistration[]>([])
  const load = () => listUsers().then((u) => setUsers([...u]))
  useEffect(() => { load(); listRegistrations().then(setRegs).catch(() => setRegs([])) }, [])
  const [err, setErr] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  useEffect(() => { if (!toast) return; const t = window.setTimeout(() => setToast(null), 3500); return () => window.clearTimeout(t) }, [toast])

  const [group, setGroup] = useState<Group>('all')
  const [query, setQuery] = useStickyState('query', '')
  const [open, setOpen] = useState<{ id: string; edit: boolean } | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirm, setConfirm] = useState<null | { kind: 'activate' | 'deactivate'; ids: string[] }>(null)
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)

  const accounts: Row[] = useMemo(() => [
    ...TEST_ACCOUNTS.map((a) => ({ ...testUserFor('system_admin', a), id: a.credentialKey, position: 'Test account (all levels)', test: true })),
    ...users,
  ], [users])
  const regFor = (u: User) => regs.filter((r) => r.accountUserId === u.id).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0]
  const statusOf = (u: Row) => {
    const r = u.roleId === 'resident' ? regFor(u) : undefined
    if (u.status === 'active' && r?.status === 'manual_review') return STATUS.pending
    return STATUS[u.status] ?? STATUS.inactive
  }
  const contactOf = (u: User) => (u.roleId === 'resident' ? (u.residentId ? residentById(u.residentId)?.contactNo : undefined) : u.contactNo) || ''
  const residentNoOf = (u: User) => (u.residentId ? residentById(u.residentId)?.residentNo : undefined) ?? ''

  const q = query.trim().toLowerCase()
  const digits = q.replace(/\D/g, '')
  const inGroup = (u: User, g: Group) => g === 'all' || (g === 'residents' ? u.roleId === 'resident' : u.roleId !== 'resident')
  const matches = (u: Row) => !q || [u.fullName, u.username, u.email, u.position, ROLES[u.roleId].name, u.accountNo ?? '', residentNoOf(u)].some((x) => x.toLowerCase().includes(q))
    || (digits.length >= 4 && contactOf(u).replace(/\D/g, '').includes(digits))
  const shown = accounts.filter((u) => inGroup(u, group) && matches(u))
  const count = (g: Group) => accounts.filter((u) => inGroup(u, g)).length
  const paged = usePaged(shown, 10)
  // New filter or search: back to the first page, nothing expanded.
  useEffect(() => { paged.setPage(0); setOpen(null) }, [group, q]) // eslint-disable-line react-hooks/exhaustive-deps

  const changeable = (u: Row) => !u.test && u.id !== me?.id
  const pageIds = paged.slice.map((u) => u.id)
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id))
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const togglePage = () => setSelected((s) => { const n = new Set(s); for (const id of pageIds) if (allOnPage) n.delete(id); else n.add(id); return n })
  const picked = accounts.filter((u) => selected.has(u.id))

  // Personnel never see or set a password: the owner gets a single-use link at their registered e-mail.
  const reset = async (u: Row) => {
    setErr(null)
    try { await sendResetLinkFor(u.id, me!); setToast(`Reset link sent to ${u.email}. It works once and expires in 15 minutes.`) } catch (e) { setErr(e instanceof ServiceError ? e.message : 'The link could not be sent. Please try again.') }
  }
  const run = async (fn: () => Promise<unknown>) => {
    setErr(null)
    try { await fn(); await load() } catch (e) { setErr(e instanceof ServiceError ? e.message : 'The change could not be saved. Please try again.') }
  }
  const applyStatus = async () => {
    if (!confirm || !me) return
    setBusy(true); setErr(null)
    const target = confirm.kind === 'activate' ? 'active' : 'inactive'
    let done = 0
    const failed: string[] = []
    for (const id of confirm.ids) {
      const u = accounts.find((x) => x.id === id)
      if (!u || !changeable(u) || u.status === target) continue
      try { await setStatus(id, target, me); done++ } catch { failed.push(u.fullName) }
    }
    await load()
    setBusy(false); setConfirm(null); setSelected(new Set())
    setToast(`${done} account${done === 1 ? '' : 's'} ${target === 'active' ? 'activated' : 'deactivated'}.${failed.length ? ` Not changed: ${failed.join(', ')}.` : ''}`)
  }
  const exportSelected = () => {
    if (!me || !picked.length) return
    // Account list only: no passwords, ID numbers or resident details.
    const rows = [['Name', 'Username', 'Account number', 'Role', 'Email', 'Status'], ...picked.map((u) => [u.fullName, u.username, u.accountNo ?? '', ROLES[u.roleId].name, u.email, statusOf(u).label])]
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }))
    a.download = `bmis-accounts-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
    audit(me, 'Exported accounts', 'User accounts', `${picked.length} account${picked.length === 1 ? '' : 's'}`)
    setToast(`Exported ${picked.length} account${picked.length === 1 ? '' : 's'}.`)
  }
  const statusAction = (u: Row) => u.status === 'active'
    ? { label: 'Deactivate account', icon: <UserX />, danger: true, onSelect: () => setConfirm({ kind: 'deactivate', ids: [u.id] }) }
    : { label: 'Activate account', icon: <UserCheck />, onSelect: () => setConfirm({ kind: 'activate', ids: [u.id] }) }
  const menuFor = (u: Row): MenuItem[] => [
    ...(u.roleId === 'system_admin' || u.test ? [] : [{ label: 'Send password reset link', icon: <KeyRound />, onSelect: () => reset(u) }]),
    ...(changeable(u) ? [statusAction(u)] : []),
  ]
  const isOpen = (u: Row) => open?.id === u.id
  const expand = (u: Row, edit = false) => setOpen(isOpen(u) && open?.edit === edit ? null : { id: u.id, edit })

  const details = (u: Row) => (
    <AccountDetails u={u} status={statusOf(u).label} contact={contactOf(u)} residentNo={residentNoOf(u)} reg={u.roleId === 'resident' ? regFor(u) : undefined}>
      {open?.edit && (u.test ? (
        <p className="rounded-[var(--radius-control)] border border-line bg-surface px-4 py-3 text-[length:calc(15px*var(--fs))] text-navy-900">Test account for the project team. Its role and permissions are not edited here. Administrator passwords are recovered through Account Recovery with the Punong Barangay's approval.</p>
      ) : <ManageUser u={u} me={me!} run={run} onReset={() => reset(u)} onSaved={(m) => setToast(m)} hideQuickActions />)}
    </AccountDetails>
  )

  return (
    <>
      <PageHeader
        title="User Accounts"
        subtitle="Accounts for Barangay 181 officials, personnel and residents."
        actions={<Button icon={<Plus />} onClick={() => setAdding(true)}>Add User</Button>}
      />
      {err && <p role="alert" className="mb-3 rounded-md bg-danger-tint px-4 py-3 text-[length:calc(15px*var(--fs))] text-danger-ink">{err}</p>}

      {/* Filters and search */}
      <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-center">
        <div role="tablist" aria-label="Account group" className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-3 xl:flex">
          {([['all', 'All'], ['personnel', 'Barangay Personnel'], ['residents', 'Residents']] as const).map(([k, label]) => (
            <button
              key={k}
              role="tab"
              type="button"
              aria-selected={group === k}
              onClick={() => setGroup(k)}
              className={cn('inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[var(--radius-control)] border px-3.5 text-center text-[length:calc(15px*var(--fs))] leading-tight font-semibold', group === k ? 'border-navy-900 bg-navy-900 text-white' : 'border-line bg-surface text-navy-900 hover:bg-surface-muted')}
            >
              {label} <span className={group === k ? 'text-white/80' : 'text-ink-nav'}>({count(k)})</span>
            </button>
          ))}
        </div>
        <label className="relative block flex-1">
          <span className="sr-only">Search accounts</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-ink-subtle" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, username, email, role, number or contact" className="h-12 w-full rounded-[var(--radius-control)] border border-line bg-surface pr-3 pl-10 text-[length:calc(16px*var(--fs))] text-navy-900 placeholder:text-ink-subtle focus:border-navy-600 focus:outline-none" />
        </label>
      </div>

      {/* Bulk actions for the selected accounts */}
      {picked.length > 0 && (
        <div role="region" aria-label="Selected accounts" className="mb-3 flex flex-col gap-2 rounded-[var(--radius-control)] border border-navy-900/20 bg-sky-50 px-4 py-3 md:flex-row md:items-center">
          <p className="flex-1 text-[length:calc(15.5px*var(--fs))] font-semibold text-navy-900">{picked.length} selected</p>
          <div className="grid grid-cols-2 gap-2 md:flex">
            <Button size="sm" variant="secondary" icon={<UserCheck />} onClick={() => setConfirm({ kind: 'activate', ids: picked.map((u) => u.id) })}>Activate</Button>
            <Button size="sm" variant="danger" icon={<UserX />} onClick={() => setConfirm({ kind: 'deactivate', ids: picked.map((u) => u.id) })}>Deactivate</Button>
            <Button size="sm" variant="secondary" icon={<Download />} onClick={exportSelected}>Export selected</Button>
            <Button size="sm" variant="ghost" icon={<X />} onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        </div>
      )}

      <Card className="overflow-hidden">
        {shown.length === 0 ? <p className="px-5 py-8 text-center text-[length:calc(16px*var(--fs))] text-ink-nav">No accounts match your search.</p> : (
          <>
            {/* Desktop: table */}
            <table className="hidden w-full table-fixed text-left text-[length:calc(15px*var(--fs))] xl:table">
              <thead className="border-b border-line bg-surface-muted">
                <tr>
                  <th className="w-14 px-3 py-2"><Check label="Select all accounts on this page" checked={allOnPage} onChange={togglePage} /></th>
                  {/* 1280–1535px: username sits under the name and the contact number under the email. */}
                  {([['Name', 'w-[27%] 2xl:w-[22%]'], ['Username', 'hidden w-[13%] 2xl:table-cell'], ['Role', 'w-[16%] 2xl:w-[13%]'], ['Email', 'w-[28%] 2xl:w-[21%]'], ['Contact Number', 'hidden w-[12%] 2xl:table-cell'], ['Status', 'w-[12%] 2xl:w-[9%]']] as const).map(([h, w]) => <th key={h} scope="col" className={cn('label-caps px-3 py-3', w)}>{h}</th>)}
                  <th scope="col" className="label-caps w-[100px] px-3 py-3 text-right"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {paged.slice.map((u) => {
                  const st = statusOf(u)
                  return [
                    <tr key={u.id} className={cn('border-b border-line-soft transition-colors', isOpen(u) ? 'bg-sky-50' : selected.has(u.id) ? 'bg-sky-50/60' : 'hover:bg-surface-muted/60')}>
                      <td className="px-3 py-2 align-middle"><Check label={`Select ${u.fullName}`} checked={selected.has(u.id)} onChange={() => toggle(u.id)} /></td>
                      <td className="px-1 py-2">
                        <button type="button" aria-expanded={isOpen(u)} aria-controls={`acct-${u.id}`} onClick={() => expand(u)} className="flex min-h-11 w-full items-center gap-2 rounded-[var(--radius-control)] px-2 text-left hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-navy-600">
                          <ChevronDown className={cn('size-5 shrink-0 text-ink-nav transition-transform', !isOpen(u) && '-rotate-90')} />
                          <Avatar name={u.fullName} />
                          <span className="min-w-0 leading-snug">
                            <span className="block font-semibold [overflow-wrap:anywhere] text-navy-900">{u.fullName}</span>
                            <span className="block text-[length:calc(14px*var(--fs))] [overflow-wrap:anywhere] text-ink-nav 2xl:hidden">{u.username}</span>
                          </span>
                        </button>
                      </td>
                      <td className="hidden px-3 py-2 [overflow-wrap:anywhere] text-navy-900 2xl:table-cell">{u.username}</td>
                      <td className="px-3 py-2 text-navy-900">{u.test ? 'Test account' : ROLES[u.roleId].name}</td>
                      <td className="px-3 py-2 leading-snug [overflow-wrap:anywhere] text-navy-900">{u.email}<span className="block text-[length:calc(14px*var(--fs))] text-ink-nav 2xl:hidden">{contactOf(u) || `Contact: ${NOT_ON_FILE.toLowerCase()}`}</span></td>
                      <td className="hidden px-3 py-2 text-navy-900 2xl:table-cell">{contactOf(u) || <span className="text-ink-nav">{NOT_ON_FILE}</span>}</td>
                      <td className="px-3 py-2"><StatusLabel status={st.label} tone={st.tone} /></td>
                      <td className="px-3 py-2">
                        <span className="flex justify-end gap-0.5">
                          <IconButton label={`Edit ${u.fullName}`} onClick={() => expand(u, true)} className={cn(isOpen(u) && open?.edit && 'bg-sky-100')}><Pencil /></IconButton>
                          <RowMenu label={`More actions for ${u.fullName}`} items={menuFor(u)} />
                        </span>
                      </td>
                    </tr>,
                    isOpen(u) && (
                      <tr key={`${u.id}-d`} id={`acct-${u.id}`} className="border-b border-line-soft bg-sky-50/50">
                        <td />
                        <td colSpan={7} className="px-3 pt-1 pb-5">{details(u)}</td>
                      </tr>
                    ),
                  ]
                })}
              </tbody>
            </table>

            {/* Phones and tablets: account cards */}
            <ul className="divide-y divide-line-soft xl:hidden">
              {paged.slice.map((u) => {
                const st = statusOf(u)
                return (
                  <li key={u.id} className={cn('px-4 py-3', (isOpen(u) || selected.has(u.id)) && 'bg-sky-50/60')}>
                    <div className="flex items-start gap-3">
                      <Check label={`Select ${u.fullName}`} checked={selected.has(u.id)} onChange={() => toggle(u.id)} />
                      <div className="min-w-0 flex-1 pt-1.5">
                        <p className="text-[length:calc(17px*var(--fs))] leading-snug font-semibold break-words text-navy-900">{u.fullName}</p>
                        <p className="text-[length:calc(15.5px*var(--fs))] text-ink-nav">{u.test ? 'Test account' : ROLES[u.roleId].name}</p>
                        <span className="mt-1.5 inline-flex"><StatusLabel status={st.label} tone={st.tone} /></span>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-[1fr_1fr_auto] gap-2 pl-[52px]">
                      <Button size="sm" variant="secondary" aria-expanded={isOpen(u) && !open?.edit} onClick={() => expand(u)} icon={<ChevronDown className={cn('transition-transform', !(isOpen(u) && !open?.edit) && '-rotate-90')} />}>
                        Details
                      </Button>
                      <Button size="sm" variant="secondary" icon={<Pencil />} aria-expanded={isOpen(u) && !!open?.edit} onClick={() => expand(u, true)}>Edit</Button>
                      <RowMenu label={`More actions for ${u.fullName}`} items={menuFor(u)} bordered />
                    </div>
                    {isOpen(u) && <div id={`acct-${u.id}`} className="mt-3">{details(u)}</div>}
                  </li>
                )
              })}
            </ul>
          </>
        )}
        <Pagination page={paged.page} pages={paged.pages} total={paged.total} size={paged.size} onPage={(p) => { paged.setPage(p); setOpen(null) }} noun="accounts" />
      </Card>

      {confirm && (
        <ConfirmDialog
          title={`${confirm.kind === 'activate' ? 'Activate' : 'Deactivate'} ${confirm.ids.length === 1 ? 'this account' : `${confirm.ids.length} accounts`}?`}
          confirmLabel={confirm.kind === 'activate' ? 'Activate' : 'Deactivate'}
          destructive={confirm.kind === 'deactivate'}
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={applyStatus}
        >
          {(() => {
            const list = confirm.ids.map((id) => accounts.find((u) => u.id === id)!).filter(Boolean)
            const skip = list.filter((u) => !changeable(u))
            return (
              <>
                <p>{confirm.kind === 'deactivate' ? 'They will not be able to sign in until the account is activated again.' : 'They will be able to sign in again.'}</p>
                {list.length <= 4 && <p className="mt-1 font-semibold text-navy-900">{list.map((u) => u.fullName).join(', ')}</p>}
                {skip.length > 0 && <p className="mt-1">Not changed: {skip.map((u) => (u.id === me?.id ? 'your own account' : u.fullName)).join(', ')}.</p>}
              </>
            )
          })()}
        </ConfirmDialog>
      )}
      {adding && <AddUserDialog onClose={() => setAdding(false)} onCreated={(u) => { setAdding(false); load(); setToast(`Account ${u.accountNo} created. A setup link was sent to ${u.email}.`) }} />}
      {toast && (
        <div role="status" className="fixed right-4 bottom-4 z-50 flex max-w-sm items-start gap-2 rounded-lg border border-success/40 bg-surface px-4 py-3 text-[length:calc(15px*var(--fs))] text-navy-900 shadow-[0_8px_24px_rgba(0,33,50,0.15)]">
          <CheckCircle2 className="icon-line w-4 text-success" /> {toast}
        </div>
      )}
    </>
  )
}

// ── Pieces ───────────────────────────────────────────────────────────

function Avatar({ name }: { name: string }) {
  return <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-sky-100 text-[length:calc(13.5px*var(--fs))] font-semibold text-navy-900">{initials(name)}</span>
}

/** 44×44 tap area around a standard checkbox. */
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-[var(--radius-control)] hover:bg-sky-50">
      <input type="checkbox" aria-label={label} checked={checked} onChange={onChange} className="size-5 cursor-pointer accent-navy-900" />
    </label>
  )
}

interface MenuItem { label: string; icon: React.ReactNode; onSelect: () => void; danger?: boolean }

function RowMenu({ label, items, bordered }: { label: string; items: MenuItem[]; bordered?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const off = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', off)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', off); document.removeEventListener('keydown', esc) }
  }, [open])
  if (!items.length) return null
  return (
    <div ref={ref} className="relative">
      <IconButton label={label} variant={bordered ? 'secondary' : 'ghost'} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}><MoreHorizontal /></IconButton>
      {open && (
        <div role="menu" aria-label={label} className="absolute right-0 z-30 mt-1 w-60 overflow-hidden rounded-[var(--radius-control)] border border-line bg-surface py-1 shadow-[0_8px_24px_rgba(0,33,50,0.15)]">
          {items.map((it) => (
            <button key={it.label} type="button" role="menuitem" onClick={() => { setOpen(false); it.onSelect() }} className={cn('flex min-h-11 w-full items-center gap-3 px-4 text-left text-[length:calc(15.5px*var(--fs))] font-semibold hover:bg-surface-muted [&_svg]:size-5 [&_svg]:shrink-0', it.danger ? 'text-danger-ink' : 'text-navy-900')}>
              {it.icon} {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Expanded details: only fields the system actually holds; missing ones say so. */
function AccountDetails({ u, status, contact, residentNo, reg, children }: { u: Row; status: string; contact: string; residentNo: string; reg?: ResidentRegistration; children?: React.ReactNode }) {
  const resident = u.residentId ? residentById(u.residentId) : undefined
  const cred = getCredential(u.id)
  const password = cred?.mustChange ? 'Must be changed at next sign-in' : testAccountByKey(u.id) || cred ? 'Set by the account owner' : 'Not set yet (setup link sent)'
  const official = OFFICIALS.find((o) => o.userId === u.id)
  const account: [string, string][] = [
    ['Account number', u.accountNo ?? NOT_ON_FILE],
    ['Account status', status],
    ['Password', password],
    [u.roleId === 'resident' ? 'Registered' : 'Account created', u.createdAt ? formatDate(u.createdAt) : reg ? formatDate(reg.submittedAt) : 'Not recorded'],
    ['Last sign-in', u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'Not recorded'],
  ]
  const about: [string, string][] = u.roleId === 'resident'
    ? [
        ['Full name', u.fullName],
        ['Resident number', residentNo || NOT_ON_FILE],
        ['Email', u.email],
        ['Contact number', contact || NOT_ON_FILE],
        ['Verification', reg ? VERIFICATION[reg.status] : resident ? 'Linked to a resident record' : 'Not verified'],
        ['Linked resident record', resident ? `${resident.firstName} ${resident.lastName}${residentNo ? ` · ${residentNo}` : ''}` : 'Not linked'],
      ]
    : [
        ['Full name', u.fullName],
        ['Role', u.test ? 'Test account (all levels)' : ROLES[u.roleId].name],
        ['Responsibility', official ? `${official.position} (barangay records)` : u.position],
        ['Email', u.email],
        ['Contact number', contact || NOT_ON_FILE],
      ]
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <DetailSection title={u.roleId === 'resident' ? 'Resident' : 'Barangay Personnel'} rows={about} />
        <DetailSection title="Account" rows={account} />
      </div>
      {children}
    </div>
  )
}

function DetailSection({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <section className="rounded-[var(--radius-control)] border border-line bg-surface px-4 py-3">
      <h3 className="label-caps mb-1">{title}</h3>
      <dl className="divide-y divide-line-soft">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-1 gap-0.5 py-2 sm:grid-cols-[150px_1fr] sm:gap-3">
            <dt className="text-[length:calc(14.5px*var(--fs))] text-ink-nav">{k}</dt>
            <dd className={cn('text-[length:calc(15.5px*var(--fs))] break-words', v === NOT_ON_FILE || v === 'Not recorded' ? 'text-ink-nav' : 'text-navy-900')}>{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/** Barangay Personnel only: residents get accounts by registering and being verified. */
function AddUserDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (u: User) => void }) {
  const { user: me } = useAuth()
  const [f, setF] = useState<NewPersonnelAccount>({ fullName: '', username: '', email: '', contactNo: '', roleId: 'property_custodian' })
  const [shownErrs, setShownErrs] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const errs = newAccountErrors(f)
  const set = (k: keyof NewPersonnelAccount) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))
  const box = useRef<HTMLFormElement>(null)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setShownErrs(true); setErr(null)
    if (Object.keys(errs).length) { window.setTimeout(() => box.current?.querySelector<HTMLElement>('[aria-invalid=true]')?.focus(), 0); return }
    setBusy(true)
    try { const r = await createPersonnelAccount(f, me!); onCreated(r.user) } catch (x) { setErr(x instanceof ServiceError ? x.message : 'The account could not be created. Please try again.') } finally { setBusy(false) }
  }
  const e = (k: keyof NewPersonnelAccount) => (shownErrs ? errs[k] : undefined)
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-navy-900/40 sm:items-center sm:px-4" role="presentation">
      <form ref={box} onSubmit={submit} noValidate role="dialog" aria-modal="true" aria-labelledby="add-user-title" className="max-h-[92dvh] w-full max-w-[560px] overflow-y-auto rounded-t-2xl bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 id="add-user-title" className="font-display text-[length:calc(21px*var(--fs))] font-bold text-navy-900">Add Barangay Personnel account</h2>
          <IconButton label="Close" onClick={onClose}><X /></IconButton>
        </div>
        <p className="mt-1 text-[length:calc(15px*var(--fs))] text-ink-nav">Residents get their accounts by registering online and being verified. A setup link is e-mailed to the person so they choose their own password; no one else sees it.</p>
        <div className="mt-4 space-y-4">
          <FieldLabel label="Position" required error={e('roleId')}>
            <Select value={f.roleId} onChange={set('roleId')} aria-invalid={!!e('roleId')}>
              {CREATABLE_ROLES.map((r) => <option key={r} value={r}>{ROLES[r].name}</option>)}
            </Select>
          </FieldLabel>
          {([['fullName', 'Full name', 'text', 'name'], ['username', 'Username', 'text', 'username'], ['email', 'Email', 'email', 'email'], ['contactNo', 'Contact number (optional)', 'tel', 'tel']] as const).map(([k, label, type, ac]) => (
            <FieldLabel key={k} label={label} required={k !== 'contactNo'} error={e(k)}>
              <TextInput type={type} autoComplete={ac === 'username' ? 'off' : ac} inputMode={k === 'contactNo' ? 'numeric' : undefined} value={f[k] ?? ''} onChange={set(k)} aria-invalid={!!e(k)} />
            </FieldLabel>
          ))}
        </div>
        {err && <p role="alert" className="mt-3 text-[length:calc(15px*var(--fs))] font-semibold text-danger-ink">{err}</p>}
        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button type="submit" loading={busy} className="sm:order-last">Create account</Button>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </div>
  )
}

