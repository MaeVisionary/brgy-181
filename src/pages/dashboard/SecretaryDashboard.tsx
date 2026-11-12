import { BarChart3, CalendarClock, FileText, Gavel, ShieldCheck, UserRoundPen } from 'lucide-react'
import { StatusBadge } from '@/components/documents/DocParts'
import { Badge } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { Panel } from '@/components/ui/Panel'
import { TaskTile } from '@/components/ui/StatCard'
import { RECURRING_REPORTS } from '@/config/barangay'
import { getDocumentType } from '@/documents/catalog'
import { useAsync } from '@/hooks/useAsync'
import { useDocActor } from '@/hooks/useDocActor'
import { formatDateTime } from '@/lib/format'
import { STAGE_LABEL, STAGE_TONE, listCases, upcomingHearings } from '@/services/caseService'
import { availableTransitions, listRequests } from '@/services/documentService'
import { getResidentQueueCounts } from '@/services/residentService'
import { DashHeader, ListPanel, Row, Stat } from './shared'

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
        <ListPanel
          dark
          title="Your work queue"
          subtitle="Requests waiting for your next step"
          items={myQueue?.slice(0, 8) ?? null}
          to="/documents"
          empty="Nothing is waiting on you."
          render={(d) => (
            <Row to={`/documents/${d.id}`} title={`${getDocumentType(d.typeId).name} · ${d.requesterName}`} meta={`${d.referenceNo} · ${formatDateTime(d.updatedAt)}`} right={<StatusBadge status={d.status} typeId={d.typeId} />} />
          )}
        />
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
