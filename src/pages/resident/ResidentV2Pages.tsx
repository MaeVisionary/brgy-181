import { CalendarClock, CheckCircle2, ChevronRight, CircleAlert, Clock, FileText, Inbox, Info, Mail, MapPin, MessageSquareWarning, Package, Paperclip, Phone, ReceiptText, XCircle } from '@/icons'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { TransitionPanel } from '@/components/documents/TransitionPanel'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { GreetingCard } from '@/components/ui/GreetingCard'
import { StatCard } from '@/components/ui/StatCard'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Panel'
import { BARANGAY_CONTACT, BORROWING, KP } from '@/config/barangay'
import { ROLES } from '@/config/permissions'
import { getDocumentType } from '@/documents/catalog'
import { isFilled } from '@/documents/fill'
import { WORKFLOWS } from '@/documents/workflows'
import { useAsync } from '@/hooks/useAsync'
import { useDocActor } from '@/hooks/useDocActor'
import { cn } from '@/lib/cn'
import { formatDate, formatDateTime } from '@/lib/format'
import { ALL_RESIDENT_STATUSES, borrowingStatusForResident, caseStageForResident, documentStatusForResident, type ResidentStatus } from '@/lib/residentStatus'
import { mockUsers } from '@/mocks/users'
import { getCase } from '@/services/caseService'
import { applyTransition, availableTransitions, getRequest } from '@/services/documentService'
import { actOnBorrowing, getBorrowing } from '@/services/equipmentService'
import { ServiceError } from '@/services/mockApi'
import { listMyTransactions, type Transaction, type TransactionKind } from '@/services/transactionService'
import type { KPCase } from '@/types/case'
import type { DocumentRequest, StatusEvent, Transition } from '@/types/document'
import type { Borrowing } from '@/types/equipment'
import { itemsText } from '@/pages/equipment/BorrowingPages'
import { NotFound } from '@/pages/system/NotFound'
import { BackLink, Banner, DetailBody, DetailHeader, InfoRows, NeedHelp, NumberedSteps, Progress, Pulse, Section, TitleBar, TransactionList, Updates, needsYou, stepsFrom } from './parts'

/** Example announcements showing the format barangay posts will take. */
const ANNOUNCEMENTS = [
  {
    kind: 'Public advisory',
    date: '2026-11-06',
    title: 'Free anti-rabies vaccination for dogs and cats',
    body: 'Bring your pets to the Barangay 181 Hall on Saturday, 14 November, 8:00 AM to 12:00 NN. Pets must be at least three months old. Bring their previous vaccination card if they have one.',
  },
  {
    kind: 'Office schedule',
    date: '2026-11-04',
    title: 'Barangay Hall closed on 30 November (Bonifacio Day)',
    body: 'The Barangay Hall will be closed in observance of Bonifacio Day. Online requests submitted on that day will be processed on the next working day.',
  },
  {
    kind: 'Community activity',
    date: '2026-11-01',
    title: 'Linis Barangay: community clean-up drive',
    body: 'Join the clean-up on Sunday, 22 November, 6:00 AM, starting at Asa St. corner Apog St. Bring gloves and a sack; drinking water will be provided. Open to all residents.',
  },
]

// ── Home ─────────────────────────────────────────────────────────────

const PENDING: ResidentStatus[] = ['Submitted', 'Under Review', 'Needs Additional Information']
const APPROVED: ResidentStatus[] = ['Approved', 'Ready for Pickup', 'Scheduled', 'Borrowed', 'Overdue']

/** Resident Home (Figma "Resident v2 / Home (simplified)"). */
export function ResidentHome() {
  const actor = useDocActor()!
  const tx = useAsync(() => listMyTransactions(actor), [actor]).data
  const recent = tx?.slice(0, 4) ?? null
  const actions = [
    { to: '/my/documents/new', icon: FileText, title: 'Request a document', body: 'Apply for barangay certificates and clearances' },
    { to: '/my/documents/new?category=case', icon: MessageSquareWarning, title: 'Report or complain', body: 'Report an incident or submit a complaint' },
    { to: '/my/borrowing?new=1', icon: Package, title: 'Borrow equipment', body: 'Request chairs, tables, ladders and other equipment.' },
  ]
  return (
    <>
      <GreetingCard subtitle="Your Barangay 181 services in one place." profileTo="/my/profile" />

      {/* Overview of everything the resident submitted (documents, complaints, borrowing). */}
      <section aria-label="My requests overview" className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total requests" value={tx ? tx.length : null} to="/my/transactions" />
        <StatCard label="Pending" value={tx ? tx.filter((t) => PENDING.includes(t.status)).length : null} attention={!!tx?.some((t) => t.status === 'Needs Additional Information')} to="/my/transactions" />
        <StatCard label="Approved" value={tx ? tx.filter((t) => APPROVED.includes(t.status)).length : null} to="/my/transactions" />
        <StatCard label="Completed" value={tx ? tx.filter((t) => t.status === 'Completed').length : null} to="/my/transactions" />
      </section>

      <h2 className="font-display text-[19px] font-bold text-navy-900">How can we help you today?</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {actions.map(({ to, icon: Icon, title, body }) => (
          <Link key={title} to={to} className="bmis-press flex min-h-[72px] items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3.5 transition-colors hover:border-navy-600/40 hover:bg-sky-50">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-sky-100 text-navy-900"><Icon className="size-[18px]" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-semibold text-navy-900">{title}</span>
              <span className="block text-[14.5px] text-ink-muted">{body}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-ink-subtle" />
          </Link>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <DarkHeadCard title="My Recent Activities" to="/my/transactions">
          {recent === null ? (
            <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded bg-surface-muted" />)}</div>
          ) : recent.length === 0 ? (
            <EmptyState icon={<ReceiptText className="size-5" />} title="No transactions yet" body="Your requests, complaints and borrowing will appear here." />
          ) : (
            <>
              <ul className="divide-y divide-line-soft">
                {recent.map((t) => <ActivityRow key={`${t.kind}-${t.id}`} t={t} />)}
              </ul>
            </>
          )}
        </DarkHeadCard>

        <DarkHeadCard title="Barangay Announcements" to="/my/announcements">
          <ul className="divide-y divide-line-soft">
            {ANNOUNCEMENTS.map((a) => <AnnouncementItem key={a.title} a={a} />)}
          </ul>
        </DarkHeadCard>
      </div>

      <NeedAssistance />
    </>
  )
}

function DarkHeadCard({ title, to, children }: { title: string; to: string; children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 bg-bar border-b border-sky-300 text-navy-900 px-5 py-3.5">
        <h2 className="font-display text-[17.5px] font-bold">{title}</h2>
        <Link to={to} className="inline-flex min-h-9 shrink-0 items-center gap-1 text-[14.5px] font-semibold text-navy-900 hover:underline">
          View all <ChevronRight className="size-4" />
        </Link>
      </div>
      {children}
    </Card>
  )
}

function ActivityRow({ t }: { t: Transaction }) {
  return (
    <li>
      <Link to={t.to} className={cn('flex items-center gap-3 px-5 py-3.5', needsYou(t) ? 'border-l-4 border-l-warning bg-warning-tint/60 hover:bg-warning-tint' : 'hover:bg-sky-50')}>
        <span className="min-w-0 flex-1">
          {needsYou(t) && <span className="mb-1 flex items-center gap-2 text-[14px] font-semibold text-warning"><Pulse /> Action needed: reply to the barangay</span>}
          <span className="block text-[12.5px] font-semibold tracking-[0.06em] text-ink-muted uppercase">{t.kindLabel}</span>
          <span className="block truncate text-[16px] font-semibold text-navy-900">{t.title}</span>
          <span className="block text-[14px] text-ink-muted">Ref. no. {t.referenceNo} · Submitted {formatDate(t.submittedAt)}</span>
        </span>
        <span className="hidden sm:block"><StatusDot status={t.status} /></span>
        <ChevronRight className="size-4 shrink-0 text-ink-subtle" />
      </Link>
      <span className="block px-5 pb-3 sm:hidden"><StatusDot status={t.status} /></span>
    </li>
  )
}

function StatusDot({ status }: { status: ResidentStatus }) {
  // Lazy import avoided: StatusLabel is tiny.
  return <StatusLabelInline status={status} />
}
import { StatusLabel as StatusLabelInline } from '@/components/ui/StatusLabel'

function AnnouncementItem({ a, full }: { a: (typeof ANNOUNCEMENTS)[number]; full?: boolean }) {
  return (
    <li className={cn('px-5 py-4', full && 'sm:px-6')}>
      <p className="text-[13px] font-semibold tracking-[0.06em] text-navy-600 uppercase">
        {a.kind} <span className="font-normal tracking-normal text-ink-muted normal-case">· Published {formatDate(a.date)}</span>
      </p>
      <p className="mt-1 font-display text-[17px] font-bold text-navy-900">{a.title}</p>
      <p className="text-[15px] text-ink-nav">{a.body}</p>
    </li>
  )
}

function NeedAssistance() {
  const C = BARANGAY_CONTACT
  return (
    <section className="mt-4 border-t border-line pt-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-[19px] font-bold text-navy-900">Need Assistance?</h2>
        </div>
        <Link to="/my/contact" className="inline-flex h-11 shrink-0 items-center justify-center gap-1 self-start rounded-[var(--radius-control)] border border-line bg-surface px-4 text-[15px] font-semibold text-navy-900 hover:bg-surface-muted sm:self-center">
          View contact information <ChevronRight className="size-4" />
        </Link>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[var(--radius-control)] border border-line bg-surface px-4 py-3">
          <p className="flex items-center gap-1.5 text-[15.5px] font-semibold text-navy-900"><MapPin className="size-4" /> Visit the Barangay Hall</p>
          <p className="mt-1 text-[15px] text-navy-900">{C.hall}, {C.address}</p>
        </div>
        <div className="rounded-[var(--radius-control)] border border-line bg-surface px-4 py-3">
          <p className="flex items-center gap-1.5 text-[15.5px] font-semibold text-navy-900"><Phone className="size-4" /> Contact the Barangay</p>
          <a href={`tel:${C.phone.replace(/[^\d+]/g, '')}`} className="mt-1 block text-[15px] text-info hover:underline">{C.phone}</a>
          <a href={`mailto:${C.email}`} className="block text-[15px] break-all text-info hover:underline">{C.email}</a>
        </div>
        <div className="rounded-[var(--radius-control)] border border-line bg-surface px-4 py-3">
          <p className="flex items-center gap-1.5 text-[15.5px] font-semibold text-navy-900"><Clock className="size-4" /> Office Hours</p>
          <p className="mt-1 text-[15px] text-navy-900">{C.officeHours}</p>
        </div>
      </div>
    </section>
  )
}

// ── My Transactions ─────────────────────────────────────────────────

const EMPTY: Record<'all' | TransactionKind, { title: string; body: string; action: string; to: string }> = {
  all: { title: 'You have no transactions yet.', body: 'Document requests, complaints and equipment borrowing you submit will appear here.', action: 'Request a document', to: '/my/documents/new' },
  document: { title: 'You have no document requests yet.', body: 'You can request certificates and clearances online, then claim them at the Barangay Hall.', action: 'Request a document', to: '/my/documents/new' },
  complaint: { title: 'You have no complaints or reports yet.', body: 'If you need to report an incident or ask for a summons, you can do it online or at the Barangay Hall.', action: 'Report or complain', to: '/my/documents/new?category=case' },
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
  const shown = (all ?? []).filter((t) => (kind === 'all' || t.kind === kind) && (!status || t.status === status))
  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) if (v && v !== 'all') next.set(k, v); else next.delete(k)
    setParams(next, { replace: true })
  }

  return (
    <>
      <PageHeader title="My Transactions" subtitle="View and track all your requests and transactions with Barangay 181." />
      <div role="tablist" aria-label="Transaction type" className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            role="tab"
            type="button"
            aria-selected={kind === f.key}
            onClick={() => set({ type: f.key })}
            className={cn(
              'inline-flex h-11 items-center justify-between gap-2 rounded-[var(--radius-control)] border px-4 text-[15.5px] font-semibold transition-colors sm:justify-start',
              kind === f.key ? 'border-navy-900 bg-navy-900 text-white' : 'border-line bg-surface text-navy-900 hover:bg-surface-muted',
            )}
          >
            {f.label} <span className={kind === f.key ? 'text-white/75' : 'text-ink-muted'}>({all ? count(f.key) : '–'})</span>
          </button>
        ))}
      </div>
      <label className="mt-4 flex items-center gap-3 text-[15px] font-semibold text-navy-900">
        Status
        <select
          value={status}
          onChange={(e) => set({ status: e.target.value })}
          className="h-11 min-w-[180px] rounded-[var(--radius-control)] border border-line bg-surface px-3 text-[15.5px] font-normal text-navy-900 focus:border-navy-600 focus:outline-none"
        >
          <option value="">All statuses</option>
          {ALL_RESIDENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>

      <Card className="mt-4 overflow-hidden">
        {all === null ? (
          <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded bg-surface-muted" />)}</div>
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <Inbox className="size-9 text-ink-subtle" strokeWidth={1.5} />
            <p className="mt-3 font-display text-[19px] font-bold text-navy-900">{status ? 'No transactions with this status.' : EMPTY[kind].title}</p>
            <p className="mt-1 max-w-md text-[15.5px] text-ink-muted">{status ? 'Try another status, or choose "All statuses".' : EMPTY[kind].body}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {!status && (
                <Link to={EMPTY[kind].to} className="inline-flex h-11 items-center rounded-[var(--radius-control)] bg-navy-900 px-5 text-[15.5px] font-semibold text-white hover:bg-navy-800">
                  {EMPTY[kind].action}
                </Link>
              )}
              {(status || kind !== 'all') && (
                <button type="button" onClick={() => set({ type: 'all', status: '' })} className="inline-flex h-11 items-center rounded-[var(--radius-control)] border border-line bg-surface px-5 text-[15.5px] font-semibold text-navy-900 hover:bg-surface-muted">
                  Show all transactions
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <TransactionList items={shown} showType={kind === 'all'} />
            <p className="border-t border-line-soft px-5 py-3 text-[14px] text-ink-muted">Showing {shown.length} transaction{shown.length === 1 ? '' : 's'}, newest first. Select a row to see its details.</p>
          </>
        )}
      </Card>
    </>
  )
}

// ── Document request details ────────────────────────────────────────

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
    if (actor) getRequest(id, actor).then(setReq).catch(() => setNotFound(true))
  }, [id, actor])
  if (notFound) return <NotFound />
  if (!req || !actor) return <div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />

  const type = getDocumentType(req.typeId)
  const report = type.category === 'case'
  const rs = documentStatusForResident(req.status)
  const shown = type.fields.filter((f) => f.by !== 'system' && !f.staffOnly && isFilled(req.values[f.key]))
  const needInfo = [...req.history].reverse().find((h) => h.status === 'needs_info')
  const usesApproval = WORKFLOWS[type.workflow].path.includes('approved')
  const replyStep = availableTransitions(req, actor).find((t) => t.by === 'owner' && t.from.includes('needs_info') && t.to === 'under_review')

  // Progress follows the request's own workflow, in resident words.
  const labels: ResidentStatus[] = usesApproval ? ['Submitted', 'Under Review', 'Approved', 'Ready for Pickup', 'Completed'] : ['Submitted', 'Under Review', 'Completed']
  const order = (s: ResidentStatus) => labels.indexOf(s === 'Needs Additional Information' ? 'Under Review' : s)
  const reached = (label: ResidentStatus) => req.history.find((h) => order(documentStatusForResident(h.status)) >= order(label))
  const idx = order(rs)
  const ended = rs === 'Rejected' || rs === 'Cancelled'
  const notes: Record<number, string | undefined> = {}
  labels.forEach((l, i) => {
    const ev = reached(l)
    if (ev && (i < idx || (i === idx && !ended))) notes[i] = formatDate(ev.at)
  })
  if (rs === 'Ready for Pickup') notes[labels.length - 1] = 'After you claim the document'
  const steps = stepsFrom(labels, ended ? labels.length : Math.max(0, idx), notes, rs === 'Completed')

  return (
    <>
      <BackLink to="/my/transactions">Back to My Transactions</BackLink>
      <DetailHeader kind={report ? 'Report' : 'Document request'} title={type.name} referenceNo={req.referenceNo} status={rs} date={req.submittedAt} />
      <DetailBody
        main={
          <>
            {rs === 'Ready for Pickup' && (
              <Banner tone="success" icon={<CheckCircle2 />} title="Your document is ready for pickup">
                Your {type.name} has been signed and sealed. You can claim it at the Barangay 181 Hall.
              </Banner>
            )}
            {rs === 'Needs Additional Information' && (
              <Banner tone="warning" icon={<CircleAlert />} title="We need more information from you">
                Your request is on hold until you send what the barangay asked for below.
              </Banner>
            )}
            {rs === 'Submitted' && (
              <Banner tone="info" icon={<Info />} title="Your request has been received">
                The Barangay Secretary will check your information. We will notify you when there is an update.
              </Banner>
            )}
            {rs === 'Rejected' && <Banner tone="danger" icon={<XCircle />} title="Your request was not approved">See the update below for the reason. You may visit the Barangay Hall for help.</Banner>}

            {rs === 'Needs Additional Information' && needInfo?.remarks && (
              <Card className="overflow-hidden border-warning/50 bg-warning-tint/50 px-5 py-4">
                <h2 className="-mx-5 -mt-4 mb-3 flex items-center gap-2 bg-bar border-b border-sky-300 text-navy-900 px-5 py-3.5 font-display text-[17.5px] font-bold">
                  Message from the barangay
                </h2>
                <p className="rounded-md bg-surface px-3 py-2 text-[15.5px] text-navy-900">“{needInfo.remarks}”</p>
                <p className="mt-1 text-[14px] text-ink-muted">From the {ROLES[needInfo.byRole].name} · {formatDateTime(needInfo.at)}</p>
              </Card>
            )}
            {replyStep && <ReplyForm req={req} step={replyStep} actor={actor} onDone={(r) => setReq({ ...r })} />}
            {availableTransitions(req, actor).some((t) => t.by === 'owner' && t !== replyStep) && (
              <TransitionPanel req={req} actor={actor} ownerView exclude={(t) => t.label === replyStep?.label} onChange={(r) => setReq({ ...r })} />
            )}

            {rs === 'Ready for Pickup' && (
              <Section title="How to claim your document">
                <NumberedSteps steps={['Go to the Barangay 181 Hall during office hours.', 'Bring a valid ID.', `Give your reference number: ${req.referenceNo}.`]} />
              </Section>
            )}

            <Section title={report ? 'Report details' : 'Request details'}>
              <InfoRows
                rows={[
                  ['Document', type.name],
                  ...shown.map((f): [string, React.ReactNode] => [
                    `${f.group ? `${f.group}: ` : ''}${f.label}`,
                    Array.isArray(req.values[f.key]) ? (req.values[f.key] as string[]).join(', ') : req.values[f.key] === true ? 'Yes' : String(req.values[f.key]),
                  ]),
                ]}
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
            <Progress steps={steps} ended={ended ? `${rs} on ${formatDate(req.updatedAt)}` : undefined} />
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
  const labels: ResidentStatus[] = ['Submitted', 'Under Review', 'Scheduled', 'Completed']
  const idx = labels.indexOf(rs)
  const firstAt = (pred: (s: ResidentStatus) => boolean) => c.history.find((h) => pred(caseStageForResident(h.stage)))?.at
  const notes: Record<number, string | undefined> = {
    0: formatDate(c.filedAt),
    1: firstAt((s) => s !== 'Submitted') ? formatDate(firstAt((s) => s !== 'Submitted')!) : undefined,
    2: next ? `Hearing on ${formatDateTime(next.scheduledAt)}` : undefined,
    3: rs === 'Completed' ? undefined : 'When the complaint is settled or closed',
  }
  const respondent = c.respondents?.map((r) => r.name).join(', ')

  return (
    <>
      <BackLink to="/my/transactions">Back to My Transactions</BackLink>
      <DetailHeader kind="Complaint · Katarungang Pambarangay" title={`Complaint: ${c.nature}`} referenceNo={c.caseNo} status={rs} date={c.filedAt} />
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
                <p className="mt-2 text-[14.5px] text-ink-muted">
                  Please attend in person. You will receive a reminder {KP.reminderDaysBefore} day before the hearing. If you have questions, visit or contact the Barangay Hall.
                </p>
              </Section>
            )}
            <Section title="Complaint details">
              <InfoRows
                rows={[
                  ['Type of complaint', c.nature],
                  ...(respondent ? ([['Filed against', respondent]] as [string, string][]) : []),
                  ['Date submitted', formatDateTime(c.filedAt)],
                  ['Incident date', (c as { incidentDate?: string }).incidentDate ? formatDate((c as { incidentDate?: string }).incidentDate!) : 'Not provided'],
                ]}
              />
            </Section>
            {c.details && (
              <Section title="Your complaint">
                <p className="text-[15.5px] whitespace-pre-wrap text-navy-900">{c.details}</p>
              </Section>
            )}
            <Updates items={[...c.history].reverse().map((h) => ({ title: h.action, at: h.at, by: h.byRole === 'resident' ? 'You' : ROLES[h.byRole]?.name }))} />
          </>
        }
        side={
          <>
            <Progress steps={stepsFrom(labels, idx, notes, rs === 'Completed')} />
            <Card className="overflow-hidden px-5 py-4">
              <TitleBar>What these words mean</TitleBar>
              <p className="text-[15px] font-semibold text-navy-900">Mediation</p>
              <p className="text-[14.5px] text-ink-nav">A meeting where the Barangay Chairman helps both sides agree on a solution.</p>
              <p className="mt-2 text-[15px] font-semibold text-navy-900">Lupon</p>
              <p className="text-[14.5px] text-ink-nav">If there is no agreement, the case may go to the Lupon Tagapamayapa, a barangay panel that continues the mediation.</p>
            </Card>
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
    getBorrowing(id, actor).then(setB).catch(() => setMissing(true))
  }, [id, actor])
  const rs = useMemo(() => (b ? borrowingStatusForResident(b) : null), [b])
  if (missing) return <NotFound />
  if (!b || !rs) return <div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />

  const labels: ResidentStatus[] = ['Submitted', 'Approved', 'Borrowed', 'Completed']
  const idx = rs === 'Overdue' ? 2 : labels.indexOf(rs)
  const ended = rs === 'Rejected' || rs === 'Cancelled'
  const at = (needle: string) => b.history.find((h) => h.action.toLowerCase().includes(needle))?.at
  const notes: Record<number, string | undefined> = {
    0: formatDate(b.requestedAt),
    1: at('approv') ? formatDate(at('approv')!) : undefined,
    2: b.releasedAt ? `Released ${formatDate(b.releasedAt)}` : undefined,
    3: b.returnedAt ? `Returned ${formatDate(b.returnedAt)}` : 'After you return the equipment',
  }
  const cancel = async () => {
    setErr(null)
    try {
      setB({ ...(await actOnBorrowing(b.id, 'cancel', actor, { remarks: 'Cancelled by the resident' })) })
      setConfirm(false)
    } catch (e) {
      setErr(e instanceof ServiceError ? e.message : 'The request could not be cancelled.')
    }
  }

  return (
    <>
      <BackLink to="/my/transactions">Back to My Transactions</BackLink>
      <DetailHeader kind="Equipment borrowing" title={`Borrow ${itemsText(b).replace(/ × /g, ' ')}`} referenceNo={b.refNo} status={rs} date={b.requestedAt} />
      <DetailBody
        main={
          <>
            {rs === 'Submitted' && (
              <Banner tone="info" icon={<Info />} title="Your request has been received">
                The Property Custodian will check if the equipment is available. We will notify you when your request is approved.
              </Banner>
            )}
            {rs === 'Approved' && (
              <Banner tone="success" icon={<CheckCircle2 />} title="Approved: ready to claim">
                Claim the equipment at the Barangay 181 Hall. The {BORROWING.periodDays}-day borrowing period starts on the day it is released to you.
              </Banner>
            )}
            {rs === 'Borrowed' && b.dueAt && (
              <Banner tone="info" icon={<Package />} title={`Please return it by ${formatDate(b.dueAt)}`}>
                A {BORROWING.graceDays}-day grace period applies until {formatDate(b.graceEndsAt!)}.
              </Banner>
            )}
            {rs === 'Overdue' && (
              <Banner tone="danger" icon={<CircleAlert />} title="This equipment is overdue">
                The grace period ended on {formatDate(b.graceEndsAt!)}. Please return the equipment to the Barangay 181 Hall as soon as possible.
              </Banner>
            )}
            {rs === 'Rejected' && <Banner tone="danger" icon={<XCircle />} title="Your request was not approved">See the update below for the reason.</Banner>}

            {rs === 'Submitted' && b.residentId && b.residentId === user?.residentId && (
              <div className="flex flex-wrap items-center gap-2">
                {confirm ? (
                  <>
                    <span className="text-[15px] text-navy-900">Cancel this request?</span>
                    <Button size="sm" variant="danger" onClick={cancel}>Yes, cancel request</Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>Keep it</Button>
                  </>
                ) : (
                  <Button size="sm" variant="danger" onClick={() => setConfirm(true)}>Cancel request</Button>
                )}
                {err && <span className="text-[14.5px] text-danger-ink">{err}</span>}
              </div>
            )}

            <Section title="Borrowing details">
              <InfoRows
                rows={[
                  ['Requested equipment', itemsText(b)],
                  ['Date of use', formatDate(b.dateOfUse)],
                  ...(b.statedReturnDate ? ([['Return date you gave', formatDate(b.statedReturnDate)]] as [string, string][]) : []),
                  ...(b.dueAt ? ([['Return by', `${formatDate(b.dueAt)} (grace until ${formatDate(b.graceEndsAt!)})`]] as [string, string][]) : []),
                  ['Borrowing period', `${BORROWING.periodDays} days from release, plus a ${BORROWING.graceDays}-day grace period`],
                ]}
              />
            </Section>
            <Updates items={[...b.history].reverse().map((h) => ({ title: h.action, at: h.at, by: h.byRole === 'resident' ? 'You' : ROLES[h.byRole]?.name, note: h.remarks }))} />
          </>
        }
        side={
          <>
            <Progress steps={stepsFrom(labels, ended ? labels.length : idx, notes, rs === 'Completed')} ended={ended ? `${rs}` : undefined} />
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
    'Filing a complaint, incident report or blotter report',
    'Borrowing barangay equipment',
    'Correcting your information in the barangay records',
    'If you do not have a phone or computer, personnel can encode your request for you at the Barangay Hall',
  ]
  return (
    <>
      <BackLink to="/dashboard">Back to Home</BackLink>
      <PageHeader title="Contact and Assistance" subtitle="Having trouble using the portal or accessing a barangay service? Our personnel are here to help." />
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="px-5 py-4">
          <p className="flex items-center gap-2 text-[16px] font-semibold text-navy-900"><MapPin className="size-4" /> Visit the Barangay Hall</p>
          <p className="mt-2 text-[15.5px] font-semibold text-navy-900">{BARANGAY_CONTACT.hall}</p>
          <p className="text-[15px] text-navy-900">{BARANGAY_CONTACT.address}</p>
        </Card>
        <Card className="px-5 py-4">
          <p className="flex items-center gap-2 text-[16px] font-semibold text-navy-900"><Phone className="size-4" /> Contact the Barangay</p>
          <p className="mt-2 text-[14px] text-ink-muted">Phone</p>
          <a href={`tel:${BARANGAY_CONTACT.phone.replace(/[^\d+]/g, '')}`} className="block text-[15.5px] font-semibold text-info hover:underline">{BARANGAY_CONTACT.phone}</a>
          <a href={`tel:${BARANGAY_CONTACT.mobile.replace(/[^\d+]/g, '')}`} className="block text-[15.5px] font-semibold text-info hover:underline">{BARANGAY_CONTACT.mobile}</a>
          <p className="mt-2 flex items-center gap-1 text-[14px] text-ink-muted"><Mail className="size-3.5" /> Email</p>
          <a href={`mailto:${BARANGAY_CONTACT.email}`} className="block text-[15.5px] font-semibold break-all text-info hover:underline">{BARANGAY_CONTACT.email}</a>
        </Card>
        <Card className="px-5 py-4">
          <p className="flex items-center gap-2 text-[16px] font-semibold text-navy-900"><Clock className="size-4" /> Office Hours</p>
          <p className="mt-2 text-[15.5px] font-semibold text-navy-900">{BARANGAY_CONTACT.officeHours}</p>
          <p className="text-[15px] text-navy-900">{BARANGAY_CONTACT.saturdayHours}</p>
        </Card>
      </div>
      <Card className="mt-4 max-w-3xl px-5 py-4">
        <h2 className="font-display text-[18px] font-bold text-navy-900">What personnel can help you with</h2>
        <ul className="mt-2 divide-y divide-line-soft">
          {help.map((h) => (
            <li key={h} className="flex items-start gap-2.5 py-2.5 text-[15.5px] text-navy-900">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> {h}
            </li>
          ))}
        </ul>
      </Card>
    </>
  )
}

export function AnnouncementsPage() {
  return (
    <>
      <BackLink to="/dashboard">Back to Home</BackLink>
      <PageHeader title="Barangay Announcements" subtitle="Advisories, office schedules and community activities from Barangay 181." />
      <Card className="max-w-3xl">
        <ul className="divide-y divide-line-soft">
          {ANNOUNCEMENTS.map((a) => <AnnouncementItem key={a.title} a={a} full />)}
        </ul>
      </Card>
      <p className="mt-3 max-w-3xl text-[14px] text-ink-muted">
        Barangay personnel cannot post announcements in the system yet, so the items above are sample content showing how announcements will appear.
      </p>
    </>
  )
}

/**
 * Reply to "Request more information": attach each item the Secretary asked for,
 * then send. The request goes back to the Secretary's review.
 */
function ReplyForm({ req, step, actor, onDone }: { req: DocumentRequest; step: Transition; actor: NonNullable<ReturnType<typeof useDocActor>>; onDone: (r: DocumentRequest) => void }) {
  const items = req.requestedItems?.length ? req.requestedItems : []
  const [files, setFiles] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ready = message.trim() && items.every((i) => files[i])
  const send = async () => {
    setBusy(true)
    setError(null)
    try {
      onDone(await applyTransition(req.id, step, message, actor, { files }))
    } catch (e) {
      setError(e instanceof ServiceError ? e.message : 'Your reply could not be sent. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Section title="Send what the barangay asked for" subtitle="Attach each item, add a short message, then send your reply.">
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item}>
            <p className="mb-1 text-[14.5px] font-semibold text-navy-900">{item} <span className="text-danger-ink">*</span> <span className="font-normal text-ink-muted">(required)</span></p>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-[var(--radius-control)] border border-dashed border-line px-3 py-2 text-[15px] text-navy-900 hover:border-navy-600 hover:bg-sky-50">
              <Paperclip className="size-4 shrink-0 text-ink-muted" />
              <span className="min-w-0 flex-1 truncate">{files[item] ?? 'Choose a photo or PDF'}</span>
              {files[item] && <span className="text-[14px] font-semibold text-info">Change</span>}
              <input
                type="file"
                accept="image/*,application/pdf"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) setFiles((x) => ({ ...x, [item]: f.name }))
                }}
              />
            </label>
          </div>
        ))}
        <label className="block">
          <span className="mb-1 block text-[14.5px] font-semibold text-navy-900">Your message <span className="text-danger-ink">*</span> <span className="font-normal text-ink-muted">(required)</span></span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="For example: Here is a clearer photo of my ID."
            className="min-h-[80px] w-full rounded-[var(--radius-control)] border border-line px-3 py-2 text-[15.5px] text-navy-900 focus:border-navy-600 focus:outline-none"
          />
        </label>
        {error && <p role="alert" className="rounded-md bg-danger-tint px-3 py-2 text-[14.5px] text-danger-ink">{error}</p>}
        <Button className="h-11 w-full sm:w-auto" loading={busy} disabled={!ready} onClick={send}>Send reply</Button>
      </div>
    </Section>
  )
}
