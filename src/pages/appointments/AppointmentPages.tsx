import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronRight } from '@/icons'
import { useAuth } from '@/auth/useAuth'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { FieldLabel, Select, TextArea, TextInput } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, Panel } from '@/components/ui/Panel'
import { EmptyState } from '@/components/ui/EmptyState'
import { BARANGAY_CONTACT } from '@/config/barangay'
import { formatDateTime } from '@/lib/format'
import { mockUsers } from '@/mocks/users'
import {
  APPOINTMENT_STATUS_LABEL,
  APPOINTMENT_TYPES,
  DOCUMENT_OPTIONS,
  VISIT_REASONS,
  bookAppointment,
  bookableServices,
  cancelByResident,
  requestVisit,
  cancelAppointment,
  checkIn,
  completeAppointment,
  confirmAppointment,
  dateLong,
  dayOptions,
  endTime,
  formatTime,
  appointmentFor,
  getAppointment,
  isOpen,
  scheduleConsultation,
  hearingsFor,
  kindsFor,
  lengthOf,
  listAppointments,
  listMyAppointments,
  markNoShow,
  reassign,
  staffConfirm,
  overrideDuration,
  recordVerification,
  requestReschedule,
  rescheduleAppointment,
  runAppointmentJobs,
  scheduleForCorrection,
  staffFor,
  timeOptions,
  visitMessage,
  type Appointment,
  type AppointmentKind,
  type AppointmentStatus,
  type HearingEntry,
  type NamedAppointment,
} from '@/services/appointmentService'
import { EMAIL_STATUS_LABEL, emailsFor } from '@/services/emailService'
import { ServiceError } from '@/services/mockApi'
import { calendarEntries } from '@/services/calendarService'
import { bookingsOn, estimateDuration, freeSlots, manilaToday, nextAvailable, nextDate, unavailableReason, workload } from '@/services/schedulingService'
import { NotFound } from '@/pages/system/NotFound'
import { BackLink } from '@/pages/resident/parts'
import { useStickyState } from '@/hooks/useStickyState'
import { Timeline } from '@/components/ui/Timeline'
import { ActionStack } from '@/components/ui/ActionStack'

const shortDate = (d: string) => new Date(`${d}T12:00:00+08:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' })
const staffName = (id: string) => mockUsers.find((u) => u.id === id)?.fullName ?? ''
const errText = (e: unknown) => (e instanceof ServiceError ? e.message : 'Something went wrong. Please try again.')
const STATUS_TONE: Record<AppointmentStatus, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  awaiting_schedule: 'warning', pending_confirmation: 'warning', confirmed: 'success', reschedule_requested: 'info', rescheduled: 'warning', completed: 'neutral', cancelled: 'neutral', no_show: 'danger',
}
const needsResident = (a: Appointment) => ['awaiting_schedule', 'pending_confirmation', 'rescheduled', 'no_show'].includes(a.status)
/** Lists: the service, or the document name for claiming. Details show the full title. */
const listTitle = (a: Appointment) => (a.kind === 'document_claim' ? `Claim: ${a.title}` : APPOINTMENT_TYPES[a.kind].label)
const titleOf = (a: Appointment) => (a.title && a.title !== APPOINTMENT_TYPES[a.kind].label ? `${APPOINTMENT_TYPES[a.kind].label}: ${a.title}` : APPOINTMENT_TYPES[a.kind].label)

function Note({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return <p role={ok ? 'status' : 'alert'} className={`rounded-[var(--radius-control)] px-4 py-2.5 text-[length:calc(15.5px*var(--fs))] ${ok ? 'bg-success-tint text-navy-900' : 'bg-danger-tint text-danger-ink'}`}>{children}</p>
}

// ── Picking a time ───────────────────────────────────────────────────

/**
 * Simple two-step picker for residents (and staff helping them): a list of
 * days, then the free times on that day. No dense calendar grid.
 */
export function TimePicker({ a, onPicked, onBack }: { a: Appointment; onPicked: () => void; onBack?: () => void }) {
  const { user } = useAuth()
  const days = useMemo(() => dayOptions(a), [a])
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const times = date ? timeOptions(a, date) : []
  const book = async () => {
    setBusy(true); setErr(null)
    try { await bookAppointment(a.id, date, time, user!); onPicked() } catch (e) { setErr(errText(e)); setConfirming(false); setTime('') } finally { setBusy(false) }
  }
  if (confirming) return (
    <div className="space-y-4">
      <p className={`text-[length:calc(19px*var(--fs))] font-bold text-navy-900`}>Please check your appointment</p>
      <dl className={`grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 text-[length:calc(16.5px*var(--fs))]`}>
        <dt className="text-ink-muted">Service</dt><dd className="font-semibold text-navy-900">{titleOf(a)}</dd>
        <dt className="text-ink-muted">Date</dt><dd className="font-semibold text-navy-900">{dateLong(date)}</dd>
        <dt className="text-ink-muted">Time</dt><dd className="font-semibold text-navy-900">{formatTime(time)} (about {a.durationMin} minutes)</dd>
        <dt className="text-ink-muted">Place</dt><dd className="text-navy-900">{BARANGAY_CONTACT.hall}</dd>
        <dt className="text-ink-muted">Bring</dt><dd className="text-navy-900"><ul className="list-disc pl-5">{a.documents.map((d) => <li key={d}>{d}</li>)}</ul></dd>
      </dl>
      <ActionStack>
        <Button onClick={book} loading={busy}>Confirm Appointment</Button>
        <Button variant="secondary" onClick={() => setConfirming(false)}>Choose another time</Button>
      </ActionStack>
    </div>
  )
  return (
    <div className="space-y-4">
      {err && <Note ok={false}>{err}</Note>}
      <div>
        <p className={`mb-2 text-[length:calc(17px*var(--fs))] font-semibold text-navy-900`}>1. Choose a day</p>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {days.map((d) => (
            <li key={d.date}>
              <button
                type="button"
                disabled={d.state !== 'open'}
                aria-pressed={date === d.date}
                onClick={() => { setDate(d.date); setTime('') }}
                className={`flex min-h-[64px] w-full flex-col items-start justify-center rounded-[var(--radius-control)] border px-3 py-2 text-left transition-colors ${date === d.date ? 'border-navy-900 bg-navy-900 text-white' : d.state === 'open' ? 'border-line bg-surface text-navy-900 hover:border-navy-600' : 'border-line-soft bg-surface-muted text-ink-subtle'}`}
              >
                <span className={`text-[length:calc(16px*var(--fs))] font-semibold`}>{shortDate(d.date)}</span>
                <span className="text-[length:calc(13.5px*var(--fs))]">{d.state === 'open' ? `${d.free} ${d.free === 1 ? 'time' : 'times'} free` : d.state === 'full' ? 'No free times' : 'Closed'}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      {date && (
        <div>
          <p className={`mb-2 text-[length:calc(17px*var(--fs))] font-semibold text-navy-900`}>2. Choose a time on {shortDate(date)}</p>
          {times.length === 0 ? <p className={`text-[length:calc(15.5px*var(--fs))] text-ink-muted`}>No free times left on this day. Please choose another day.</p> : (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {times.map((t) => (
                <li key={t.time}>
                  <button type="button" aria-pressed={time === t.time} onClick={() => setTime(t.time)}
                    className={`h-12 w-full rounded-[var(--radius-control)] border text-[length:calc(16px*var(--fs))] font-semibold ${time === t.time ? 'border-navy-900 bg-navy-900 text-white' : 'border-line bg-surface text-navy-900 hover:border-navy-600'}`}>
                    {formatTime(t.time)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <ActionStack>
        <Button disabled={!time} onClick={() => setConfirming(true)}>Next</Button>
        {onBack && <Button variant="ghost" onClick={onBack}>Back</Button>}
      </ActionStack>
    </div>
  )
}

/** Staff choose date, staff member and a free time; the engine suggests alternatives when the person is unavailable. */
export function StaffSlotPicker({ kind, minutes, ignoreId, value, onChange }: { kind: AppointmentKind; minutes: number; ignoreId?: string; value: { date: string; staff: string; time: string }; onChange: (v: { date: string; staff: string; time: string }) => void }) {
  const staffIds = staffFor(kind)
  const { date, staff, time } = value
  const why = date && staff ? unavailableReason(staff, date) : null
  const slots = date && staff ? freeSlots(date, staff, minutes, ignoreId) : []
  const others = date && staff && !slots.length ? staffIds.filter((s) => s !== staff && freeSlots(date, s, minutes, ignoreId).length) : []
  const next = date && staff && !slots.length ? nextAvailable(nextDate(date), minutes, [staff], ignoreId) : null
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <FieldLabel label="Date"><TextInput type="date" min={manilaToday()} value={date} onChange={(e) => onChange({ ...value, date: e.target.value, time: '' })} /></FieldLabel>
        <FieldLabel label="Barangay Personnel">
          <Select value={staff} onChange={(e) => onChange({ ...value, staff: e.target.value, time: '' })}>
            {staffIds.map((id) => <option key={id} value={id}>{staffName(id)}{date && unavailableReason(id, date) ? ' (not available)' : ''}</option>)}
          </Select>
        </FieldLabel>
        <FieldLabel label="Time">
          <Select value={time} onChange={(e) => onChange({ ...value, time: e.target.value })} disabled={!slots.length}>
            <option value="">{!date ? 'Choose a date first' : slots.length ? 'Choose a time' : 'No free times'}</option>
            {slots.map((s) => <option key={s.time} value={s.time}>{formatTime(s.time)} – {formatTime(s.end)}</option>)}
          </Select>
        </FieldLabel>
      </div>
      {date && staff && !slots.length && (
        <div className={`rounded-[var(--radius-control)] bg-surface-muted px-3 py-2.5 text-[length:calc(15px*var(--fs))] text-navy-900`}>
          <p>{why ?? 'Fully booked on this day.'}</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {others.map((s) => <Button key={s} size="sm" variant="secondary" onClick={() => onChange({ ...value, staff: s, time: '' })}>Use {staffName(s)}</Button>)}
            {next && <Button size="sm" variant="secondary" onClick={() => onChange({ date: next.date, staff: next.staffId, time: next.time })}>Next free: {shortDate(next.date)}, {formatTime(next.time)}</Button>}
          </div>
        </div>
      )}
    </div>
  )
}

/** Correction review: require an in-person visit. Length is calculated, not chosen. */
export function ScheduleVisitForm({ changeRequestId, onDone, onCancel }: { changeRequestId: string; onDone: () => void; onCancel: () => void }) {
  const { user } = useAuth()
  const [reason, setReason] = useState<string>(VISIT_REASONS[0])
  const [docs, setDocs] = useState<string[]>([DOCUMENT_OPTIONS[0]])
  const [who, setWho] = useState<'resident' | 'staff'>('resident')
  const [slot, setSlot] = useState({ date: '', staff: user?.id ?? '', time: '' })
  const [override, setOverride] = useState<{ minutes: number; reason: string } | null>(null)
  const [instructions, setInstructions] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const est = estimateDuration(docs)
  const minutes = override?.minutes ?? est.minutes
  const save = async () => {
    setBusy(true); setErr(null)
    try {
      await scheduleForCorrection(changeRequestId, { reason, documents: docs, date: who === 'staff' ? slot.date : '', time: who === 'staff' ? slot.time : '', assignedTo: slot.staff, instructions, override: override ?? undefined }, user!)
      onDone()
    } catch (e) { setErr(errText(e)) } finally { setBusy(false) }
  }
  const preview: Appointment = { id: 'preview', ref: 'APT-…', kind: 'correction_verification', subjectId: changeRequestId, title: '', reason, documents: docs, date: who === 'staff' ? slot.date : '', time: slot.time, durationMin: minutes, assignedTo: slot.staff, status: 'pending_confirmation', remindersSent: [], history: [], createdAt: '', instructions: instructions || undefined }
  return (
    <div className="space-y-4 rounded-[var(--radius-control)] border border-line-soft p-4">
      <p className={`text-[length:calc(17px*var(--fs))] font-semibold text-navy-900`}>Require in-person verification</p>
      <FieldLabel label="Reason"><Select value={reason} onChange={(e) => setReason(e.target.value)}>{VISIT_REASONS.map((r) => <option key={r}>{r}</option>)}</Select></FieldLabel>
      <fieldset>
        <legend className={`mb-1 text-[length:calc(16px*var(--fs))] font-semibold text-navy-900`}>Originals to bring</legend>
        {DOCUMENT_OPTIONS.map((d) => (
          <label key={d} className={`flex min-h-11 items-center gap-2.5 text-[length:calc(15.5px*var(--fs))] text-navy-900`}>
            <input type="checkbox" className="size-5 accent-[#002132]" checked={docs.includes(d)} onChange={(e) => setDocs((x) => (e.target.checked ? [...x, d] : x.filter((y) => y !== d)))} /> {d}
          </label>
        ))}
      </fieldset>

      <div className={`rounded-[var(--radius-control)] bg-surface-muted px-3 py-2.5 text-[length:calc(15.5px*var(--fs))] text-navy-900`}>
        <p><span className="font-semibold">Estimated length: {minutes} minutes</span>{override ? ` (calculated ${est.minutes} min)` : ''}</p>
        <p className={`text-[length:calc(14px*var(--fs))] text-ink-muted`}>{est.note}</p>
        {override ? (
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[140px_1fr_auto]">
            <Select aria-label="Adjusted length" value={override.minutes} onChange={(e) => setOverride({ ...override, minutes: Number(e.target.value) })}>{[10, 15, 20, 25, 30, 40, 45, 60, 90].map((m) => <option key={m} value={m}>{m} minutes</option>)}</Select>
            <TextInput aria-label="Reason for the change" placeholder="Reason for the change (required)" value={override.reason} onChange={(e) => setOverride({ ...override, reason: e.target.value })} />
            <Button size="sm" variant="ghost" onClick={() => setOverride(null)}>Use calculated</Button>
          </div>
        ) : docs.length > 0 && <button type="button" className={`mt-1 text-[length:calc(14.5px*var(--fs))] font-semibold text-info hover:underline`} onClick={() => setOverride({ minutes: est.minutes, reason: '' })}>Change length (needs a reason)</button>}
      </div>

      <fieldset className="space-y-1">
        <legend className={`mb-1 text-[length:calc(16px*var(--fs))] font-semibold text-navy-900`}>Schedule</legend>
        <label className={`flex min-h-11 items-center gap-2.5 text-[length:calc(15.5px*var(--fs))] text-navy-900`}><input type="radio" className="size-5 accent-[#002132]" checked={who === 'resident'} onChange={() => setWho('resident')} /> Let the resident choose a free time (recommended)</label>
        <label className={`flex min-h-11 items-center gap-2.5 text-[length:calc(15.5px*var(--fs))] text-navy-900`}><input type="radio" className="size-5 accent-[#002132]" checked={who === 'staff'} onChange={() => setWho('staff')} /> Set the time now</label>
      </fieldset>
      {who === 'staff' && <StaffSlotPicker kind="correction_verification" minutes={minutes} value={slot} onChange={setSlot} />}
      {who === 'staff' && slot.time && <p className={`text-[length:calc(15.5px*var(--fs))] text-navy-900`}>{dateLong(slot.date)} · {formatTime(slot.time)} to about {formatTime(endTime({ time: slot.time, durationMin: minutes }))} with {staffName(slot.staff)}</p>}

      <FieldLabel label="Note to the resident (optional)"><TextArea className="min-h-[60px]" value={instructions} onChange={(e) => setInstructions(e.target.value)} /></FieldLabel>
      <details className={`text-[length:calc(15px*var(--fs))] text-navy-900`}>
        <summary className="cursor-pointer font-semibold text-info">Preview the message to the resident</summary>
        <pre className={`mt-2 whitespace-pre-wrap rounded-[var(--radius-control)] bg-surface-muted p-3 font-sans text-[length:calc(14.5px*var(--fs))]`}>{visitMessage(preview, who === 'staff' ? 'scheduled' : 'ready').body}</pre>
      </details>
      {err && <Note ok={false}>{err}</Note>}
      <ActionStack>
        <Button size="sm" onClick={save} loading={busy} disabled={!docs.length || (who === 'staff' && !slot.time) || (!!override && override.reason.trim().length < 5)}>{who === 'staff' ? 'Schedule and notify resident' : 'Ask the resident to choose a time'}</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </ActionStack>
    </div>
  )
}

function Details({ a, staff }: { a: Appointment; staff?: boolean }) {
  return (
    <dl className={`grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 text-[length:calc(16px*var(--fs))]`}>
      <dt className="text-ink-muted">When</dt>
      <dd className="font-semibold text-navy-900">{a.date ? `${dateLong(a.date)} · ${formatTime(a.time)} to about ${formatTime(endTime(a))}` : 'Not chosen yet'}</dd>
      <dt className="text-ink-muted">How long</dt><dd className="text-navy-900">About {a.durationMin} minutes{staff && a.durationOverride ? ` (changed from ${a.durationOverride.original}: ${a.durationOverride.reason})` : ''}</dd>
      <dt className="text-ink-muted">Where</dt><dd className="text-navy-900">{BARANGAY_CONTACT.hall}, {BARANGAY_CONTACT.address}</dd>
      <dt className="text-ink-muted">Why</dt><dd className="text-navy-900">{a.reason}</dd>
      <dt className="text-ink-muted">Bring</dt><dd className="text-navy-900"><ul className="list-disc pl-5">{a.documents.map((d) => <li key={d}>{d}</li>)}</ul></dd>
      {a.instructions && <><dt className="text-ink-muted">Note</dt><dd className="text-navy-900">{a.instructions}</dd></>}
      {staff && a.assignedTo && <><dt className="text-ink-muted">Barangay Personnel</dt><dd className="text-navy-900">{staffName(a.assignedTo)}</dd></>}
      <dt className="text-ink-muted">Reference</dt><dd className="text-navy-900">{a.ref}{a.subjectRef ? ` · ${a.subjectRef}` : ''}</dd>
    </dl>
  )
}

function EmailStatus({ a }: { a: Appointment }) {
  const last = emailsFor(a.ref).at(-1)
  if (!last) return null
  return <p className={`text-[length:calc(14px*var(--fs))] text-ink-muted`}>{EMAIL_STATUS_LABEL[last.status]} · {formatDateTime(last.at)}</p>
}

// ── Resident ─────────────────────────────────────────────────────────

function AppointmentRow({ to, title, when, status, tone }: { to: string; title: string; when: string; status: string; tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }) {
  return (
    <li>
      <Link to={to} className="flex min-h-[72px] items-center gap-3 px-5 py-3 hover:bg-sky-50 active:bg-sky-100">
        <span className="min-w-0 flex-1">
          <span className={`block text-[length:calc(17px*var(--fs))] font-semibold text-navy-900`}>{title}</span>
          <span className={`block text-[length:calc(15.5px*var(--fs))] text-ink-nav`}>{when}</span>
        </span>
        <Badge tone={tone}>{status}</Badge>
        <ChevronRight className="size-4 shrink-0 text-ink-subtle" />
      </Link>
    </li>
  )
}

export function MyAppointmentsPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<Appointment[] | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => { runAppointmentJobs(); if (user) listMyAppointments(user).then(setItems).catch(() => setFailed(true)) }, [user])
  const hearings = user ? hearingsFor(user) : []
  const todo = items?.filter(needsResident) ?? []
  const upcoming = items?.filter((a) => ['confirmed', 'reschedule_requested'].includes(a.status)) ?? []
  const past = items?.filter((a) => ['completed', 'cancelled'].includes(a.status)).reverse() ?? []
  const when = (a: Appointment) => (a.date ? `${dateLong(a.date)} · ${formatTime(a.time)}` : needsResident(a) ? 'Choose a date and time' : 'No time was set')
  const section = (title: string, list: Appointment[]) => list.length > 0 && (
    <Panel key={title} className="mb-4" title={title} bodyClassName="px-0 py-0">
      <ul className="divide-y divide-line-soft">{list.map((a) => <AppointmentRow key={a.id} to={`/my/appointments/${a.id}`} title={listTitle(a)} when={when(a)} status={APPOINTMENT_STATUS_LABEL[a.status]} tone={STATUS_TONE[a.status]} />)}</ul>
    </Panel>
  )
  return (
    <>
      <PageHeader title="My Appointments" actions={bookableServices().length > 0 && <ButtonLink to="/my/appointments/new">Book a visit</ButtonLink>} />
      {failed ? <Card><EmptyState title="Could not load your appointments" body="Please check your connection and try again." /></Card>
        : items === null ? <div className="h-24 animate-pulse rounded-[var(--radius-card)] bg-surface" />
        : items.length === 0 && hearings.length === 0 ? <Card><EmptyState title="No appointments" body="When you need to visit the Barangay Hall, it will appear here." /></Card>
        : (
          <>
            {section('Needs your action', todo)}
            {section('Upcoming', upcoming)}
            {hearings.length > 0 && (
              <Panel className="mb-4" title="Hearings" bodyClassName="px-0 py-0">
                <ul className="divide-y divide-line-soft">{hearings.map((h) => <AppointmentRow key={h.id} to={`/my/complaints/${h.caseId}`} title={h.label} when={`${dateLong(h.date)} · ${formatTime(h.time)}`} status="Scheduled" tone="info" />)}</ul>
              </Panel>
            )}
            {section('Past', past)}
          </>
        )}
    </>
  )
}

export function MyAppointmentPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const [a, setA] = useState<Appointment | null>(null)
  const [missing, setMissing] = useState(false)
  const [mode, setMode] = useState<null | 'pick' | 'ask'>(null)
  const [reason, setReason] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const load = () => { if (user) getAppointment(id, user).then(setA).catch(() => setMissing(true)) }
  useEffect(load, [id, user])
  if (missing) return <NotFound />
  if (!a || !user) return <div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />
  const run = async (fn: () => Promise<unknown>, ok: string) => { setMsg(null); try { await fn(); setMode(null); setMsg({ ok: true, text: ok }); load() } catch (e) { setMsg({ ok: false, text: errText(e) }) } }
  const mayMove = APPOINTMENT_TYPES[a.kind].residentMayMove
  const head: Record<AppointmentStatus, string> = {
    awaiting_schedule: 'Your appointment is ready to schedule',
    pending_confirmation: 'Please confirm your appointment',
    rescheduled: 'Your appointment was moved. Please confirm',
    confirmed: 'Your appointment is confirmed',
    reschedule_requested: 'We will send you a new schedule',
    completed: 'Completed',
    cancelled: 'This appointment was cancelled',
    no_show: 'You missed this appointment',
  }
  const next: Partial<Record<AppointmentStatus, string>> = {
    awaiting_schedule: 'Choose a day and time that suits you.',
    no_show: 'Your request is still open. Choose a new time below.',
    confirmed: 'Please arrive 10 minutes early and bring the items listed.',
    reschedule_requested: 'The barangay will choose a new time and notify you.',
    pending_confirmation: a.bookedAt && !a.staffConfirmed ? 'Waiting for the barangay to confirm your time. You will be notified.' : undefined,
  }
  return (
    <>
      <BackLink to="/my/appointments">My Appointments</BackLink>
      <PageHeader title={titleOf(a)} />
      <Card className="space-y-4 px-5 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <p className={`text-[length:calc(20px*var(--fs))] font-bold text-navy-900`}>{head[a.status]}</p>
          <Badge tone={STATUS_TONE[a.status]}>{APPOINTMENT_STATUS_LABEL[a.status]}</Badge>
        </div>
        {next[a.status] && <p className={`text-[length:calc(16.5px*var(--fs))] text-navy-900`}>{next[a.status]}</p>}
        {a.verification?.result === 'not_verified' && <p className={`text-[length:calc(16px*var(--fs))] text-navy-900`}>{a.verification.notes}</p>}
        {msg && <Note ok={msg.ok}>{msg.text}</Note>}

        {mode === 'pick' || ((a.status === 'awaiting_schedule' || a.status === 'no_show') && mode !== 'ask') ? (
          <TimePicker a={a} onPicked={() => { setMode(null); setMsg({ ok: true, text: 'Your appointment is confirmed! You will get a reminder before your visit.' }); load() }} onBack={mode === 'pick' ? () => setMode(null) : undefined} />
        ) : (
          <>
            <Details a={a} />
            {mode === 'ask' ? (
              <div className="space-y-2">
                <TextArea aria-label="Why, or a better day and time" placeholder="Why, or a better day and time" className="min-h-[72px]" value={reason} onChange={(e) => setReason(e.target.value)} />
                <ActionStack><Button onClick={() => run(() => requestReschedule(a.id, reason, user), 'Sent. We will notify you of the new time.')}>Send request</Button><Button variant="ghost" onClick={() => setMode(null)}>Back</Button></ActionStack>
              </div>
            ) : ['pending_confirmation', 'rescheduled', 'confirmed'].includes(a.status) && !a.checkedInAt && (
              <ActionStack>
                {a.status !== 'confirmed' && <Button onClick={() => run(() => confirmAppointment(a.id, user), 'Your appointment is confirmed!')}>Confirm Appointment</Button>}
                <Button variant="secondary" onClick={() => setMode(mayMove ? 'pick' : 'ask')}>{mayMove ? 'Choose another time' : 'Request Another Schedule'}</Button>
                {['chairman_consult', 'general_assist'].includes(a.kind) && <Button variant="ghost" onClick={() => run(() => cancelByResident(a.id, '', user), 'Your appointment was cancelled.')}>Cancel appointment</Button>}
              </ActionStack>
            )}
          </>
        )}
        <p className={`text-[length:calc(15px*var(--fs))] text-ink-nav`}>Questions: {BARANGAY_CONTACT.phone} · Office hours: {BARANGAY_CONTACT.officeHours}</p>
        <EmailStatus a={a} />
      </Card>
      <Panel className="mt-4" title="Updates">
        <Timeline items={a.history.map((h) => ({ at: h.at, title: h.action }))} />
      </Panel>
    </>
  )
}

// ── Staff ────────────────────────────────────────────────────────────

type Range = 'day' | 'week' | 'month' | 'action'
type CalItem = { key: string; date: string; time: string; title: string; who: string; status: string; tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral'; to: string; kind: AppointmentKind | 'hearing' | 'public'; staff: string[] }

function toItems(apps: NamedAppointment[], hearings: HearingEntry[]): CalItem[] {
  return [
    ...apps.map((a) => ({ key: a.id, date: a.date, time: a.time, title: APPOINTMENT_TYPES[a.kind].label, who: a.residentName, status: a.status === 'pending_confirmation' && !a.staffConfirmed && a.bookedAt ? 'Needs your confirmation' : APPOINTMENT_STATUS_LABEL[a.status], tone: STATUS_TONE[a.status], to: `/appointments/${a.id}`, kind: a.kind, staff: a.assignedTo ? [a.assignedTo] : [] })),
    ...hearings.map((h) => ({ key: h.id, date: h.date, time: h.time, title: h.label, who: `${h.caseNo} · ${h.title}`, status: 'Scheduled', tone: 'info' as const, to: `/cases/${h.caseId}`, kind: 'hearing' as const, staff: h.participants })),
  ]
}
const monthStart = (d: string) => `${d.slice(0, 8)}01`
const weekday = (d: string) => new Date(`${d}T12:00:00+08:00`).getUTCDay()

/**
 * One calendar, role-based views. "My calendar" shows what this person
 * handles or attends (hearings from Case Management appear automatically for
 * the Punong Barangay and assigned members); "Team" shows every appointment
 * this person is allowed to see. Day, week and month views; a list on phones.
 */
export function AppointmentsPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<NamedAppointment[] | null>(null)
  const [scope, setScope] = useStickyState<'mine' | 'team'>('scope', 'mine')
  const [range, setRange] = useStickyState<Range>('range', 'day')
  const [day, setDay] = useStickyState('day', manilaToday())
  const [kind, setKind] = useStickyState<'' | AppointmentKind | 'hearing'>('kind', '')
  const [staff, setStaff] = useStickyState('staff', '')
  useEffect(() => { runAppointmentJobs(); if (user) listAppointments(user).then(setItems).catch(() => setItems([])) }, [user])
  if (!user) return null
  const kinds = kindsFor(user)
  const hearings = hearingsFor(user)
  const t = manilaToday()
  const all = toItems(items ?? [], hearings)
    .filter((x) => (scope === 'mine' ? x.staff.includes(user.id) : true))
    .filter((x) => (!kind || x.kind === kind) && (!staff || x.staff.includes(staff)))
  const action = toItems((items ?? []).filter((a) => (scope === 'team' || a.assignedTo === user.id || !a.assignedTo) && ['awaiting_schedule', 'reschedule_requested', 'no_show', 'pending_confirmation', 'rescheduled'].includes(a.status)), [])
  const from = range === 'week' ? day : range === 'month' ? monthStart(day) : day
  const to = range === 'week' ? addDays(day, 6) : range === 'month' ? addDays(monthStart(day), 41).slice(0, 8) + '00' : day
  const inRange = (d: string) => (range === 'month' ? d.slice(0, 7) === day.slice(0, 7) : d >= from && d <= to)
  // The official calendar (holidays, closures, published events) shows on everyone's view.
  const pub: CalItem[] = range === 'action' || kind ? [] : calendarEntries(range === 'month' ? monthStart(day) : from, range === 'month' ? addDays(monthStart(day), 31) : to).map((e) => ({
    key: e.id, date: e.date, time: e.time ?? '', title: e.title, who: e.detail, status: e.kind === 'holiday' ? 'Holiday' : e.kind === 'closure' ? 'Closed' : 'Event', tone: e.kind === 'event' ? 'success' as const : 'neutral' as const,
    to: e.kind === 'event' ? `/announcements/${e.id}` : '/calendar', kind: 'public' as const, staff: [],
  }))
  const shown = range === 'action' ? action : [...pub, ...all].filter((x) => x.date && inRange(x.date) && x.status !== 'Cancelled')
  const byDay = new Map<string, CalItem[]>()
  for (const x of shown.sort((p, q) => (p.date + p.time).localeCompare(q.date + q.time))) byDay.set(x.date || 'No time yet', [...(byDay.get(x.date || 'No time yet') ?? []), x])
  const staffIds = [...new Set([...kinds.flatMap((k) => staffFor(k)), ...hearings.flatMap((h) => h.participants)])]
  const step = (n: number) => setDay(range === 'month' ? addMonths(day, n) : addDays(day, range === 'week' ? 7 * n : n))
  const tab = (on: boolean) => `h-11 rounded-[var(--radius-control)] px-4 text-[length:calc(15.5px*var(--fs))] font-semibold ${on ? 'bg-navy-900 text-white' : 'border border-line bg-surface text-navy-900'}`
  const me = workload(user.id, day)

  return (
    <>
      <PageHeader title="Calendar" />
      <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Whose calendar">
        <button role="tab" aria-selected={scope === 'mine'} className={tab(scope === 'mine')} onClick={() => setScope('mine')}>My calendar</button>
        <button role="tab" aria-selected={scope === 'team'} className={tab(scope === 'team')} onClick={() => setScope('team')}>Team</button>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5" role="tablist" aria-label="View">
        {([['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['action', `Needs action (${action.length})`]] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={range === k} onClick={() => setRange(k)} className={tab(range === k)}>{l}</button>
        ))}
      </div>
      {range !== 'action' && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" aria-label="Previous" onClick={() => step(-1)}>‹</Button>
          <p className="min-w-0 flex-1 text-center text-[length:calc(17px*var(--fs))] font-semibold text-navy-900 sm:flex-none sm:text-left">
            {range === 'month' ? new Date(`${day}T12:00:00+08:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'Asia/Manila' }) : range === 'week' ? `${shortDate(from)} – ${shortDate(to)}` : day === t ? `Today · ${shortDate(day)}` : dateLong(day)}
          </p>
          <Button size="sm" variant="secondary" aria-label="Next" onClick={() => step(1)}>›</Button>
          {day !== t && <Button size="sm" variant="ghost" onClick={() => setDay(t)}>Today</Button>}
        </div>
      )}
      <div className="mb-4 flex flex-wrap gap-2">
        <Select aria-label="Service" className="w-full sm:w-auto sm:min-w-[200px]" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
          <option value="">All services</option>
          {kinds.map((k) => <option key={k} value={k}>{APPOINTMENT_TYPES[k].label}</option>)}
          {hearings.length > 0 && <option value="hearing">Hearings</option>}
        </Select>
        {scope === 'team' && (
          <Select aria-label="Barangay Personnel" className="w-full sm:w-auto sm:min-w-[200px]" value={staff} onChange={(e) => setStaff(e.target.value)}>
            <option value="">Everyone</option>
            {staffIds.map((s) => <option key={s} value={s}>{staffName(s)}</option>)}
          </Select>
        )}
      </div>
      {scope === 'mine' && range === 'day' && me.openMinutes > 0 && (
        <p className="mb-3 text-[length:calc(16px*var(--fs))] text-ink-nav">{me.count} {me.count === 1 ? 'appointment' : 'appointments'} · about {Math.floor(me.freeMinutes / 60)} h {me.freeMinutes % 60} min free</p>
      )}
      {range === 'month' && <MonthGrid day={day} items={all} onPick={(d) => { setDay(d); setRange('day') }} />}
      {items === null ? <div className="h-32 animate-pulse rounded-[var(--radius-card)] bg-surface" /> : byDay.size === 0 ? (
        <Card><EmptyState title={range === 'action' ? 'Nothing needs action' : 'Nothing scheduled'} /></Card>
      ) : [...byDay].map(([d, list]) => (
        <Panel key={d} className="mb-4" title={d === t ? `Today · ${shortDate(d)}` : d === 'No time yet' ? d : dateLong(d)} bodyClassName="px-0 py-0">
          <ul className="divide-y divide-line-soft">
            {list.map((x) => (
              <li key={x.key}>
                <Link to={x.to} className="flex min-h-[64px] items-center gap-3 px-5 py-3 hover:bg-sky-50">
                  <span className="w-[76px] shrink-0 text-[length:calc(15.5px*var(--fs))] font-semibold tabular-nums text-navy-900">{x.time ? formatTime(x.time) : '–'}</span>
                  <span className="min-w-0 flex-1"><span className="block break-words text-[length:calc(16px*var(--fs))] font-semibold text-navy-900">{x.title}</span><span className="block break-words text-[length:calc(14.5px*var(--fs))] text-ink-muted">{x.who}{scope === 'team' && x.staff.length ? ` · ${x.staff.map(staffName).join(', ')}` : ''}</span></span>
                  <Badge tone={x.tone}>{x.status}</Badge>
                  <ChevronRight className="size-4 shrink-0 text-ink-subtle" />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      ))}
      {kinds.length > 0 && <FreeTimes staffIds={staffIds.filter((s) => kinds.some((k) => staffFor(k).includes(s)))} />}
    </>
  )
}
const addMonths = (d: string, n: number) => { const x = new Date(`${monthStart(d)}T12:00:00+08:00`); x.setUTCMonth(x.getUTCMonth() + n); return x.toISOString().slice(0, 10) }

/** Month overview: number of items per day; tap a day to see it. Hidden on small phones (the list below is used). */
function MonthGrid({ day, items, onPick }: { day: string; items: CalItem[]; onPick: (d: string) => void }) {
  const first = monthStart(day)
  const lead = weekday(first)
  const cells: (string | null)[] = [...Array(lead).fill(null)]
  for (let d = first; d.slice(0, 7) === first.slice(0, 7); d = nextDate(d)) cells.push(d)
  const t = manilaToday()
  return (
    <Card className="mb-4 hidden p-3 sm:block">
      <div className="grid grid-cols-7 gap-1 text-center">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((w) => <div key={w} className="py-1 text-[length:calc(14px*var(--fs))] font-semibold text-ink-nav">{w}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} />
          const n = items.filter((x) => x.date === d && x.status !== 'Cancelled').length
          return (
            <button key={d} type="button" onClick={() => onPick(d)} aria-label={`${dateLong(d)}: ${n} scheduled`} className={`flex min-h-16 flex-col items-center justify-start rounded-[var(--radius-control)] border px-1 py-1.5 hover:bg-sky-50 ${d === t ? 'border-navy-900' : 'border-line-soft'}`}>
              <span className={`text-[length:calc(15px*var(--fs))] font-semibold ${d === t ? 'text-navy-900' : 'text-ink-nav'}`}>{Number(d.slice(8))}</span>
              {n > 0 && <span className="mt-1 rounded-full bg-navy-900 px-2 text-[length:calc(13px*var(--fs))] font-semibold text-white">{n}</span>}
            </button>
          )
        })}
      </div>
    </Card>
  )
}
const addDays = (d: string, n: number) => { let x = d; for (let i = 0; i < n; i++) x = nextDate(x); return x }

/** Booked and free times for one staff member on one day (from the scheduling engine). */
function FreeTimes({ staffIds }: { staffIds: string[] }) {
  const [date, setDate] = useState(manilaToday())
  const [staff, setStaff] = useState(staffIds[0] ?? '')
  if (!staffIds.length) return null
  const why = unavailableReason(staff, date)
  const booked = bookingsOn(date).filter((b) => b.staffId === staff).sort((p, q) => p.time.localeCompare(q.time))
  const free = freeSlots(date, staff, 15)
  return (
    <Panel className="mt-2" title="Free and booked times">
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FieldLabel label="Date"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></FieldLabel>
        <FieldLabel label="Barangay Personnel"><Select value={staff} onChange={(e) => setStaff(e.target.value)}>{staffIds.map((s) => <option key={s} value={s}>{staffName(s)}</option>)}</Select></FieldLabel>
      </div>
      {why ? <p className={`text-[length:calc(15.5px*var(--fs))] text-navy-900`}>{why}</p> : (
        <div className={`space-y-2 text-[length:calc(15.5px*var(--fs))] text-navy-900`}>
          <p><span className="font-semibold">Booked:</span> {booked.length ? booked.map((b) => `${formatTime(b.time)}–${formatTime(endTime({ time: b.time, durationMin: b.minutes }))} (${b.label})`).join(', ') : 'nothing yet'}</p>
          <p><span className="font-semibold">Free start times (15-minute visit):</span> {free.length ? free.map((s) => formatTime(s.time)).join(', ') : 'none'}</p>
        </div>
      )}
    </Panel>
  )
}

export function AppointmentDetailPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const [a, setA] = useState<NamedAppointment | null>(null)
  const [missing, setMissing] = useState(false)
  const [mode, setMode] = useState<null | 'verify' | 'reschedule' | 'cancel' | 'length' | 'complete' | 'assist' | 'reassign'>(null)
  const [to, setTo] = useState('')
  const [v, setV] = useState({ idPresented: false, nameMatches: false, documentChecked: false, idExpired: false, notes: '' })
  const [slot, setSlot] = useState({ date: '', staff: '', time: '' })
  const [text, setText] = useState('')
  const [len, setLen] = useState(0)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const load = () => { if (user) getAppointment(id, user).then((x) => { setA(x); setSlot((s) => ({ ...s, staff: s.staff || x.assignedTo || staffFor(x.kind)[0] || '' })); setLen(x.durationMin) }).catch(() => setMissing(true)) }
  useEffect(load, [id, user])
  if (missing) return <NotFound />
  if (!a || !user) return <div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />
  const run = async (fn: () => Promise<unknown>, ok: string) => { setMsg(null); try { await fn(); setMsg({ ok: true, text: ok }); setMode(null); setText(''); load() } catch (e) { setMsg({ ok: false, text: errText(e) }) } }
  const check = (k: keyof typeof v, label: string) => (
    <label className={`flex min-h-11 items-center gap-2.5 text-[length:calc(16px*var(--fs))] text-navy-900`}><input type="checkbox" className="size-5 accent-[#002132]" checked={v[k] as boolean} onChange={(e) => setV({ ...v, [k]: e.target.checked })} /> {label}</label>
  )
  const booked = ['pending_confirmation', 'confirmed', 'rescheduled'].includes(a.status)
  const type = APPOINTMENT_TYPES[a.kind]
  const isVerify = a.kind === 'correction_verification'
  const handledElsewhere = a.kind === 'document_claim' || a.kind.startsWith('equipment')
  return (
    <>
      <BackLink to="/appointments">Appointments</BackLink>
      <PageHeader title={a.residentName} />
      {msg && <div className="mb-3"><Note ok={msg.ok}>{msg.text}</Note></div>}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card className="space-y-4 px-5 py-5">
          <div className="flex flex-wrap items-center gap-2">
            <p className={`text-[length:calc(18px*var(--fs))] font-semibold text-navy-900`}>{titleOf(a)}</p>
            <Badge tone={STATUS_TONE[a.status]}>{APPOINTMENT_STATUS_LABEL[a.status]}</Badge>
            {a.checkedInAt && a.status !== 'completed' && <Badge tone="info">Checked in {formatDateTime(a.checkedInAt)}</Badge>}
          </div>
          {a.rescheduleReason && <p className={`text-[length:calc(15.5px*var(--fs))] text-navy-900`}>Resident asked: {a.rescheduleReason}</p>}
          <Details a={a} staff />
          {a.outcome && <p className={`rounded-md bg-surface-muted px-3 py-2 text-[length:calc(15.5px*var(--fs))] text-navy-900`}>{a.outcome.notes} · {staffName(a.outcome.byUserId) || 'System'}</p>}
          {a.verification && <p className={`text-[length:calc(15px*var(--fs))] text-ink-muted`}>ID presented {a.verification.idPresented ? 'yes' : 'no'} · name matches {a.verification.nameMatches ? 'yes' : 'no'} · document checked {a.verification.documentChecked ? 'yes' : 'no'}{a.verification.idExpired ? ' · ID expired' : ''}</p>}
          <EmailStatus a={a} />

          {mode === 'verify' ? (
            <div className="space-y-1 border-t border-line-soft pt-3">
              {check('idPresented', 'Original ID presented')}
              {check('nameMatches', 'Name and details match the request')}
              {check('documentChecked', 'Supporting document checked')}
              {check('idExpired', 'The ID is expired')}
              <TextArea aria-label="Notes" placeholder="Notes (required if not verified: what did not match and what to do next)" className="min-h-[72px]" value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />
              <ActionStack className="pt-2">
                <Button onClick={() => run(() => recordVerification(a.id, 'verified', v, user), 'Marked as verified. You can now decide on the request.')}>Verified</Button>
                <Button variant="secondary" onClick={() => run(() => recordVerification(a.id, 'not_verified', v, user), 'Marked as not verified. The resident was told.')}>Not verified</Button>
                <Button variant="ghost" onClick={() => setMode(null)}>Back</Button>
              </ActionStack>
            </div>
          ) : mode === 'reschedule' ? (
            <div className="space-y-2 border-t border-line-soft pt-3">
              <StaffSlotPicker kind={a.kind} minutes={a.durationMin} ignoreId={a.id} value={slot} onChange={setSlot} />
              <ActionStack><Button disabled={!slot.time} onClick={() => run(() => rescheduleAppointment(a.id, slot.date, slot.time, slot.staff, user), 'Moved. The resident was told and asked to confirm.')}>Save new time</Button><Button variant="ghost" onClick={() => setMode(null)}>Back</Button></ActionStack>
            </div>
          ) : mode === 'assist' ? (
            <div className="border-t border-line-soft pt-3"><TimePicker a={a} onPicked={() => { setMode(null); setMsg({ ok: true, text: 'Booked for the resident. They were told.' }); load() }} onBack={() => setMode(null)} /></div>
          ) : mode === 'length' ? (
            <div className="space-y-2 border-t border-line-soft pt-3">
              <p className={`text-[length:calc(15px*var(--fs))] text-ink-muted`}>Calculated: {a.durationEstimate ?? lengthOf(a.kind, a.documents)} minutes</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[150px_1fr]">
                <Select aria-label="New length" value={len} onChange={(e) => setLen(Number(e.target.value))}>{[10, 15, 20, 25, 30, 40, 45, 60, 90].map((m) => <option key={m} value={m}>{m} minutes</option>)}</Select>
                <TextInput aria-label="Reason" placeholder="Reason (required)" value={text} onChange={(e) => setText(e.target.value)} />
              </div>
              <ActionStack><Button onClick={() => run(() => overrideDuration(a.id, len, text, user), 'Length changed and recorded.')}>Save</Button><Button variant="ghost" onClick={() => setMode(null)}>Back</Button></ActionStack>
            </div>
          ) : mode === 'complete' ? (
            <div className="space-y-2 border-t border-line-soft pt-3">
              <TextArea aria-label="What happened and the next step" placeholder="What happened and the next step" className="min-h-[72px]" value={text} onChange={(e) => setText(e.target.value)} />
              <ActionStack><Button onClick={() => run(() => completeAppointment(a.id, text, user), 'Completed.')}>Mark as Completed</Button><Button variant="ghost" onClick={() => setMode(null)}>Back</Button></ActionStack>
            </div>
          ) : mode === 'reassign' ? (
            <div className="space-y-2 border-t border-line-soft pt-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Select aria-label="Assign to" value={to} onChange={(e) => setTo(e.target.value)}>
                  <option value="">Choose a colleague…</option>
                  {staffFor(a.kind).filter((s) => s !== a.assignedTo).map((s) => <option key={s} value={s}>{staffName(s)}</option>)}
                </Select>
                <TextInput aria-label="Reason" placeholder="Reason" value={text} onChange={(e) => setText(e.target.value)} />
              </div>
              <ActionStack><Button disabled={!to} onClick={() => run(() => reassign(a.id, to, text, user), 'Reassigned. Both members of the Barangay Personnel were told.')}>Reassign</Button><Button variant="ghost" onClick={() => setMode(null)}>Back</Button></ActionStack>
            </div>
          ) : mode === 'cancel' ? (
            <div className="space-y-2 border-t border-line-soft pt-3">
              <TextInput aria-label="Reason" placeholder="Reason (the resident will see it)" value={text} onChange={(e) => setText(e.target.value)} />
              <ActionStack><Button variant="danger" onClick={() => run(() => cancelAppointment(a.id, text, user), 'Cancelled. The resident was told.')}>Cancel appointment</Button><Button variant="ghost" onClick={() => setMode(null)}>Back</Button></ActionStack>
            </div>
          ) : (
            <ActionStack className="border-t border-line-soft pt-3">
              {a.status === 'pending_confirmation' && a.bookedAt && !a.staffConfirmed && <Button onClick={() => run(() => staffConfirm(a.id, user), 'Confirmed. The resident was told.')}>Confirm appointment</Button>}
              {booked && !a.checkedInAt && <Button variant={a.status === 'pending_confirmation' && !a.staffConfirmed ? 'secondary' : 'primary'} onClick={() => run(() => checkIn(a.id, user), 'Checked in.')}>Check In</Button>}
              {isVerify && a.checkedInAt && a.status !== 'completed' && <Button onClick={() => setMode('verify')}>Record result</Button>}
              {['complaint_consult', 'chairman_consult', 'general_assist'].includes(a.kind) && a.checkedInAt && a.status !== 'completed' && <Button onClick={() => setMode('complete')}>Record outcome</Button>}
              {handledElsewhere && a.status !== 'completed' && <Link to={type.staffLink(a.subjectId)} className={`inline-flex h-12 items-center rounded-[var(--radius-control)] bg-navy-900 px-5 text-[length:calc(16.5px*var(--fs))] font-semibold text-white`}>{a.kind === 'document_claim' ? 'Open request to release' : 'Open borrowing'}</Link>}
              {['awaiting_schedule', 'no_show'].includes(a.status) && <Button variant="secondary" onClick={() => setMode('assist')}>Book for the resident</Button>}
              {['awaiting_schedule', 'pending_confirmation', 'confirmed', 'reschedule_requested', 'rescheduled', 'no_show'].includes(a.status) && !a.checkedInAt && <Button variant="secondary" onClick={() => setMode('reschedule')}>Reschedule</Button>}
              {['awaiting_schedule', 'pending_confirmation', 'confirmed', 'reschedule_requested', 'rescheduled'].includes(a.status) && !a.checkedInAt && <Button variant="ghost" onClick={() => setMode('length')}>Change length</Button>}
              {booked && !a.checkedInAt && staffFor(a.kind).length > 1 && <Button variant="ghost" onClick={() => { setTo(''); setText(''); setMode('reassign') }}>Reassign</Button>}
              {booked && !a.checkedInAt && <Button variant="secondary" onClick={() => run(() => markNoShow(a.id, user), 'Marked as no-show. The resident was told.')}>No-show</Button>}
              {!['completed', 'cancelled'].includes(a.status) && <Button variant="ghost" onClick={() => setMode('cancel')}>Cancel</Button>}
              {a.status === 'completed' && <Link to={type.staffLink(a.subjectId)} className={`inline-flex h-12 items-center text-[length:calc(16px*var(--fs))] font-semibold text-info hover:underline`}>Go to the request</Link>}
            </ActionStack>
          )}
        </Card>
        <Panel title="History">
          <Timeline items={a.history.map((h) => ({ at: h.at, title: h.action, by: h.byUserId === 'system' ? 'System' : staffName(h.byUserId) || 'Resident', tone: /(reject|not approved|overdue|cancel|no-show|not verified|damage|referred|settled|closed|approved|decided)/i.test(h.action) ? 'important' as const : undefined }))} />
        </Panel>
      </div>
    </>
  )
}

/**
 * Dashboard: this person's own schedule for today (appointments assigned to
 * them and hearings they attend), with a simple workload line. The Secretary
 * does not see the Custodian's or the Chairman's appointments here.
 */
export function TodayAppointmentsPanel() {
  const { user } = useAuth()
  const [items, setItems] = useState<NamedAppointment[] | null>(null)
  useEffect(() => { runAppointmentJobs(); if (user) listAppointments(user).then(setItems).catch(() => setItems([])) }, [user])
  if (!user) return null
  const t = manilaToday()
  const mineAll = toItems((items ?? []).filter((a) => a.assignedTo === user.id), hearingsFor(user).filter((h) => h.participants.includes(user.id)))
  if (!kindsFor(user).length && !mineAll.length) return null
  const today = mineAll.filter((x) => x.date === t && x.status !== 'Cancelled').sort((p, q) => p.time.localeCompare(q.time))
  const next = mineAll.filter((x) => x.date > t && x.status !== 'Cancelled').sort((p, q) => (p.date + p.time).localeCompare(q.date + q.time))[0]
  const toConfirm = (items ?? []).filter((a) => a.assignedTo === user.id && a.status === 'pending_confirmation' && a.bookedAt && !a.staffConfirmed).length
  const asks = (items ?? []).filter((a) => a.assignedTo === user.id && a.status === 'reschedule_requested').length
  const w = workload(user.id, t)
  return (
    <Panel className="mt-4" title="Today's schedule" actions={<Link to="/appointments" className="inline-flex min-h-11 items-center text-[length:calc(15.5px*var(--fs))] font-semibold text-info hover:underline">View calendar <ChevronRight className="size-4" /></Link>} bodyClassName="px-0 py-0">
      <p className="border-b border-line-soft px-5 py-3 text-[length:calc(16px*var(--fs))] text-navy-900">
        {items === null ? 'Loading…' : `${today.length} today${w.openMinutes ? ` · about ${Math.floor(w.freeMinutes / 60)} h ${w.freeMinutes % 60} min free` : ''}${toConfirm ? ` · ${toConfirm} to confirm` : ''}${asks ? ` · ${asks} reschedule ${asks === 1 ? 'request' : 'requests'}` : ''}`}
      </p>
      {today.length === 0 ? <p className="px-5 py-4 text-[length:calc(16px*var(--fs))] text-ink-muted">{next ? `Nothing today. Next: ${shortDate(next.date)}, ${formatTime(next.time)} · ${next.title}` : 'Nothing scheduled today.'}</p> : (
        <ul className="divide-y divide-line-soft">
          {today.map((x) => (
            <li key={x.key}><Link to={x.to} className="flex min-h-[56px] items-center gap-3 px-5 py-2.5 hover:bg-sky-50">
              <span className="w-[76px] shrink-0 text-[length:calc(15.5px*var(--fs))] font-semibold tabular-nums text-navy-900">{formatTime(x.time)}</span>
              <span className="min-w-0 flex-1 break-words"><span className="text-[length:calc(15.5px*var(--fs))] font-semibold text-navy-900">{x.title}</span><span className="text-[length:calc(15px*var(--fs))] text-ink-muted"> · {x.who}</span></span>
              <Badge tone={x.tone}>{x.status}</Badge>
            </Link></li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

/** Case page: ask the complainant to come in for a consultation (not a hearing; hearings follow the case steps). */
export function ConsultationPanel({ caseId }: { caseId: string }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  // Always held by the Punong Barangay; the Secretary may book it on the Chairman's calendar.
  const [slot, setSlot] = useState({ date: '', staff: staffFor('complaint_consult')[0] ?? '', time: '' })
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const existing = appointmentFor('complaint_consult', caseId)
  if (!user) return null
  const minutes = lengthOf('complaint_consult', [])
  const save = async () => {
    setBusy(true); setMsg(null)
    try { await scheduleConsultation(caseId, { reason, documents: ['Valid government-issued ID', 'Any photos or papers about the complaint'], date: slot.date, time: slot.time, assignedTo: slot.staff }, user); setOpen(false); setMsg({ ok: true, text: 'Scheduled. The complainant was told and asked to confirm.' }) } catch (e) { setMsg({ ok: false, text: errText(e) }) } finally { setBusy(false) }
  }
  return (
    <Panel title="Consultation with the Punong Barangay">
      <div className="space-y-3">
        {msg && <Note ok={msg.ok}>{msg.text}</Note>}
        {existing && isOpen(existing) ? (
          <Link to={`/appointments/${existing.id}`} className="block rounded-[var(--radius-control)] border border-line-soft px-3 py-2 hover:bg-sky-50">
            <span className="block text-[length:calc(15.5px*var(--fs))] font-semibold text-navy-900">{APPOINTMENT_STATUS_LABEL[existing.status]}</span>
            <span className="block text-[length:calc(14.5px*var(--fs))] text-ink-muted">{existing.date ? `${dateLong(existing.date)} · ${formatTime(existing.time)}` : 'No time yet'}</span>
          </Link>
        ) : open ? (
          <>
            <FieldLabel label="Why should the complainant come in?"><TextArea className="min-h-[60px]" value={reason} onChange={(e) => setReason(e.target.value)} /></FieldLabel>
            <p className="text-[length:calc(15px*var(--fs))] text-ink-muted">About {minutes} minutes</p>
            <StaffSlotPicker kind="complaint_consult" minutes={minutes} value={slot} onChange={setSlot} />
            <ActionStack><Button size="sm" loading={busy} disabled={!slot.time || reason.trim().length < 5} onClick={save}>Schedule and notify</Button><Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button></ActionStack>
          </>
        ) : <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Schedule a consultation</Button>}
      </div>
    </Panel>
  )
}

/** Resident books a visit for something that is not part of another request. */
export function BookVisitPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [kind, setKind] = useState<AppointmentKind | null>(null)
  const [reason, setReason] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  if (!user) return null
  const next = async () => {
    if (!kind) return
    setBusy(true); setErr(null)
    try { const a = await requestVisit(kind, reason, user); navigate(`/my/appointments/${a.id}`, { replace: true }) } catch (e) { setErr(errText(e)) } finally { setBusy(false) }
  }
  return (
    <>
      <BackLink to="/my/appointments">My Appointments</BackLink>
      <PageHeader title="Book a visit" />
      {!kind ? (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {bookableServices().map((k) => (
            <li key={k}>
              <button type="button" onClick={() => setKind(k)} className="flex min-h-16 w-full items-center justify-between gap-3 rounded-[var(--radius-control)] border border-line bg-surface px-4 py-3 text-left hover:border-navy-600 hover:bg-sky-50">
                <span><span className="block text-[length:calc(17px*var(--fs))] font-semibold text-navy-900">{APPOINTMENT_TYPES[k].label}</span><span className="block text-[length:calc(15px*var(--fs))] text-ink-nav">About {lengthOf(k, [])} minutes</span></span>
                <ChevronRight className="size-5 shrink-0 text-ink-subtle" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <Card className="space-y-4 px-5 py-5">
          <p className="text-[length:calc(18px*var(--fs))] font-semibold text-navy-900">{APPOINTMENT_TYPES[kind].label}</p>
          <FieldLabel label="What do you need help with?"><TextArea className="min-h-[96px]" value={reason} onChange={(e) => setReason(e.target.value)} /></FieldLabel>
          {err && <Note ok={false}>{err}</Note>}
          <ActionStack>
            <Button loading={busy} disabled={reason.trim().length < 5} onClick={next}>Next: choose a time</Button>
            <Button variant="ghost" onClick={() => setKind(null)}>Back</Button>
          </ActionStack>
        </Card>
      )}
    </>
  )
}
