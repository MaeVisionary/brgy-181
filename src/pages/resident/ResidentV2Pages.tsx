import { CalendarClock, CheckCircle2, CircleAlert, Clock, Inbox, Mail, MapPin, Phone, XCircle } from '@/icons'
import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { TransitionPanel } from '@/components/documents/TransitionPanel'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Panel'
import { BARANGAY_CONTACT, KP } from '@/config/barangay'
import { ROLES } from '@/config/permissions'
import { getDocumentType } from '@/documents/catalog'
import { isFilled } from '@/documents/fill'
import { useAsync } from '@/hooks/useAsync'
import { useDocActor } from '@/hooks/useDocActor'
import { cn } from '@/lib/cn'
import { FileField } from '@/components/ui/FileField'
import { MAX_TRANSACTION_BYTES } from '@/config/uploads'
import { attachUploads, totalSize, type StoredFile } from '@/services/fileStore'
import { formatDate, formatDateTime } from '@/lib/format'
import { ALL_RESIDENT_STATUSES, STATUSES_BY_KIND, caseStageForResident, documentStatusForResident, type ResidentStatus } from '@/lib/residentStatus'
import { mockUsers } from '@/mocks/users'
import { getCase } from '@/services/caseService'
import { estimateFor, standardFor } from '@/services/serviceStandardService'
import { readyEstimate } from '@/services/processingService'
import { PickupSection } from './PickupSection'
import { applyTransition, availableTransitions, getRequest } from '@/services/documentService'
import { STAGE_ORDER, actOnBorrowing, borrowingStage, fmtDue, getBorrowing, runBorrowingJobs } from '@/services/equipmentService'
import { appointmentFor, formatTime } from '@/services/appointmentService'
import { ServiceError } from '@/services/mockApi'
import { listMyTransactions, type TransactionKind } from '@/services/transactionService'
import type { KPCase } from '@/types/case'
import type { DocumentRequest, StatusEvent, Transition } from '@/types/document'
import type { Borrowing } from '@/types/equipment'
import { itemsText } from '@/pages/equipment/BorrowingPages'
import { NotFound } from '@/pages/system/NotFound'
import { BackLink, Banner, DetailBody, DetailHeader, InfoRows, NeedHelp, Progress, Section, TitleBar, TransactionList, Updates, stepsFrom } from './parts'


// ── My Transactions ─────────────────────────────────────────────────

const EMPTY: Record<'all' | TransactionKind, { title: string; body: string; action: string; to: string }> = {
  all: { title: 'You have no transactions yet.', body: 'Document requests, complaints and equipment borrowing you submit will appear here.', action: 'Request a document', to: '/my/documents/new' },
  document: { title: 'You have no document requests yet.', body: 'You can request certificates and clearances online, then claim them at the Barangay Hall.', action: 'Request a document', to: '/my/documents/new' },
  complaint: { title: 'You have no complaints or reports yet.', body: 'Report an incident, a complaint or a community concern.', action: 'File a report', to: '/my/complaints/new' },
  borrowing: { title: 'You have not borrowed any equipment yet.', body: 'You can borrow chairs, tables, ladders and other barangay equipment.', action: 'Borrow equipment', to: '/my/borrowing?new=1' },
}

const FILTERS: { key: 'all' | TransactionKind; label: string }[] = [
  { key: 'all', label: 'All Transactions' },
  { key: 'document', label: 'Document Requests' },
  { key: 'complaint', label: 'Complaints and Reports' },
  { key: 'borrowing', label: 'Equipment Borrowing' },
]

export function MyTransactionsPage() {
  const actor = useDocActor()!
  const [params, setParams] = useSearchParams()
  const kind = (params.get('type') as 'all' | TransactionKind | null) ?? 'all'
  const status = params.get('status') ?? ''
  const all = useAsync(() => listMyTransactions(actor), [actor]).data
  const count = (k: 'all' | TransactionKind) => (all ?? []).filter((t) => k === 'all' || t.kind === k).length
  const inKind = (all ?? []).filter((t) => kind === 'all' || t.kind === kind)
  const shown = inKind.filter((t) => !status || t.status === status)
  // Only statuses that belong to this type and actually occur, with counts.
  const order: readonly ResidentStatus[] = kind === 'all' ? ALL_RESIDENT_STATUSES : STATUSES_BY_KIND[kind]
  const statusOptions = order.map((s) => [s, inKind.filter((t) => t.status === s).length] as const).filter(([, n]) => n > 0)
  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) if (v && v !== 'all') next.set(k, v); else next.delete(k)
    setParams(next, { replace: true })
  }

  return (
    <>
      <PageHeader title="My Transactions" />
      <div role="tablist" aria-label="Transaction type" className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            role="tab"
            type="button"
            aria-selected={kind === f.key}
            onClick={() => set({ type: f.key, status: '' })}
            className={cn(
              'inline-flex h-11 items-center justify-between gap-2 rounded-[var(--radius-control)] border px-4 text-[length:calc(15.5px*var(--fs))] font-semibold transition-colors sm:justify-start',
              kind === f.key ? 'border-navy-900 bg-navy-900 text-white' : 'border-line bg-surface text-navy-900 hover:bg-surface-muted',
            )}
          >
            {f.label} <span className={kind === f.key ? 'text-white/75' : 'text-ink-muted'}>({all ? count(f.key) : '–'})</span>
          </button>
        ))}
      </div>
      <label className="mt-4 flex items-center gap-3 text-[length:calc(15px*var(--fs))] font-semibold text-navy-900">
        Status
        <select
          value={status}
          onChange={(e) => set({ status: e.target.value })}
          className="h-11 min-w-[180px] rounded-[var(--radius-control)] border border-line bg-surface px-3 text-[length:calc(15.5px*var(--fs))] font-normal text-navy-900 focus:border-navy-600 focus:outline-none"
        >
          <option value="">All statuses</option>
          {statusOptions.map(([s, n]) => <option key={s} value={s}>{s} ({n})</option>)}
        </select>
      </label>

      <Card className="mt-4 overflow-hidden">
        {all === null ? (
          <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded bg-surface-muted" />)}</div>
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <Inbox className="size-9 text-ink-subtle" strokeWidth={1.5} />
            <p className="mt-3 font-display text-[length:calc(19px*var(--fs))] font-bold text-navy-900">{status ? 'No transactions with this status.' : EMPTY[kind].title}</p>
            <p className="mt-1 max-w-md text-[length:calc(15.5px*var(--fs))] text-ink-muted">{status ? 'Try another status, or choose "All statuses".' : EMPTY[kind].body}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {!status && (
                <Link to={EMPTY[kind].to} className="inline-flex h-11 items-center rounded-[var(--radius-control)] bg-navy-900 px-5 text-[length:calc(15.5px*var(--fs))] font-semibold text-white hover:bg-navy-800">
                  {EMPTY[kind].action}
                </Link>
              )}
              {(status || kind !== 'all') && (
                <button type="button" onClick={() => set({ type: 'all', status: '' })} className="inline-flex h-11 items-center rounded-[var(--radius-control)] border border-line bg-surface px-5 text-[length:calc(15.5px*var(--fs))] font-semibold text-navy-900 hover:bg-surface-muted">
                  Show all transactions
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <TransactionList items={shown} showType={kind === 'all'} />
          </>
        )}
      </Card>
    </>
  )
}

// ── Document request details ────────────────────────────────────────

const readyWhen = (d: Date) => d.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' })

/** Notes the requester is meant to read; other staff notes stay internal. */
const PUBLIC_REMARKS = new Set<StatusEvent['status']>(['needs_info', 'rejected', 'cancelled', 'under_review'])
const byLabel = (e: StatusEvent) => {
  if (e.byRole === 'resident') return 'You'
  return ROLES[e.byRole]?.name ?? mockUsers.find((u) => u.id === e.byUserId)?.fullName
}

export function DocumentDetailsPage() {
  const { id = '' } = useParams()
  const actor = useDocActor()
  const [req, setReq] = useState<DocumentRequest | null>(null)
  const [notFound, setNotFound] = useState(false)
  useEffect(() => {
    setNotFound(false)
    if (actor) getRequest(id, actor).then(setReq).catch(() => setNotFound(true))
  }, [id, actor])
  if (notFound) return <NotFound />
  if (!req || !actor) return <div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />

  const type = getDocumentType(req.typeId)
  const report = type.category === 'case'
  const rs = documentStatusForResident(req.status)
  const shown = type.fields.filter((f) => f.by !== 'system' && !f.staffOnly && isFilled(req.values[f.key]))
  const needInfo = [...req.history].reverse().find((h) => h.status === 'needs_info')
  const replyStep = availableTransitions(req, actor).find((t) => t.by === 'owner' && t.from.includes('needs_info') && t.to === 'under_review')
  const std = standardFor(req.typeId)
  const pickup = std.release === 'pickup'
  const est = estimateFor(req)
  const ready = readyEstimate(req)
  const ended = rs === 'Unsuccessful'
  const done = rs === 'Completed'

  // Progress follows the request's own workflow, in resident words.
  const labels: ResidentStatus[] = pickup ? ['Submitted', 'Processing', 'Ready', 'Completed'] : ['Submitted', 'Processing', 'Completed']
  const order = (s: ResidentStatus) => labels.indexOf(s === 'Action Needed' ? 'Processing' : s)
  const reached = (label: ResidentStatus) => req.history.find((h) => order(documentStatusForResident(h.status)) >= order(label))
  const idx = order(rs)
  const notes: Record<number, string | undefined> = {}
  labels.forEach((l, i) => {
    const ev = reached(l)
    if (ev && (i < idx || (i === idx && !ended))) notes[i] = formatDate(ev.at)
  })
  const steps = stepsFrom(labels, ended ? labels.length : Math.max(0, idx), notes, done)

  const step = req.status === 'submitted' ? 'Review' : req.status === 'needs_info' ? 'Waiting for your reply' : ['approved', 'for_signature', 'pending_approval'].includes(req.status) ? 'Approval and signing' : rs === 'Ready' ? 'Release' : rs === 'Processing' ? 'Review' : undefined
  const next: Record<ResidentStatus, string> = {
    Submitted: 'Your request has been received. The Barangay Secretary will review it.',
    Processing: req.status === 'approved' || req.status === 'for_signature' ? 'Your document has been approved. We will notify you when it is ready.' : 'Your request is being processed. No action is needed from you.',
    'Action Needed': 'Please send the information requested below so processing can continue.',
    Ready: pickup ? 'Your document is ready. You may now claim it at the Barangay Hall.' : 'Your document is ready.',
    Borrowed: '',
    Completed: 'Your request has been completed.',
    Unsuccessful: req.status === 'cancelled' ? 'This request was cancelled.' : 'Your request was not approved. See the reason below.',
  }
  const expected = est ? formatDate((est.extended?.newDate ?? est.expectedBy) + 'T12:00:00+08:00') : null

  return (
    <>
      <BackLink to={report ? '/my/complaints' : '/my/documents'}>{report ? 'My Complaints and Reports' : 'Document Requests'}</BackLink>
      <DetailHeader kind={report ? 'Report' : 'Document request'} title={type.name} referenceNo={req.referenceNo} status={rs} date={req.submittedAt} />
      <DetailBody
        main={
          <>
            <Section title="What happens next">
              <p className="text-[length:calc(16px*var(--fs))] text-navy-900">{next[rs]}</p>
              {!ended && !done && (
                <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 text-[length:calc(15px*var(--fs))]">
                  <dt className="text-ink-muted">Submitted</dt><dd className="text-navy-900">{formatDateTime(req.submittedAt)}</dd>
                  {!report && (
                    <>
                      <dt className="text-ink-muted">Estimated ready</dt>
                      <dd className="text-navy-900">
                        {ready && ready.readyAt && ready.state !== 'ready' ? <span className="font-semibold">{readyWhen(ready.readyAt)}</span> : rs === 'Action Needed' ? 'After you send the requested information' : ready?.state === 'ready' ? 'Ready now' : 'Processing time will be confirmed.'}
                        {ready?.state === 'delayed' && <span className="block text-[length:calc(14.5px*var(--fs))] text-warning">Taking longer than first expected</span>}
                        {expected && <span className="block text-[length:calc(14.5px*var(--fs))] text-ink-nav">Latest allowed: {expected} ({est!.extended ? 'extended' : `${est!.days} working day${est!.days === 1 ? '' : 's'}${est!.fromCharter ? ', Citizen\'s Charter' : ', RA 11032'}`})</span>}
                      </dd>
                    </>
                  )}
                  {step && <><dt className="text-ink-muted">Current step</dt><dd className="text-navy-900">{step}</dd></>}
                  {!report && <><dt className="text-ink-muted">Release</dt><dd className="text-navy-900">{pickup ? 'In person at the Barangay Hall' : std.release === 'online' ? 'Download here' : 'No document to claim'}</dd></>}
                </dl>
              )}
            </Section>

            {est?.extended && !ended && !done && (
              <Banner tone="warning" icon={<Clock />} title="Processing time extended">
                {est.extended.reason} New expected date: {formatDate(est.extended.newDate + 'T12:00:00+08:00')}. No action is needed from you.
              </Banner>
            )}

            {rs === 'Action Needed' && needInfo?.remarks && (
              <Section title="Message from the barangay">
                <p className="text-[length:calc(15.5px*var(--fs))] text-navy-900">“{needInfo.remarks}”</p>
                <p className="mt-1 text-[length:calc(14px*var(--fs))] text-ink-muted">{ROLES[needInfo.byRole].name} · {formatDateTime(needInfo.at)}</p>
              </Section>
            )}
            {replyStep && <ReplyForm req={req} step={replyStep} actor={actor} onDone={(r) => setReq({ ...r })} />}
            {availableTransitions(req, actor).some((t) => t.by === 'owner' && t !== replyStep) && (
              <TransitionPanel req={req} actor={actor} ownerView exclude={(t) => t.label === replyStep?.label} onChange={(r) => setReq({ ...r })} />
            )}

            {pickup && !report && !ended && !done && <PickupSection req={req} onChange={() => setReq({ ...req })} />}

            <Section title={report ? 'Report details' : 'Request details'}>
              <InfoRows
                rows={shown.map((f): [string, React.ReactNode] => [
                  `${f.group ? `${f.group}: ` : ''}${f.label}`,
                  Array.isArray(req.values[f.key]) ? (req.values[f.key] as string[]).join(', ') : req.values[f.key] === true ? 'Yes' : String(req.values[f.key]),
                ])}
              />
            </Section>

            {Object.keys(req.requirements).length > 0 && (
              <Section title="Requirements">
                <InfoRows rows={Object.entries(req.requirements).map(([k, v]) => [k, v.provided ? 'Provided' : v.note ? `Needs a clearer copy: ${v.note}` : 'Not yet provided'])} />
              </Section>
            )}

            <Updates
              items={[...req.history].reverse().map((h) => ({ title: h.action, at: h.at, by: byLabel(h), note: h.remarks && PUBLIC_REMARKS.has(h.status) ? h.remarks : undefined }))}
            />
          </>
        }
        side={
          <>
            <Progress steps={steps} ended={ended ? `${req.status === 'cancelled' ? 'Cancelled' : 'Not approved'} on ${formatDate(req.updatedAt)}` : undefined} />
            <NeedHelp />
          </>
        }
      />
    </>
  )
}

// ── Complaint details ───────────────────────────────────────────────

/** Complainant's view of a case: no internal notes, no other party's contact details. */
export function ComplaintDetailsPage() {
  const { id = '' } = useParams()
  const actor = useDocActor()!
  const [c, setC] = useState<KPCase | null>(null)
  const [missing, setMissing] = useState(false)
  useEffect(() => {
    getCase(id, actor).then(setC).catch(() => setMissing(true))
  }, [id, actor])
  if (missing) return <NotFound />
  if (!c) return <div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />

  const rs = caseStageForResident(c.stage)
  const next = c.hearings.filter((h) => h.status === 'scheduled').sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0]
  const labels: ResidentStatus[] = ['Submitted', 'Processing', 'Completed']
  const idx = labels.indexOf(rs)
  const firstAt = (pred: (s: ResidentStatus) => boolean) => c.history.find((h) => pred(caseStageForResident(h.stage)))?.at
  const notes: Record<number, string | undefined> = {
    0: formatDate(c.filedAt),
    1: firstAt((s) => s !== 'Submitted') ? formatDate(firstAt((s) => s !== 'Submitted')!) : undefined,
    2: rs === 'Completed' ? undefined : next ? `Hearing on ${formatDateTime(next.scheduledAt)}` : 'When the complaint is settled or closed',
  }
  const respondent = c.respondents?.map((r) => r.name).join(', ')

  return (
    <>
      <BackLink to="/my/complaints">My Complaints and Reports</BackLink>
      <DetailHeader kind="Complaint · Katarungang Pambarangay" title={c.nature} referenceNo={c.caseNo} status={rs} date={c.filedAt} />
      <DetailBody
        main={
          <>
            {next && (
              <Banner tone="info" icon={<CalendarClock />} title={next.kind === 'lupon_mediation' ? 'A Lupon mediation hearing has been scheduled' : 'A mediation hearing has been scheduled'}>
                Please attend the hearing below. {next.kind === 'lupon_mediation' ? 'The Lupon Tagapamayapa' : 'The Barangay Chairman'} will meet with you and the other party to help you both reach an agreement.
              </Banner>
            )}
            {c.outcome && <Banner tone="success" icon={<CheckCircle2 />} title="Outcome">{c.outcome.summary}</Banner>}
            {next && (
              <Section title="Hearing schedule">
                <InfoRows
                  rows={[
                    ['Date', new Date(next.scheduledAt).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })],
                    ['Time', new Date(next.scheduledAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })],
                    ['Location', next.place],
                    ['Type of meeting', next.kind === 'lupon_mediation' ? 'Mediation with the Lupon' : 'Mediation with the Barangay Chairman'],
                  ]}
                />
                <p className="mt-2 text-[length:calc(14.5px*var(--fs))] text-ink-muted">
                  Please attend in person. You will receive a reminder {KP.reminderDaysBefore} day before the hearing. If you have questions, visit or contact the Barangay Hall.
                </p>
              </Section>
            )}
            <Section title="Complaint details">
              <InfoRows
                rows={[
                  ['Subject', c.nature],
                  ...(respondent ? ([['Filed against', respondent]] as [string, string][]) : []),
                  ...(c.incidentDate ? ([['Date', formatDate(c.incidentDate)]] as [string, string][]) : []),
                  ...(c.incidentPlace ? ([['Place', c.incidentPlace]] as [string, string][]) : []),
                ]}
              />
            </Section>
            {c.details && (
              <Section title="What happened">
                <p className="text-[length:calc(15.5px*var(--fs))] whitespace-pre-wrap text-navy-900">{c.details.replace(/^\[[^\]]+\]\s*/, '')}</p>
              </Section>
            )}
            <Updates items={[...c.history].reverse().map((h) => ({ title: h.action, at: h.at, by: h.byRole === 'resident' ? 'You' : ROLES[h.byRole]?.name }))} />
          </>
        }
        side={
          <>
            <Progress steps={stepsFrom(labels, idx, notes, rs === 'Completed')} />
            {c.hearings.length > 0 && <Card className="overflow-hidden px-5 py-4">
              <TitleBar>What these words mean</TitleBar>
              <p className="text-[length:calc(15px*var(--fs))] font-semibold text-navy-900">Mediation</p>
              <p className="text-[length:calc(14.5px*var(--fs))] text-ink-nav">A meeting where the Barangay Chairman helps both sides agree on a solution.</p>
              <p className="mt-2 text-[length:calc(15px*var(--fs))] font-semibold text-navy-900">Lupon</p>
              <p className="text-[length:calc(14.5px*var(--fs))] text-ink-nav">If there is no agreement, the case may go to the Lupon Tagapamayapa, a barangay panel that continues the mediation.</p>
            </Card>}
            <NeedHelp />
          </>
        }
      />
    </>
  )
}

// ── Equipment borrowing details ─────────────────────────────────────

export function BorrowingDetailsPage() {
  const { id = '' } = useParams()
  const actor = useDocActor()!
  const { user } = useAuth()
  const [b, setB] = useState<Borrowing | null>(null)
  const [missing, setMissing] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  useEffect(() => {
    runBorrowingJobs()
    getBorrowing(id, actor).then(setB).catch(() => setMissing(true))
  }, [id, actor])
  if (missing) return <NotFound />
  if (!b) return <div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />

  const stage = borrowingStage(b)
  const ended = stage === 'Rejected' || stage === 'Cancelled'
  const trackStage = stage === 'Availability Checking' ? 'Request Submitted' : stage === 'Return Due Soon' || stage === 'Overdue' ? 'Borrowed' : stage
  const idx = STAGE_ORDER.indexOf(trackStage as (typeof STAGE_ORDER)[number])
  const at = (needle: string) => b.history.find((h) => h.action.toLowerCase().startsWith(needle))?.at
  const notes: Record<number, string | undefined> = {
    0: formatDate(b.requestedAt),
    1: at('approved') ? formatDate(at('approved')!) : undefined,
    2: at('prepared') ? formatDate(at('prepared')!) : undefined,
    3: b.releasedAt ? formatDate(b.releasedAt) : undefined,
    4: b.returnedAt ? formatDate(b.returnedAt) : undefined,
  }
  const pickup = appointmentFor('equipment_pickup', b.id)
  const mine = !!b.residentId && b.residentId === user?.residentId
  const overdueDays = stage === 'Overdue' && b.graceEndsAt ? Math.max(1, Math.ceil((Date.now() - new Date(b.graceEndsAt).getTime()) / 86_400_000)) : 0
  const cancel = async () => {
    setErr(null)
    try { setB(await actOnBorrowing(b.id, 'cancel', actor)); setConfirm(false) } catch (e) { setErr(e instanceof ServiceError ? e.message : 'The request could not be cancelled.') }
  }
  const tone = stage === 'Overdue' || stage === 'Rejected' ? 'danger' : stage === 'Return Due Soon' || stage === 'Availability Checking' ? 'warning' : stage === 'Completed' || stage === 'Cancelled' ? 'neutral' : 'info'
  const row = (label: string, value: React.ReactNode, kind?: string) => (
    <div className="flex flex-col gap-0.5 border-b border-line-soft py-3 last:border-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <dt className="text-[length:calc(16px*var(--fs))] text-ink-nav">{label}{kind && <span className="ml-2 text-[length:calc(14px*var(--fs))] font-semibold text-ink-muted">{kind}</span>}</dt>
      <dd className="text-[length:calc(17px*var(--fs))] font-semibold text-navy-900 sm:text-right">{value}</dd>
    </div>
  )

  return (
    <>
      <BackLink to="/my/borrowing">Equipment Borrowing</BackLink>
      <DetailHeader kind="Equipment borrowing" title={itemsText(b).replace(/ × /g, ' ')} referenceNo={b.refNo} status={stage} statusTone={tone} date={b.history.at(-1)?.at ?? b.requestedAt} dateLabel="Last updated" />
      <DetailBody
        main={
          <>
            {stage === 'Overdue' && (
              <Banner tone="danger" icon={<CircleAlert />} title="Your borrowed equipment is overdue">
                Please return it to the Barangay Hall as soon as possible. It was due on {fmtDue(b.dueAt!)} ({overdueDays} {overdueDays === 1 ? 'day' : 'days'} ago).
              </Banner>
            )}
            {stage === 'Rejected' && <Banner tone="danger" icon={<XCircle />} title="Your request was not approved">See the update below for the reason.</Banner>}

            <Section title="Schedule">
              <dl>
                {b.status === 'pending' && row('Estimated availability', b.estimate?.readyBy ? formatDate(b.estimate.readyBy) : 'Being determined', 'Estimate')}
                {b.status === 'pending' && b.estimate && <p className="pb-3 text-[length:calc(16px*var(--fs))] text-ink-nav">{b.estimate.note}</p>}
                {(b.status === 'approved' || b.status === 'ready') && row('Pickup', pickup?.date ? `${formatDate(pickup.date)} · ${formatTime(pickup.time)}` : <Link to={pickup ? `/my/appointments/${pickup.id}` : '/my/appointments'} className="text-info hover:underline">Choose a pickup time</Link>, pickup?.date ? 'Confirmed' : undefined)}
                {b.releasedAt && row('Released', formatDateTime(b.releasedAt), 'Actual')}
                {b.dueAt && row('Return deadline', fmtDue(b.dueAt), 'Confirmed')}
                {b.graceEndsAt && b.graceEndsAt !== b.dueAt && b.status === 'released' && row('Grace period until', fmtDue(b.graceEndsAt))}
                {b.returnedAt && row('Returned', formatDateTime(b.returnedAt), 'Actual')}
                {row('Date of use', `${formatDate(b.dateOfUse)}${b.statedReturnDate ? ` to ${formatDate(b.statedReturnDate)}` : ''}`)}
              </dl>
            </Section>

            {mine && ['pending', 'approved', 'ready'].includes(b.status) && (
              <div className="flex flex-wrap items-center gap-2">
                {confirm ? (
                  <>
                    <span className="text-[length:calc(16px*var(--fs))] text-navy-900">Cancel this request?</span>
                    <Button size="sm" variant="danger" onClick={cancel}>Yes, cancel request</Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>Keep it</Button>
                  </>
                ) : <Button size="sm" variant="secondary" onClick={() => setConfirm(true)}>Cancel request</Button>}
                {err && <span className="text-[length:calc(15px*var(--fs))] text-danger-ink">{err}</span>}
              </div>
            )}

            <Updates items={[...b.history].reverse().map((h) => ({ title: h.action, at: h.at, by: h.byUserId === 'system' ? 'System' : h.byRole === 'resident' ? 'You' : ROLES[h.byRole]?.name, note: h.remarks }))} />
          </>
        }
        side={
          <>
            <Progress steps={stepsFrom([...STAGE_ORDER], ended ? STAGE_ORDER.length : idx, notes, stage === 'Completed')} ended={ended ? (stage === 'Rejected' ? 'Not approved' : 'Cancelled') : undefined} />
            <NeedHelp />
          </>
        }
      />
    </>
  )
}

// ── Contact and Assistance / Announcements ──────────────────────────

export function ContactPage() {
  const help = [
    'Creating your account, or registering in person with a valid ID',
    'Requesting certificates and clearances',
    'Filing a complaint or incident report',
    'Borrowing barangay equipment',
    'Correcting your information in the barangay records',
    'If you do not have a phone or computer, personnel can encode your request for you at the Barangay Hall',
  ]
  return (
    <>
      <BackLink to="/dashboard">Back to Home</BackLink>
      <PageHeader title="Contact and Assistance" subtitle="Having trouble using the portal or accessing a barangay service? Our personnel are here to help." />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="px-5 py-4">
          <p className="flex items-center gap-2 text-[length:calc(16px*var(--fs))] font-semibold text-navy-900"><MapPin className="size-4" /> Visit the Barangay Hall</p>
          <p className="mt-2 text-[length:calc(15.5px*var(--fs))] font-semibold text-navy-900">{BARANGAY_CONTACT.hall}</p>
          <p className="text-[length:calc(15px*var(--fs))] text-navy-900">{BARANGAY_CONTACT.address}</p>
        </Card>
        <Card className="px-5 py-4">
          <p className="flex items-center gap-2 text-[length:calc(16px*var(--fs))] font-semibold text-navy-900"><Phone className="size-4" /> Contact the Barangay</p>
          <p className="mt-2 text-[length:calc(14px*var(--fs))] text-ink-muted">Phone</p>
          <a href={`tel:${BARANGAY_CONTACT.phone.replace(/[^\d+]/g, '')}`} className="block text-[length:calc(15.5px*var(--fs))] font-semibold text-info hover:underline">{BARANGAY_CONTACT.phone}</a>
          <a href={`tel:${BARANGAY_CONTACT.mobile.replace(/[^\d+]/g, '')}`} className="block text-[length:calc(15.5px*var(--fs))] font-semibold text-info hover:underline">{BARANGAY_CONTACT.mobile}</a>
          <p className="mt-2 flex items-center gap-1 text-[length:calc(14px*var(--fs))] text-ink-muted"><Mail className="size-3.5" /> Email</p>
          <a href={`mailto:${BARANGAY_CONTACT.email}`} className="block text-[length:calc(15.5px*var(--fs))] font-semibold break-all text-info hover:underline">{BARANGAY_CONTACT.email}</a>
        </Card>
        <Card className="px-5 py-4">
          <p className="flex items-center gap-2 text-[length:calc(16px*var(--fs))] font-semibold text-navy-900"><Clock className="size-4" /> Office Hours</p>
          <p className="mt-2 text-[length:calc(15.5px*var(--fs))] font-semibold text-navy-900">{BARANGAY_CONTACT.officeHours}</p>
          <p className="text-[length:calc(15px*var(--fs))] text-navy-900">{BARANGAY_CONTACT.saturdayHours}</p>
        </Card>
      </div>
      <Card className="mt-4 max-w-3xl px-5 py-4">
        <h2 className="font-display text-[length:calc(18px*var(--fs))] font-bold text-navy-900">What personnel can help you with</h2>
        <ul className="mt-2 divide-y divide-line-soft">
          {help.map((h) => (
            <li key={h} className="flex items-start gap-2.5 py-2.5 text-[length:calc(15.5px*var(--fs))] text-navy-900">
              <CheckCircle2 className="icon-line w-4 text-success" /> {h}
            </li>
          ))}
        </ul>
      </Card>
    </>
  )
}

/**
 * Reply to "Request more information": attach each item the Secretary asked for,
 * then send. The request goes back to the Secretary's review.
 */
function ReplyForm({ req, step, actor, onDone }: { req: DocumentRequest; step: Transition; actor: NonNullable<ReturnType<typeof useDocActor>>; onDone: (r: DocumentRequest) => void }) {
  const items = req.requestedItems?.length ? req.requestedItems : []
  const [files, setFiles] = useState<Record<string, StoredFile | null>>({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ready = message.trim() && items.every((i) => files[i])
  const send = async () => {
    setBusy(true)
    setError(null)
    try {
      const ids = Object.values(files).filter((f): f is StoredFile => !!f).map((f) => f.id)
      if (totalSize(ids) > MAX_TRANSACTION_BYTES) throw new ServiceError('too_large', 'Attachments total more than 10 MB. Remove a file or use a smaller one.')
      const names = Object.fromEntries(Object.entries(files).filter(([, f]) => f).map(([k, f]) => [k, f!.originalName]))
      const r = await applyTransition(req.id, step, message, actor, { files: names })
      attachUploads(ids, req.referenceNo)
      onDone(r)
    } catch (e) {
      setError(e instanceof ServiceError ? e.message : 'Your reply could not be sent. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Section title="Send what the barangay asked for">
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item}>
            <p className="mb-1 text-[length:calc(14.5px*var(--fs))] font-semibold text-navy-900">{item} <span className="text-danger-ink">*</span> <span className="font-normal text-ink-muted">(required)</span></p>
            <FileField category="reply" value={files[item] ?? null} onChange={(f) => setFiles((x) => ({ ...x, [item]: f }))} />
          </div>
        ))}
        <label className="block">
          <span className="mb-1 block text-[length:calc(14.5px*var(--fs))] font-semibold text-navy-900">Your message <span className="text-danger-ink">*</span> <span className="font-normal text-ink-muted">(required)</span></span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="For example: Here is a clearer photo of my ID."
            className="min-h-[80px] w-full rounded-[var(--radius-control)] border border-line px-3 py-2 text-[length:calc(15.5px*var(--fs))] text-navy-900 focus:border-navy-600 focus:outline-none"
          />
        </label>
        {error && <p role="alert" className="rounded-md bg-danger-tint px-3 py-2 text-[length:calc(14.5px*var(--fs))] text-danger-ink">{error}</p>}
        <Button className="h-11 w-full sm:w-auto" loading={busy} disabled={!ready} onClick={send}>Send reply</Button>
      </div>
    </Section>
  )
}

/** Home: the three newest published announcements (titles only; details open on their own page). */
