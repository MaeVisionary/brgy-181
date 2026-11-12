import { CalendarCheck2, CalendarClock, ChevronRight, Gavel, Plus } from '@/icons'
import { HearingCalendar } from './HearingCalendar'
import { Link, useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { Select, TextInput } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, Panel } from '@/components/ui/Panel'
import { useAsync } from '@/hooks/useAsync'
import { useDocActor } from '@/hooks/useDocActor'
import { formatDateTime } from '@/lib/format'
import { STAGE_LABEL, STAGE_TONE, listCases, mediationDay, removedCaseIds, upcomingHearings } from '@/services/caseService'
import type { CaseStage } from '@/types/case'
import { SampleBadge } from '@/pages/dashboard/shared'
import { useStickyState } from '@/hooks/useStickyState'

/** Katarungang Pambarangay case list: case number, parties, one status, next hearing. Everything else is on the case page. */
export function CasesPage() {
  const actor = useDocActor()!
  const [showRemoved, setShowRemoved] = useStickyState('removed', false)
  const cases = useAsync(() => listCases(actor, { includeRemoved: showRemoved }), [actor, showRemoved]).data
  const [stage, setStage] = useStickyState('stage', '')
  const [q, setQ] = useStickyState('q', '')
  const canRemove = actor.permissions.has('cases.decide')
  const removed = removedCaseIds()
  const needle = q.trim().toLowerCase()
  const rows = (cases ?? []).filter((c) => (!stage || c.stage === stage) && (!needle || [c.caseNo, c.blotterNo, c.title, c.nature, ...c.complainants.map((p) => p.name), ...c.respondents.map((p) => p.name)].some((v) => v?.toLowerCase().includes(needle))))
  const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'Asia/Manila' })

  return (
    <>
      <PageHeader title="Cases" actions={actor.permissions.has('cases.manage') && <ButtonLink to="/cases/new" icon={<Plus className="size-4" />}>New blotter entry</ButtonLink>} />
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-line-soft p-4">
          <TextInput className="w-full sm:w-72" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search cases" aria-label="Search cases" />
          <Select className="w-full sm:w-56" value={stage} onChange={(e) => setStage(e.target.value)} aria-label="Filter by stage">
            <option value="">All stages</option>
            {(Object.keys(STAGE_LABEL) as CaseStage[]).map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
          </Select>
          {canRemove && (
            <label className="flex min-h-11 items-center gap-2 text-[length:calc(15.5px*var(--fs))] text-navy-900 sm:ml-auto">
              <input type="checkbox" className="size-5 accent-[#002132]" checked={showRemoved} onChange={(e) => setShowRemoved(e.target.checked)} />
              Show removed cases ({removed.size})
            </label>
          )}
        </div>
        {cases === undefined || cases === null ? <div className="h-32 animate-pulse" /> : rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-[length:calc(16px*var(--fs))] text-ink-muted">No cases found.</p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {rows.map((c) => {
              const next = c.hearings.filter((h) => h.status === 'scheduled').sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0]
              const late = mediationDay(c)?.overdue
              return (
                <li key={c.id}>
                  <Link to={`/cases/${c.id}`} aria-label={`View case ${c.caseNo}`} className="flex min-h-[76px] items-center gap-4 px-5 py-3.5 transition-colors hover:bg-sky-50 active:bg-sky-100">
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-[length:calc(15px*var(--fs))] font-semibold text-ink-nav">
                        {c.caseNo}
                        {late && <span className="inline-flex items-center gap-1 text-danger-ink"><span aria-hidden className="size-2 rounded-full bg-danger" />Past the mediation period</span>}
                        {removed.has(c.id) && <span className="text-ink-muted">· Removed</span>}
                      </span>
                      <span className="block text-[length:calc(17px*var(--fs))] font-semibold break-words text-navy-900">{c.title}</span>
                      {next && <span className="block text-[length:calc(15px*var(--fs))] text-ink-nav">Next hearing: {shortDate(next.scheduledAt)}</span>}
                    </span>
                    <Badge tone={STAGE_TONE[c.stage]}>{STAGE_LABEL[c.stage]}</Badge>
                    <ChevronRight className="size-5 shrink-0 text-ink-subtle" />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
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
          <span className="text-[length:calc(12px*var(--fs))] font-semibold uppercase">{new Date(h.scheduledAt).toLocaleDateString('en-US', { month: 'short' })}</span>
          <span className="font-display text-[length:calc(18px*var(--fs))] font-extrabold">{new Date(h.scheduledAt).getDate()}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[length:calc(15.5px*var(--fs))] font-semibold text-navy-900">{c.caseNo} · {c.title}</span>
          <span className="block text-[length:calc(14px*var(--fs))] text-ink-muted">{formatDateTime(h.scheduledAt)} · {h.kind === 'lupon_mediation' ? 'Lupon mediation' : 'Mediation under the Barangay Chairman'} · {h.place}</span>
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
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Total icon={<CalendarClock className="size-5" />} label="Upcoming hearings" value={cases ? upcoming.length : null} hint={upcoming[0] ? `Next: ${formatDateTime(upcoming[0].h.scheduledAt)}` : 'Nothing scheduled'} tone="navy" />
        <Total icon={<CalendarCheck2 className="size-5" />} label="Hearings held" value={cases ? past.length : null} hint={past[0] ? `Last: ${formatDateTime(past[0].h.scheduledAt)}` : 'None yet'} tone="sky" />
      </div>
      {cases && <HearingCalendar cases={cases} />}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Upcoming" bodyClassName="px-0 py-0" icon={<CalendarClock className="size-[18px]" />}>
          {upcoming.length === 0 ? <p className="px-5 py-6 text-[length:calc(15px*var(--fs))] text-ink-muted">No hearings scheduled.</p> : <ul>{upcoming.map((x) => <Item key={x.h.id} {...x} />)}</ul>}
        </Panel>
        <Panel title="Held" bodyClassName="px-0 py-0" icon={<Gavel className="size-[18px]" />}>
          {past.length === 0 ? <p className="px-5 py-6 text-[length:calc(15px*var(--fs))] text-ink-muted">No hearings held yet.</p> : <ul>{past.map((x) => <Item key={x.h.id} {...x} />)}</ul>}
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
        <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-sky-100 text-navy-900">{icon}</span>
        <div>
          <p className="text-[length:calc(14px*var(--fs))] font-semibold tracking-[0.06em] text-navy-600 uppercase">{label}</p>
          <p className="font-display text-[length:calc(34px*var(--fs))] leading-none font-extrabold text-navy-900">{value ?? '–'}</p>
          <p className="mt-1 text-[length:calc(14.5px*var(--fs))] text-navy-600">{hint}</p>
        </div>
      </div>
    </Card>
  )
}
