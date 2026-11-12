import { useState } from 'react'
import { useAuth } from '@/auth/useAuth'
import { Panel } from '@/components/ui/Panel'
import { CLASSIFICATION_LABEL, CLASSIFICATION_MAX } from '@/config/serviceStandards'
import { DOCUMENT_TYPES } from '@/documents/catalog'
import { ServiceError } from '@/services/mockApi'
import { allowedDays, standardFor, updateStandard } from '@/services/serviceStandardService'
import { PROCESSING_LIMITS, dailyCapacity, hasProcessing, isDefaultHours, officeHoursPerDay, processingHours, setDailyCapacity, setProcessingHours } from '@/services/processingService'
import { Link } from 'react-router-dom'
import type { DocumentTypeId } from '@/types/document'

const input = 'h-11 rounded-[var(--radius-control)] border border-line bg-surface px-2.5 text-[length:calc(15px*var(--fs))] text-navy-900'

/** Citizen's Charter processing times per service (administrators only). Holidays live in the Barangay Calendar. */
export function ServiceStandardsPanel() {
  const { user } = useAuth()
  const [tick, setTick] = useState(0)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const save = async (id: DocumentTypeId, days: string) => {
    setMsg(null)
    try {
      await updateStandard(id, { charterDays: days ? Number(days) : undefined }, user!)
      setTick((t) => t + 1)
      setMsg({ ok: true, text: 'Saved.' })
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ServiceError ? e.message : 'Not saved.' })
    }
  }
  const run = async (fn: () => Promise<unknown>, done: string) => {
    setMsg(null)
    try { await fn(); setTick((t) => t + 1); setMsg({ ok: true, text: done }) } catch (e) { setMsg({ ok: false, text: e instanceof ServiceError ? e.message : 'Not saved.' }) }
  }
  const timed = DOCUMENT_TYPES.filter((d) => standardFor(d.id).classification)
  return (
    <>
      <Panel className="mt-4" title="Processing times" bodyClassName="px-0 py-0" key={tick}>
        <div id="proc-help" className="space-y-2 border-b border-line-soft px-5 py-3 text-[length:calc(15px*var(--fs))] text-navy-900">
          <p>Preparation time is counted in office hours ({officeHoursPerDay()} per working day), from {PROCESSING_LIMITS.minHours} to {PROCESSING_LIMITS.maxHours} hours, and skips weekends, holidays, closures and days when everyone who prepares documents is on leave. Set each one from actual barangay operations. Residents see the resulting ready time and can only book pickup after it. Charter days remain the legal maximum.</p>
          <label className="flex flex-wrap items-center gap-2 text-ink-nav">
            Requests the office can prepare per working day
            <input type="number" min={1} max={500} step={1} defaultValue={dailyCapacity()} className={`${input} w-24`}
              onBlur={(e) => { const v = Number(e.target.value); if (v !== dailyCapacity()) run(() => setDailyCapacity(v, user!), `Capacity: ${v} requests per day.`) }} />
          </label>
        </div>
        {msg && <p role="status" className={`mx-5 mt-3 rounded-md px-3 py-2 text-[length:calc(14.5px*var(--fs))] ${msg.ok ? 'bg-success-tint text-navy-900' : 'bg-danger-tint text-danger-ink'}`}>{msg.text}</p>}
        <ul className="divide-y divide-line-soft">
          {timed.map((d) => {
            const s = standardFor(d.id)
            const a = allowedDays(s)!
            return (
              <li key={d.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="min-w-0 flex-1 basis-[220px]">
                  <span className="block font-semibold text-navy-900">{d.name}</span>
                  <span className="block text-[length:calc(14px*var(--fs))] text-ink-muted">{CLASSIFICATION_LABEL[s.classification!]} · {a.fromCharter ? `${a.days} working days (Citizen's Charter)` : `up to ${a.days} working days (RA 11032)`}</span>
                </span>
                {hasProcessing(d.id) && (
                  <label className="flex items-center gap-2 text-[length:calc(14.5px*var(--fs))] text-ink-nav">
                    Preparation (office hours)
                    <input type="number" min={PROCESSING_LIMITS.minHours} max={PROCESSING_LIMITS.maxHours} step={1} defaultValue={processingHours(d.id)} aria-describedby="proc-help" className={`${input} w-20`}
                      onBlur={(e) => { const v = Number(e.target.value); if (v !== processingHours(d.id)) run(() => setProcessingHours(d.id, v, user!), `${d.name}: ${v} office hours.`) }} />
                    {isDefaultHours(d.id) && <span className="text-[length:calc(13.5px*var(--fs))]">(initial estimate)</span>}
                  </label>
                )}
                <label className="flex items-center gap-2 text-[length:calc(14.5px*var(--fs))] text-ink-nav">
                  Charter days
                  <input type="number" min={1} max={CLASSIFICATION_MAX[s.classification!]} defaultValue={s.charterDays ?? ''} className={`${input} w-20`} onBlur={(e) => { if ((e.target.value || undefined) !== (s.charterDays ? String(s.charterDays) : undefined)) save(d.id, e.target.value) }} />
                </label>
              </li>
            )
          })}
        </ul>
      </Panel>
      <Panel className="mt-4" title="Holidays">
        <p className="text-[length:calc(16px*var(--fs))] text-navy-900">Holidays and office closures are kept in one place. <Link to="/calendar" className="font-semibold text-info hover:underline">Open the Barangay Calendar</Link></p>
      </Panel>
    </>
  )
}
