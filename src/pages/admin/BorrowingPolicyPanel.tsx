import { useState } from 'react'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/ui/Button'
import { Panel } from '@/components/ui/Panel'
import { ServiceError } from '@/services/mockApi'
import { borrowingPolicy, saveBorrowingPolicy, type BorrowingPolicy } from '@/services/equipmentService'

const control = 'h-12 w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 text-[length:calc(16px*var(--fs))] text-navy-900'

/** Equipment borrowing rules (System Administrator only, audited). */
export function BorrowingPolicyPanel() {
  const { user } = useAuth()
  const [p, setP] = useState<BorrowingPolicy>(borrowingPolicy())
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  if (!user) return null
  const num = (k: keyof BorrowingPolicy) => (e: React.ChangeEvent<HTMLInputElement>) => setP({ ...p, [k]: Number(e.target.value) })
  const field = (label: string, el: React.ReactNode, unit?: string) => (
    <label className="block">
      <span className="mb-1.5 block text-[length:calc(16px*var(--fs))] font-semibold text-navy-900">{label}</span>
      <span className="flex items-center gap-2"><span className="min-w-0 flex-1">{el}</span>{unit && <span className="shrink-0 text-[length:calc(16px*var(--fs))] text-ink-nav">{unit}</span>}</span>
    </label>
  )
  return (
    <Panel className="mt-4" title="Equipment Borrowing Rules">
      <div className="space-y-5">
        {!p.confirmed && <p role="alert" className="rounded-[var(--radius-control)] bg-warning-tint px-4 py-3 text-[length:calc(16px*var(--fs))] text-navy-900">Not yet confirmed by the barangay. Current values come from the system study.</p>}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {field('Borrowing Period', <input type="number" min={1} max={60} className={control} value={p.periodDays} onChange={num('periodDays')} />, 'days')}
          {field('Grace Period', <input type="number" min={0} max={30} className={control} value={p.graceDays} onChange={num('graceDays')} />, 'days')}
          {field('Return Time on the Due Date', <input type="time" className={control} value={p.returnTime} onChange={(e) => setP({ ...p, returnTime: e.target.value })} />)}
          {field('Review and Preparation', <input type="number" min={0} max={10} className={control} value={p.processingDays} onChange={num('processingDays')} />, 'working days')}
          {field('Repeat Overdue Notice Every', <input type="number" min={1} className={control} value={p.overdueRepeatDays} onChange={num('overdueRepeatDays')} />, 'days')}
          <fieldset>
            <legend className="mb-1.5 text-[length:calc(16px*var(--fs))] font-semibold text-navy-900">Return Reminders</legend>
            <div className="flex flex-wrap gap-x-5">
              {[72, 48, 24].map((h) => (
                <label key={h} className="flex min-h-12 items-center gap-2 text-[length:calc(16px*var(--fs))] text-navy-900">
                  <input type="checkbox" className="size-5 accent-[#002132]" checked={p.reminderHours.includes(h)} onChange={(e) => setP({ ...p, reminderHours: e.target.checked ? [...p.reminderHours, h] : p.reminderHours.filter((x) => x !== h) })} /> {h / 24} {h === 24 ? 'day' : 'days'} before
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <label className="flex min-h-12 items-center gap-3 text-[length:calc(16px*var(--fs))] font-semibold text-navy-900">
          <input type="checkbox" className="size-5 accent-[#002132]" checked={p.confirmed} onChange={(e) => setP({ ...p, confirmed: e.target.checked })} /> Confirmed by the barangay
        </label>
        {msg && <p role={msg.ok ? 'status' : 'alert'} className={`rounded-[var(--radius-control)] px-4 py-3 text-[length:calc(16px*var(--fs))] ${msg.ok ? 'bg-success-tint text-navy-900' : 'bg-danger-tint text-danger-ink'}`}>{msg.text}</p>}
        <Button onClick={() => { setMsg(null); try { saveBorrowingPolicy(p, user); setMsg({ ok: true, text: 'Saved. Applies to new releases; current deadlines stay.' }) } catch (e) { setMsg({ ok: false, text: e instanceof ServiceError ? e.message : 'Not saved.' }) } }}>Save Changes</Button>
      </div>
    </Panel>
  )
}
