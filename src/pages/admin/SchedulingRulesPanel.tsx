import { useState } from 'react'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/ui/Button'
import { Panel } from '@/components/ui/Panel'
import { APPOINTMENT_TYPES, appointmentSettings, saveAppointmentSettings, type AppointmentKind } from '@/services/appointmentService'
import { ServiceError } from '@/services/mockApi'
import { DEFAULT_RULES, eligibleStaff, saveSchedulingRules, schedulingRules, type SchedulingRules } from '@/services/schedulingService'
import { formatDateTime } from '@/lib/format'
import { mockUsers } from '@/mocks/users'

const input = 'h-11 w-full rounded-[var(--radius-control)] border border-line bg-surface px-2.5 text-[length:calc(15.5px*var(--fs))] text-navy-900'
const label = 'block text-[length:calc(14.5px*var(--fs))] font-semibold text-ink-nav'
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * Scheduling rules (System Administrator only): office hours, buffers, limits,
 * how long each service takes, staff hours and leave. Every save is versioned
 * and written to the audit log. Holidays are under Processing times.
 */
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
  const save = () => {
    setMsg(null)
    try {
      const saved = saveSchedulingRules(r, user)
      saveAppointmentSettings({ remindersOn: reminders }, user)
      setR(saved)
      setMsg({ ok: true, text: `Saved (version ${saved.version}). New bookings use these rules; booked appointments keep their times.` })
    } catch (e) { setMsg({ ok: false, text: e instanceof ServiceError ? e.message : 'Not saved.' }) }
  }
  const field = (l: string, el: React.ReactNode) => <label className="space-y-1"><span className={label}>{l}</span>{el}</label>
  return (
    <Panel className="mt-4" title="Appointment scheduling rules">
      <div className="space-y-6">
        {msg && <p role="status" className={`rounded-md px-3 py-2 text-[length:calc(15px*var(--fs))] ${msg.ok ? 'bg-success-tint text-navy-900' : 'bg-danger-tint text-danger-ink'}`}>{msg.text}</p>}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {field('Office opens', <input type="time" className={input} value={r.officeStart} onChange={str('officeStart')} />)}
          {field('Office closes', <input type="time" className={input} value={r.officeEnd} onChange={str('officeEnd')} />)}
          {field('Break starts', <input type="time" className={input} value={r.breakStart} onChange={str('breakStart')} />)}
          {field('Break ends', <input type="time" className={input} value={r.breakEnd} onChange={str('breakEnd')} />)}
          {field('Start times every (min)', <select className={input} value={r.stepMinutes} onChange={(e) => setR({ ...r, stepMinutes: Number(e.target.value) })}>{[5, 10, 15, 30].map((m) => <option key={m}>{m}</option>)}</select>)}
          {field('Buffer after each (min)', <input type="number" min={0} max={60} className={input} value={r.bufferMinutes} onChange={num('bufferMinutes')} />)}
          {field('At the same time (max)', <input type="number" min={1} max={20} className={input} value={r.maxConcurrent} onChange={num('maxConcurrent')} />)}
          {field('Per day (max)', <input type="number" min={1} className={input} value={r.maxPerDay} onChange={num('maxPerDay')} />)}
          {field('Earliest booking from now (min)', <input type="number" min={0} className={input} value={r.leadMinutes} onChange={num('leadMinutes')} />)}
          {field('No-show after (min past end)', <input type="number" min={0} className={input} value={r.noShowGraceMinutes} onChange={num('noShowGraceMinutes')} />)}
          {field('Reminders (hours before)', <input className={input} value={r.reminderHours.join(', ')} onChange={(e) => setR({ ...r, reminderHours: e.target.value.split(',').map((x) => Number(x.trim())).filter((x) => x > 0) })} />)}
          <label className="flex items-end gap-2 pb-2.5 text-[length:calc(15.5px*var(--fs))] text-navy-900"><input type="checkbox" className="size-5 accent-[#002132]" checked={reminders} onChange={(e) => setReminders(e.target.checked)} /> Send reminders</label>
        </section>

        <section>
          <h3 className="mb-2 text-[length:calc(16.5px*var(--fs))] font-semibold text-navy-900">How long each check takes (minutes)</h3>
          <p className="mb-2 text-[length:calc(14.5px*var(--fs))] text-ink-muted">Starting estimates, not legal processing times. Several items in one visit: the longest, plus the extra time for each other item, kept between the floor and the cap.</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {Object.entries(r.documentMinutes).map(([doc, m]) => (
              <label key={doc} className="flex items-center justify-between gap-3 rounded-md border border-line-soft px-3 py-1.5 text-[length:calc(15px*var(--fs))] text-navy-900">
                <span className="min-w-0">{doc}</span>
                <input type="number" min={5} max={120} className={`${input} w-24 shrink-0`} value={m} onChange={(e) => setR({ ...r, documentMinutes: { ...r.documentMinutes, [doc]: Number(e.target.value) } })} />
              </label>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {field('Extra per item', <input type="number" min={0} className={input} value={r.extraDocumentMinutes} onChange={num('extraDocumentMinutes')} />)}
            {field('Several items: floor', <input type="number" min={5} className={input} value={r.multiDocumentMin} onChange={num('multiDocumentMin')} />)}
            {field('Several items: cap', <input type="number" min={5} className={input} value={r.multiDocumentMax} onChange={num('multiDocumentMax')} />)}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-[length:calc(16.5px*var(--fs))] font-semibold text-navy-900">Service length (minutes)</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {Object.entries(r.typeMinutes).map(([k, m]) => field(k === 'hearing' ? 'Hearing (Chairman time)' : APPOINTMENT_TYPES[k as AppointmentKind]?.label ?? k,
              <input type="number" min={5} max={240} className={input} value={m} onChange={(e) => setR({ ...r, typeMinutes: { ...r.typeMinutes, [k]: Number(e.target.value) } })} />))}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-[length:calc(16.5px*var(--fs))] font-semibold text-navy-900">Staff hours</h3>
          <ul className="divide-y divide-line-soft rounded-md border border-line-soft">
            {staff.map((u) => {
              const s = r.staff[u.id]
              const set = (next: typeof s | undefined) => { const copy = { ...r.staff }; if (next) copy[u.id] = next; else delete copy[u.id]; setR({ ...r, staff: copy }) }
              return (
                <li key={u.id} className="space-y-2 px-3 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[length:calc(15.5px*var(--fs))] font-semibold text-navy-900">{u.fullName} <span className="font-normal text-ink-muted">· {u.position}</span></span>
                    <label className="flex items-center gap-2 text-[length:calc(14.5px*var(--fs))] text-navy-900"><input type="checkbox" className="size-5 accent-[#002132]" checked={!!s} onChange={(e) => set(e.target.checked ? { days: [1, 2, 3, 4, 5], start: r.officeStart, end: r.officeEnd } : undefined)} /> Own schedule</label>
                  </div>
                  {s ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {DAYS.map((d, i) => <label key={d} className="flex items-center gap-1 text-[length:calc(14.5px*var(--fs))]"><input type="checkbox" className="size-4 accent-[#002132]" checked={s.days.includes(i)} onChange={(e) => set({ ...s, days: e.target.checked ? [...s.days, i] : s.days.filter((x) => x !== i) })} />{d}</label>)}
                      <input aria-label="Starts" type="time" className={`${input} w-32`} value={s.start} onChange={(e) => set({ ...s, start: e.target.value })} />
                      <input aria-label="Ends" type="time" className={`${input} w-32`} value={s.end} onChange={(e) => set({ ...s, end: e.target.value })} />
                    </div>
                  ) : <p className="text-[length:calc(14px*var(--fs))] text-ink-muted">Follows office hours on working days.</p>}
                </li>
              )
            })}
          </ul>
        </section>

        <section>
          <h3 className="mb-2 text-[length:calc(16.5px*var(--fs))] font-semibold text-navy-900">Leave and unavailable days</h3>
          {r.leave.length > 0 && (
            <ul className="mb-3 divide-y divide-line-soft rounded-md border border-line-soft">
              {r.leave.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[length:calc(15px*var(--fs))] text-navy-900">
                  <span>{mockUsers.find((u) => u.id === l.staffId)?.fullName} · {l.from}{l.to !== l.from ? ` to ${l.to}` : ''} · {l.reason}</span>
                  <Button size="sm" variant="ghost" onClick={() => setR({ ...r, leave: r.leave.filter((x) => x.id !== l.id) })}>Remove</Button>
                </li>
              ))}
            </ul>
          )}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1.2fr_1fr_1fr_1.4fr_auto]">
            <select aria-label="Staff" className={input} value={leave.staffId} onChange={(e) => setLeave({ ...leave, staffId: e.target.value })}><option value="">Staff…</option>{staff.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}</select>
            <input aria-label="From" type="date" className={input} value={leave.from} onChange={(e) => setLeave({ ...leave, from: e.target.value, to: leave.to || e.target.value })} />
            <input aria-label="To" type="date" className={input} value={leave.to} onChange={(e) => setLeave({ ...leave, to: e.target.value })} />
            <input aria-label="Reason" placeholder="Reason" className={input} value={leave.reason} onChange={(e) => setLeave({ ...leave, reason: e.target.value })} />
            <Button size="sm" variant="secondary" disabled={!leave.staffId || !leave.from || leave.reason.trim().length < 3} onClick={() => { setR({ ...r, leave: [...r.leave, { ...leave, id: `lv-${Date.now().toString(36)}` }] }); setLeave({ staffId: '', from: '', to: '', reason: '' }) }}>Add</Button>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={save}>Save rules</Button>
          <Button variant="ghost" onClick={() => setR({ ...DEFAULT_RULES, version: r.version })}>Reset to starting values</Button>
          {r.updatedAt && <span className="text-[length:calc(14px*var(--fs))] text-ink-muted">Version {r.version} · {formatDateTime(r.updatedAt)} · {mockUsers.find((u) => u.id === r.updatedBy)?.fullName}</span>}
        </div>
      </div>
    </Panel>
  )
}
