import { useEffect, useState } from 'react'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, Panel } from '@/components/ui/Panel'
import { StepUpDialog } from '@/components/ui/StepUpDialog'
import { APP_CONFIG } from '@/config/app'
import { formatDateTime } from '@/lib/format'
import { mockUsers } from '@/mocks/users'
import { listAudit } from '@/services/auditService'
import { ServiceError } from '@/services/mockApi'
import { approveAccessRequest, canApproveAccess, cancelAccessRequest, listAccessRequests, rejectAccessRequest, type AccessRequest } from '@/services/userService'

const nameOf = (id?: string) => mockUsers.find((u) => u.id === id)?.fullName ?? '—'
const cell = (v: boolean | string) => (typeof v === 'string' ? v : v ? 'Yes' : 'No')

function Rows({ r }: { r: AccessRequest }) {
  return (
    <table className="mt-2 w-full text-[length:calc(15px*var(--fs))]">
      <thead><tr className="border-b border-line text-left text-[length:calc(14px*var(--fs))] text-ink-nav"><th className="py-2 pr-2 font-semibold">Change</th><th className="px-2 py-2 font-semibold">Before</th><th className="py-2 pl-2 font-semibold">After</th></tr></thead>
      <tbody>{r.rows.map(([k, b, a], i) => <tr key={i} className="border-b border-line-soft"><td className="py-2 pr-2 text-navy-900">{k}</td><td className="px-2 py-2 text-ink-nav">{cell(b)}</td><td className="py-2 pl-2 font-semibold text-navy-900">{cell(a)}</td></tr>)}</tbody>
    </table>
  )
}

/** Access changes waiting for a second person, recent decisions and security events. */
export function SecurityPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<AccessRequest[]>([])
  const [open, setOpen] = useState<AccessRequest | null>(null)
  const [mode, setMode] = useState<null | 'approve' | 'reject' | 'cancel'>(null)
  const [reason, setReason] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const load = () => { if (user) listAccessRequests(user).then(setItems).catch(() => setItems([])) }
  useEffect(load, [user])
  if (!user) return null
  const pending = items.filter((r) => r.status === 'pending')
  const decided = items.filter((r) => r.status !== 'pending').slice(0, 10)
  const events = listAudit().filter((e) => e.module === 'Security' && e.outcome === 'failure').slice(0, 8)
  const canDecide = (r: AccessRequest) => canApproveAccess(user) && r.initiatorId !== user.id && !r.affectedUserIds.includes(user.id)
  const done = (text: string, ok = true) => { setMsg({ ok, text }); setOpen(null); setMode(null); setReason(''); load() }

  return (
    <>
      <PageHeader title="Security" />
      {msg && <p role="status" className={`mb-3 rounded-[var(--radius-control)] px-4 py-2.5 text-[length:calc(15px*var(--fs))] ${msg.ok ? 'bg-success-tint text-navy-900' : 'bg-danger-tint text-danger-ink'}`}>{msg.text}</p>}

      <Panel title="Waiting for approval" bodyClassName="px-0 py-0">
        {pending.length === 0 ? <p className="px-5 py-5 text-[length:calc(16px*var(--fs))] text-ink-muted">Nothing waiting.</p> : (
          <ul className="divide-y divide-line-soft">
            {pending.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <span className="min-w-0 flex-1 basis-[220px]">
                  <span className="block font-semibold text-navy-900">{r.title}</span>
                  <span className="block text-[length:calc(14.5px*var(--fs))] text-ink-muted">{r.ref} · asked by {nameOf(r.initiatorId)} · {formatDateTime(r.createdAt)}</span>
                </span>
                <Button size="sm" variant="secondary" onClick={() => { setOpen(r); setMode(null) }}>Review</Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {open && !mode && (
        <ConfirmDialog title={open.title} confirmLabel={canDecide(open) ? 'Approve…' : open.initiatorId === user.id ? 'Cancel request' : 'Close'} cancelLabel={canDecide(open) ? 'Reject…' : 'Back'} destructive={!canDecide(open) && open.initiatorId === user.id}
          onCancel={() => (canDecide(open) ? setMode('reject') : setOpen(null))}
          onConfirm={() => (canDecide(open) ? setMode('approve') : open.initiatorId === user.id ? setMode('cancel') : setOpen(null))}>
          <div className="text-left">
            <p className="text-[length:calc(15px*var(--fs))]">{open.ref} · asked by {nameOf(open.initiatorId)}</p>
            <Rows r={open} />
            <p className="mt-2 text-[length:calc(15px*var(--fs))]"><span className="text-ink-muted">Reason:</span> {open.reason}</p>
            {!canDecide(open) && <p className="mt-2 text-[length:calc(14.5px*var(--fs))] text-ink-muted">{open.initiatorId === user.id ? 'Another administrator or the Barangay Chairman must approve this.' : 'You cannot decide a change to your own access.'}</p>}
          </div>
        </ConfirmDialog>
      )}
      {open && mode === 'approve' && (
        <StepUpDialog title="Approve access change" action="approve-access" payload={{ id: open.id }} confirmLabel="Approve" onCancel={() => setMode(null)}
          onApply={async (_reason, challengeId) => { await approveAccessRequest(open.id, challengeId, user); done(`${open.ref} approved and applied. Everyone involved has been notified.`) }}>
          <p className="text-[length:calc(15px*var(--fs))] text-navy-900">{open.title} · asked by {nameOf(open.initiatorId)}</p>
          <Rows r={open} />
        </StepUpDialog>
      )}
      {open && mode === 'reject' && (
        <ConfirmDialog title="Reject this request?" confirmLabel="Reject" destructive onCancel={() => setMode(null)}
          onConfirm={async () => { try { await rejectAccessRequest(open.id, reason, user); done(`${open.ref} rejected. Nothing was changed.`) } catch (e) { setMsg({ ok: false, text: e instanceof ServiceError ? e.message : 'Not saved.' }) } }}>
          <textarea aria-label="Reason for rejecting" placeholder="Reason" className="mt-2 min-h-[80px] w-full rounded-[var(--radius-control)] border border-line px-3 py-2 text-left text-[length:calc(16px*var(--fs))] text-navy-900" value={reason} onChange={(e) => setReason(e.target.value)} />
        </ConfirmDialog>
      )}
      {open && mode === 'cancel' && (
        <ConfirmDialog title="Cancel this request?" confirmLabel="Cancel request" cancelLabel="Keep" destructive onCancel={() => setMode(null)}
          onConfirm={async () => { await cancelAccessRequest(open.id, user); done(`${open.ref} cancelled.`) }} />
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Recent decisions" bodyClassName="px-0 py-0">
          {decided.length === 0 ? <p className="px-5 py-5 text-[length:calc(16px*var(--fs))] text-ink-muted">None yet.</p> : (
            <ul className="divide-y divide-line-soft">
              {decided.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <span className="min-w-0"><span className="block truncate font-semibold text-navy-900">{r.title}</span><span className="block text-[length:calc(14px*var(--fs))] text-ink-muted">{r.ref} · {r.decidedBy ? nameOf(r.decidedBy) : '—'}</span></span>
                  <span className={`shrink-0 text-[length:calc(14.5px*var(--fs))] font-semibold ${r.status === 'approved' ? 'text-success' : r.status === 'rejected' ? 'text-danger-ink' : 'text-ink-muted'}`}>{r.status[0].toUpperCase() + r.status.slice(1)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Blocked or failed attempts" bodyClassName="px-0 py-0">
          {events.length === 0 ? <p className="px-5 py-5 text-[length:calc(16px*var(--fs))] text-ink-muted">None in this session.</p> : (
            <ul className="divide-y divide-line-soft">
              {events.map((e) => <li key={e.id} className="px-5 py-3"><span className="block text-navy-900">{e.action}</span><span className="block text-[length:calc(14px*var(--fs))] text-ink-muted">{nameOf(e.userId)} · {formatDateTime(e.timestamp)}</span></li>)}
            </ul>
          )}
        </Panel>
      </div>

      <Card className="mt-4 px-5 py-4">
        <h2 className="font-display text-[length:calc(19px*var(--fs))] font-bold text-navy-900">Rules in force</h2>
        <dl className="mt-2 grid grid-cols-1 gap-x-8 gap-y-1.5 text-[length:calc(15px*var(--fs))] sm:grid-cols-2">
          <div className="flex justify-between gap-3 border-b border-line-soft py-1.5"><dt className="text-ink-nav">Access changes</dt><dd className="text-right text-navy-900">Second approval required</dd></div>
          <div className="flex justify-between gap-3 border-b border-line-soft py-1.5"><dt className="text-ink-nav">Second approver</dt><dd className="text-right text-navy-900">Another admin or the Chairman</dd></div>
          <div className="flex justify-between gap-3 border-b border-line-soft py-1.5"><dt className="text-ink-nav">Request expires</dt><dd className="text-right text-navy-900">24 hours</dd></div>
          <div className="flex justify-between gap-3 border-b border-line-soft py-1.5"><dt className="text-ink-nav">Confirmation</dt><dd className="text-right text-navy-900">Password, 5 min, 5 tries</dd></div>
          <div className="flex justify-between gap-3 border-b border-line-soft py-1.5"><dt className="text-ink-nav">Idle sign-out</dt><dd className="text-right text-navy-900">{APP_CONFIG.sessionMinutes} minutes</dd></div>
          <div className="flex justify-between gap-3 border-b border-line-soft py-1.5"><dt className="text-ink-nav">One-time codes</dt><dd className="text-right text-warning">Needs the server</dd></div>
        </dl>
      </Card>
    </>
  )
}
