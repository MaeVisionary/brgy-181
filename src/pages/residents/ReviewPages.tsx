import { CheckCircle2, ChevronRight, CircleHelp, Paperclip, XCircle } from '@/icons'
import { maskIdNumber } from '@/config/idTypes'
import { audit } from '@/services/auditService'
import { EMAIL_STATUS_LABEL, emailsFor } from '@/services/emailService'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { TextArea } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Panel'
import { formatDateTime, formatShortDate } from '@/lib/format'
import { mockHouseholds, residentById } from '@/mocks/residents'
import { Timeline } from '@/components/ui/Timeline'
import { BackLink } from '@/components/ui/BackLink'
import { userById } from '@/mocks/users'
import { ServiceError } from '@/services/mockApi'
import { IN_PERSON_REASONS, completeInPerson, decideRegistration, decideRegistrationReport, getRegistration, inPersonEmail, listRegistrations, registrationTimeline, reportRegistration, requestInPerson, resendInPersonEmail } from '@/services/registrationService'
import { decideId, listPendingIds, type IdDocument } from '@/services/identityService'
import { fileMeta, openFile } from '@/services/fileStore'
import { APPOINTMENT_STATUS_LABEL, appointmentForRequest, formatTime } from '@/services/appointmentService'
import { ScheduleVisitForm } from '@/pages/appointments/AppointmentPages'
import { PROOF_REQUIRED, decideChangeRequest, displayRequestedValue, listChangeRequests, possibleDuplicates } from '@/services/residentService'
import type { ResidentChangeRequest, ResidentRegistration } from '@/types/resident'
import { fullName } from './common'
import { VerificationSummary, verificationOf } from './VerificationSummary'
import { useStickyState } from '@/hooks/useStickyState'
import { ActionStack } from '@/components/ui/ActionStack'

function CheckIcon({ v }: { v: 'passed' | 'failed' | 'inconclusive' }) {
  if (v === 'passed') return <CheckCircle2 className="icon-line w-4 text-success" />
  if (v === 'failed') return <XCircle className="icon-line w-4 text-danger" />
  return <CircleHelp className="icon-line w-4 text-warning" />
}

/** Approve / Reject. A reason is asked for only when rejecting. */
function Decide({ onDecide, disabled, extra }: { onDecide: (d: 'approved' | 'rejected', note: string) => Promise<void>; disabled?: boolean; extra?: ReactNode }) {
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const run = async (d: 'approved' | 'rejected') => {
    if (d === 'rejected' && !note.trim()) { setErr('Add the reason for rejecting.'); return }
    setConfirming(false)
    setBusy(true)
    setErr(null)
    try {
      await onDecide(d, note)
    } catch (e) {
      setErr(e instanceof ServiceError ? e.message : 'Failed.')
    } finally {
      setBusy(false)
    }
  }
  if (rejecting) {
    return (
      <div className="w-full space-y-2">
        <TextArea autoFocus className="min-h-[64px]" aria-label="Reason for rejecting" placeholder="Reason for rejecting" value={note} onChange={(e) => setNote(e.target.value)} />
        {err && <p className="text-[length:calc(14px*var(--fs))] text-danger-ink">{err}</p>}
        <ActionStack>
          <Button size="sm" variant="danger" onClick={() => (note.trim() ? setConfirming(true) : setErr('Add the reason for rejecting.'))} loading={busy}>Reject</Button>
          <Button size="sm" variant="secondary" onClick={() => { setRejecting(false); setErr(null) }} disabled={busy}>Cancel</Button>
        </ActionStack>
        {confirming && <ConfirmDialog title="Reject this?" confirmLabel="Reject" destructive onCancel={() => setConfirming(false)} onConfirm={() => run('rejected')}>The applicant will be told the reason.</ConfirmDialog>}
      </div>
    )
  }
  return (
    <div className="space-y-1">
      <ActionStack>
        {extra}
        <Button size="sm" onClick={() => run('approved')} loading={busy} disabled={disabled}>Approve</Button>
        <Button size="sm" variant="secondary" onClick={() => setRejecting(true)} disabled={disabled || busy}>Reject</Button>
      </ActionStack>
      {err && <p className="text-[length:calc(14px*var(--fs))] text-danger-ink">{err}</p>}
    </div>
  )
}

type CheckResult = 'passed' | 'failed' | 'inconclusive' | 'not_checked'
const RESULT = {
  passed: { label: 'Passed', cls: 'text-success', dot: 'bg-success' },
  inconclusive: { label: 'Needs review', cls: 'text-warning', dot: 'bg-warning' },
  failed: { label: 'Failed', cls: 'text-danger-ink', dot: 'bg-danger' },
  not_checked: { label: 'Not checked', cls: 'text-ink-muted', dot: 'bg-ink-subtle' },
} as const

function CheckRow({ label, v, detail }: { label: string; v: CheckResult; detail?: string }) {
  return (
    <li className={v === 'passed' || v === 'not_checked' ? 'flex items-start gap-2 py-1.5' : 'flex items-start gap-2 rounded-md bg-danger-tint px-2 py-1.5'}>
      {v === 'not_checked' ? <CircleHelp className="icon-line w-4 text-ink-subtle" /> : <CheckIcon v={v} />}
      <span className="min-w-0 flex-1 text-[length:calc(15px*var(--fs))] text-navy-900">{label}{detail && <span className="text-ink-muted"> · {detail}</span>}</span>
      <span className={`shrink-0 text-[length:calc(14px*var(--fs))] font-semibold ${RESULT[v].cls}`}>{RESULT[v].label}</span>
    </li>
  )
}

const ageFrom = (iso: string) => {
  const b = new Date(iso)
  const n = new Date()
  return n.getFullYear() - b.getFullYear() - (n < new Date(n.getFullYear(), b.getMonth(), b.getDate()) ? 1 : 0)
}

function Field({ k, v }: { k: string; v?: ReactNode }) {
  if (v === undefined || v === null || v === '') return null
  return <><dt className="text-ink-muted">{k}</dt><dd className="min-w-0 break-words text-navy-900">{v}</dd></>
}


/** Masked ID number; verifiers can reveal it (logged). */
function IdNumber({ value, refNo }: { value: string; refNo: string }) {
  const { user } = useAuth()
  const [shown, setShown] = useState(false)
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="tabular-nums">{shown ? value : maskIdNumber(value)}</span>
      {!shown && <button type="button" className="text-[length:calc(14px*var(--fs))] font-semibold text-info hover:underline" onClick={() => { audit(user!, 'Revealed an ID number', 'Residents', refNo); setShown(true) }}>Show</button>}
    </span>
  )
}

// ── Registration list and details ───────────────────────────────────

/** Where a registration stands, in one label for the list and the details page. */
export function registrationLabel(r: ResidentRegistration): { label: string; tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral' } {
  if (r.report?.status === 'open') return { label: 'Reported for review', tone: 'warning' }
  if (r.report?.status === 'suspended') return { label: 'Account suspended', tone: 'danger' }
  if (r.status === 'manual_review') return r.inPerson && !r.inPerson.completedAt ? { label: 'Visit requested', tone: 'info' } : { label: 'To review', tone: 'warning' }
  if (r.status === 'rejected') return { label: 'Rejected', tone: 'danger' }
  return { label: 'Approved', tone: 'success' }
}
const methodOf = (r: ResidentRegistration) => (r.status === 'auto_approved' ? 'Automatic' : 'Manual review')
const nameOf = (r: ResidentRegistration) => [r.applicant.firstName, r.applicant.middleName, r.applicant.lastName, r.applicant.suffix].filter(Boolean).join(' ')
const whoName = (id: string) => (id === 'system' ? 'System (automatic)' : userById(id)?.fullName ?? (id.startsWith('usr-reg-') ? 'Applicant' : ''))

/** A registration row: the whole row opens the details. */
function RegistrationRow({ r }: { r: ResidentRegistration }) {
  const st = registrationLabel(r)
  return (
    <li>
      <Link to={`/residents/registrations/${r.id}`} className="flex min-h-[72px] items-center gap-3 px-4 py-3 transition-colors hover:bg-sky-50 active:bg-sky-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-navy-600 sm:px-5">
        <span className="min-w-0 flex-1">
          <span className="block text-[length:calc(17px*var(--fs))] leading-snug font-semibold break-words text-navy-900">{nameOf(r)}</span>
          <span className="block text-[length:calc(15px*var(--fs))] text-ink-nav">{r.referenceNo} · {formatShortDate(r.submittedAt)}{r.status !== 'manual_review' ? ` · ${r.status === 'auto_approved' ? 'Automatic' : 'Manual review'}` : ''}</span>
          <span className="mt-1 inline-flex sm:hidden"><Badge tone={st.tone}>{st.label}</Badge></span>
        </span>
        <span className="hidden sm:inline-flex"><Badge tone={st.tone}>{st.label}</Badge></span>
        <span className="hidden shrink-0 text-[length:calc(15px*var(--fs))] font-semibold text-info md:inline">View details</span>
        <ChevronRight className="size-5 shrink-0 text-ink-subtle" />
      </Link>
    </li>
  )
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

/** Full registration record for Barangay Personnel: every status, including automatic approvals. */
export function RegistrationDetailPage() {
  const { id = '' } = useParams()
  const { user, can } = useAuth()
  const [r, setR] = useState<ResidentRegistration | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [mode, setMode] = useState<null | 'visit' | 'visited'>(null)
  const load = () => { if (user) getRegistration(id, user).then((x) => setR({ ...x })).catch((e) => setErr(e instanceof ServiceError ? e.message : 'Not found.')) }
  useEffect(load, [id, user]) // eslint-disable-line react-hooks/exhaustive-deps
  if (err) return <><BackLink fallbackTo="/residents/registrations" fallbackLabel="Registrations" /><Card className="px-5 py-6 text-[length:calc(16px*var(--fs))] text-navy-900">{err}</Card></>
  if (!r || !user) return <div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />

  const a = r.applicant
  const ev = r.evidence
  const st = registrationLabel(r)
  const match = r.matchedResidentId ? residentById(r.matchedResidentId) : undefined
  const household = match ? mockHouseholds.find((h) => h.id === match.householdId) : undefined
  const account = r.accountUserId ? userById(r.accountUserId) : undefined
  const dups = match || r.status === 'approved' || r.status === 'auto_approved' ? [] : possibleDuplicates({ firstName: a.firstName, lastName: a.lastName, birthDate: a.birthDate, contactNo: a.contactNo, street: a.street })
  const expiry = ev?.idExpiry
  const expired = !!expiry && new Date(expiry + 'T23:59:59+08:00').getTime() < Date.now()
  const visit = r.inPerson
  const waitingVisit = !!visit && !visit.completedAt
  const canDecide = can('residents.approve')
  const canReport = can('residents.verify')
  const canOverride = can('residents.override')
  const auto = r.status === 'auto_approved'
  const decidedAt = auto ? r.decidedAt ?? r.submittedAt : r.decidedAt

  return (
    <>
      <BackLink fallbackTo="/residents/registrations" fallbackLabel="Registrations" />
      <PageHeader title={nameOf(r)} subtitle={`${r.referenceNo} · submitted ${formatDateTime(r.submittedAt)}`} actions={<Badge tone={st.tone}>{st.label}</Badge>} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] xl:items-start">
        <div className="space-y-4">
          <Block title="Resident information">
            <dl className={dl}>
              <Field k="Full name" v={nameOf(r)} />
              <Field k="Date of birth" v={`${a.birthDate} (${ageFrom(a.birthDate)} years old)`} />
              <Field k="Sex" v={a.sex ? (a.sex === 'male' ? 'Male' : 'Female') : undefined} />
              <Field k="Civil status" v={a.civilStatus ? a.civilStatus.replace('_', '-').replace(/^./, (c) => c.toUpperCase()) : undefined} />
              <Field k="Contact number" v={a.contactNo} />
              <Field k="Email" v={a.email} />
              <Field k="Address" v={a.address} />
              <Field k="Resident since" v={a.residentSince} />
              <Field k="Registered voter" v={a.voter === undefined ? undefined : a.voter ? 'Yes' : 'No'} />
              <Field k="Other declared" v={[a.oscaId && `OSCA ID ${a.oscaId}`, a.pwd && 'PWD', a.soloParent && 'Solo parent', a.fourPs && '4Ps member'].filter(Boolean).join(' · ') || undefined} />
            </dl>
          </Block>

          <Block title="Identity verification">
            <VerificationSummary r={r} />
          </Block>

          <Block title="Submitted ID and photos">
            {ev ? (
              <>
                <dl className={dl}>
                  <Field k="ID type" v={ev.idType} />
                  <Field k="ID number" v={<IdNumber value={ev.idNumber} refNo={r.referenceNo} />} />
                  <Field k="Expiry" v={expiry ? <span className={expired ? 'font-semibold text-danger-ink' : ''}>{expiry}{expired ? ' (expired)' : ''}</span> : 'No expiry on this ID'} />
                  <Field k="Read on the ID" v={[ev.ocrFound.firstName && 'first name', ev.ocrFound.lastName && 'last name', ev.ocrFound.idNumber && 'ID number', ev.ocrFound.birthDate && 'birthdate', ev.ocrFound.expiry && 'expiry'].filter(Boolean).join(', ') || 'Nothing could be read'} />
                </dl>
                <ProtectedImages r={r} />
              </>
            ) : <p className="text-[length:calc(15.5px*var(--fs))] text-ink-nav">No ID or selfie was submitted online (registered at the Barangay Hall or before online checks).</p>}
            {dups.length > 0 && <p className="mt-3 rounded-[var(--radius-control)] bg-warning-tint px-3 py-2 text-[length:calc(15px*var(--fs))] font-semibold text-navy-900">Possible duplicate: {dups.map((d) => `${fullName(d.resident)} (${d.resident.residentNo}, ${d.reasons.join(', ').toLowerCase()})`).join('; ')}. Check before approving.</p>}
          </Block>

          {visit && (
            <Block title="In-person visit">
              <dl className={dl}>
                <Field k="Reason" v={visit.reason} />
                <Field k="Bring" v={visit.bring} />
                <Field k="Appointment" v={visit.date ? `${visit.date}${visit.time ? `, ${visit.time}` : ''}` : undefined} />
                <Field k="Requested" v={`${formatDateTime(visit.requestedAt)} · ${userById(visit.requestedBy)?.fullName ?? ''}`} />
                <Field k="Email" v={<EmailStatusLine ids={visit.emailIds} refNo={r.referenceNo} hasEmail={!!a.email} regId={r.id} onChange={load} />} />
                <Field k="Visit recorded" v={visit.completedAt ? `${formatDateTime(visit.completedAt)} · ${userById(visit.completedBy!)?.fullName ?? ''}` : undefined} />
                <Field k="Documents checked" v={visit.inspected} />
                <Field k="Notes" v={visit.outcomeNotes} />
              </dl>
            </Block>
          )}
        </div>

        <div className="space-y-4">
          <Block title="Registration status">
            <dl className={dl}>
              <Field k="Status" v={st.label} />
              <Field k="Decided by" v={r.status === 'manual_review' ? 'Not decided yet' : auto ? 'System (automatic)' : r.decidedBy ? `${userById(r.decidedBy)?.fullName ?? ''} (manual review)` : 'Manual review'} />
              <Field k="Method" v={r.status === 'manual_review' ? undefined : methodOf(r)} />
              <Field k="Date and time" v={decidedAt ? formatDateTime(decidedAt) : undefined} />
              <Field k={r.status === 'rejected' ? 'Reason' : 'Note'} v={r.decisionNote} />
              <Field k="Privacy notice" v={`Accepted (version ${r.privacyNoticeVersion})`} />
            </dl>
            {auto && (
              <p className="mt-3 rounded-[var(--radius-control)] bg-sky-50 px-3 py-2 text-[length:calc(15px*var(--fs))] text-navy-900">
                {verificationOf(r).overall === 'Verified' ? 'Approved automatically: all four checks were verified.' : 'Approved automatically on the resident record match; not every identity check was completed online.'} If something looks wrong, report it under Actions.
              </p>
            )}
          </Block>

          <Block title="Linked barangay records">
            <dl className={dl}>
              <Field k="Resident record" v={match ? <Link to={`/residents/${match.id}`} className="font-semibold text-info hover:underline">{fullName(match)}</Link> : r.status === 'manual_review' ? (ev?.recordSource === 'osca_masterlist' ? 'In the OSCA masterlist; approving creates a resident record' : 'No match; approving creates a new record') : 'Not linked'} />
              <Field k="Resident number" v={match?.residentNo} />
              <Field k="Household" v={household ? `${household.householdNo ?? household.id} · ${household.address ?? ''}` : undefined} />
              <Field k="Account" v={account ? `${account.username} · ${account.accountNo ?? ''} · ${account.status === 'active' ? 'Active' : 'Inactive'}` : undefined} />
            </dl>
          </Block>

          <ActionsBlock r={r} canDecide={canDecide} canReport={canReport} canOverride={canOverride} waitingVisit={waitingVisit} mode={mode} setMode={setMode} onChange={load} />

          <Block title="Activity history">
            <Timeline items={registrationTimeline(r).map((h) => ({ at: h.at, title: h.action, by: whoName(h.by), detail: h.note }))} />
          </Block>
        </div>
      </div>
    </>
  )
}

/** ID and selfie for authorized reviewers only; opening the page is logged, and the images are never in notices. */
function ProtectedImages({ r }: { r: ResidentRegistration }) {
  const ev = r.evidence!
  const name = nameOf(r)
  return (
    <div className="mt-3 flex flex-wrap gap-3">
      {ev.idImage && <a href={ev.idImage} target="_blank" rel="noreferrer" title="Open full size" className="block min-w-0 flex-1 basis-[220px]"><img src={ev.idImage} alt={`ID submitted by ${name}`} className="max-h-[240px] w-full rounded-lg border border-line bg-surface-muted object-contain" /></a>}
      {ev.selfieImage && <a href={ev.selfieImage} target="_blank" rel="noreferrer" title="Open full size" className="block"><img src={ev.selfieImage} alt={`Selfie of ${name}`} className={`h-[240px] w-[180px] rounded-lg border border-line object-cover ${r.verification.liveness === 'passed' ? '-scale-x-100' : ''}`} /></a>}
    </div>
  )
}

/** What the signed-in official may do with this registration, by status and authority. */
function ActionsBlock({ r, canDecide, canReport, canOverride, waitingVisit, mode, setMode, onChange }: {
  r: ResidentRegistration; canDecide: boolean; canReport: boolean; canOverride: boolean; waitingVisit: boolean
  mode: null | 'visit' | 'visited'; setMode: (m: null | 'visit' | 'visited') => void; onChange: () => void
}) {
  const { user } = useAuth()
  const [note, setNote] = useState('')
  const [ask, setAsk] = useState<null | 'report' | 'no_change' | 'suspend' | 'reinstate'>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const approved = r.status === 'approved' || r.status === 'auto_approved'
  const rep = r.report
  const go = async () => {
    if (!ask || !user) return
    setBusy(true); setErr(null)
    try {
      if (ask === 'report') await reportRegistration(r.id, note, user)
      else await decideRegistrationReport(r.id, ask, note, user)
      setNote(''); setAsk(null); onChange()
    } catch (e) { setErr(e instanceof ServiceError ? e.message : 'Not saved.'); setAsk(null) } finally { setBusy(false) }
  }
  const noteBox = (label: string) => (
    <label className="block text-[length:calc(15.5px*var(--fs))] font-semibold text-navy-900">{label}
      <TextArea className="mt-1 min-h-[80px]" value={note} onChange={(e) => setNote(e.target.value)} />
    </label>
  )
  const titles = { report: 'Report this registration?', no_change: 'Keep the approval?', suspend: 'Suspend this account?', reinstate: 'Reinstate this account?' } as const
  const bodies = {
    report: 'The approval stays as it is. The Punong Barangay is notified and decides what to do.',
    no_change: 'The report is closed and the account stays active.',
    suspend: 'The resident cannot sign in until the account is reinstated. The registration itself is not changed. The resident is told to visit the Barangay Hall.',
    reinstate: 'The resident can sign in again.',
  } as const

  let body: ReactNode = null
  if (r.status === 'manual_review') {
    body = mode === 'visit' ? <VisitForm r={r} onCancel={() => setMode(null)} onDone={() => { setMode(null); onChange() }} />
      : mode === 'visited' ? <VisitedForm r={r} onCancel={() => setMode(null)} onDone={() => { setMode(null); onChange() }} />
      : (
        <Decide
          disabled={!canDecide}
          onDecide={async (d, n) => { await decideRegistration(r.id, d, n, user!); onChange() }}
          extra={waitingVisit ? <Button size="sm" variant="secondary" onClick={() => setMode('visited')}>Record visit</Button> : !r.inPerson && <Button size="sm" variant="secondary" onClick={() => setMode('visit')}>Request in-person visit</Button>}
        />
      )
  } else if (approved && rep?.status === 'open') {
    body = (
      <div className="space-y-3">
        <p className="rounded-[var(--radius-control)] bg-warning-tint px-3 py-2 text-[length:calc(15.5px*var(--fs))] text-navy-900"><strong>Reported</strong> by {userById(rep.reportedBy)?.fullName} on {formatDateTime(rep.reportedAt)}: {rep.reason}</p>
        {canOverride ? (
          <>
            {noteBox('Reason for your decision')}
            <ActionStack>
              <Button size="sm" variant="secondary" onClick={() => setAsk('no_change')}>Keep approval</Button>
              <Button size="sm" variant="danger" onClick={() => setAsk('suspend')}>Suspend account</Button>
            </ActionStack>
          </>
        ) : <p className="text-[length:calc(15px*var(--fs))] text-ink-nav">Waiting for the Punong Barangay's decision.</p>}
      </div>
    )
  } else if (approved && rep?.status === 'suspended') {
    body = (
      <div className="space-y-3">
        <p className="rounded-[var(--radius-control)] bg-danger-tint px-3 py-2 text-[length:calc(15.5px*var(--fs))] text-danger-ink">Account suspended on {formatDateTime(rep.decidedAt!)}: {rep.decision}</p>
        {canOverride ? <>{noteBox('Reason for reinstating (what was checked)')}<ActionStack><Button size="sm" onClick={() => setAsk('reinstate')}>Reinstate account</Button></ActionStack></>
          : <p className="text-[length:calc(15px*var(--fs))] text-ink-nav">Only the Punong Barangay can reinstate the account.</p>}
      </div>
    )
  } else if (approved) {
    body = (
      <div className="space-y-3">
        {rep && <p className="text-[length:calc(15px*var(--fs))] text-ink-nav">Earlier report: {rep.status === 'no_change' ? 'approval kept' : 'account reinstated'} ({rep.decision})</p>}
        {canReport ? (
          <>
            <p className="text-[length:calc(15px*var(--fs))] text-navy-900">Found an error (wrong person, wrong details, a check that should not have passed)? Report it. The approval is not changed until the Punong Barangay decides.</p>
            {noteBox('What is wrong')}
            <ActionStack><Button size="sm" variant="secondary" onClick={() => setAsk('report')}>Report a problem</Button></ActionStack>
          </>
        ) : canOverride ? <p className="text-[length:calc(15px*var(--fs))] text-ink-nav">No open report.</p> : null}
        <p className="text-[length:calc(14.5px*var(--fs))] text-ink-nav">Wrong personal details are corrected through a record correction on the resident's profile.</p>
      </div>
    )
  } else {
    body = <p className="text-[length:calc(15.5px*var(--fs))] text-navy-900">Rejected. The applicant was told the reason and can register again with corrected information; the new registration is reviewed like any other.</p>
  }
  return (
    <Block title="Actions">
      {err && <p role="alert" className="mb-2 rounded-[var(--radius-control)] bg-danger-tint px-3 py-2 text-[length:calc(15px*var(--fs))] text-danger-ink">{err}</p>}
      {body}
      {ask && <ConfirmDialog title={titles[ask]} confirmLabel={ask === 'report' ? 'Report' : ask === 'no_change' ? 'Keep approval' : ask === 'suspend' ? 'Suspend' : 'Reinstate'} destructive={ask === 'suspend'} busy={busy} onCancel={() => setAsk(null)} onConfirm={go}>{bodies[ask]}</ConfirmDialog>}
    </Block>
  )
}

function EmailStatusLine({ ids, refNo, hasEmail, regId, onChange }: { ids: string[]; refNo: string; hasEmail: boolean; regId: string; onChange: () => void }) {
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  const last = emailsFor(refNo).filter((e) => ids.includes(e.id)).pop()
  if (!hasEmail) return <span className="text-warning">No email address. Call or text the applicant.</span>
  if (!last) return <span className="text-ink-muted">Not sent</span>
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className={last.status === 'sent' ? 'text-success' : 'text-warning'}>{EMAIL_STATUS_LABEL[last.status]}</span>
      {last.status !== 'sent' && <button type="button" disabled={busy} className="font-semibold text-info hover:underline disabled:opacity-50" onClick={async () => { setBusy(true); try { await resendInPersonEmail(regId, user!) } finally { setBusy(false); onChange() } }}>Try again</button>}
    </span>
  )
}

/** Request an in-person visit: reason, what to bring, optional appointment; email preview editable before sending. */
function VisitForm({ r, onCancel, onDone }: { r: ResidentRegistration; onCancel: () => void; onDone: () => void }) {
  const { user } = useAuth()
  const [reason, setReason] = useState<string>(IN_PERSON_REASONS[0])
  const [bring, setBring] = useState('Your original valid ID')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [notes, setNotes] = useState('')
  const [body, setBody] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const preview = inPersonEmail(r, { reason, bring, date, time, notes })
  const input = 'h-12 w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 text-[length:calc(16px*var(--fs))] text-navy-900'
  const send = async () => {
    if (busy) return
    setBusy(true)
    setErr(null)
    try {
      await requestInPerson(r.id, { reason, bring, date, time, notes, body: body ?? undefined }, user!)
      onDone()
    } catch (e) {
      setErr(e instanceof ServiceError ? e.message : 'The request could not be saved.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-3">
      <p className="text-[length:calc(16px*var(--fs))] font-semibold text-navy-900">Request an in-person visit</p>
      <label className="block text-[length:calc(15px*var(--fs))] font-semibold text-navy-900">Reason
        <select className={`${input} mt-1`} value={IN_PERSON_REASONS.includes(reason as never) ? reason : ''} onChange={(e) => setReason(e.target.value)}>
          {IN_PERSON_REASONS.map((x) => <option key={x}>{x}</option>)}
          <option value="">Other (type below)</option>
        </select>
        {!IN_PERSON_REASONS.includes(reason as never) && <input className={`${input} mt-2`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" />}
      </label>
      <label className="block text-[length:calc(15px*var(--fs))] font-semibold text-navy-900">What to bring
        <input className={`${input} mt-1`} value={bring} onChange={(e) => setBring(e.target.value)} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-[length:calc(15px*var(--fs))] font-semibold text-navy-900">Date (optional)<input type="date" min={new Date().toISOString().slice(0, 10)} className={`${input} mt-1`} value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="block text-[length:calc(15px*var(--fs))] font-semibold text-navy-900">Time (optional)<input type="time" className={`${input} mt-1`} value={time} onChange={(e) => setTime(e.target.value)} /></label>
      </div>
      <label className="block text-[length:calc(15px*var(--fs))] font-semibold text-navy-900">Other instructions (optional)
        <TextArea className="mt-1 min-h-[60px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <details className="rounded-[var(--radius-control)] border border-line-soft px-3 py-2" onToggle={(e) => { if ((e.target as HTMLDetailsElement).open && body === null) setBody(preview.body) }}>
        <summary className="min-h-10 cursor-pointer py-2 text-[length:calc(15px*var(--fs))] font-semibold text-navy-900">Email to {r.applicant.email ?? 'applicant (no email on file)'}</summary>
        <p className="text-[length:calc(14px*var(--fs))] text-ink-muted">{preview.subject}</p>
        <TextArea className="mt-2 min-h-[220px] font-mono text-[length:calc(13.5px*var(--fs))]" value={body ?? preview.body} onChange={(e) => setBody(e.target.value)} />
      </details>
      {!r.applicant.email && <p className="text-[length:calc(14.5px*var(--fs))] text-warning">This applicant has no email address. The request will be saved; contact them by phone{r.applicant.contactNo ? ` (${r.applicant.contactNo})` : ''}.</p>}
      {err && <p role="alert" className="text-[length:calc(14.5px*var(--fs))] text-danger-ink">{err}</p>}
      <ActionStack>
        <Button size="sm" onClick={send} loading={busy}>Send request</Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
      </ActionStack>
    </div>
  )
}

/** After the applicant came in: what was checked; the decision follows. */
function VisitedForm({ r, onCancel, onDone }: { r: ResidentRegistration; onCancel: () => void; onDone: () => void }) {
  const { user } = useAuth()
  const [came, setCame] = useState(false)
  const [inspected, setInspected] = useState('')
  const [notes, setNotes] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const save = async () => {
    if (!came) { setErr('Confirm that the applicant came in person.'); return }
    try {
      await completeInPerson(r.id, { inspected, notes }, user!)
      onDone()
    } catch (e) {
      setErr(e instanceof ServiceError ? e.message : 'Not saved.')
    }
  }
  return (
    <div className="space-y-3">
      <p className="text-[length:calc(16px*var(--fs))] font-semibold text-navy-900">Record the visit</p>
      <label className="flex min-h-11 items-center gap-2.5 text-[length:calc(15.5px*var(--fs))] text-navy-900"><input type="checkbox" className="size-5 accent-[#002132]" checked={came} onChange={(e) => setCame(e.target.checked)} /> The applicant came in person</label>
      <label className="block text-[length:calc(15px*var(--fs))] font-semibold text-navy-900">Documents checked
        <TextArea className="mt-1 min-h-[60px]" value={inspected} onChange={(e) => setInspected(e.target.value)} placeholder="e.g. Original UMID, PSA birth certificate" />
      </label>
      <label className="block text-[length:calc(15px*var(--fs))] font-semibold text-navy-900">Notes (optional)
        <TextArea className="mt-1 min-h-[60px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      {err && <p role="alert" className="text-[length:calc(14.5px*var(--fs))] text-danger-ink">{err}</p>}
      <ActionStack>
        <Button size="sm" onClick={save}>Save visit</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </ActionStack>
    </div>
  )
}

/** FR10: registrations that did not pass every check wait for the Secretary's manual verification. */
export function RegistrationsPage() {
  const [items, setItems] = useState<ResidentRegistration[] | null>(null)
  const [tab, setTab] = useStickyState<'review' | 'visit' | 'decided'>('tab', 'review')
  const load = () => listRegistrations().then((x) => setItems([...x]))
  useEffect(() => {
    load()
  }, [])
  const open = items?.filter((r) => r.status === 'manual_review') ?? []
  const groups = {
    review: open.filter((r) => !r.inPerson || r.inPerson.completedAt),
    visit: open.filter((r) => r.inPerson && !r.inPerson.completedAt),
    decided: items?.filter((r) => r.status !== 'manual_review') ?? [],
  }
  const shown = groups[tab]
  return (
    <>
      <PageHeader title="Resident Registrations" />
      <div role="tablist" aria-label="Registrations" className="mb-3 flex flex-wrap gap-2">
        {([['review', 'To review'], ['visit', 'Visit requested'], ['decided', 'Decided']] as const).map(([k, label]) => (
          <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => setTab(k)} className={tab === k ? 'inline-flex h-11 items-center gap-1.5 rounded-full bg-navy-900 px-4 text-[length:calc(15.5px*var(--fs))] font-semibold text-white' : 'inline-flex h-11 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-[length:calc(15.5px*var(--fs))] font-semibold text-navy-900 hover:bg-surface-muted'}>
            {label} <span className={tab === k ? 'text-white/75' : 'text-ink-muted'}>{groups[k].length}</span>
          </button>
        ))}
      </div>
      {items === null ? <div className="h-32 animate-pulse rounded-[var(--radius-card)] bg-surface" /> : shown.length === 0 ? (
        <Card className="px-5 py-6 text-[length:calc(16px*var(--fs))] text-ink-nav">{tab === 'decided' ? 'No decided registrations.' : 'Nothing here.'}</Card>
      ) : (
        <Card className="overflow-hidden"><ul className="divide-y divide-line-soft">{shown.map((r) => <RegistrationRow key={r.id} r={r} />)}</ul></Card>
      )}
      <IdUpdates />
    </>
  )
}

/** Replacement IDs uploaded by residents; staff verify the ID itself (text reading is not proof). */
function IdUpdates() {
  const { user, can } = useAuth()
  const [items, setItems] = useState<(IdDocument & { residentName: string })[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const load = () => { if (user && can('residents.verify')) listPendingIds(user).then(setItems).catch(() => setItems([])) }
  useEffect(load, [user, can])
  if (!items.length) return null
  return (
    <>
      <h2 className="label-caps mt-6 mb-2">ID updates</h2>
      <Card className="divide-y divide-line-soft">
        {items.map((d) => {
          const open = openId === d.id
          return (
            <div key={d.id} className="px-5 py-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                <div className="min-w-0 flex-1 basis-[240px]">
                  <p className="text-[length:calc(16.5px*var(--fs))] font-bold text-navy-900">{d.residentName}</p>
                  <p className="text-[length:calc(14.5px*var(--fs))] text-ink-muted">{d.idType} · {formatShortDate(d.uploadedAt)}</p>
                </div>
                <Decide
                  disabled={!can('residents.approve')}
                  onDecide={async (dec, note) => { await decideId(d.id, dec === 'approved' ? 'verified' : 'rejected', note, user!); load() }}
                  extra={<Button size="sm" variant="secondary" aria-expanded={open} onClick={() => setOpenId(open ? null : d.id)}>{open ? 'Hide Details' : 'View Details'}</Button>}
                />
              </div>
              {open && (
                <div className="mt-4 grid grid-cols-1 gap-4 border-t border-line-soft pt-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  {d.fileId ? <StoredImage id={d.fileId} alt={`ID of ${d.residentName}`} /> : d.image && <img src={d.image} alt={`ID of ${d.residentName}`} className="max-h-[200px] w-full rounded-lg border border-line bg-surface-muted object-contain" />}
                  <div>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[length:calc(14.5px*var(--fs))]">
                      <dt className="text-ink-muted">ID number</dt><dd className="text-navy-900">{d.idNumber}</dd>
                      <dt className="text-ink-muted">Expiry</dt><dd className="text-navy-900">{d.expiresAt ? formatShortDate(d.expiresAt + 'T12:00:00+08:00') : 'No expiry on this ID'}</dd>
                    </dl>
                    <ul className="mt-2">
                      <CheckRow label="Name read on ID" v={d.ocr?.name ? 'passed' : 'inconclusive'} />
                      <CheckRow label="ID number read" v={d.ocr?.idNumber ? 'passed' : 'inconclusive'} />
                      {d.expiresAt && <CheckRow label="Expiry date read" v={d.ocr?.expiry ? 'passed' : 'inconclusive'} />}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </Card>
    </>
  )
}

/** FR11: resident correction requests; the official record changes only after approval. */
/** Decided requests stay listed this many days, then drop off the screen (the record keeps them). */
const DECIDED_VISIBLE_DAYS = 7

export function ChangeRequestsPage() {
  const { user, can } = useAuth()
  const [items, setItems] = useState<ResidentChangeRequest[] | null>(null)
  const [tab, setTab] = useStickyState<'review' | 'decided'>('tab', 'review')
  const load = () => listChangeRequests().then(setItems)
  useEffect(() => {
    load()
  }, [])
  const since = Date.now() - DECIDED_VISIBLE_DAYS * 86_400_000
  const toReview = (items ?? []).filter((c) => c.status === 'pending')
  const decided = (items ?? []).filter((c) => c.status !== 'pending' && c.decidedAt && new Date(c.decidedAt).getTime() >= since)
  const shown = tab === 'review' ? toReview : decided
  return (
    <>
      <PageHeader title="Record Update Requests" />
      <div role="tablist" aria-label="Requests" className="mb-3 flex flex-wrap gap-2">
        {([
          ['review', 'To review', toReview.length],
          ['decided', 'Recently decided', decided.length],
        ] as const).map(([k, label, n]) => (
          <button
            key={k}
            role="tab"
            type="button"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={tab === k ? 'inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-control)] border border-navy-900 bg-navy-900 px-4 text-[length:calc(15px*var(--fs))] font-semibold text-white' : 'inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-control)] border border-line bg-surface px-4 text-[length:calc(15px*var(--fs))] font-semibold text-navy-900 hover:bg-surface-muted'}
          >
            {label} <span className={tab === k ? 'text-white/75' : 'text-ink-muted'}>({n})</span>
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {items && shown.length === 0 && (
          <Card className="px-5 py-6 text-[length:calc(15px*var(--fs))] text-ink-muted">{tab === 'review' ? 'No requests waiting for review.' : `No requests decided in the last ${DECIDED_VISIBLE_DAYS} days.`}</Card>
        )}
        {shown.map((c) => {
          const r = residentById(c.residentId)
          return (
            <Card key={c.id} className="grid grid-cols-1 gap-4 px-5 py-4 lg:grid-cols-[1.4fr_1fr]">
              <div>
                <p className="label-caps">{formatDateTime(c.submittedAt)}</p>
                <p className="mt-1 text-[length:calc(16px*var(--fs))] font-semibold text-navy-900">{r ? <Link to={`/residents/${r.id}`} className="hover:underline">{fullName(r)}</Link> : 'Unknown resident'} · {c.field}</p>
                {c.requestedByResidentId && residentById(c.requestedByResidentId) && (
                  <p className="text-[length:calc(14px*var(--fs))] text-ink-nav">Requested by {fullName(residentById(c.requestedByResidentId)!)} · {c.basis === 'representative' ? 'representative' : c.basis === 'household' ? 'household head' : 'parent or guardian'}</p>
                )}
                {c.authorization && <AuthLine a={c.authorization} />}
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="rounded-md bg-surface-muted px-3 py-2"><p className="text-[length:calc(13px*var(--fs))] text-ink-muted">Current record</p><p className="text-[length:calc(15px*var(--fs))] text-navy-900">{c.originalValue || '–'}</p></div>
                  <div className="rounded-md bg-sky-100 px-3 py-2"><p className="text-[length:calc(13px*var(--fs))] text-ink-muted">Requested</p><p className="text-[length:calc(15px*var(--fs))] font-semibold text-navy-900">{displayRequestedValue(c.field, c.requestedValue)}</p></div>
                </div>
                <p className="mt-2 text-[length:calc(14.5px*var(--fs))] text-ink-muted">Reason: {c.reason}</p>
                <ProofLine c={c} />
                {c.checks && c.status === 'pending' && (
                  <ul className="mt-2 space-y-0.5 text-[length:calc(14.5px*var(--fs))]">
                    {c.checks.filter((k) => k.result !== 'not_applicable').map((k) => (
                      <li key={k.name} className={k.result === 'passed' ? 'text-ink-nav' : k.result === 'failed' ? 'text-danger-ink' : 'text-warning'}>
                        {k.result === 'passed' ? 'Passed' : k.result === 'failed' ? 'Failed' : 'Needs review'} · {k.name}{k.note ? `: ${k.note}` : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {c.status === 'pending' ? (
                <CorrectionActions c={c} canDecide={can('residents.approve')} onDecide={async (d, note) => { await decideChangeRequest(c.id, d, note, user!); await load() }} onChange={load} />
              ) : (
                <div className="text-[length:calc(14.5px*var(--fs))]">
                  <Badge tone={c.status === 'approved' ? 'success' : 'danger'}>{c.status === 'approved' ? 'Approved' : 'Rejected'}</Badge>
                  <p className="mt-1 text-ink-muted">{c.decidedBy && userById(c.decidedBy)?.fullName} · {c.decidedAt && formatDateTime(c.decidedAt)}</p>
                  {c.decisionNote && <p className="mt-1 text-navy-900">{c.decisionNote}</p>}
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </>
  )
}

/** Guardianship proof or representative authorization (verify before approving). */
function AuthLine({ a }: { a: NonNullable<ResidentChangeRequest['authorization']> }) {
  return (
    <p className={a.fileName ? 'mt-2 flex flex-wrap items-center gap-2 rounded-md border border-line px-3 py-2 text-[length:calc(14.5px*var(--fs))] text-navy-900' : 'mt-2 rounded-md bg-warning-tint px-3 py-2 text-[length:calc(14.5px*var(--fs))] text-navy-900'}>
      <Paperclip className="size-4 text-ink-muted" /> {a.kind}: {a.fileName ? <strong>{a.fileName}</strong> : 'original to be presented at the Barangay Hall'}
      {a.fileId ? <ViewFile id={a.fileId} /> : a.url && <a href={a.url} target="_blank" rel="noreferrer" className="font-semibold text-info hover:underline">View file</a>}
    </p>
  )
}

/** What the resident sent as proof (view it before approving). */
function ProofLine({ c }: { c: ResidentChangeRequest }) {
  const needed = PROOF_REQUIRED[c.field]
  if (!needed && !c.proof) return null
  if (c.proof?.fileName) {
    return (
      <p className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-line px-3 py-2 text-[length:calc(14.5px*var(--fs))] text-navy-900">
        <Paperclip className="size-4 text-ink-muted" /> Proof attached: <strong>{c.proof.fileName}</strong>
        {c.proof.fileId ? <ViewFile id={c.proof.fileId} /> : c.proof.url && <a href={c.proof.url} target="_blank" rel="noreferrer" className="font-semibold text-info hover:underline">View file</a>}
      </p>
    )
  }
  if (c.proof?.bringOnsite) {
    return <p className="mt-2 rounded-md border border-warning/50 bg-warning-tint px-3 py-2 text-[length:calc(14.5px*var(--fs))] text-navy-900">The resident will bring the original document to the Barangay Hall. Check it before approving.</p>
  }
  return <p className="mt-2 rounded-md bg-danger-tint px-3 py-2 text-[length:calc(14.5px*var(--fs))] text-danger-ink">No proof attached ({needed}). Ask the resident to submit it before approving.</p>
}

/** Opens a stored file through a short-lived link (access checked and logged). */
function ViewFile({ id }: { id: string }) {
  const { user } = useAuth()
  const [err, setErr] = useState<string | null>(null)
  return (
    <>
      <button type="button" className="font-semibold text-info hover:underline" onClick={async () => { try { window.open(await openFile(id, user!), '_blank', 'noopener') } catch (e) { setErr(e instanceof ServiceError ? e.message : 'Could not open the file.') } }}>View file</button>
      {err && <span className="text-[length:calc(14px*var(--fs))] text-danger-ink">{err}</span>}
    </>
  )
}

/** Shows a stored ID image (or a link for PDFs) through a short-lived link. */
function StoredImage({ id, alt }: { id: string; alt: string }) {
  const { user } = useAuth()
  const [url, setUrl] = useState<string | null>(null)
  const [err, setErr] = useState(false)
  const meta = fileMeta(id)
  useEffect(() => { openFile(id, user!).then(setUrl).catch(() => setErr(true)) }, [id, user])
  if (err) return <p className="text-[length:calc(14px*var(--fs))] text-danger-ink">The ID file could not be opened.</p>
  if (!url) return <div className="h-[160px] animate-pulse rounded-lg bg-surface-muted" />
  return meta?.mimeType === 'application/pdf'
    ? <a href={url} target="_blank" rel="noreferrer" className="font-semibold text-info hover:underline">Open ID (PDF)</a>
    : <img src={url} alt={alt} className="max-h-[200px] w-full rounded-lg border border-line bg-surface-muted object-contain" />
}

/** Decide, or first require an in-person visit; shows the visit once scheduled. */
function CorrectionActions({ c, canDecide, onDecide, onChange }: { c: ResidentChangeRequest; canDecide: boolean; onDecide: (d: 'approved' | 'rejected', note: string) => Promise<void>; onChange: () => void }) {
  const [scheduling, setScheduling] = useState(false)
  const visit = appointmentForRequest(c.id)
  const open = visit && !['completed', 'cancelled', 'no_show'].includes(visit.status)
  return (
    <div className="space-y-3">
      {visit && (
        <Link to={`/appointments/${visit.id}`} className="block rounded-[var(--radius-control)] border border-line-soft px-3 py-2 text-[length:calc(15px*var(--fs))] hover:bg-sky-50">
          <span className="block font-semibold text-navy-900">Visit: {visit.verification ? (visit.verification.result === 'verified' ? 'Verified' : 'Not verified') : APPOINTMENT_STATUS_LABEL[visit.status]}</span>
          <span className="block text-ink-muted">{visit.date ? `${visit.date} · ${formatTime(visit.time)}` : 'The resident is choosing a time'}</span>
        </Link>
      )}
      {scheduling ? (
        <ScheduleVisitForm changeRequestId={c.id} onCancel={() => setScheduling(false)} onDone={() => { setScheduling(false); onChange() }} />
      ) : (
        <>
          <Decide disabled={!canDecide} onDecide={onDecide} />
          {canDecide && !open && <Button size="sm" variant="secondary" onClick={() => setScheduling(true)}>Require in-person verification</Button>}
        </>
      )}
    </div>
  )
}
