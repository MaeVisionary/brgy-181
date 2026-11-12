import { BarChart3, CalendarClock, FileText, Gavel, ShieldCheck, UserRoundPen } from '@/icons'
import { StatusBadge } from '@/components/documents/DocParts'
import { Badge } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { Panel } from '@/components/ui/Panel'
import { TaskTile } from '@/components/ui/StatCard'
import { RECURRING_REPORTS } from '@/config/barangay'
import { getDocumentType } from '@/documents/catalog'
import { useAsync } from '@/hooks/useAsync'
import { useDocActor } from '@/hooks/useDocActor'
import { formatDateTime, formatShortDate } from '@/lib/format'
import { STAGE_LABEL, STAGE_TONE, listCases, upcomingHearings } from '@/services/caseService'
import { availableTransitions, listRequests } from '@/services/documentService'
import { getResidentQueueCounts } from '@/services/residentService'
import { Link } from 'react-router-dom'
import { DashHeader, EmptyNote, ListPanel, Row, Stat, ViewAll } from './shared'

/** Ana Manila Salvador: day-to-day administration of records, documents, complaints and reports. */
export function SecretaryDashboard() {
  const actor = useDocActor()!
  const docs = useAsync(() => listRequests(actor), [actor]).data
  const cases = useAsync(() => listCases(actor), [actor]).data
  const q = useAsync(getResidentQueueCounts).data

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

  return (
    <>
      <DashHeader
        overview="Secretary Overview"
        subtitle="Resident records, document requests, complaints and reports for Barangay 181."
        actions={<ButtonLink to="/reports" icon={<BarChart3 className="size-4" />}>Reports</ButtonLink>}
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Pending registrations" value={q?.registrationsForReview ?? null} attention={!!q?.registrationsForReview} to="/residents/registrations" />
        <Stat label="Pending document requests" value={newDocs} attention={!!newDocs} to="/documents" />
        <Stat label="Under verification" value={toPrepare} to="/documents" />
        <Stat label="Forwarded to Chairman" value={awaitingChairman} to="/documents" />
        <Stat label="Completed requests" value={completed} to="/documents" />
      </section>

      <section className="mt-3 grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TaskTile icon={<ShieldCheck className="size-4" />} label="Registrations to verify" count={q?.registrationsForReview ?? null} to="/residents/registrations" attention={!!q?.registrationsForReview} />
        <TaskTile icon={<UserRoundPen className="size-4" />} label="Resident update requests" count={q?.pendingChangeRequests ?? null} to="/residents/change-requests" />
        <TaskTile icon={<FileText className="size-4" />} label="Complaint, incident and blotter submissions" count={submissions} to="/documents" />
        <TaskTile icon={<Gavel className="size-4" />} label="Cases needing updates" count={caseUpdates?.length ?? null} to="/cases" />
      </section>

      {/* Work queue across the full width; hearings and case records side by side below it. */}
      <section className="mt-4">
        <Panel title="Your work queue" actions={<ViewAll to="/documents" />} bodyClassName="px-0 py-0">
          <dl className="grid grid-cols-3 divide-x divide-line-soft border-b border-line-soft text-center">
            {([
              ['Needs your action', myQueue?.length ?? null, 'text-navy-900'],
              ['Open requests', openCount, 'text-navy-900'],
              ['Completed this week', doneThisWeek, 'text-success'],
            ] as const).map(([label, n, tone]) => (
              <div key={label} className="px-2 py-2">
                <dt className="text-[13px] text-ink-muted">{label}</dt>
                <dd className={`font-display text-[18px] leading-tight font-extrabold tabular-nums ${tone}`}>{n ?? '–'}</dd>
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
                  <Link to={`/documents/${d.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2 transition-colors hover:bg-sky-50">
                    <span className="min-w-0 flex-1 basis-60">
                      <span className="block truncate text-[15px] font-semibold text-navy-900">{getDocumentType(d.typeId).name} · {d.requesterName}</span>
                      <span className="block text-[13.5px] text-ink-muted">{d.referenceNo} · {formatShortDate(d.submittedAt)}</span>
                    </span>
                    <StatusBadge status={d.status} typeId={d.typeId} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>
      <section className="mt-4 grid gap-4 lg:grid-cols-2">
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

      <Panel className="mt-4" title="Reports to prepare" subtitle="Recurring reports for DILG, OSCA, MADAO and Barangay Bureau">
        <ul className="grid gap-2 sm:grid-cols-2">
          {RECURRING_REPORTS.map((r) => (
            <li key={r.id} className={`flex items-center justify-between gap-3 rounded-[var(--radius-control)] border px-3 py-2.5 ${r.id === 'senior-masterlist' ? 'border-line' : 'border-warning/40 bg-warning-tint/40'}`}>
              <span>
                <span className="block text-[15px] font-semibold text-navy-900">{r.name}</span>
                <span className="block text-[13.5px] text-ink-muted">{r.schedule.replace(/\s*\(format pending\)/i, '')}</span>
              </span>
              <Badge tone={r.id === 'senior-masterlist' ? 'success' : 'warning'}>{r.id === 'senior-masterlist' ? 'Analytics ready' : 'Awaiting official file'}</Badge>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  )
}
