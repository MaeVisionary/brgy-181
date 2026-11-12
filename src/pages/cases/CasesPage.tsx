import { CalendarCheck2, CalendarClock, Gavel, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { HearingCalendar } from './HearingCalendar'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Select, TextInput } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, Panel } from '@/components/ui/Panel'
import { useAsync } from '@/hooks/useAsync'
import { useDocActor } from '@/hooks/useDocActor'
import { formatDate, formatDateTime } from '@/lib/format'
import { STAGE_LABEL, STAGE_TONE, listCases, mediationDay, removeClosedCase, removedCaseIds, restoreCase, upcomingHearings } from '@/services/caseService'
import { ServiceError } from '@/services/mockApi'
import type { CaseStage } from '@/types/case'
import { SampleBadge } from '@/pages/dashboard/shared'
import { KP } from '@/config/barangay'

/** Katarungang Pambarangay case list. */
export function CasesPage() {
  const actor = useDocActor()!
  const navigate = useNavigate()
  const [showRemoved, setShowRemoved] = useState(false)
  const [version, setVersion] = useState(0)
  const cases = useAsync(() => listCases(actor, { includeRemoved: showRemoved }), [actor, showRemoved, version]).data
  const [stage, setStage] = useState('')
  const [q, setQ] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const canRemove = actor.permissions.has('cases.decide')
  const removed = removedCaseIds()
  const needle = q.trim().toLowerCase()
  const rows = (cases ?? []).filter((c) => (!stage || c.stage === stage) && (!needle || [c.caseNo, c.blotterNo, c.title, c.nature, ...c.complainants.map((p) => p.name), ...c.respondents.map((p) => p.name)].some((v) => v?.toLowerCase().includes(needle))))
  const act = async (fn: () => Promise<void>) => {
    setError(null)
    try {
      await fn()
      setConfirmId(null)
      setVersion((v) => v + 1)
    } catch (e) {
      setError(e instanceof ServiceError ? e.message : 'Something went wrong.')
    }
  }

  return (
    <>
      <PageHeader
        title="Katarungang Pambarangay"
        subtitle={`Complaints and disputes: mediation under the Barangay Chairman (up to ${KP.chairmanMediationDays} days), then the Lupon if not settled.`}
        actions={<>{actor.permissions.has('cases.manage') && <ButtonLink to="/cases/new" icon={<Plus className="size-4" />}>New blotter entry</ButtonLink>}<SampleBadge /></>}
      />
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-line-soft p-4">
          <TextInput className="w-full sm:w-72" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search case no., blotter no., name" aria-label="Search the blotter" />
          <Select className="w-56" value={stage} onChange={(e) => setStage(e.target.value)} aria-label="Filter by stage">
            <option value="">All stages</option>
            {(Object.keys(STAGE_LABEL) as CaseStage[]).map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
          </Select>
          <span className="text-[14.5px] text-ink-muted">{rows.length} cases</span>
          {canRemove && (
            <label className="ml-auto flex items-center gap-2 text-[14.5px] text-navy-900">
              <input type="checkbox" className="size-4 accent-[#002132]" checked={showRemoved} onChange={(e) => setShowRemoved(e.target.checked)} />
              Show removed cases ({removed.size})
            </label>
          )}
        </div>
        {error && <p className="border-b border-line-soft bg-danger-tint px-4 py-2 text-[14.5px] text-danger-ink">{error}</p>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-[15.5px]">
            <thead>
              <tr className="bg-surface-muted text-left">{['Case / blotter no.', 'Parties', 'Nature', 'Filed', 'Stage', 'Next hearing', ...(canRemove ? [''] : [])].map((h, i) => <th key={i} className="label-caps px-4 py-2.5">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const next = c.hearings.filter((h) => h.status === 'scheduled').sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0]
                const md = mediationDay(c)
                return (
                  <tr key={c.id} onClick={() => navigate(`/cases/${c.id}`)} className="cursor-pointer border-t border-line-soft hover:bg-sky-50">
                    <td className="px-4 py-3.5 whitespace-nowrap"><span className="block font-semibold text-navy-900">{c.caseNo}</span>{c.blotterNo && <span className="block text-[14px] text-ink-muted">{c.blotterNo}</span>}</td>
                    <td className="px-4 py-3 text-navy-900">{c.title}</td>
                    <td className="px-4 py-3">{c.nature}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-muted">{formatDate(c.filedAt)}</td>
                    <td className="px-4 py-3">
                      {md && <span className={`mb-1 block text-[14px] font-semibold ${md.overdue ? 'text-danger-ink' : 'text-navy-900'}`}>Day {md.day} of {md.total}</span>}
                      <Badge tone={STAGE_TONE[c.stage]}>{STAGE_LABEL[c.stage]}</Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{next ? formatDateTime(next.scheduledAt) : <span className="text-ink-subtle">–</span>}</td>
                    {canRemove && (
                      <td className="px-4 py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {removed.has(c.id) ? (
                          <Button size="sm" variant="secondary" icon={<RotateCcw className="size-3.5" />} onClick={() => act(() => restoreCase(c.id, actor))}>Restore</Button>
                        ) : c.stage === 'closed' ? (
                          confirmId === c.id ? (
                            <span className="inline-flex items-center gap-2">
                              <Button size="sm" variant="danger" onClick={() => act(() => removeClosedCase(c.id, actor))}>Remove</Button>
                              <button type="button" className="text-[14px] font-semibold text-ink-muted hover:text-navy-900" onClick={() => setConfirmId(null)}>Cancel</button>
                            </span>
                          ) : (
                            <Button size="sm" variant="secondary" icon={<Trash2 className="size-3.5" />} onClick={() => setConfirmId(c.id)} aria-label={`Remove ${c.caseNo} from the list`}>
                              Remove
                            </Button>
                          )
                        ) : null}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
      {canRemove && (
        <p className="mt-2 text-[14px] text-ink-muted">
          Closed cases can be removed from this list to keep it short. The case record is kept, as Katarungang Pambarangay records must be preserved, and can be restored anytime.
        </p>
      )}
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
          <span className="text-[12px] font-semibold uppercase">{new Date(h.scheduledAt).toLocaleDateString('en-US', { month: 'short' })}</span>
          <span className="font-display text-[18px] font-extrabold">{new Date(h.scheduledAt).getDate()}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15.5px] font-semibold text-navy-900">{c.caseNo} · {c.title}</span>
          <span className="block text-[14px] text-ink-muted">{formatDateTime(h.scheduledAt)} · {h.kind === 'lupon_mediation' ? 'Lupon mediation' : 'Mediation under the Barangay Chairman'} · {h.place}</span>
        </span>
        {h.status === 'held' ? (
          <Badge dot={false} tone="neutral">{h.attendance.filter((a) => a.present).length}/{h.attendance.length} attended</Badge>
        ) : (
          <Badge tone={h.remindersSentAt.length ? 'success' : 'warning'}>{h.remindersSentAt.length ? 'Reminder sent' : 'No reminder yet'}</Badge>
        )}
      </button>
    </li>
  )
  return (
    <>
      <PageHeader title="Hearings and Mediation" subtitle="Schedules come from case records. Reminders go to the parties before each hearing." actions={<SampleBadge />} />
      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <Total icon={<CalendarClock className="size-5" />} label="Upcoming hearings" value={cases ? upcoming.length : null} hint={upcoming[0] ? `Next: ${formatDateTime(upcoming[0].h.scheduledAt)}` : 'Nothing scheduled'} tone="navy" />
        <Total icon={<CalendarCheck2 className="size-5" />} label="Hearings held" value={cases ? past.length : null} hint={past[0] ? `Last: ${formatDateTime(past[0].h.scheduledAt)}` : 'None yet'} tone="sky" />
      </div>
      {cases && <HearingCalendar cases={cases} />}
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Upcoming" bodyClassName="px-0 py-0" icon={<CalendarClock className="size-[18px]" />}>
          {upcoming.length === 0 ? <p className="px-5 py-6 text-[15px] text-ink-muted">No hearings scheduled.</p> : <ul>{upcoming.map((x) => <Item key={x.h.id} {...x} />)}</ul>}
        </Panel>
        <Panel title="Held" bodyClassName="px-0 py-0" icon={<Gavel className="size-[18px]" />}>
          {past.length === 0 ? <p className="px-5 py-6 text-[15px] text-ink-muted">No hearings held yet.</p> : <ul>{past.map((x) => <Item key={x.h.id} {...x} />)}</ul>}
        </Panel>
      </div>
    </>
  )
}

/** Total card: plain white, dark blue text (both cards look the same). */
function Total({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: number | null; hint: string; tone?: 'navy' | 'sky' }) {
  return (
    <Card className="px-6 py-5">
      <div className="flex items-center gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-sky-100 text-navy-900">{icon}</span>
        <div>
          <p className="text-[14px] font-semibold tracking-[0.06em] text-navy-600 uppercase">{label}</p>
          <p className="font-display text-[34px] leading-none font-extrabold text-navy-900">{value ?? '–'}</p>
          <p className="mt-1 text-[14.5px] text-navy-600">{hint}</p>
        </div>
      </div>
    </Card>
  )
}
