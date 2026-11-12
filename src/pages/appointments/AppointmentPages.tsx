import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronRight } from '@/icons'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/ui/Button'
import { FieldLabel, Select, TextArea, TextInput } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, Panel } from '@/components/ui/Panel'
import { EmptyState } from '@/components/ui/EmptyState'
import { BARANGAY_CONTACT } from '@/config/barangay'
import { ROLE_PERMISSIONS } from '@/config/permissions'
import { formatDate, formatDateTime } from '@/lib/format'
import { mockUsers } from '@/mocks/users'
import {
  APPOINTMENT_STATUS_LABEL,
  DOCUMENT_OPTIONS,
  VISIT_REASONS,
  availableSlots,
  cancelAppointment,
  confirmAppointment,
  formatTime,
  getAppointment,
  listAppointments,
  listMyAppointments,
  markArrived,
  markNoShow,
  recordVerification,
  requestReschedule,
  rescheduleAppointment,
  runReminders,
  scheduleForCorrection,
  startVerification,
  type Appointment,
} from '@/services/appointmentService'
import { ServiceError } from '@/services/mockApi'
import { NotFound } from '@/pages/system/NotFound'
import { BackLink } from '@/pages/resident/parts'

const dateLong = (d: string) => new Date(`${d}T12:00:00+08:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' })
const verifiers = () => mockUsers.filter((u) => u.status === 'active' && (ROLE_PERMISSIONS[u.roleId]?.includes('residents.approve') || u.extraPermissions?.includes('residents.approve')))
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })

/** Date → staff → free time; only open slots are offered. */
function SlotPicker({ date, setDate, staff, setStaff, time, setTime, ignoreId }: { date: string; setDate: (v: string) => void; staff: string; setStaff: (v: string) => void; time: string; setTime: (v: string) => void; ignoreId?: string }) {
  const slots = date && staff ? availableSlots(date, staff, ignoreId) : []
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <FieldLabel label="Date"><TextInput type="date" min={today()} value={date} onChange={(e) => { setDate(e.target.value); setTime('') }} /></FieldLabel>
      <FieldLabel label="Staff">
        <Select value={staff} onChange={(e) => { setStaff(e.target.value); setTime('') }}>{verifiers().map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}</Select>
      </FieldLabel>
      <FieldLabel label="Time">
        <Select value={time} onChange={(e) => setTime(e.target.value)} disabled={!slots.length}>
          <option value="">{date ? (slots.length ? 'Choose a time' : 'No free times') : 'Choose a date first'}</option>
          {slots.map((t) => <option key={t} value={t}>{formatTime(t)}</option>)}
        </Select>
      </FieldLabel>
    </div>
  )
}

/** Used on the correction review: require an in-person visit with a real slot. */
export function ScheduleVisitForm({ changeRequestId, onDone, onCancel }: { changeRequestId: string; onDone: () => void; onCancel: () => void }) {
  const { user } = useAuth()
  const [reason, setReason] = useState<string>(VISIT_REASONS[0])
  const [docs, setDocs] = useState<string[]>([DOCUMENT_OPTIONS[0]])
  const [date, setDate] = useState('')
  const [staff, setStaff] = useState(user?.id ?? '')
  const [time, setTime] = useState('')
  const [duration, setDuration] = useState(30)
  const [instructions, setInstructions] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true); setErr(null)
    try { await scheduleForCorrection(changeRequestId, { reason, documents: docs, date, time, durationMin: duration, assignedTo: staff, instructions }, user!); onDone() } catch (e) { setErr(e instanceof ServiceError ? e.message : 'Not saved.') } finally { setBusy(false) }
  }
  return (
    <div className="space-y-3 rounded-[var(--radius-control)] border border-line-soft p-4">
      <p className="text-[length:calc(16px*var(--fs))] font-semibold text-navy-900">Require in-person verification</p>
      <FieldLabel label="Reason"><Select value={reason} onChange={(e) => setReason(e.target.value)}>{VISIT_REASONS.map((r) => <option key={r}>{r}</option>)}</Select></FieldLabel>
      <fieldset>
        <legend className="mb-1 text-[length:calc(16px*var(--fs))] font-semibold text-navy-900">Bring</legend>
        {DOCUMENT_OPTIONS.map((d) => (
          <label key={d} className="flex min-h-10 items-center gap-2.5 text-[length:calc(15.5px*var(--fs))] text-navy-900">
            <input type="checkbox" className="size-5 accent-[#002132]" checked={docs.includes(d)} onChange={(e) => setDocs((x) => (e.target.checked ? [...x, d] : x.filter((y) => y !== d)))} /> {d}
          </label>
        ))}
      </fieldset>
      <SlotPicker date={date} setDate={setDate} staff={staff} setStaff={setStaff} time={time} setTime={setTime} />
      <FieldLabel label="Expected duration"><Select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>{[15, 30, 45, 60].map((m) => <option key={m} value={m}>{m} minutes</option>)}</Select></FieldLabel>
      <FieldLabel label="Instructions (optional)"><TextArea className="min-h-[60px]" value={instructions} onChange={(e) => setInstructions(e.target.value)} /></FieldLabel>
      {err && <p role="alert" className="text-[length:calc(15px*var(--fs))] text-danger-ink">{err}</p>}
      <div className="flex flex-wrap gap-2"><Button size="sm" onClick={save} loading={busy} disabled={!time}>Schedule visit</Button><Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button></div>
    </div>
  )
}

function Details({ a }: { a: Appointment & { residentName?: string } }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 text-[length:calc(16px*var(--fs))]">
      <dt className="text-ink-muted">When</dt><dd className="font-semibold text-navy-900">{dateLong(a.date)} · {formatTime(a.time)}</dd>
      <dt className="text-ink-muted">How long</dt><dd className="text-navy-900">About {a.durationMin} minutes</dd>
      <dt className="text-ink-muted">Where</dt><dd className="text-navy-900">{BARANGAY_CONTACT.hall}, {BARANGAY_CONTACT.address}</dd>
      <dt className="text-ink-muted">Why</dt><dd className="text-navy-900">{a.reason}</dd>
      <dt className="text-ink-muted">Bring</dt><dd className="text-navy-900"><ul className="list-disc pl-5">{a.documents.map((d) => <li key={d}>{d}</li>)}</ul></dd>
      {a.instructions && <><dt className="text-ink-muted">Note</dt><dd className="text-navy-900">{a.instructions}</dd></>}
    </dl>
  )
}

// ── Resident ─────────────────────────────────────────────────────────

export function MyAppointmentsPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<Appointment[] | null>(null)
  useEffect(() => { runReminders(); if (user) listMyAppointments(user).then(setItems) }, [user])
  return (
    <>
      <PageHeader title="My Appointments" />
      <Card className="overflow-hidden">
        {items === null ? <div className="h-24 animate-pulse" /> : items.length === 0 ? <EmptyState title="No appointments" /> : (
          <ul className="divide-y divide-line-soft">
            {items.map((a) => (
              <li key={a.id}>
                <Link to={`/my/appointments/${a.id}`} className="flex min-h-[64px] items-center gap-3 px-5 py-3 hover:bg-sky-50">
                  <span className="min-w-0 flex-1"><span className="block text-[length:calc(16.5px*var(--fs))] font-semibold text-navy-900">{formatDate(`${a.date}T12:00:00+08:00`)} · {formatTime(a.time)}</span><span className="block text-[length:calc(14.5px*var(--fs))] text-ink-muted">In-person verification · {APPOINTMENT_STATUS_LABEL[a.status]}</span></span>
                  <ChevronRight className="size-4 shrink-0 text-ink-subtle" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}

export function MyAppointmentPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const [a, setA] = useState<Appointment | null>(null)
  const [missing, setMissing] = useState(false)
  const [asking, setAsking] = useState(false)
  const [reason, setReason] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const load = () => { if (user) getAppointment(id, user).then(setA).catch(() => setMissing(true)) }
  useEffect(load, [id, user])
  if (missing) return <NotFound />
  if (!a || !user) return <div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />
  const run = async (fn: () => Promise<unknown>) => { setErr(null); try { await fn(); setAsking(false); load() } catch (e) { setErr(e instanceof ServiceError ? e.message : 'Not saved.') } }
  const head = a.status === 'scheduled' ? 'Please confirm your visit' : a.status === 'confirmed' ? 'Your visit is confirmed' : a.status === 'reschedule_requested' ? 'We will send you a new schedule' : a.status === 'verified' ? 'Your documents were checked' : a.status === 'not_verified' ? 'Your documents could not be verified' : a.status === 'no_show' ? 'You missed this visit' : a.status === 'cancelled' ? 'This visit was cancelled' : 'Visit in progress'
  return (
    <>
      <BackLink to="/my/appointments">My Appointments</BackLink>
      <PageHeader title="In-person verification" />
      <Card className="space-y-4 px-5 py-5">
        <p className="text-[length:calc(19px*var(--fs))] font-bold text-navy-900">{head}</p>
        {a.status === 'not_verified' && a.verification?.notes && <p className="text-[length:calc(16px*var(--fs))] text-navy-900">{a.verification.notes}</p>}
        <Details a={a} />
        {['scheduled', 'confirmed'].includes(a.status) && <p className="text-[length:calc(15.5px*var(--fs))] text-ink-nav">Please come 10 minutes early. Office hours: {BARANGAY_CONTACT.officeHours}. Questions: {BARANGAY_CONTACT.phone}.</p>}
        {err && <p role="alert" className="text-[length:calc(15px*var(--fs))] text-danger-ink">{err}</p>}
        {asking ? (
          <div className="space-y-2">
            <TextArea aria-label="Why, or a better day and time" placeholder="Why, or a better day and time" className="min-h-[72px]" value={reason} onChange={(e) => setReason(e.target.value)} />
            <div className="flex flex-wrap gap-2"><Button onClick={() => run(() => requestReschedule(a.id, reason, user))}>Send request</Button><Button variant="ghost" onClick={() => setAsking(false)}>Cancel</Button></div>
          </div>
        ) : ['scheduled', 'confirmed'].includes(a.status) && (
          <div className="grid grid-cols-1 gap-2 sm:flex">
            {a.status === 'scheduled' && <Button onClick={() => run(() => confirmAppointment(a.id, user))}>Confirm Appointment</Button>}
            <Button variant="secondary" onClick={() => setAsking(true)}>Request Another Schedule</Button>
          </div>
        )}
      </Card>
    </>
  )
}

// ── Staff ────────────────────────────────────────────────────────────

export function AppointmentsPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<(Appointment & { residentName: string })[] | null>(null)
  useEffect(() => { runReminders(); if (user) listAppointments(user).then(setItems).catch(() => setItems([])) }, [user])
  const t = today()
  const groups: [string, (Appointment & { residentName: string })[]][] = items ? [
    ["Today's appointments", items.filter((a) => a.date === t && !['cancelled'].includes(a.status))],
    ['Needs a new schedule', items.filter((a) => ['reschedule_requested', 'no_show'].includes(a.status))],
    ['Upcoming', items.filter((a) => a.date > t && ['scheduled', 'confirmed'].includes(a.status))],
    ['Recent', items.filter((a) => a.date < t || ['verified', 'not_verified', 'cancelled'].includes(a.status)).slice(-10).reverse()],
  ] : []
  return (
    <>
      <PageHeader title="Appointments" />
      {items === null ? <div className="h-32 animate-pulse rounded-[var(--radius-card)] bg-surface" /> : items.length === 0 ? <Card><EmptyState title="No appointments yet" /></Card> : groups.filter(([, l]) => l.length).map(([title, list]) => (
        <Panel key={title} className="mb-4" title={title} bodyClassName="px-0 py-0">
          <ul className="divide-y divide-line-soft">
            {list.map((a) => (
              <li key={a.id}>
                <Link to={`/appointments/${a.id}`} className="flex min-h-[64px] items-center gap-3 px-5 py-3 hover:bg-sky-50">
                  <span className="min-w-0 flex-1"><span className="block truncate text-[length:calc(16.5px*var(--fs))] font-semibold text-navy-900">{a.residentName}</span><span className="block truncate text-[length:calc(14.5px*var(--fs))] text-ink-muted">{a.date === t ? '' : `${formatDate(`${a.date}T12:00:00+08:00`)} · `}{formatTime(a.time)} · {a.reason}</span></span>
                  <span className="shrink-0 text-[length:calc(14px*var(--fs))] font-semibold text-ink-nav">{APPOINTMENT_STATUS_LABEL[a.status]}</span>
                  <ChevronRight className="size-4 shrink-0 text-ink-subtle" />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      ))}
    </>
  )
}

export function AppointmentDetailPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const [a, setA] = useState<(Appointment & { residentName: string }) | null>(null)
  const [missing, setMissing] = useState(false)
  const [mode, setMode] = useState<null | 'verify' | 'reschedule' | 'cancel'>(null)
  const [v, setV] = useState({ idPresented: false, nameMatches: false, documentChecked: false, idExpired: false, notes: '' })
  const [slot, setSlot] = useState({ date: '', staff: '', time: '' })
  const [reason, setReason] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const load = () => { if (user) getAppointment(id, user).then((x) => { setA(x); setSlot((s) => ({ ...s, staff: s.staff || x.assignedTo })) }).catch(() => setMissing(true)) }
  useEffect(load, [id, user])
  if (missing) return <NotFound />
  if (!a || !user) return <div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />
  const run = async (fn: () => Promise<unknown>, ok: string) => { setMsg(null); try { await fn(); setMsg({ ok: true, text: ok }); setMode(null); load() } catch (e) { setMsg({ ok: false, text: e instanceof ServiceError ? e.message : 'Not saved.' }) } }
  const check = (k: keyof typeof v, label: string) => (
    <label className="flex min-h-11 items-center gap-2.5 text-[length:calc(16px*var(--fs))] text-navy-900"><input type="checkbox" className="size-5 accent-[#002132]" checked={v[k] as boolean} onChange={(e) => setV({ ...v, [k]: e.target.checked })} /> {label}</label>
  )
  return (
    <>
      <BackLink to="/appointments">Appointments</BackLink>
      <PageHeader title={a.residentName} />
      {msg && <p role="status" className={`mb-3 rounded-[var(--radius-control)] px-4 py-2.5 text-[length:calc(15px*var(--fs))] ${msg.ok ? 'bg-success-tint text-navy-900' : 'bg-danger-tint text-danger-ink'}`}>{msg.text}</p>}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card className="space-y-4 px-5 py-5">
          <p className="text-[length:calc(17px*var(--fs))] font-semibold text-navy-900">{APPOINTMENT_STATUS_LABEL[a.status]}{a.rescheduleReason ? ` · ${a.rescheduleReason}` : ''}</p>
          <Details a={a} />
          <p className="text-[length:calc(15px*var(--fs))] text-ink-muted">{a.ref} · checked by {mockUsers.find((u) => u.id === a.assignedTo)?.fullName}{a.arrivedAt ? ` · arrived ${formatDateTime(a.arrivedAt)}` : ''}</p>
          {a.verification && <p className="rounded-md bg-surface-muted px-3 py-2 text-[length:calc(15.5px*var(--fs))] text-navy-900">{a.verification.result === 'verified' ? 'Verified' : 'Not verified'}: ID presented {a.verification.idPresented ? 'yes' : 'no'}, name matches {a.verification.nameMatches ? 'yes' : 'no'}, document checked {a.verification.documentChecked ? 'yes' : 'no'}{a.verification.idExpired ? ', ID expired' : ''}. {a.verification.notes}</p>}

          {mode === 'verify' ? (
            <div className="space-y-1 border-t border-line-soft pt-3">
              {check('idPresented', 'Original ID presented')}
              {check('nameMatches', 'Name and details match the request')}
              {check('documentChecked', 'Supporting document checked')}
              {check('idExpired', 'The ID is expired')}
              <TextArea aria-label="Notes" placeholder="Notes (required if not verified: what did not match and what to do next)" className="min-h-[72px]" value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />
              <div className="flex flex-wrap gap-2 pt-2">
                <Button onClick={() => run(() => recordVerification(a.id, 'verified', v, user), 'Marked as verified. You can now decide on the request.')}>Verified</Button>
                <Button variant="secondary" onClick={() => run(() => recordVerification(a.id, 'not_verified', v, user), 'Marked as not verified. The resident was told.')}>Not verified</Button>
                <Button variant="ghost" onClick={() => setMode(null)}>Back</Button>
              </div>
            </div>
          ) : mode === 'reschedule' ? (
            <div className="space-y-2 border-t border-line-soft pt-3">
              <SlotPicker date={slot.date} setDate={(d) => setSlot({ ...slot, date: d })} staff={slot.staff} setStaff={(s) => setSlot({ ...slot, staff: s })} time={slot.time} setTime={(t) => setSlot({ ...slot, time: t })} ignoreId={a.id} />
              <div className="flex gap-2"><Button disabled={!slot.time} onClick={() => run(() => rescheduleAppointment(a.id, slot.date, slot.time, slot.staff, user), 'Moved. The resident was told.')}>Save new time</Button><Button variant="ghost" onClick={() => setMode(null)}>Back</Button></div>
            </div>
          ) : mode === 'cancel' ? (
            <div className="space-y-2 border-t border-line-soft pt-3">
              <TextInput aria-label="Reason" placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
              <div className="flex gap-2"><Button variant="danger" onClick={() => run(() => cancelAppointment(a.id, reason, user), 'Cancelled.')}>Cancel visit</Button><Button variant="ghost" onClick={() => setMode(null)}>Back</Button></div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 border-t border-line-soft pt-3">
              {['scheduled', 'confirmed'].includes(a.status) && <Button onClick={() => run(() => markArrived(a.id, user), 'Marked as arrived.')}>Mark as Arrived</Button>}
              {a.status === 'arrived' && <Button onClick={() => run(() => startVerification(a.id, user), 'Verification started.')}>Start Verification</Button>}
              {a.status === 'in_verification' && <Button onClick={() => setMode('verify')}>Record result</Button>}
              {['scheduled', 'confirmed', 'reschedule_requested', 'no_show'].includes(a.status) && <Button variant="secondary" onClick={() => setMode('reschedule')}>Reschedule</Button>}
              {['scheduled', 'confirmed'].includes(a.status) && <Button variant="secondary" onClick={() => run(() => markNoShow(a.id, user), 'Marked as no show.')}>No Show</Button>}
              {!['verified', 'not_verified', 'cancelled'].includes(a.status) && <Button variant="ghost" onClick={() => setMode('cancel')}>Cancel</Button>}
              {['verified', 'not_verified'].includes(a.status) && <Link to="/residents/change-requests" className="inline-flex h-11 items-center font-semibold text-info hover:underline">Go to the request</Link>}
            </div>
          )}
        </Card>
        <Panel title="History">
          <ol className="space-y-2.5">{[...a.history].reverse().map((h, i) => <li key={i} className="border-l-2 border-line-soft pl-3"><p className="text-[length:calc(15px*var(--fs))] text-navy-900">{h.action}</p><p className="text-[length:calc(13.5px*var(--fs))] text-ink-muted">{formatDateTime(h.at)} · {mockUsers.find((u) => u.id === h.byUserId)?.fullName ?? 'Resident'}</p></li>)}</ol>
        </Panel>
      </div>
    </>
  )
}
