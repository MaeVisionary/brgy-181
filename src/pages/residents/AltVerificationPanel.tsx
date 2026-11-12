import { useState, type ReactNode } from 'react'
import { CheckCircle2, Clock, FileText } from '@/icons'
import { useAuth } from '@/auth/useAuth'
import { ActionStack } from '@/components/ui/ActionStack'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FieldLabel, Select, TextArea, TextInput } from '@/components/ui/Field'
import { Card } from '@/components/ui/Panel'
import { formatDateTime } from '@/lib/format'
import { userById } from '@/mocks/users'
import { StaffSlotPicker } from '@/pages/appointments/AppointmentPages'
import { audit } from '@/services/auditService'
import { ServiceError } from '@/services/mockApi'
import { ALT_CHECKS, ALT_REJECT_REASONS, ALT_STATUS_LABEL, altMarkVerified, altRecordCheck, altReject, altRequestMore, altSchedule } from '@/services/registrationService'
import { staffFor } from '@/services/appointmentService'
import type { AltCheckKey, AltDocument, AltStatus, ResidentRegistration } from '@/types/resident'

export const ALT_TONE: Record<AltStatus, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  pending: 'warning', document_review: 'warning', in_person_required: 'info', scheduled: 'info', under_verification: 'info', needs_more: 'warning', verified: 'success', rejected: 'danger',
}
/** What the Secretary should do next, by status (shown in the list). */
export function altNextAction(r: ResidentRegistration): string {
  const a = r.alt!
  if (a.status === 'verified') return r.status === 'manual_review' ? 'Approve the registration' : 'None'
  if (a.status === 'rejected') return 'None'
  if (a.status === 'needs_more') return 'Waiting for the applicant'
  if (a.status === 'scheduled') return `Visit on ${a.schedule?.date ?? ''}`
  if (a.status === 'in_person_required' && !a.schedule) return 'Schedule the in-person visit'
  if (a.status === 'document_review') return 'Review the documents'
  return 'Verify identity and residency'
}
export const altMethod = (r: ResidentRegistration) => {
  const a = r.alt!
  return [a.documents.length ? `${a.documents.length} document${a.documents.length > 1 ? 's' : ''}` : 'No documents', a.endorsement ? 'Endorsement' : '', a.inPersonRequested ? 'In person' : ''].filter(Boolean).join(' · ')
}

function Block({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <Card className="px-4 py-4 sm:px-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-[length:calc(19px*var(--fs))] font-bold text-navy-900">{title}</h2>
        {action}
      </div>
      {children}
    </Card>
  )
}
const dl = 'grid grid-cols-1 gap-x-4 gap-y-1 text-[length:calc(15.5px*var(--fs))] sm:grid-cols-[minmax(150px,auto)_1fr] sm:gap-y-1.5'
const errText = (e: unknown) => (e instanceof ServiceError ? e.message : 'Not saved. Please try again.')

/** Supporting documents, endorsement and in-person request. Opening a document is logged. */
export function AltEvidence({ r }: { r: ResidentRegistration }) {
  const a = r.alt!
  const { user } = useAuth()
  const [shown, setShown] = useState<AltDocument | null>(null)
  const view = (d: AltDocument) => { audit(user!, `Viewed supporting document: ${d.category}`, 'Residents', r.referenceNo); setShown(d) }
  const all = [...a.documents, ...(a.endorsement?.document ? [a.endorsement.document] : [])]
  return (
    <Block title="Identity evidence (no valid ID)">
      <h3 className="text-[length:calc(16px*var(--fs))] font-semibold text-navy-900">Supporting documents</h3>
      {all.length === 0 ? <p className="text-[length:calc(15.5px*var(--fs))] text-ink-nav">{a.noDocuments ? 'The applicant has no supporting documents.' : 'None submitted.'}</p> : (
        <ul className="mt-1 divide-y divide-line-soft rounded-[var(--radius-control)] border border-line">
          {all.map((d) => (
            <li key={d.id} className="flex min-h-14 items-center gap-3 px-3 py-2">
              <FileText className="size-5 shrink-0 text-ink-nav" />
              <span className="min-w-0 flex-1">
                <span className="block text-[length:calc(16px*var(--fs))] font-semibold break-words text-navy-900">{d.category}</span>
                <span className="block text-[length:calc(14.5px*var(--fs))] break-all text-ink-nav">{d.fileName} · {formatDateTime(d.submittedAt)}{d.inResponseTo ? ' · sent after a request' : ''}</span>
              </span>
              <Button size="sm" variant="secondary" onClick={() => view(d)}>View</Button>
            </li>
          ))}
        </ul>
      )}
      {shown && (
        <div className="mt-3 rounded-[var(--radius-control)] border border-line p-2">
          <div className="mb-2 flex items-center justify-between gap-2"><span className="text-[length:calc(15px*var(--fs))] font-semibold text-navy-900">{shown.category}</span><Button size="sm" variant="secondary" onClick={() => setShown(null)}>Close</Button></div>
          {shown.kind === 'image' ? <img src={shown.dataUrl} alt={shown.category} className="max-h-[420px] w-full object-contain" /> : <iframe title={shown.category} src={shown.dataUrl} className="h-[420px] w-full" />}
        </div>
      )}
      <h3 className="mt-4 text-[length:calc(16px*var(--fs))] font-semibold text-navy-900">Endorsement</h3>
      {a.endorsement ? (
        <dl className={dl}>
          <dt className="text-ink-nav">Name</dt><dd className="text-navy-900">{a.endorsement.name}</dd>
          <dt className="text-ink-nav">Relationship or position</dt><dd className="text-navy-900">{a.endorsement.relationship}</dd>
          {a.endorsement.contactNo && <><dt className="text-ink-nav">Contact</dt><dd className="text-navy-900">{a.endorsement.contactNo}</dd></>}
          {a.endorsement.purok && <><dt className="text-ink-nav">Purok or household</dt><dd className="text-navy-900">{a.endorsement.purok}</dd></>}
        </dl>
      ) : <p className="text-[length:calc(15.5px*var(--fs))] text-ink-nav">None given.</p>}
      <p className="mt-2 text-[length:calc(14.5px*var(--fs))] text-ink-nav">An endorsement supports the review; it is not proof of identity or residency by itself.</p>
      <h3 className="mt-4 text-[length:calc(16px*var(--fs))] font-semibold text-navy-900">In-person verification</h3>
      <p className="text-[length:calc(15.5px*var(--fs))] text-navy-900">{a.inPersonRequested ? 'Requested by the applicant.' : 'Not requested.'}{a.schedule ? ` Scheduled: ${a.schedule.date} ${a.schedule.time} with ${userById(a.schedule.staffId)?.fullName ?? ''}.` : ''}</p>
      {a.requests.length > 0 && (
        <>
          <h3 className="mt-4 text-[length:calc(16px*var(--fs))] font-semibold text-navy-900">Requests to the applicant</h3>
          <ul className="mt-1 space-y-2">
            {a.requests.map((q) => (
              <li key={q.id} className="rounded-[var(--radius-control)] border border-line px-3 py-2 text-[length:calc(15px*var(--fs))] text-navy-900">
                <p><strong>{q.items}</strong> · asked {formatDateTime(q.at)} by {userById(q.by)?.fullName}{q.deadline ? ` · by ${q.deadline}` : ''}</p>
                <p className="text-ink-nav">{q.explanation} {q.instructions}</p>
                <p className="mt-1">{q.response ? <>Answered {formatDateTime(q.response.at)}: {q.response.note || '(documents only)'}{q.response.documentIds.length ? ` · ${q.response.documentIds.length} document(s)` : ''}</> : <span className="text-warning">Not answered yet</span>}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </Block>
  )
}

/** Checklist: each item is ticked only by recording how it was verified and what evidence was reviewed. */
export function AltChecklist({ r, onChange }: { r: ResidentRegistration; onChange: () => void }) {
  const a = r.alt!
  const { user, can } = useAuth()
  const [openKey, setOpenKey] = useState<AltCheckKey | null>(null)
  const [f, setF] = useState({ method: '', evidence: '', note: '' })
  const [err, setErr] = useState<string | null>(null)
  const closed = a.status === 'verified' || a.status === 'rejected'
  const items = ALT_CHECKS.filter((c) => c.key !== 'in_person' || a.inPersonRequested || a.schedule)
  const save = async () => {
    if (!openKey) return
    setErr(null)
    try { await altRecordCheck(r.id, openKey, f, user!); setOpenKey(null); setF({ method: '', evidence: '', note: '' }); onChange() } catch (e) { setErr(errText(e)) }
  }
  return (
    <Block title="Verification checklist">
      <p className="mb-2 text-[length:calc(14.5px*var(--fs))] text-ink-nav">Identity and residency are checked separately. A document or endorsement supports a finding; none is conclusive by itself.</p>
      <ul className="divide-y divide-line-soft">
        {items.map((c) => {
          const v = a.checklist[c.key]
          return (
            <li key={c.key} className="py-2.5">
              <div className="flex items-start gap-3">
                {v?.done ? <CheckCircle2 className="icon-line w-5 text-success" /> : <Clock className="icon-line w-5 text-ink-nav" />}
                <span className="min-w-0 flex-1">
                  <span className="block text-[length:calc(16px*var(--fs))] font-semibold text-navy-900">{c.label}</span>
                  {v?.done ? <span className="block text-[length:calc(14.5px*var(--fs))] text-ink-nav">{v.method} · {v.evidence}{v.note ? ` · ${v.note}` : ''} · {userById(v.by!)?.fullName}, {formatDateTime(v.at!)}</span>
                    : <span className="block text-[length:calc(14.5px*var(--fs))] text-ink-nav">Not recorded</span>}
                </span>
                {!closed && can('residents.verify') && openKey !== c.key && <Button size="sm" variant="secondary" onClick={() => { setOpenKey(c.key); setErr(null) }}>{v?.done ? 'Update' : 'Record'}</Button>}
              </div>
              {openKey === c.key && (
                <div className="mt-2 space-y-3 rounded-[var(--radius-control)] bg-surface-muted p-3">
                  <FieldLabel label="How it was verified" required><TextInput value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })} placeholder="e.g. Compared with the PSA birth certificate; called the purok leader" /></FieldLabel>
                  <FieldLabel label="Evidence reviewed" required><TextInput value={f.evidence} onChange={(e) => setF({ ...f, evidence: e.target.value })} placeholder="e.g. PSA birth certificate no. …; household record HH-181-…" /></FieldLabel>
                  <FieldLabel label="Findings (optional)"><TextArea className="min-h-[64px]" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></FieldLabel>
                  {err && <p role="alert" className="text-[length:calc(15px*var(--fs))] text-danger-ink">{err}</p>}
                  <ActionStack><Button size="sm" onClick={save}>Save finding</Button><Button size="sm" variant="secondary" onClick={() => setOpenKey(null)}>Cancel</Button></ActionStack>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </Block>
  )
}

/** Request more, schedule the visit, mark verified, reject. Approval of the registration itself follows "Verified". */
export function AltActions({ r, onChange }: { r: ResidentRegistration; onChange: () => void }) {
  const a = r.alt!
  const { user, can } = useAuth()
  const [mode, setMode] = useState<null | 'more' | 'visit' | 'verify' | 'reject'>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [more, setMore] = useState({ items: '', explanation: '', instructions: 'Send it on the registration status page, or bring it to the Barangay Hall.', deadline: '' })
  const [slot, setSlot] = useState({ date: a.schedule?.date ?? '', staff: a.schedule?.staffId ?? staffFor('identity_verification')[0] ?? '', time: '' })
  const [instr, setInstr] = useState(a.schedule?.instructions ?? 'Bring any documents you have. Someone who knows you may come with you.')
  const [ver, setVer] = useState({ evidenceReviewed: '', remarks: '' })
  const [rej, setRej] = useState<{ reason: (typeof ALT_REJECT_REASONS)[number] | ''; remarks: string }>({ reason: '', remarks: '' })
  const [confirmReject, setConfirmReject] = useState(false)
  if (!can('residents.verify')) return null
  if (a.status === 'verified' || a.status === 'rejected') return null
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr(null)
    try { await fn(); setMode(null); onChange() } catch (e) { setErr(errText(e)) } finally { setBusy(false) }
  }
  const ready = !!a.checklist.identity?.done && !!a.checklist.residency?.done && (!a.inPersonRequested || !!a.checklist.in_person?.done)
  return (
    <Block title="Verification actions" action={<Badge tone={ALT_TONE[a.status]}>{ALT_STATUS_LABEL[a.status]}</Badge>}>
      {err && <p role="alert" className="mb-2 rounded-[var(--radius-control)] bg-danger-tint px-3 py-2 text-[length:calc(15px*var(--fs))] text-danger-ink">{err}</p>}
      {!mode && (
        <ActionStack>
          <Button size="sm" variant="secondary" onClick={() => setMode('more')}>Request additional requirements</Button>
          <Button size="sm" variant="secondary" onClick={() => setMode('visit')}>{a.schedule ? 'Change the visit' : 'Schedule in-person verification'}</Button>
          <Button size="sm" onClick={() => setMode('verify')} blockedReason={!ready ? `Record ${!a.checklist.identity?.done ? 'identity' : !a.checklist.residency?.done ? 'residency' : 'the in-person check'} in the checklist first.` : undefined}>Mark as verified</Button>
          <Button size="sm" variant="danger" onClick={() => setMode('reject')}>Reject</Button>
        </ActionStack>
      )}
      {mode === 'more' && (
        <div className="space-y-3">
          <FieldLabel label="What is missing" required><TextInput value={more.items} onChange={(e) => setMore({ ...more, items: e.target.value })} placeholder="e.g. A clearer photo of your school ID" /></FieldLabel>
          <FieldLabel label="Why it is needed" required><TextArea className="min-h-[64px]" value={more.explanation} onChange={(e) => setMore({ ...more, explanation: e.target.value })} /></FieldLabel>
          <FieldLabel label="How to send it" required><TextArea className="min-h-[64px]" value={more.instructions} onChange={(e) => setMore({ ...more, instructions: e.target.value })} /></FieldLabel>
          <FieldLabel label="Send by (optional)"><TextInput type="date" value={more.deadline} onChange={(e) => setMore({ ...more, deadline: e.target.value })} /></FieldLabel>
          <ActionStack><Button size="sm" loading={busy} onClick={() => run(() => altRequestMore(r.id, more, user!))}>Send request</Button><Button size="sm" variant="secondary" onClick={() => setMode(null)}>Cancel</Button></ActionStack>
        </div>
      )}
      {mode === 'visit' && (
        <div className="space-y-3">
          <StaffSlotPicker kind="identity_verification" minutes={30} ignoreId={a.schedule?.appointmentId} value={slot} onChange={setSlot} />
          <FieldLabel label="Instructions for the applicant"><TextArea className="min-h-[64px]" value={instr} onChange={(e) => setInstr(e.target.value)} /></FieldLabel>
          <ActionStack><Button size="sm" loading={busy} onClick={() => run(() => altSchedule(r.id, { date: slot.date, time: slot.time, staffId: slot.staff, instructions: instr }, user!))}>{a.schedule ? 'Move visit and notify' : 'Schedule and notify'}</Button><Button size="sm" variant="secondary" onClick={() => setMode(null)}>Cancel</Button></ActionStack>
        </div>
      )}
      {mode === 'verify' && (
        <div className="space-y-3">
          <p className="text-[length:calc(15px*var(--fs))] text-navy-900">Identity: {a.checklist.identity?.method} · Residency: {a.checklist.residency?.method}</p>
          <FieldLabel label="Evidence reviewed" required><TextArea className="min-h-[64px]" value={ver.evidenceReviewed} onChange={(e) => setVer({ ...ver, evidenceReviewed: e.target.value })} /></FieldLabel>
          <FieldLabel label="Findings and remarks" required><TextArea className="min-h-[64px]" value={ver.remarks} onChange={(e) => setVer({ ...ver, remarks: e.target.value })} /></FieldLabel>
          <p className="text-[length:calc(14.5px*var(--fs))] text-ink-nav">Recorded with today's date and your name. The registration is then approved separately.</p>
          <ActionStack><Button size="sm" loading={busy} onClick={() => run(() => altMarkVerified(r.id, ver, user!))}>Mark as verified</Button><Button size="sm" variant="secondary" onClick={() => setMode(null)}>Cancel</Button></ActionStack>
        </div>
      )}
      {mode === 'reject' && (
        <div className="space-y-3">
          <p className="text-[length:calc(15px*var(--fs))] text-navy-900">Not having a government ID is never a reason to reject.</p>
          <FieldLabel label="Reason" required>
            <Select value={rej.reason} onChange={(e) => setRej({ ...rej, reason: e.target.value as typeof rej.reason })}>
              <option value="">Choose the reason</option>
              {ALT_REJECT_REASONS.map((x) => <option key={x} value={x}>{x}</option>)}
            </Select>
          </FieldLabel>
          <FieldLabel label="What was found" required><TextArea className="min-h-[64px]" value={rej.remarks} onChange={(e) => setRej({ ...rej, remarks: e.target.value })} /></FieldLabel>
          <ActionStack><Button size="sm" variant="danger" onClick={() => (rej.reason && rej.remarks.trim().length >= 10 ? setConfirmReject(true) : setErr('Choose the reason and describe what was found (at least 10 characters).'))}>Reject</Button><Button size="sm" variant="secondary" onClick={() => setMode(null)}>Cancel</Button></ActionStack>
          {confirmReject && <ConfirmDialog title="Reject this registration?" confirmLabel="Reject" destructive busy={busy} onCancel={() => setConfirmReject(false)} onConfirm={() => { setConfirmReject(false); void run(() => altReject(r.id, { reason: rej.reason as (typeof ALT_REJECT_REASONS)[number], remarks: rej.remarks }, user!)) }}>The applicant is told the reason and how to register again or ask for reconsideration.</ConfirmDialog>}
        </div>
      )}
    </Block>
  )
}
