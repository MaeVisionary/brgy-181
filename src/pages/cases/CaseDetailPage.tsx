import { BellRing, Check, Lock } from '@/icons'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BackLink } from '@/components/ui/BackLink'
import { useAuth } from '@/auth/useAuth'
import { ConsultationPanel } from '@/pages/appointments/AppointmentPages'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { TextArea, TextInput } from '@/components/ui/Field'
import { Card, Panel } from '@/components/ui/Panel'
import { useDocActor } from '@/hooks/useDocActor'
import { cn } from '@/lib/cn'
import { formatDate, formatDateTime } from '@/lib/format'
import { mockDocumentRequests } from '@/mocks/documentRequests'
import { userById } from '@/mocks/users'
import { ROLES } from '@/config/permissions'
import { ServiceError } from '@/services/mockApi'
import { STAGE_LABEL, STAGE_TONE, addInternalNote, removeClosedCase, removedCaseIds, restoreCase, assignCase, assignableKagawads, applyStep, getCase, mediationDay, recordHearing, reschedule, sendReminder, stepsFor, type CaseStep } from '@/services/caseService'
import type { CaseStage, KPCase } from '@/types/case'
import { NotFound } from '@/pages/system/NotFound'
import { AvailabilityRow, CaseDocuments } from './CaseParts'
import { Timeline } from '@/components/ui/Timeline'
import { ActionStack } from '@/components/ui/ActionStack'

const PATH: CaseStage[] = ['filed', 'under_review', 'for_assessment', 'mediation_scheduled', 'ongoing_mediation', 'referred_to_lupon', 'lupon_mediation', 'settled', 'closed']

export function CaseDetailPage() {
  const { id = '' } = useParams()
  const actor = useDocActor()!
  const { can } = useAuth()
  const [c, setC] = useState<KPCase | null>(null)
  const [missing, setMissing] = useState(false)
  const [step, setStep] = useState<CaseStep | null>(null)
  const [remarks, setRemarks] = useState('')
  const [when, setWhen] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [note, setNote] = useState('')

  useEffect(() => {
    getCase(id, actor).then(setC).catch(() => setMissing(true))
  }, [id, actor])

  if (missing) return <NotFound />
  if (!c) return <div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />

  const refresh = (x: KPCase) => setC({ ...x, hearings: [...x.hearings], history: [...x.history] })
  const steps = stepsFor(c, actor)
  const md = mediationDay(c)
  const docs = mockDocumentRequests.filter((d) => d.caseId === c.id)
  const manage = can('hearings.manage')
  const reached = new Set(c.history.map((h) => h.stage))

  const run = async () => {
    if (!step) return
    setErr(null)
    try {
      refresh(await applyStep(c.id, step, remarks, when || null, actor))
      setStep(null)
      setRemarks('')
      setWhen('')
    } catch (e) {
      setErr(e instanceof ServiceError ? e.message : 'Failed.')
    }
  }

  return (
    <>
      <BackLink fallbackTo="/cases" fallbackLabel="Cases" />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 text-[length:calc(14.5px*var(--fs))] text-ink-muted">
            <span className="font-semibold text-navy-900">{c.caseNo}</span>
            {c.blotterNo && <><span aria-hidden>·</span><span>Blotter {c.blotterNo}</span></>}
            <span aria-hidden>·</span>
            <span>Filed {formatDate(c.filedAt)}</span>
            <span aria-hidden>·</span>
            <span>{c.filedVia === 'online' ? 'Online' : 'Walk-in'}</span>
          </p>
          <h1 className="mt-1 font-display text-[length:calc(26px*var(--fs))] leading-tight font-extrabold text-navy-900 sm:text-[length:calc(30px*var(--fs))]">{c.title}</h1>
          <p className="mt-0.5 text-[length:calc(16px*var(--fs))] text-ink-nav">{c.nature}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[length:calc(14px*var(--fs))] text-ink-muted">Current stage</span>
          <Badge tone={STAGE_TONE[c.stage]}>{STAGE_LABEL[c.stage]}</Badge>
        </div>
      </div>

      <Card className="mb-4 overflow-x-auto px-5 py-4">
        <ol className="relative flex min-w-[760px] justify-between">
          {/* Connecting line behind the steps */}
          <span aria-hidden className="absolute top-3 right-[5.5%] left-[5.5%] h-0.5 bg-line" />
          {PATH.map((s, i) => {
            const current = c.stage === s
            const done = reached.has(s) && !current
            return (
              <li key={s} className="relative z-10 flex w-[11%] flex-col items-center text-center">
                <span
                  className={cn(
                    'grid size-6 place-items-center rounded-full border-2 text-[length:calc(13px*var(--fs))] font-bold',
                    current ? 'border-navy-900 bg-navy-900 text-white' : done ? 'border-navy-900 bg-sky-100 text-navy-900' : 'border-line bg-surface text-ink-subtle',
                  )}
                >
                  {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                </span>
                <span className={cn('mt-1.5 text-[length:calc(13.5px*var(--fs))] leading-tight font-semibold', current ? 'text-navy-900' : done ? 'text-navy-900' : 'text-ink-subtle')}>{STAGE_LABEL[s]}</span>
              </li>
            )
          })}
        </ol>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          {md && (
            <Card className={cn('px-5 py-4', md.overdue ? 'border-danger' : '')}>
              <p className="label-caps">Mediation under the Barangay Chairman</p>
              <p className="mt-1 font-display text-[length:calc(22px*var(--fs))] font-extrabold text-navy-900">Day {md.day} of {md.total}</p>
              <div className="mt-2 h-2 rounded-full bg-surface-muted"><div className={cn('h-2 rounded-full', md.overdue ? 'bg-danger' : 'bg-navy-900')} style={{ width: `${Math.min(100, (md.day / md.total) * 100)}%` }} /></div>
              {md.overdue && <p className="mt-2 text-[length:calc(14.5px*var(--fs))] text-danger-ink">The 15-day period has ended. Record a settlement or refer the case to the Lupon.</p>}
            </Card>
          )}
          <Panel title="Parties">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(['complainants', 'respondents'] as const).map((side) => (
                <div key={side} className="rounded-md border border-line bg-surface px-4 py-3">
                  <p className="label-caps mb-1.5">{side === 'complainants' ? 'Complainant' : 'Respondent'}</p>
                  {c[side].map((p) => (
                    <div key={p.name} className="text-[length:calc(15px*var(--fs))]">
                      {p.residentId && can('residents.view') ? <Link to={`/residents/${p.residentId}`} className="font-semibold text-navy-900 hover:underline">{p.name}</Link> : <span className="font-semibold text-navy-900">{p.name}</span>}
                      <span className="block text-ink-muted">{p.address}</span>
                      {p.contactNo && <span className="block text-ink-muted">{p.contactNo}</span>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-md border border-line border-l-4 border-l-navy-600 bg-sky-50 px-4 py-3">
              <p className="label-caps mb-1 flex items-center gap-1.5"><Lock className="size-3.5" /> Complaint details (confidential)</p>
              <p className="text-[length:calc(15.5px*var(--fs))] text-navy-900">{c.details}</p>
            </div>
            {c.outcome && (
              <div className="mt-4 rounded-md bg-success-tint px-3 py-2 text-[length:calc(15px*var(--fs))] text-navy-900"><strong className="capitalize">{c.outcome.type.replace('_', ' ')}:</strong> {c.outcome.summary}</div>
            )}
          </Panel>

          <Panel title="Hearings and mediation sessions" bodyClassName="px-0 py-0">
            {c.hearings.length === 0 ? <p className="px-5 py-5 text-[length:calc(15px*var(--fs))] text-ink-muted">No hearing scheduled yet.</p> : (
              <ul>{[...c.hearings].sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt)).map((h) => <HearingRow key={h.id} caseId={c.id} h={h} manage={manage} onChange={refresh} />)}</ul>
            )}
          </Panel>

          <CaseDocuments c={c} docs={docs} onPrepared={() => refresh(c)} />
        </div>

        <div className="space-y-4">
          <Panel title="Next step" subtitle={`Stage: ${STAGE_LABEL[c.stage]}`}>
            {steps.length === 0 ? <p className="text-[length:calc(14.5px*var(--fs))] text-ink-muted">No actions available.</p> : step ? (
              <div className="space-y-3">
                <p className="text-[length:calc(15px*var(--fs))] font-semibold text-navy-900">{step.label}</p>
                {step.schedule && (
                  <label className="block"><span className="mb-1 block text-[length:calc(14px*var(--fs))] font-semibold text-navy-900">Hearing date and time *</span><TextInput type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></label>
                )}
                {step.remarks && <label className="block"><span className="mb-1 block text-[length:calc(14px*var(--fs))] font-semibold text-navy-900">{step.outcome === 'settled' ? 'Settlement terms' : 'Note'} {step.remarks === 'required' && '*'}</span><TextArea value={remarks} onChange={(e) => setRemarks(e.target.value)} /></label>}
                {err && <p className="text-[length:calc(14px*var(--fs))] text-danger-ink">{err}</p>}
                <ActionStack><Button onClick={run}>Confirm</Button><Button variant="ghost" onClick={() => { setStep(null); setErr(null) }}>Back</Button></ActionStack>
              </div>
            ) : (
              <div className="space-y-2">{steps.map((s, i) => <Button key={s.label} className="w-full" variant={s.outcome === 'dismissed' || s.outcome === 'withdrawn' || s.outcome === 'not_settled' ? 'danger' : i === 0 ? 'primary' : 'secondary'} onClick={() => setStep(s)}>{s.label}</Button>)}</div>
            )}
          </Panel>

          {can('cases.manage') && <AssignPanel c={c} actor={actor} onChange={refresh} />}
          {(can('cases.manage') || can('cases.decide')) && !['filed', 'under_review', 'closed'].includes(c.stage) && <ConsultationPanel caseId={c.id} />}
          {(can('cases.manage') || c.assignedTo?.includes(actor.user.id)) && (
            <Panel title="Internal notes">
              {c.internalNotes.length === 0 && <p className="text-[length:calc(14.5px*var(--fs))] text-ink-muted">No notes.</p>}
              <ul className="space-y-1.5">{c.internalNotes.map((n, i) => <li key={i} className="rounded-md bg-surface-muted px-3 py-2 text-[length:calc(14.5px*var(--fs))] text-navy-900">{n}</li>)}</ul>
              <div className="mt-3 flex gap-2"><TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note" /><Button size="md" variant="secondary" disabled={!note.trim()} onClick={async () => { refresh(await addInternalNote(c.id, note, actor)); setNote('') }}>Add</Button></div>
            </Panel>
          )}

          <Panel title="Case history">
            <Timeline items={c.history.map((h) => ({
              at: h.at, title: h.action, by: userById(h.byUserId)?.fullName ?? 'Resident',
              tone: /(reject|not approved|overdue|cancel|no-show|not verified|damage|referred|settled|closed|approved|decided)/i.test(h.action) ? 'important' as const : undefined,
              details: <><p>{userById(h.byUserId)?.fullName ?? 'Resident'} · {ROLES[h.byRole].name}</p>{h.stage && <p>Stage: {STAGE_LABEL[h.stage]}</p>}{h.remarks && <p className="mt-1">{h.remarks}</p>}</>,
            }))} />
          </Panel>
          {can('cases.decide') && (c.stage === 'closed' || removedCaseIds().has(c.id)) && <RemovePanel caseId={c.id} />}
        </div>
      </div>
    </>
  )
}

/** Closed cases can be taken off the list (kept in records) or put back. */
function RemovePanel({ caseId }: { caseId: string }) {
  const actor = useDocActor()!
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const isRemoved = removedCaseIds().has(caseId)
  const run = async (fn: () => Promise<void>) => { setErr(null); try { await fn(); navigate('/cases') } catch (e) { setErr(e instanceof Error ? e.message : 'Not saved.') } }
  return (
    <Panel title="Case list">
      {isRemoved ? <Button variant="secondary" onClick={() => run(() => restoreCase(caseId, actor))}>Put back on the list</Button>
        : confirm ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[length:calc(16px*var(--fs))] text-navy-900">Remove this closed case from the list? The record is kept.</span>
            <Button variant="danger" onClick={() => run(() => removeClosedCase(caseId, actor))}>Remove</Button>
            <Button variant="ghost" onClick={() => setConfirm(false)}>Keep</Button>
          </div>
        ) : <Button variant="secondary" onClick={() => setConfirm(true)}>Remove from the list</Button>}
      {err && <p role="alert" className="mt-2 text-[length:calc(15px*var(--fs))] text-danger-ink">{err}</p>}
    </Panel>
  )
}

function HearingRow({ caseId, h, manage, onChange }: { caseId: string; h: KPCase['hearings'][number]; manage: boolean; onChange: (c: KPCase) => void }) {
  const actor = useDocActor()!
  const [mode, setMode] = useState<'none' | 'attendance' | 'reschedule'>('none')
  const [open, setOpen] = useState(false)
  const [att, setAtt] = useState<(boolean | null | 'excused')[]>(h.attendance.map((a) => (a.excused ? 'excused' : a.present)))
  const [notes, setNotes] = useState('')
  const [when, setWhen] = useState('')
  const [confirm, setConfirm] = useState<null | 'attendance' | 'reschedule' | 'reminder'>(null)
  const [err, setErr] = useState<string | null>(null)
  const kind = h.kind === 'lupon_mediation' ? 'Conciliation (Lupon)' : 'Mediation'
  const status = h.status === 'held' ? 'Held' : h.status === 'scheduled' ? 'Scheduled' : h.status === 'rescheduled' ? 'Postponed' : 'Cancelled'
  const absent = h.attendance.filter((a) => a.present === false && !a.excused)
  // One short line: what happened, only when there is something to say.
  const outcome = h.status === 'held' ? (absent.length ? `${absent.map((a) => (a.side === 'complainant' ? 'Complainant' : 'Respondent')).join(' and ')} did not attend.` : h.notes?.split(/(?<=\.)\s/)[0]) : undefined
  const mark = (a: { present: boolean | null; excused?: boolean }) => (a.excused ? 'Excused' : a.present === true ? 'Present' : a.present === false ? 'Absent' : h.status === 'held' ? 'Not recorded' : 'Expected')
  const run = async (fn: () => Promise<KPCase>) => {
    setErr(null)
    try { onChange(await fn()); setMode('none'); setConfirm(null) } catch (e) { setErr(e instanceof ServiceError ? e.message : 'Not saved.'); setConfirm(null) }
  }
  const choice = (i: number, v: boolean | 'excused', label: string) => (
    <button type="button" onClick={() => setAtt((s) => s.map((x, j) => (j === i ? v : x)))} aria-pressed={att[i] === v}
      className={cn('min-h-11 rounded-[var(--radius-control)] border px-3 text-[length:calc(15px*var(--fs))] font-semibold', att[i] === v ? 'border-navy-900 bg-navy-900 text-white' : 'border-line text-navy-900')}>{label}</button>
  )

  return (
    <li className="border-b border-line-soft px-5 py-4 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-[length:calc(16.5px*var(--fs))] font-semibold text-navy-900">{formatDateTime(h.scheduledAt)}</span>
          <span className="block text-[length:calc(15px*var(--fs))] text-ink-nav">{kind} · {h.place}</span>
          {outcome && <span className="mt-1 block text-[length:calc(15.5px*var(--fs))] text-navy-900">{outcome}</span>}
        </span>
        <Badge tone={h.status === 'held' ? 'neutral' : h.status === 'scheduled' ? 'info' : 'warning'}>{status}</Badge>
      </div>

      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="mt-2 inline-flex min-h-11 items-center gap-1 text-[length:calc(15.5px*var(--fs))] font-semibold text-info hover:underline">
        {open ? 'Hide details' : h.status === 'cancelled' ? 'View cancellation details' : 'View details'}
      </button>

      {open && (
        <div className="mt-2 space-y-3 rounded-[var(--radius-control)] bg-surface-muted px-4 py-3">
          <ul className="space-y-1.5">
            {h.attendance.map((a) => (
              <li key={a.name} className="flex flex-wrap items-baseline justify-between gap-2 text-[length:calc(15.5px*var(--fs))] text-navy-900">
                <span><span className="font-semibold">{a.name}</span> · <span className="capitalize">{a.side}</span></span>
                <span className={cn('font-semibold', a.present === false && !a.excused ? 'text-danger-ink' : a.present ? 'text-success' : 'text-ink-nav')}>{mark(a)}</span>
              </li>
            ))}
          </ul>
          {h.status === 'scheduled' && <AvailabilityRow caseId={caseId} h={h} manage={manage} onChange={onChange} />}
          {h.notes && <p className="text-[length:calc(15.5px*var(--fs))] text-navy-900">{h.notes}</p>}
          <p className="text-[length:calc(14.5px*var(--fs))] text-ink-nav">{h.remindersSentAt.length ? `Reminders sent: ${h.remindersSentAt.map((x) => formatDate(x)).join(', ')}` : 'No reminder sent yet.'}</p>
        </div>
      )}

      {err && <p role="alert" className="mt-2 text-[length:calc(15px*var(--fs))] text-danger-ink">{err}</p>}
      {manage && h.status === 'scheduled' && mode === 'none' && (
        <ActionStack className="mt-3">
          {new Date(h.scheduledAt).getTime() <= Date.now() + 3600_000 && <Button size="sm" onClick={() => setMode('attendance')}>Record attendance</Button>}
          <Button size="sm" variant="secondary" onClick={() => setMode('reschedule')}>Reschedule</Button>
          <Button size="sm" variant="ghost" icon={<BellRing className="size-4" />} onClick={() => setConfirm('reminder')}>Send reminder</Button>
        </ActionStack>
      )}
      {mode === 'attendance' && (
        <div className="mt-3 space-y-3 rounded-[var(--radius-control)] border border-line p-3">
          {h.attendance.map((a, i) => (
            <div key={a.name} className="space-y-1.5">
              <p className="text-[length:calc(15.5px*var(--fs))] text-navy-900"><span className="font-semibold">{a.name}</span> · <span className="capitalize">{a.side}</span></p>
              <div className="flex flex-wrap gap-2">{choice(i, true, 'Present')}{choice(i, false, 'Absent')}{choice(i, 'excused', 'Excused')}</div>
            </div>
          ))}
          <TextArea className="min-h-[60px]" placeholder="What happened (outcome, agreement, next step)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <ActionStack><Button size="sm" disabled={att.some((x) => x === null)} onClick={() => setConfirm('attendance')}>Save</Button><Button size="sm" variant="ghost" onClick={() => setMode('none')}>Cancel</Button></ActionStack>
        </div>
      )}
      {mode === 'reschedule' && (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-[var(--radius-control)] border border-line p-3">
          <TextInput type="datetime-local" aria-label="New date and time" className="w-auto" value={when} onChange={(e) => setWhen(e.target.value)} />
          <Button size="sm" disabled={!when} onClick={() => setConfirm('reschedule')}>Save new schedule</Button>
          <Button size="sm" variant="ghost" onClick={() => setMode('none')}>Cancel</Button>
        </div>
      )}
      {confirm && (
        <ConfirmDialog
          title={confirm === 'attendance' ? 'Save attendance?' : confirm === 'reschedule' ? 'Move this hearing?' : 'Send a reminder to the parties?'}
          confirmLabel={confirm === 'attendance' ? 'Save' : confirm === 'reschedule' ? 'Move hearing' : 'Send'}
          onCancel={() => setConfirm(null)}
          onConfirm={() => run(() => (confirm === 'attendance' ? recordHearing(caseId, h.id, att, notes, actor) : confirm === 'reschedule' ? reschedule(caseId, h.id, when, actor) : sendReminder(caseId, h.id, actor)))}
        >
          {confirm === 'attendance' ? 'The hearing will be marked as held. Attendance cannot be changed afterwards.' : confirm === 'reschedule' ? 'The parties and assigned personnel will be told the new schedule.' : undefined}
        </ConfirmDialog>
      )}
    </li>
  )
}

/** Assign Kagawads to help with a complaint (case personnel only). */
function AssignPanel({ c, actor, onChange }: { c: KPCase; actor: NonNullable<ReturnType<typeof useDocActor>>; onChange: (c: KPCase) => void }) {
  const people = assignableKagawads()
  const [err, setErr] = useState<string | null>(null)
  const toggle = async (id: string, on: boolean) => {
    setErr(null)
    try {
      const cur = c.assignedTo ?? []
      onChange(await assignCase(c.id, on ? [...cur, id] : cur.filter((x) => x !== id), actor))
    } catch (e) {
      setErr(e instanceof ServiceError ? e.message : 'Not saved.')
    }
  }
  if (!people.length) return null
  return (
    <Panel title="Assigned Kagawads">
      <ul className="space-y-1">
        {people.map((u) => (
          <li key={u.id}>
            <label className="flex min-h-10 items-center gap-2.5 text-[length:calc(15px*var(--fs))] text-navy-900">
              <input type="checkbox" className="size-4 accent-[#002132]" checked={!!c.assignedTo?.includes(u.id)} onChange={(e) => toggle(u.id, e.target.checked)} />
              {u.fullName}
            </label>
          </li>
        ))}
      </ul>
      {err && <p className="mt-2 text-[length:calc(14px*var(--fs))] text-danger-ink">{err}</p>}
    </Panel>
  )
}
