import { Check, Printer } from '@/icons'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { StatusBadge } from '@/components/documents/DocParts'
import { Button } from '@/components/ui/Button'
import { Select, TextInput } from '@/components/ui/Field'
import { Panel } from '@/components/ui/Panel'
import { getDocumentType } from '@/documents/catalog'
import { useDocActor } from '@/hooks/useDocActor'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/format'
import { setAvailability } from '@/services/caseService'
import { prepareHearingDocuments, recordAcknowledgment, recordDelivery } from '@/services/documentService'
import { ServiceError } from '@/services/mockApi'
import type { Availability, AvailabilityWho, Hearing, KPCase } from '@/types/case'
import type { DocumentRequest } from '@/types/document'
import { ActionStack } from '@/components/ui/ActionStack'

const today = () => new Date().toISOString().slice(0, 10)

const WHO: [AvailabilityWho, string][] = [
  ['complainant', 'Complainant'],
  ['respondent', 'Respondent'],
  ['chairman', 'Barangay Chairman'],
]
const AV_LABEL: Record<Availability, string> = { unconfirmed: 'Not yet confirmed', confirmed: 'Confirmed', unavailable: 'Not available' }

/** Who confirmed they can attend a scheduled hearing. */
export function AvailabilityRow({ caseId, h, manage, onChange }: { caseId: string; h: Hearing; manage: boolean; onChange: (c: KPCase) => void }) {
  const actor = useDocActor()!
  const av = h.availability ?? { complainant: 'unconfirmed', respondent: 'unconfirmed', chairman: 'unconfirmed' }
  const clash = Object.values(av).includes('unavailable')
  return (
    <div className={cn('mt-2 rounded-md border px-3 py-2', clash ? 'border-warning/60 bg-warning-tint/50' : 'border-line')}>
      <p className="label-caps mb-1.5">Availability for this schedule</p>
      <div className="space-y-1.5">
        {WHO.map(([who, label]) => (
          <label key={who} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[length:calc(14.5px*var(--fs))] text-navy-900">
            <span className="font-semibold">{label}</span>
            {manage ? (
              <Select className="w-full sm:w-52" value={av[who]} onChange={async (e) => onChange(await setAvailability(caseId, h.id, who, e.target.value as Availability, actor))}>
                {(Object.keys(AV_LABEL) as Availability[]).map((k) => <option key={k} value={k}>{AV_LABEL[k]}</option>)}
              </Select>
            ) : (
              <span className={av[who] === 'unavailable' ? 'text-danger-ink' : av[who] === 'confirmed' ? 'text-success' : 'text-ink-muted'}>{AV_LABEL[av[who]]}</span>
            )}
          </label>
        ))}
      </div>
      {clash && <p className="mt-1.5 text-[length:calc(14px*var(--fs))] text-warning">Someone cannot attend. Consider rescheduling.</p>}
    </div>
  )
}

/** Summons and notices (generated → delivered → acknowledged) plus outcome records. */
export function CaseDocuments({ c, docs, onPrepared }: { c: KPCase; docs: DocumentRequest[]; onPrepared?: () => void }) {
  const actor = useDocActor()!
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const next = c.hearings.filter((h) => h.status === 'scheduled').sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0]
  const prepared = next && docs.some((d) => d.hearingId === next.id && !['cancelled', 'rejected'].includes(d.status))
  const prepare = async () => {
    setMsg(null)
    try {
      const made = await prepareHearingDocuments(c, next!, actor)
      setMsg({ ok: true, text: `Prepared ${made.map((d) => d.referenceNo).join(' and ')}. Submit each for approval from its record.` })
      onPrepared?.()
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ServiceError ? e.message : 'Something went wrong.' })
    }
  }
  const held = c.hearings.some((h) => h.status === 'held')
  const outcomeDocs: { kind: string; label: string; show: boolean }[] = [
    { kind: 'mediation', label: 'Mediation record', show: held },
    { kind: 'settlement', label: 'Amicable Settlement', show: c.outcome?.type === 'settled' },
    { kind: 'cfa', label: 'Certificate to File Action', show: c.outcome?.type === 'not_settled' },
  ]
  return (
    <Panel title="Case documents" bodyClassName="px-0 py-0">
      {next && actor.permissions.has('cases.manage') && !prepared && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft bg-sky-50 px-5 py-3">
          <p className="text-[length:calc(15px*var(--fs))] text-navy-900">Hearing on {formatDate(next.scheduledAt)}: summons for the respondent and notice of hearing for the complainant.</p>
          <Button size="sm" onClick={prepare}>Prepare summons and notice</Button>
        </div>
      )}
      {msg && <p role="status" className={cn('border-b border-line-soft px-5 py-2.5 text-[length:calc(14.5px*var(--fs))]', msg.ok ? 'bg-success-tint text-navy-900' : 'bg-danger-tint text-danger-ink')}>{msg.text}</p>}
      {docs.length === 0 ? (
        <p className="px-5 py-4 text-[length:calc(15px*var(--fs))] text-ink-muted">No summons or notice yet.</p>
      ) : (
        <ul>{docs.map((d) => <ServedDoc key={d.id} d={d} />)}</ul>
      )}
      <div className="border-t border-line-soft px-5 py-3">
        <p className="label-caps mb-1.5">Outcome records</p>
        {outcomeDocs.some((o) => o.show) ? (
          <div className="flex flex-wrap gap-2">
            {outcomeDocs.filter((o) => o.show).map((o) => (
              <Link key={o.kind} to={`/cases/${c.id}/print/${o.kind}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-control)] border border-line px-3.5 text-[length:calc(15px*var(--fs))] font-semibold text-navy-900 hover:bg-surface-muted">
                <Printer className="size-4" /> {o.label}
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-[length:calc(14.5px*var(--fs))] text-ink-muted">None yet.</p>
        )}
      </div>
    </Panel>
  )
}

function ServedDoc({ d: initial }: { d: DocumentRequest }) {
  const actor = useDocActor()!
  const [d, setD] = useState(initial)
  const [mode, setMode] = useState<'none' | 'deliver' | 'ack'>('none')
  const [who, setWho] = useState('')
  const [method, setMethod] = useState('Personal service')
  const [on, setOn] = useState(today())
  const [error, setError] = useState<string | null>(null)
  const served = ['summon', 'notice-of-hearing'].includes(d.typeId)
  const generated = ['approved', 'served'].includes(d.status)
  const can = actor.permissions.has('documents.release') || actor.permissions.has('cases.manage')

  const save = async () => {
    setError(null)
    try {
      const r = mode === 'deliver' ? await recordDelivery(d.id, { deliveredTo: who, method, on }, actor) : await recordAcknowledgment(d.id, { receivedBy: who, on }, actor)
      setD({ ...r, history: [...r.history] })
      setMode('none')
      setWho('')
    } catch (e) {
      setError(e instanceof ServiceError ? e.message : 'Something went wrong.')
    }
  }

  const Step = ({ ok, label, sub }: { ok: boolean; label: string; sub?: string }) => (
    <li className={cn('flex items-start gap-1.5 text-[length:calc(14px*var(--fs))]', ok ? 'text-navy-900' : 'text-ink-muted')}>
      <span className={cn('mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border', ok ? 'border-success bg-success text-white' : 'border-line')}>{ok && <Check className="size-3" strokeWidth={3} />}</span>
      <span>{label}{sub && <span className="block text-[length:calc(13px*var(--fs))] text-ink-muted">{sub}</span>}</span>
    </li>
  )

  return (
    <li className="border-b border-line-soft px-5 py-3 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to={`/documents/${d.id}`} className="text-[length:calc(15.5px*var(--fs))] font-semibold text-navy-900 hover:underline">{getDocumentType(d.typeId).name} · {d.referenceNo}</Link>
        <StatusBadge status={d.status} typeId={d.typeId} />
      </div>
      {served && (
        <>
          <ol className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Step ok={generated} label="Generated and signed" />
            <Step ok={!!d.delivery} label="Delivered" sub={d.delivery && `${d.delivery.deliveredTo} · ${d.delivery.method} · ${formatDate(d.delivery.on)}`} />
            <Step ok={!!d.acknowledgment} label="Receipt acknowledged" sub={d.acknowledgment && `${d.acknowledgment.receivedBy} · ${formatDate(d.acknowledgment.on)}`} />
          </ol>
          {can && generated && mode === 'none' && (
            <ActionStack className="mt-2">
              {!d.delivery && <Button size="sm" variant="secondary" onClick={() => setMode('deliver')}>Record delivery</Button>}
              {d.delivery && !d.acknowledgment && <Button size="sm" variant="secondary" onClick={() => setMode('ack')}>Record acknowledgment</Button>}
            </ActionStack>
          )}
          {mode !== 'none' && (
            <div className="mt-2 grid grid-cols-1 gap-2 rounded-md border border-line p-3 sm:grid-cols-3">
              <label className="block text-[length:calc(14px*var(--fs))] font-semibold text-navy-900">{mode === 'deliver' ? 'Given to' : 'Signed by'} *<TextInput className="mt-0.5" value={who} onChange={(e) => setWho(e.target.value)} /></label>
              {mode === 'deliver' && (
                <label className="block text-[length:calc(14px*var(--fs))] font-semibold text-navy-900">How<Select className="mt-0.5" value={method} onChange={(e) => setMethod(e.target.value)}>{['Personal service', 'Left at residence', 'Through a family member'].map((m) => <option key={m}>{m}</option>)}</Select></label>
              )}
              <label className="block text-[length:calc(14px*var(--fs))] font-semibold text-navy-900">Date *<TextInput className="mt-0.5" type="date" max={today()} value={on} onChange={(e) => setOn(e.target.value)} /></label>
              {error && <p className="text-[length:calc(14px*var(--fs))] text-danger-ink sm:col-span-3">{error}</p>}
              <div className="flex flex-wrap gap-2 sm:col-span-3">
                <Button size="sm" blockedReason={!who.trim() ? 'Please enter the name.' : !on ? 'Please choose the date.' : ''} onClick={save}>Save</Button>
                <Button size="sm" variant="secondary" onClick={() => { setMode('none'); setError(null) }}>Cancel</Button>
              </div>
            </div>
          )}
        </>
      )}
    </li>
  )
}
