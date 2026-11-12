import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronRight } from '@/icons'
import { useAuth } from '@/auth/useAuth'
import { ActionDivider, ActionStack } from '@/components/ui/ActionStack'
import { BackLink } from '@/components/ui/BackLink'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FieldLabel, TextArea, TextInput } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Panel'
import { Timeline } from '@/components/ui/Timeline'
import { formatDateTime, formatShortDate } from '@/lib/format'
import { userById } from '@/mocks/users'
import { ServiceError } from '@/services/mockApi'
import { RECOVERY_STATUS_LABEL, REVIEWER_LABEL, approveRecovery, getRecovery, listRecovery, recordRecoveryFinding, rejectRecovery, requestRecoveryInfo, scheduleRecoveryVisit, type RecoveryRequest, type RecoveryStatus } from '@/services/accountRecoveryService'

const TONE: Record<RecoveryStatus, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = { pending_review: 'warning', more_info: 'warning', in_person: 'info', approved: 'info', rejected: 'danger', completed: 'success' }
const nextAction = (q: RecoveryRequest) => ({ pending_review: 'Verify identity', more_info: 'Waiting for the person', in_person: `Visit ${q.inPerson?.date ?? ''}`, approved: 'Waiting for the new password', rejected: 'None', completed: 'None' })[q.status]

/** Account recovery requests this official may review (residents: Secretary; personnel: System Administrator; administrators: Punong Barangay). */
export function AccountRecoveryPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<RecoveryRequest[] | null>(null)
  useEffect(() => { if (user) listRecovery(user).then(setItems).catch(() => setItems([])) }, [user])
  return (
    <>
      <PageHeader title="Account Recovery" subtitle="People who cannot use their registered e-mail. Verify identity, then approve to send a one-time reset link. Passwords are never shown or set by personnel." />
      <Card className="overflow-hidden">
        {items === null ? <div className="h-24 animate-pulse" /> : items.length === 0 ? <p className="px-5 py-6 text-[length:calc(16px*var(--fs))] text-ink-nav">No recovery requests for you to review.</p> : (
          <ul className="divide-y divide-line-soft">
            {items.map((q) => (
              <li key={q.id}>
                <Link to={`/account-recovery/${q.id}`} className="flex min-h-[72px] items-center gap-3 px-4 py-3 hover:bg-sky-50 sm:px-5">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[length:calc(17px*var(--fs))] font-semibold break-words text-navy-900">{q.fullName}</span>
                    <span className="block text-[length:calc(15px*var(--fs))] text-ink-nav">{q.ref} · {formatShortDate(q.createdAt)} · {q.accountType === 'resident' ? 'Resident' : 'Barangay Personnel'} · Reviewer: {REVIEWER_LABEL[q.reviewer]}</span>
                    <span className="block text-[length:calc(15px*var(--fs))] break-words text-navy-900">{q.reason.slice(0, 90)}{q.reason.length > 90 ? '…' : ''}</span>
                    <span className="block text-[length:calc(15px*var(--fs))] font-semibold text-navy-900">Next: {nextAction(q)}</span>
                  </span>
                  <Badge tone={TONE[q.status]}>{RECOVERY_STATUS_LABEL[q.status]}</Badge>
                  <ChevronRight className="size-5 shrink-0 text-ink-subtle" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}

export function AccountRecoveryDetailPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const [q, setQ] = useState<Awaited<ReturnType<typeof getRecovery>> | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [mode, setMode] = useState<null | 'finding' | 'info' | 'visit' | 'approve' | 'reject'>(null)
  const [text, setText] = useState('')
  const [visit, setVisit] = useState({ date: '', time: '' })
  const [sendTo, setSendTo] = useState<'registered' | 'new'>('registered')
  const [confirmedEmail, setConfirmedEmail] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const load = () => { if (user) getRecovery(id, user).then(setQ).catch((e) => setErr(e instanceof ServiceError ? e.message : 'Not found.')) }
  // A different request: drop the previous one first so a refused request never shows stale details.
  useEffect(() => { setQ(null); setErr(null); setMode(null); load() }, [id, user]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!user) return null
  if (err && !q) return <><BackLink fallbackTo="/account-recovery" fallbackLabel="Account Recovery" /><Card className="px-5 py-6">{err}</Card></>
  if (!q) return <div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />
  const closed = q.status === 'rejected' || q.status === 'completed' || q.status === 'approved'
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr(null)
    try { await fn(); setMode(null); setText(''); setConfirm(false); load() } catch (e) { setErr(e instanceof ServiceError ? e.message : 'Not saved.'); setConfirm(false) } finally { setBusy(false) }
  }
  const dl = 'grid grid-cols-1 gap-x-4 gap-y-1 text-[length:calc(15.5px*var(--fs))] sm:grid-cols-[minmax(160px,auto)_1fr]'
  return (
    <>
      <BackLink fallbackTo="/account-recovery" fallbackLabel="Account Recovery" />
      <PageHeader title={q.fullName} subtitle={`${q.ref} · ${formatDateTime(q.createdAt)}`} actions={<Badge tone={TONE[q.status]}>{RECOVERY_STATUS_LABEL[q.status]}</Badge>} />
      {/* Actions across the full width on desktop, so related buttons sit side by side. */}
      <div className="mb-4">
      {!closed && (
        <Card className="px-4 py-4 sm:px-5">
          <h2 className="mb-2 font-display text-[length:calc(19px*var(--fs))] font-bold text-navy-900">Actions</h2>
          {err && <p role="alert" className="mb-2 rounded-[var(--radius-control)] bg-danger-tint px-3 py-2 text-[length:calc(15px*var(--fs))] text-danger-ink">{err}</p>}
          {!mode && (
            <>
              {/* Verification steps side by side; the decision after them; Reject on its own after a divider. */}
              <ActionStack>
                <Button variant="secondary" onClick={() => setMode('finding')}>Record verification finding</Button>
                <Button variant="secondary" onClick={() => setMode('info')}>Request more information</Button>
                <Button variant="secondary" onClick={() => setMode('visit')}>Require in-person verification</Button>
              </ActionStack>
              <ActionDivider />
              <ActionStack>
                <Button onClick={() => setMode('approve')} blockedReason={!q.findings.length ? 'Record how identity was verified first.' : !q.account ? 'No account matches this request.' : undefined}>Approve and send reset link</Button>
                <Button variant="danger" onClick={() => setMode('reject')}>Reject</Button>
              </ActionStack>
            </>
          )}
          {(mode === 'finding' || mode === 'info' || mode === 'reject') && (
            <div className="max-w-[720px] space-y-3">
              <FieldLabel label={mode === 'finding' ? 'What did you check?' : mode === 'info' ? 'What is missing?' : 'Reason for rejecting'} required>
                <TextArea className="min-h-[90px]" value={text} onChange={(e) => setText(e.target.value)} placeholder={mode === 'finding' ? 'e.g. Saw the original UMID at the counter; matches the registration record' : undefined} />
              </FieldLabel>
              <ActionStack>
                <Button variant={mode === 'reject' ? 'danger' : 'primary'} loading={busy} onClick={() => (mode === 'reject' ? setConfirm(true) : run(() => (mode === 'finding' ? recordRecoveryFinding(q.id, text, user) : requestRecoveryInfo(q.id, text, user))))}>{mode === 'finding' ? 'Save finding' : mode === 'info' ? 'Send request' : 'Reject'}</Button>
                <Button variant="secondary" onClick={() => setMode(null)}>Cancel</Button>
              </ActionStack>
            </div>
          )}
          {mode === 'visit' && (
            <div className="max-w-[720px] space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FieldLabel label="Date" required><TextInput type="date" value={visit.date} onChange={(e) => setVisit({ ...visit, date: e.target.value })} /></FieldLabel>
                <FieldLabel label="Time" required><TextInput type="time" value={visit.time} onChange={(e) => setVisit({ ...visit, time: e.target.value })} /></FieldLabel>
              </div>
              <ActionStack><Button loading={busy} onClick={() => run(() => scheduleRecoveryVisit(q.id, visit, user))}>Save and notify</Button><Button variant="secondary" onClick={() => setMode(null)}>Cancel</Button></ActionStack>
            </div>
          )}
          {mode === 'approve' && (
            <div className="max-w-[720px] space-y-3">
              <fieldset className="space-y-2">
                <legend className="text-[length:calc(15.5px*var(--fs))] font-semibold text-navy-900">Send the one-time reset link to</legend>
                <label className="flex min-h-11 items-center gap-2 text-[length:calc(15.5px*var(--fs))] text-navy-900"><input type="radio" className="size-5 accent-[#002132]" checked={sendTo === 'registered'} onChange={() => setSendTo('registered')} /> The registered e-mail</label>
                {q.newEmail ? <label className="flex min-h-11 items-center gap-2 text-[length:calc(15.5px*var(--fs))] break-all text-navy-900"><input type="radio" className="size-5 accent-[#002132]" checked={sendTo === 'new'} onChange={() => setSendTo('new')} /> The new e-mail ({q.newEmail}), which I verified</label> : (
                  <>
                    <label className="flex min-h-11 items-center gap-2 text-[length:calc(15.5px*var(--fs))] text-navy-900"><input type="radio" className="size-5 accent-[#002132]" checked={sendTo === 'new'} onChange={() => setSendTo('new')} /> A new e-mail I confirmed with the person</label>
                    {sendTo === 'new' && <TextInput type="email" aria-label="New e-mail confirmed with the person" value={confirmedEmail} onChange={(e) => setConfirmedEmail(e.target.value)} placeholder="name@example.com" />}
                  </>
                )}
              </fieldset>
              <FieldLabel label="Reason for approving" required><TextArea className="min-h-[70px]" value={text} onChange={(e) => setText(e.target.value)} /></FieldLabel>
              <ActionStack><Button onClick={() => setConfirm(true)}>Approve</Button><Button variant="secondary" onClick={() => setMode(null)}>Cancel</Button></ActionStack>
            </div>
          )}
          {confirm && (
            <ConfirmDialog title={mode === 'reject' ? 'Reject this request?' : 'Approve and send a reset link?'} confirmLabel={mode === 'reject' ? 'Reject' : 'Approve'} destructive={mode === 'reject'} busy={busy} onCancel={() => setConfirm(false)} onConfirm={() => run(() => (mode === 'reject' ? rejectRecovery(q.id, text, user) : approveRecovery(q.id, text, sendTo, user, !q.newEmail && sendTo === 'new' ? confirmedEmail : undefined)))}>
              {mode === 'reject' ? 'The person is told the reason.' : 'A single-use link that expires in 15 minutes is sent. You will not see the password.'}
            </ConfirmDialog>
          )}
        </Card>
      )}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] xl:items-start">
        <div className="space-y-4">
          <Card className="px-4 py-4 sm:px-5">
            <h2 className="mb-2 font-display text-[length:calc(19px*var(--fs))] font-bold text-navy-900">Request</h2>
            <dl className={dl}>
              <dt className="text-ink-nav">Account type</dt><dd className="text-navy-900">{q.accountType === 'resident' ? 'Resident' : 'Barangay Personnel'}</dd>
              <dt className="text-ink-nav">Username or e-mail given</dt><dd className="break-all text-navy-900">{q.identifier}</dd>
              {q.accountNo && <><dt className="text-ink-nav">Account number given</dt><dd className="text-navy-900">{q.accountNo}</dd></>}
              <dt className="text-ink-nav">Reason</dt><dd className="break-words text-navy-900">{q.reason}</dd>
              <dt className="text-ink-nav">New contact given</dt><dd className="break-all text-navy-900">{[q.newEmail, q.newMobile].filter(Boolean).join(' · ') || 'None'}</dd>
            </dl>
          </Card>
          <Card className="px-4 py-4 sm:px-5">
            <h2 className="mb-2 font-display text-[length:calc(19px*var(--fs))] font-bold text-navy-900">Matching account</h2>
            {q.account ? (
              <dl className={dl}>
                <dt className="text-ink-nav">Name</dt><dd className="text-navy-900">{q.account.name}</dd>
                <dt className="text-ink-nav">Role</dt><dd className="text-navy-900">{q.account.role}</dd>
                <dt className="text-ink-nav">Account number</dt><dd className="text-navy-900">{q.account.accountNo ?? '—'}{q.accountNo && q.account.accountNo ? (q.accountNo === q.account.accountNo ? ' (matches what was given)' : ' (does NOT match what was given)') : ''}</dd>
                <dt className="text-ink-nav">Registered e-mail</dt><dd className="break-all text-navy-900">{q.account.registeredEmail}</dd>
              </dl>
            ) : <p className="text-[length:calc(15.5px*var(--fs))] text-navy-900">No account matches the username or e-mail given. Check the spelling with the person, or reject with the reason.</p>}
            <p className="mt-2 text-[length:calc(14.5px*var(--fs))] text-ink-nav">Verify identity with the barangay's procedure (valid ID or the documents used at registration, and the registration record) before approving.</p>
          </Card>
          <Card className="px-4 py-4 sm:px-5">
            <h2 className="mb-2 font-display text-[length:calc(19px*var(--fs))] font-bold text-navy-900">Identity verification findings</h2>
            {q.findings.length === 0 ? <p className="text-[length:calc(15.5px*var(--fs))] text-ink-nav">Nothing recorded yet.</p> : (
              <ul className="space-y-2">{q.findings.map((f) => <li key={f.at} className="text-[length:calc(15.5px*var(--fs))] text-navy-900">{f.text}<span className="block text-[length:calc(14px*var(--fs))] text-ink-nav">{userById(f.by)?.fullName}, {formatDateTime(f.at)}</span></li>)}</ul>
            )}
            {q.infoRequest && <p className="mt-2 text-[length:calc(15px*var(--fs))] text-navy-900">More information asked: {q.infoRequest.text}</p>}
            {q.inPerson && <p className="mt-1 text-[length:calc(15px*var(--fs))] text-navy-900">In-person verification: {q.inPerson.date} {q.inPerson.time}, {q.inPerson.place}</p>}
            {q.decision && <p className="mt-2 text-[length:calc(15px*var(--fs))] text-navy-900">Decision: {q.decision.result === 'approved' ? `Approved, reset link sent to the ${q.decision.sentTo}` : 'Rejected'} · {q.decision.reason} · {userById(q.decision.by)?.fullName}</p>}
          </Card>
        </div>
        <div className="space-y-4">
          <Card className="px-4 py-4 sm:px-5">
            <h2 className="mb-2 font-display text-[length:calc(19px*var(--fs))] font-bold text-navy-900">Activity history</h2>
            <Timeline items={q.history.map((h) => ({ at: h.at, title: h.action, by: h.by === 'requester' ? 'Requester' : h.by === 'system' ? 'System' : userById(h.by)?.fullName }))} />
          </Card>
        </div>
      </div>
    </>
  )
}
