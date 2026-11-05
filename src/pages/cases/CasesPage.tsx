import { CalendarClock, Gavel } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, Panel } from '@/components/ui/Panel'
import { useAsync } from '@/hooks/useAsync'
import { useDocActor } from '@/hooks/useDocActor'
import { formatDate, formatDateTime } from '@/lib/format'
import { STAGE_LABEL, STAGE_TONE, listCases, mediationDay, upcomingHearings } from '@/services/caseService'
import type { CaseStage } from '@/types/case'
import { SampleBadge } from '@/pages/dashboard/shared'
import { KP } from '@/config/barangay'

/** Katarungang Pambarangay case list. */
export function CasesPage() {
  const actor = useDocActor()!
  const navigate = useNavigate()
  const cases = useAsync(() => listCases(actor), [actor]).data
  const [stage, setStage] = useState('')
  const rows = (cases ?? []).filter((c) => !stage || c.stage === stage)

  return (
    <>
      <PageHeader
        title="Katarungang Pambarangay"
        subtitle={`Complaints and disputes: mediation under the Barangay Chairman (up to ${KP.chairmanMediationDays} days), then the Lupon if not settled.`}
        actions={<SampleBadge />}
      />
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-line-soft p-4">
          <Select className="w-56" value={stage} onChange={(e) => setStage(e.target.value)} aria-label="Filter by stage">
            <option value="">All stages</option>
            {(Object.keys(STAGE_LABEL) as CaseStage[]).map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
          </Select>
          <span className="text-[12.5px] text-ink-muted">{rows.length} cases</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-[13px]">
            <thead>
              <tr className="bg-surface-muted text-left">{['Case no.', 'Parties', 'Nature', 'Filed', 'Stage', 'Next hearing'].map((h) => <th key={h} className="label-caps px-4 py-2.5">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const next = c.hearings.filter((h) => h.status === 'scheduled').sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0]
                const md = mediationDay(c)
                return (
                  <tr key={c.id} onClick={() => navigate(`/cases/${c.id}`)} className="cursor-pointer border-t border-line-soft hover:bg-sky-50">
                    <td className="px-4 py-3 font-semibold whitespace-nowrap text-navy-900">{c.caseNo}</td>
                    <td className="px-4 py-3 text-navy-900">{c.title}</td>
                    <td className="px-4 py-3">{c.nature}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-muted">{formatDate(c.filedAt)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={STAGE_TONE[c.stage]}>{STAGE_LABEL[c.stage]}</Badge>
                      {md && <span className={`mt-0.5 block text-[11px] ${md.overdue ? 'text-danger-ink' : 'text-ink-muted'}`}>Day {md.day} of {md.total}</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{next ? formatDateTime(next.scheduledAt) : <span className="text-ink-subtle">–</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

/** Hearing and mediation schedule across cases. */
export function HearingsPage() {
  const actor = useDocActor()!
  const navigate = useNavigate()
  const cases = useAsync(() => listCases(actor), [actor]).data
  const upcoming = cases ? upcomingHearings(cases) : []
  const past = (cases ?? []).flatMap((c) => c.hearings.filter((h) => h.status === 'held').map((h) => ({ c, h }))).sort((a, b) => b.h.scheduledAt.localeCompare(a.h.scheduledAt))
  const Item = ({ c, h }: { c: (typeof upcoming)[number]['c']; h: (typeof upcoming)[number]['h'] }) => (
    <li className="border-b border-line-soft last:border-0">
      <button type="button" onClick={() => navigate(`/cases/${c.id}`)} className="flex w-full items-center gap-4 px-5 py-3 text-left hover:bg-sky-50">
        <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-sky-100 text-center leading-tight text-navy-900">
          <span className="text-[10px] font-semibold uppercase">{new Date(h.scheduledAt).toLocaleDateString('en-US', { month: 'short' })}</span>
          <span className="font-display text-[16px] font-extrabold">{new Date(h.scheduledAt).getDate()}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-semibold text-navy-900">{c.caseNo} · {c.title}</span>
          <span className="block text-[12px] text-ink-muted">{formatDateTime(h.scheduledAt)} · {h.kind === 'lupon_mediation' ? 'Lupon mediation' : 'Mediation under the Barangay Chairman'} · {h.place}</span>
        </span>
        {h.status === 'held' ? (
          <Badge tone="neutral">{h.attendance.filter((a) => a.present).length}/{h.attendance.length} attended</Badge>
        ) : (
          <Badge tone={h.remindersSentAt.length ? 'success' : 'warning'}>{h.remindersSentAt.length ? 'Reminder sent' : 'No reminder yet'}</Badge>
        )}
      </button>
    </li>
  )
  return (
    <>
      <PageHeader title="Hearings and Mediation" subtitle="Schedules come from case records. Reminders go to the parties before each hearing (FR20)." actions={<SampleBadge />} />
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Upcoming" bodyClassName="px-0 py-0" icon={<CalendarClock className="size-[18px]" />}>
          {upcoming.length === 0 ? <p className="px-5 py-6 text-[13px] text-ink-muted">No hearings scheduled.</p> : <ul>{upcoming.map((x) => <Item key={x.h.id} {...x} />)}</ul>}
        </Panel>
        <Panel title="Held" bodyClassName="px-0 py-0" icon={<Gavel className="size-[18px]" />}>
          {past.length === 0 ? <p className="px-5 py-6 text-[13px] text-ink-muted">No hearings held yet.</p> : <ul>{past.map((x) => <Item key={x.h.id} {...x} />)}</ul>}
        </Panel>
      </div>
    </>
  )
}
