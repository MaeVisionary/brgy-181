import { CalendarClock, Gavel } from '@/icons'
import { StatusBadge } from '@/components/documents/DocParts'
import { Badge } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { Panel } from '@/components/ui/Panel'
import { getDocumentType } from '@/documents/catalog'
import { useAsync } from '@/hooks/useAsync'
import { useDocActor } from '@/hooks/useDocActor'
import { formatDateTime } from '@/lib/format'
import { STAGE_LABEL, STAGE_TONE, listCases, mediationDay, upcomingHearings } from '@/services/caseService'
import { listRequests } from '@/services/documentService'
import { DashHeader, EmptyNote, ListPanel, PopulationByStreet, Row, Stat } from './shared'

/** Robert Atad: executive oversight, approvals, assessment of complaints, KP mediation. */
export function ChairmanDashboard() {
  const actor = useDocActor()!
  const docs = useAsync(() => listRequests(actor), [actor]).data
  const cases = useAsync(() => listCases(actor), [actor]).data

  const forApproval = docs?.filter((d) => d.status === 'pending_approval' || d.status === 'for_assessment') ?? null
  const approvedDocs = docs?.filter((d) => !!d.approvedBy && !['released'].includes(d.status)) ?? null
  const forSignature = docs?.filter((d) => d.status === 'for_signature') ?? null
  const completed = docs?.filter((d) => d.status === 'released') ?? null
  const forAssessment = cases?.filter((c) => c.stage === 'for_assessment') ?? null
  const active = cases?.filter((c) => !['closed', 'settled'].includes(c.stage)) ?? null
  const hearings = cases ? upcomingHearings(cases) : null
  const resolved = cases?.filter((c) => c.outcome) ?? []

  return (
    <>
      <DashHeader
        overview="Barangay Overview"
        subtitle="Approvals, complaints for assessment and Katarungang Pambarangay mediation."
        actions={<ButtonLink to="/documents/approvals" icon={<Gavel className="size-4" />}>Review Approvals</ButtonLink>}
      />
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Pending approvals" value={forApproval?.length ?? null} attention={!!forApproval?.length} to="/documents/approvals" />
        <Stat label="Approved documents" value={approvedDocs?.length ?? null} to="/documents" />
        <Stat label="Documents for signature" value={forSignature?.length ?? null} attention={!!forSignature?.length} to="/documents" />
        <Stat label="Completed requests" value={completed?.length ?? null} to="/documents" />
      </section>
      <section className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Complaints for assessment" value={forAssessment?.length ?? null} attention={!!forAssessment?.length} to="/cases" />
        <Stat label="Active KP cases" value={active?.length ?? null} to="/cases" />
        <Stat label="Upcoming hearings" value={hearings?.length ?? null} to="/hearings" />
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-2">
        <ListPanel
          dark
          title="Routed to you for approval"
          subtitle="Verified and forwarded by the Barangay Secretary"
          items={forApproval}
          to="/documents/approvals"
          empty="Nothing is waiting for your approval."
          render={(d) => (
            <Row to={`/documents/${d.id}`} title={`${getDocumentType(d.typeId).name} · ${d.requesterName}`} meta={`${d.referenceNo} · updated ${formatDateTime(d.updatedAt)}`} right={<StatusBadge status={d.status} typeId={d.typeId} />} />
          )}
        />
        <ListPanel
          title="Hearing and mediation schedule"
          subtitle="Barangay 181 Hall"
          items={hearings}
          to="/hearings"
          empty="No upcoming hearings."
          render={({ c, h }) => (
            <Row
              to={`/cases/${c.id}`}
              title={`${c.caseNo} · ${c.title}`}
              meta={`${formatDateTime(h.scheduledAt)} · ${h.kind === 'lupon_mediation' ? 'Lupon mediation' : 'Mediation under the Barangay Chairman'}`}
              right={<CalendarClock className="size-4 text-ink-subtle" />}
            />
          )}
        />
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <ListPanel
          title="Katarungang Pambarangay cases"
          subtitle="Open cases and the 15-day mediation period"
          items={active}
          to="/cases"
          empty="No open cases."
          render={(c) => {
            const md = mediationDay(c)
            return (
              <Row
                to={`/cases/${c.id}`}
                title={`${c.caseNo} · ${c.title}`}
                meta={md ? `Mediation day ${md.day} of ${md.total}${md.overdue ? ' (period ended)' : ''}` : c.nature}
                right={<Badge tone={STAGE_TONE[c.stage]}>{STAGE_LABEL[c.stage]}</Badge>}
              />
            )
          }}
        />
        <Panel title="Case outcomes" subtitle="Settled and closed cases" bodyClassName={resolved.length === 0 ? "px-0 py-0" : undefined}>
          {resolved.length === 0 ? (
            <EmptyNote>No settled or closed cases yet.</EmptyNote>
          ) : (
            <ul className="space-y-2.5">
              {resolved.map((c) => (
                <li key={c.id} className="text-[15px]">
                  <span className="font-semibold text-navy-900">{c.caseNo} · {c.title}</span>
                  <span className="block text-ink-muted">{c.outcome!.summary}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>

      <section className="mt-4 space-y-4">
        <PopulationByStreet />
      </section>
    </>
  )
}
