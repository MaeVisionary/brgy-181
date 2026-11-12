import { useState } from 'react'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/ui/Button'
import { Panel } from '@/components/ui/Panel'
import { CLASSIFICATION_LABEL, CLASSIFICATION_MAX } from '@/config/serviceStandards'
import { DOCUMENT_TYPES } from '@/documents/catalog'
import { ServiceError } from '@/services/mockApi'
import { allowedDays, holidays, setHolidays, standardFor, updateStandard } from '@/services/serviceStandardService'
import type { DocumentTypeId } from '@/types/document'

const input = 'h-10 rounded-[var(--radius-control)] border border-line bg-surface px-2.5 text-[length:calc(15px*var(--fs))] text-navy-900'

/** Citizen's Charter processing times per service, and the office holiday list (administrators only). */
export function ServiceStandardsPanel() {
  const { user } = useAuth()
  const [tick, setTick] = useState(0)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [hol, setHol] = useState(holidays())
  const [newHol, setNewHol] = useState({ date: '', name: '' })
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
  const saveHol = async (list: typeof hol) => {
    await setHolidays(list, user!)
    setHol(holidays())
  }
  const timed = DOCUMENT_TYPES.filter((d) => standardFor(d.id).classification)
  return (
    <>
      <Panel className="mt-4" title="Processing times" bodyClassName="px-0 py-0" key={tick}>
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
                <label className="flex items-center gap-2 text-[length:calc(14px*var(--fs))] text-ink-nav">
                  Charter days
                  <input type="number" min={1} max={CLASSIFICATION_MAX[s.classification!]} defaultValue={s.charterDays ?? ''} className={`${input} w-20`} onBlur={(e) => { if ((e.target.value || undefined) !== (s.charterDays ? String(s.charterDays) : undefined)) save(d.id, e.target.value) }} />
                </label>
              </li>
            )
          })}
        </ul>
      </Panel>
      <Panel className="mt-4" title="Office holidays" bodyClassName="px-0 py-0">
        <ul className="divide-y divide-line-soft">
          {hol.map((h) => (
            <li key={h.date} className="flex items-center justify-between gap-3 px-5 py-2.5 text-[length:calc(15px*var(--fs))]">
              <span className="min-w-0"><span className="tabular-nums text-ink-nav">{h.date}</span> · <span className="text-navy-900">{h.name}</span></span>
              <button type="button" className="text-[length:calc(14px*var(--fs))] font-semibold text-danger-ink hover:underline" onClick={() => { if (confirm(`Remove ${h.name}?`)) saveHol(hol.filter((x) => x.date !== h.date)) }}>Remove</button>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-2 border-t border-line-soft px-5 py-3">
          <input type="date" className={input} value={newHol.date} onChange={(e) => setNewHol((n) => ({ ...n, date: e.target.value }))} aria-label="Holiday date" />
          <input className={`${input} min-w-0 flex-1`} placeholder="Holiday name" value={newHol.name} onChange={(e) => setNewHol((n) => ({ ...n, name: e.target.value }))} />
          <Button size="sm" disabled={!newHol.date || !newHol.name.trim() || hol.some((h) => h.date === newHol.date)} onClick={() => { saveHol([...hol, { date: newHol.date, name: newHol.name.trim() }]); setNewHol({ date: '', name: '' }) }}>Add</Button>
        </div>
      </Panel>
    </>
  )
}
