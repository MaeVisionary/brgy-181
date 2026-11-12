import { BarChart3, CalendarClock, ChevronRight, FileText, Gavel, ShieldCheck, UserRoundPen } from '@/icons'
import { Badge } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { Panel } from '@/components/ui/Panel'
import { RECURRING_REPORTS } from '@/config/barangay'
import { getDocumentType } from '@/documents/catalog'
import { useAsync } from '@/hooks/useAsync'
import { useDocActor } from '@/hooks/useDocActor'
import { useAuth } from '@/auth/useAuth'
import { formatDateTime } from '@/lib/format'
import { STAGE_LABEL, STAGE_TONE, listCases, upcomingHearings } from '@/services/caseService'
import { availableTransitions, listRequests } from '@/services/documentService'
import { getResidentQueueCounts, listChangeRequests } from '@/services/residentService'
import { listRegistrations } from '@/services/registrationService'
import { listAppointments } from '@/services/appointmentService'
import { listReviewQueue } from '@/services/concernService'
import { estimateFor } from '@/services/serviceStandardService'
import { TodayAppointmentsPanel } from '@/pages/appointments/AppointmentPages'
import { Link } from 'react-router-dom'
import { DashHeader, EmptyNote, ListPanel, Row, Stat, ViewAll } from './shared'

/** Ana Manila Salvador: day-to-day administration of records, documents, complaints and reports. */
export function SecretaryDashboard() {
  const actor = useDocActor()!
  const { user } = useAuth()
  const docs = useAsync(() => listRequests(actor), [actor]).data
  const cases = useAsync(() => listCases(actor), [actor]).data
  const q = useAsync(getResidentQueueCounts).data
  const regs = useAsync(listRegistrations).data
  const crs = useAsync(listChangeRequests).data
  const appts = useAsync(() => (user ? listAppointments(user) : Promise.resolve([])), [user]).data
  const concernReview = useAsync(() => (user ? listReviewQueue(user) : Promise.resolve([])).catch(() => []), [user]).data

  const myQueue = docs?.filter((d) => availableTransitions(d, actor).some((t) => t.by !== 'owner' && !t.label.startsWith('Cancel'))) ?? null
  const isCase = (id: string) => getDocumentType(id as never).category === 'case'
  const newDocs = docs?.filter((d) => d.status === 'submitted' && !isCase(d.typeId)).length ?? null
  const toPrepare = docs?.filter((d) => ['under_review', 'needs_info', 'processing'].includes(d.status) && !isCase(d.typeId)).length ?? null
  const completed = docs?.filter((d) => d.status === 'released').length ?? null
  const awaitingChairman = docs?.filter((d) => d.status === 'pending_approval').length ?? null
  const submissions = docs?.filter((d) => isCase(d.typeId) && ['submitted', 'under_review', 'needs_info'].includes(d.status)).length ?? null
  const caseUpdates = cases?.filter((c) => ['filed', 'under_review', 'referred_to_lupon', 'mediation_scheduled'].includes(c.stage)) ?? null
  const hearings = cases ? upcomingHearings(cases) : null
  // Open = not completed, rejected or cancelled. Completed this week = marked completed in the last 7 days.
  const openCount = docs?.filter((d) => !['released', 'served', 'forwarded', 'rejected', 'cancelled'].includes(d.status)).length ?? null
  const weekAgo = Date.now() - 7 * 86_400_000
  const doneThisWeek = docs?.filter((d) => d.history.some((h) => ['released', 'served', 'forwarded'].includes(h.status) && new Date(h.at).getTime() >= weekAgo)).length ?? null

  // Work split by who has to act next, so the Secretary sees only her own pile first.
  const loaded = docs && regs && crs && appts && concernReview
  const today = new Date().toISOString().slice(0, 10)
  const openDoc = (d: { status: string }) => !['released', 'served', 'forwarded', 'rejected', 'cancelled'].includes(d.status)
  const byWho = loaded
    ? {
        mine: (myQueue?.length ?? 0) + regs.filter((r) => r.status === 'manual_review' && !(r.inPerson && !r.inPerson.completedAt)).length
          + crs.filter((c) => c.status === 'pending').length + concernReview.length,
        auto: crs.filter((c) => c.decidedBy === 'system' && c.decidedAt && new Date(c.decidedAt).getTime() >= weekAgo).length
          + regs.filter((r) => r.status === 'auto_approved' && new Date(r.submittedAt).getTime() >= weekAgo).length,
        resident: docs.filter((d) => d.status === 'needs_info').length + regs.filter((r) => r.status === 'manual_review' && r.inPerson && !r.inPerson.completedAt).length
          + appts.filter((a) => ['awaiting_schedule', 'pending_confirmation', 'rescheduled'].includes(a.status)).length,
        chairman: docs.filter((d) => d.status === 'pending_approval').length,
        late: docs.filter((d) => { if (!openDoc(d)) return false; const e = estimateFor(d); return !!e && (e.extended?.newDate ?? e.expectedBy) < today }).length,
      }
    : null

  return (
    <>
      <DashHeader
        overview="Secretary Overview"
        subtitle=""
        actions={<ButtonLink to="/reports" icon={<BarChart3 className="size-4" />}>Reports</ButtonLink>}
      />

      {/* Document pipeline at a glance (registrations live under Needs attention, not here twice). */}
      <section aria-label="Document requests" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="New requests" value={newDocs} to="/documents" />
        <Stat label="Under verification" value={toPrepare} to="/documents" />
        <Stat label="Forwarded to Chairman" value={awaitingChairman} to="/documents" />
        <Stat label="Completed" value={completed} to="/documents" />
      </section>

      <Panel className="mt-4" title="Who needs to act" bodyClassName="px-0 py-0">
        <dl className="grid grid-cols-2 divide-line-soft sm:grid-cols-5 sm:divide-x">
          {([
            ['Needs my attention', byWho?.mine, 'Waiting on you', 'text-navy-900'],
            ['Past expected date', byWho?.late, 'Exceptions', byWho?.late ? 'text-danger' : 'text-navy-900'],
            ['Waiting for resident', byWho?.resident, 'Reply, visit or confirmation', 'text-navy-900'],
            ['Waiting for Chairman', byWho?.chairman, 'Approval or signature', 'text-navy-900'],
            ['Done automatically', byWho?.auto, 'Last 7 days', 'text-success'],
          ] as const).map(([label, n, hint, tone]) => (
            <div key={label} className="flex flex-col gap-1 border-b border-line-soft px-4 py-4 sm:border-b-0">
              <dt className="text-[length:calc(15px*var(--fs))] leading-snug font-semibold text-ink-nav">{label}</dt>
              <dd className={`font-display text-[length:calc(30px*var(--fs))] leading-none font-extrabold tabular-nums ${tone}`}>{n ?? '–'}</dd>
              <dd className="text-[length:calc(13.5px*var(--fs))] text-ink-muted">{hint}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <TodayAppointmentsPanel />

      <Panel className="mt-4" title="Needs attention" bodyClassName="px-0 py-0">
        <ul className="divide-y divide-line-soft">
          {([
            [ShieldCheck, 'Registrations to verify', q?.registrationsForReview ?? null, '/residents/registrations'],
            [UserRoundPen, 'Resident update requests', q?.pendingChangeRequests ?? null, '/residents/change-requests'],
            [FileText, 'Complaints and reports', submissions, '/documents'],
            [Gavel, 'Cases needing updates', caseUpdates?.length ?? null, '/cases'],
          ] as const).map(([Icon, label, n, to]) => (
            <li key={label}>
              <Link to={to} className="flex min-h-[60px] items-center gap-4 px-5 py-3 transition-colors hover:bg-sky-50 focus-visible:bg-sky-50 active:bg-sky-100">
                <Icon className="size-[22px] shrink-0 text-navy-600" />
                <span className="min-w-0 flex-1 text-[length:calc(16.5px*var(--fs))] font-medium text-navy-900">{label}</span>
                <span className={`font-display text-[length:calc(22px*var(--fs))] font-extrabold tabular-nums ${n ? 'text-navy-900' : 'text-ink-subtle'}`}>{n ?? '–'}</span>
                <ChevronRight className="size-4 shrink-0 text-ink-subtle" />
              </Link>
            </li>
          ))}
        </ul>
      </Panel>

      {/* Work queue across the full width; hearings and case records side by side below it. */}
      <section className="mt-4">
        <Panel title="Your work queue" actions={<ViewAll to="/documents" />} bodyClassName="px-0 py-0">
          <dl className="grid grid-cols-3 divide-x divide-line-soft border-b border-line-soft">
            {([
              ['Needs your action', myQueue?.length ?? null, 'text-navy-900'],
              ['Open requests', openCount, 'text-navy-900'],
              ['Completed this week', doneThisWeek, 'text-success'],
            ] as const).map(([label, n, tone]) => (
              <div key={label} className="flex flex-col justify-between gap-2 px-3 py-5 sm:px-6">
                <dt className="text-[length:calc(16px*var(--fs))] leading-snug font-medium text-ink-nav">{label}</dt>
                <dd className={`font-display text-[length:calc(34px*var(--fs))] leading-none font-extrabold tabular-nums ${tone}`}>{n ?? '–'}</dd>
              </div>
            ))}
          </dl>
          {!myQueue ? (
            <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <div key={i} className="h-9 animate-pulse rounded bg-surface-muted" />)}</div>
          ) : myQueue.length === 0 ? (
            <EmptyNote>Nothing is waiting on you.</EmptyNote>
          ) : (
            <ul className="divide-y divide-line-soft">
              {myQueue.slice(0, 10).map((d) => (
                <li key={d.id}>
                  <Link to={`/documents/${d.id}`} className="flex min-h-[60px] items-center gap-3 px-5 py-3 transition-colors hover:bg-sky-50 active:bg-sky-100">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[length:calc(16px*var(--fs))] font-semibold text-navy-900">{getDocumentType(d.typeId).name}</span>
                      <span className="block truncate text-[length:calc(15px*var(--fs))] text-ink-nav">{d.requesterName}</span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-ink-subtle" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>
      <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ListPanel
            title="Upcoming hearings"
            items={hearings}
            to="/hearings"
            empty="No hearings scheduled."
            render={({ c, h }) => (
              <Row to={`/cases/${c.id}`} title={`${c.caseNo} · ${c.title}`} meta={formatDateTime(h.scheduledAt)} right={<CalendarClock className="size-4 text-ink-subtle" />} />
            )}
          />
          <ListPanel
            title="Case records to update"
            items={caseUpdates}
            to="/cases"
            empty="All case records are up to date."
            render={(c) => <Row to={`/cases/${c.id}`} title={`${c.caseNo} · ${c.title}`} meta={c.nature} right={<Badge tone={STAGE_TONE[c.stage]}>{STAGE_LABEL[c.stage]}</Badge>} />}
          />
      </section>

      <Panel className="mt-4" title="Reports to prepare">
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {RECURRING_REPORTS.map((r) => (
            <li key={r.id}>
              <Link to="/reports" className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-line-soft bg-surface px-3.5 py-3 hover:border-line hover:bg-surface-muted">
                <span className="min-w-0">
                  <span className="block text-[length:calc(15px*var(--fs))] font-semibold text-navy-900">{r.name}</span>
                  <span className="block text-[length:calc(14px*var(--fs))] text-ink-muted">{r.schedule.replace(/\s*\(format pending\)/i, '')}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-ink-subtle" />
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  )
}
