import { useState, type ReactNode } from 'react'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/ui/Button'
import { Panel } from '@/components/ui/Panel'
import { actualDurations, appointmentSettings, bookedOutsideHours, saveAppointmentSettings } from '@/services/appointmentService'
import { ROLES } from '@/config/permissions'
import { ServiceError } from '@/services/mockApi'
import { DEFAULT_RULES, REMINDER_LABEL, SERVICE_KEYS, eligibleStaff, saveSchedulingRules, schedulingRules, type ReminderKey, type SchedulingRules } from '@/services/schedulingService'
import { formatDateTime } from '@/lib/format'
import { mockUsers } from '@/mocks/users'

const control = 'h-12 w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 text-[length:calc(16px*var(--fs))] text-navy-900 focus-visible:outline-2 focus-visible:outline-navy-600'
/** Fixed-width number box for list rows (never stretches over the label). */
const small = 'h-12 w-20 shrink-0 rounded-[var(--radius-control)] border border-line bg-surface px-3 text-right text-[length:calc(16px*var(--fs))] text-navy-900 focus-visible:outline-2 focus-visible:outline-navy-600'
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function Field({ label, unit, children }: { label: string; unit?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[length:calc(16px*var(--fs))] font-semibold text-navy-900">{label}</span>
      <span className="flex items-center gap-2">
        <span className="min-w-0 flex-1">{children}</span>
        {unit && <span className="shrink-0 text-[length:calc(16px*var(--fs))] text-ink-nav">{unit}</span>}
      </span>
    </label>
  )
}
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line-soft pt-5 first:border-t-0 first:pt-0">
      <h3 className="mb-4 text-[length:calc(18px*var(--fs))] font-bold text-navy-900">{title}</h3>
      {children}
    </section>
  )
}
const grid = 'grid grid-cols-1 gap-4 md:grid-cols-2'

/** Appointment scheduling rules (System Administrator only). Versioned and audited. */
export function SchedulingRulesPanel() {
  const { user } = useAuth()
  const [r, setR] = useState<SchedulingRules>(schedulingRules())
  const [reminders, setReminders] = useState(appointmentSettings().remindersOn)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [leave, setLeave] = useState({ staffId: '', from: '', to: '', reason: '' })
  if (!user) return null
  const staff = [...new Map([...eligibleStaff('residents.approve'), ...eligibleStaff('documents.release'), ...eligibleStaff('cases.manage'), ...eligibleStaff('borrowing.release'), ...mockUsers.filter((u) => u.roleId === 'chairman' && u.status === 'active')].map((u) => [u.id, u])).values()]
  const num = (k: keyof SchedulingRules) => (e: React.ChangeEvent<HTMLInputElement>) => setR({ ...r, [k]: Number(e.target.value) })
  const str = (k: keyof SchedulingRules) => (e: React.ChangeEvent<HTMLInputElement>) => setR({ ...r, [k]: e.target.value })
  const outside = bookedOutsideHours(r)
  const actuals = actualDurations()
  const save = () => {
    setMsg(null)
    try {
      const saved = saveSchedulingRules(r, user)
      saveAppointmentSettings({ remindersOn: reminders }, user)
      setR(saved)
      setMsg({ ok: true, text: `Saved. Version ${saved.version}.` })
    } catch (e) { setMsg({ ok: false, text: e instanceof ServiceError ? e.message : 'Not saved.' }) }
  }
  const staffName = (id: string) => mockUsers.find((u) => u.id === id)?.fullName ?? id

  return (
    <Panel className="mt-4" title="Appointment Scheduling">
      <div className="space-y-6">
        <Section title="Office Hours">
          <div className={grid}>
            <Field label="Opening Time"><input type="time" className={control} value={r.officeStart} onChange={str('officeStart')} /></Field>
            <Field label="Closing Time"><input type="time" className={control} value={r.officeEnd} onChange={str('officeEnd')} /></Field>
            <Field label="Break Starts"><input type="time" className={control} value={r.breakStart} onChange={str('breakStart')} /></Field>
            <Field label="Break Ends"><input type="time" className={control} value={r.breakEnd} onChange={str('breakEnd')} /></Field>
          </div>
          {outside > 0 && <p role="alert" className="mt-3 rounded-[var(--radius-control)] bg-warning-tint px-4 py-3 text-[length:calc(16px*var(--fs))] text-navy-900">{outside} booked {outside === 1 ? 'appointment is' : 'appointments are'} outside these hours. {outside === 1 ? 'It keeps its' : 'They keep their'} time until rescheduled.</p>}
        </Section>

        <Section title="Appointment Availability">
          <div className={grid}>
            <Field label="Appointment Interval" unit="minutes"><select className={control} value={r.stepMinutes} onChange={(e) => setR({ ...r, stepMinutes: Number(e.target.value) })}>{[5, 10, 15, 30].map((m) => <option key={m} value={m}>{m}</option>)}</select></Field>
            <Field label="Buffer Between Appointments" unit="minutes"><input type="number" min={0} max={60} className={control} value={r.bufferMinutes} onChange={num('bufferMinutes')} /></Field>
            <Field label="Maximum Simultaneous Appointments"><input type="number" min={1} max={20} className={control} value={r.maxConcurrent} onChange={num('maxConcurrent')} /></Field>
            <Field label="Maximum Appointments Per Day"><input type="number" min={1} className={control} value={r.maxPerDay} onChange={num('maxPerDay')} /></Field>
            <Field label="Earliest Booking From Now" unit="minutes"><input type="number" min={0} className={control} value={r.leadMinutes} onChange={num('leadMinutes')} /></Field>
          </div>
        </Section>

        <Section title="Attendance and Reminders">
          <div className={grid}>
            <Field label="No-Show Grace Period" unit="minutes"><input type="number" min={0} className={control} value={r.noShowGraceMinutes} onChange={num('noShowGraceMinutes')} /></Field>
            <label className="flex min-h-12 items-center gap-3 text-[length:calc(16px*var(--fs))] font-semibold text-navy-900">
              <input type="checkbox" className="size-5 accent-[#002132]" checked={reminders} onChange={(e) => setReminders(e.target.checked)} /> Enable Appointment Reminders
            </label>
          </div>
        </Section>

        <Section title="Service Durations">
          <ul className="divide-y divide-line-soft">
            {SERVICE_KEYS.map((k) => {
              const sv = r.services[k]
              const actual = actuals[k]
              const set = (patch: Partial<typeof sv>) => setR({ ...r, services: { ...r.services, [k]: { ...sv, ...patch } } })
              return (
                <li key={k} className="grid grid-cols-1 gap-2 py-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center md:gap-4">
                  <span className="min-w-0">
                    <span className="block text-[length:calc(16px*var(--fs))] font-semibold break-words text-navy-900">{sv.label}</span>
                    {actual && <span className="block text-[length:calc(15px*var(--fs))] text-ink-nav">Actual average: {actual.avg} min ({actual.count} {actual.count === 1 ? 'visit' : 'visits'})</span>}
                  </span>
                  <label className="flex items-center gap-2 text-[length:calc(16px*var(--fs))] text-navy-900">
                    <input aria-label={`${sv.label}, minutes`} type="number" min={5} max={240} className={small} value={sv.minutes} onChange={(e) => set({ minutes: Number(e.target.value) })} />
                    <span className="w-16">minutes</span>
                  </label>
                  <label className="flex items-center gap-2 text-[length:calc(16px*var(--fs))] text-navy-900">
                    <input aria-label={`${sv.label}, buffer`} type="number" min={0} max={60} className={small} value={sv.buffer} onChange={(e) => set({ buffer: Number(e.target.value) })} />
                    <span className="w-24">min buffer</span>
                  </label>
                </li>
              )
            })}
          </ul>
        </Section>

        <Section title="Workload Protection">
          <div className={grid}>
            <Field label="Appointments Per Person Per Day"><input type="number" min={1} className={control} value={r.staffDailyLimit} onChange={num('staffDailyLimit')} /></Field>
            <Field label="Longest Stretch Without a Break" unit="minutes"><input type="number" min={30} step={15} className={control} value={r.maxContinuousMinutes} onChange={num('maxContinuousMinutes')} /></Field>
          </div>
        </Section>

        <Section title="Time to Check Each Original Document">
          <ul className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
            {Object.entries(r.documentMinutes).map(([doc, m]) => (
              <li key={doc} className="flex items-center gap-3 border-b border-line-soft py-3">
                <span className="min-w-0 flex-1 text-[length:calc(16px*var(--fs))] break-words text-navy-900">{doc}</span>
                <input aria-label={`${doc}, minutes`} type="number" min={5} max={120} className={small} value={m} onChange={(e) => setR({ ...r, documentMinutes: { ...r.documentMinutes, [doc]: Number(e.target.value) } })} />
                <span className="w-16 shrink-0 text-[length:calc(16px*var(--fs))] text-ink-nav">minutes</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Barangay Personnel Leave">
          {r.leave.length > 0 && (
            <ul className="mb-4 divide-y divide-line-soft">
              {r.leave.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[length:calc(16px*var(--fs))] text-navy-900">
                  <span>{staffName(l.staffId)} · {l.from}{l.to !== l.from ? ` to ${l.to}` : ''} · {l.reason}</span>
                  <Button size="sm" variant="ghost" onClick={() => setR({ ...r, leave: r.leave.filter((x) => x.id !== l.id) })}>Remove</Button>
                </li>
              ))}
            </ul>
          )}
          <div className={grid}>
            <Field label="Barangay Personnel"><select className={control} value={leave.staffId} onChange={(e) => setLeave({ ...leave, staffId: e.target.value })}><option value="">Choose…</option>{staff.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}</select></Field>
            <Field label="Reason"><input className={control} value={leave.reason} onChange={(e) => setLeave({ ...leave, reason: e.target.value })} /></Field>
            <Field label="From"><input type="date" className={control} value={leave.from} onChange={(e) => setLeave({ ...leave, from: e.target.value, to: leave.to || e.target.value })} /></Field>
            <Field label="To"><input type="date" className={control} value={leave.to} onChange={(e) => setLeave({ ...leave, to: e.target.value })} /></Field>
          </div>
          <Button className="mt-3" size="sm" variant="secondary" blockedReason={!leave.staffId ? 'Please choose the member of the Barangay Personnel.' : !leave.from ? 'Please choose the first day of leave.' : leave.reason.trim().length < 3 ? 'Please type the reason for the leave.' : ''} onClick={() => { setR({ ...r, leave: [...r.leave, { ...leave, id: `lv-${Date.now().toString(36)}` }] }); setLeave({ staffId: '', from: '', to: '', reason: '' }) }}>Add Leave</Button>
        </Section>

        <details className="group border-t border-line-soft pt-5">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-[length:calc(18px*var(--fs))] font-bold text-navy-900">
            Advanced Settings <span aria-hidden className="text-ink-nav transition-transform group-open:rotate-180">⌄</span>
          </summary>
          <div className="mt-4 space-y-6">
            <div>
              <h4 className="mb-3 text-[length:calc(16.5px*var(--fs))] font-semibold text-navy-900">Several Documents in One Visit</h4>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Field label="Extra Per Document" unit="minutes"><input type="number" min={0} className={control} value={r.extraDocumentMinutes} onChange={num('extraDocumentMinutes')} /></Field>
                <Field label="Shortest Visit" unit="minutes"><input type="number" min={5} className={control} value={r.multiDocumentMin} onChange={num('multiDocumentMin')} /></Field>
                <Field label="Longest Visit" unit="minutes"><input type="number" min={5} className={control} value={r.multiDocumentMax} onChange={num('multiDocumentMax')} /></Field>
              </div>
            </div>
            <div>
              <h4 className="mb-3 text-[length:calc(16.5px*var(--fs))] font-semibold text-navy-900">Service Details</h4>
              <ul className="divide-y divide-line-soft">
                {SERVICE_KEYS.map((k) => {
                  const sv = r.services[k]
                  const set = (patch: Partial<typeof sv>) => setR({ ...r, services: { ...r.services, [k]: { ...sv, ...patch } } })
                  return (
                    <li key={k} className="space-y-2 py-3">
                      <p className="text-[length:calc(16px*var(--fs))] font-semibold text-navy-900">{sv.label} <span className="font-normal text-ink-nav">· {sv.roles.length ? sv.roles.map((x) => ROLES[x]?.name ?? x).join(', ') : 'Assigned per case'}</span></p>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <Field label="Start Times Every" unit="minutes"><select className={control} value={sv.step} onChange={(e) => set({ step: Number(e.target.value) })}>{[5, 10, 15, 30, 60].map((m) => <option key={m} value={m}>{m}</option>)}</select></Field>
                        <Field label="Per Person Per Day"><input type="number" min={0} className={control} value={sv.maxPerDay} onChange={(e) => set({ maxPerDay: Number(e.target.value) })} /></Field>
                        <Field label="Changes Allowed Until" unit="hours before"><input type="number" min={0} className={control} value={sv.cancelHours} onChange={(e) => set({ cancelHours: Number(e.target.value) })} /></Field>
                      </div>
                      <div className="flex flex-wrap gap-x-5">
                        {(Object.keys(REMINDER_LABEL) as ReminderKey[]).map((rk) => (
                          <label key={rk} className="flex min-h-11 items-center gap-2 text-[length:calc(16px*var(--fs))] text-navy-900">
                            <input type="checkbox" className="size-5 accent-[#002132]" checked={sv.reminders.includes(rk)} onChange={(e) => set({ reminders: e.target.checked ? [...sv.reminders, rk] : sv.reminders.filter((x) => x !== rk) })} /> {REMINDER_LABEL[rk]}
                          </label>
                        ))}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
            <div>
              <h4 className="mb-3 text-[length:calc(16.5px*var(--fs))] font-semibold text-navy-900">Barangay Personnel Working Hours</h4>
              <ul className="divide-y divide-line-soft">
                {staff.map((u) => {
                  const s = r.staff[u.id]
                  const set = (next?: typeof s) => { const copy = { ...r.staff }; if (next) copy[u.id] = next; else delete copy[u.id]; setR({ ...r, staff: copy }) }
                  return (
                    <li key={u.id} className="space-y-2 py-3">
                      <label className="flex min-h-11 flex-wrap items-center justify-between gap-2 text-[length:calc(16px*var(--fs))] text-navy-900">
                        <span className="font-semibold">{u.fullName}</span>
                        <span className="flex items-center gap-2"><input type="checkbox" className="size-5 accent-[#002132]" checked={!!s} onChange={(e) => set(e.target.checked ? { days: [1, 2, 3, 4, 5], start: r.officeStart, end: r.officeEnd } : undefined)} /> Own schedule</span>
                      </label>
                      {s && (
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                          {DAYS.map((d, i) => <label key={d} className="flex min-h-11 items-center gap-1.5 text-[length:calc(16px*var(--fs))]"><input type="checkbox" className="size-5 accent-[#002132]" checked={s.days.includes(i)} onChange={(e) => set({ ...s, days: e.target.checked ? [...s.days, i] : s.days.filter((x) => x !== i) })} />{d}</label>)}
                          <input aria-label={`${u.fullName} starts`} type="time" className="h-12 w-36 shrink-0 rounded-[var(--radius-control)] border border-line bg-surface px-3 text-[length:calc(16px*var(--fs))] text-navy-900" value={s.start} onChange={(e) => set({ ...s, start: e.target.value })} />
                          <input aria-label={`${u.fullName} ends`} type="time" className="h-12 w-36 shrink-0 rounded-[var(--radius-control)] border border-line bg-surface px-3 text-[length:calc(16px*var(--fs))] text-navy-900" value={s.end} onChange={(e) => set({ ...s, end: e.target.value })} />
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setR({ ...DEFAULT_RULES, version: r.version, leave: r.leave })}>Reset to Starting Values</Button>
          </div>
        </details>

        {msg && <p role={msg.ok ? 'status' : 'alert'} className={`rounded-[var(--radius-control)] px-4 py-3 text-[length:calc(16px*var(--fs))] ${msg.ok ? 'bg-success-tint text-navy-900' : 'bg-danger-tint text-danger-ink'}`}>{msg.text}</p>}
        <div className="flex flex-wrap items-center gap-3 border-t border-line-soft pt-5">
          <Button onClick={save}>Save Changes</Button>
          {r.updatedAt && <span className="text-[length:calc(16px*var(--fs))] text-ink-nav">Last saved {formatDateTime(r.updatedAt)} by {staffName(r.updatedBy ?? '')}</span>}
        </div>
      </div>
    </Panel>
  )
}
