import { ClipboardCheck, Receipt } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { FieldLabel, TextArea, TextInput } from '@/components/ui/Field'
import { Panel } from '@/components/ui/Panel'
import { getDocumentType } from '@/documents/catalog'
import { formatDate, formatDateTime } from '@/lib/format'
import { mockUsers } from '@/mocks/users'
import { recordPayment, recordVerification, type DocActor } from '@/services/documentService'
import { ServiceError } from '@/services/mockApi'
import type { DocumentRequest } from '@/types/document'

const nameOf = (id: string) => mockUsers.find((u) => u.id === id)?.fullName ?? 'Personnel'
const today = () => new Date().toISOString().slice(0, 10)

/** Ocular inspection / residency check etc., recorded before the Secretary approves. */
export function VerificationPanel({ req, actor, onChange }: { req: DocumentRequest; actor: DocActor; onChange: (r: DocumentRequest) => void }) {
  const def = getDocumentType(req.typeId).verification
  const [result, setResult] = useState<'confirmed' | 'not_confirmed'>('confirmed')
  const [findings, setFindings] = useState('')
  const [checkedOn, setCheckedOn] = useState(today())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!def) return null
  const v = req.verification
  const open = ['submitted', 'under_review', 'needs_info'].includes(req.status) && actor.permissions.has('documents.inspect')

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      onChange({ ...(await recordVerification(req.id, { result, findings, checkedOn }, actor)) })
      setFindings('')
    } catch (e) {
      setError(e instanceof ServiceError ? e.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel keepSubtitle title={def.title} subtitle={def.help} icon={<ClipboardCheck className="size-5" />}>
      {v ? (
        <div className={v.result === 'confirmed' ? 'rounded-[var(--radius-control)] bg-success-tint px-4 py-3' : 'rounded-[var(--radius-control)] bg-danger-tint px-4 py-3'}>
          <p className="text-[15px] font-semibold text-navy-900">{v.result === 'confirmed' ? 'Confirmed' : 'Not confirmed'} · checked {formatDate(v.checkedOn)}</p>
          <p className="mt-1 text-[15px] text-navy-900">{v.findings}</p>
          <p className="mt-1 text-[13.5px] text-ink-muted">Recorded by {nameOf(v.byUserId)} · {formatDateTime(v.at)}</p>
        </div>
      ) : (
        <p className="text-[15px] text-warning">Not recorded yet. The Secretary can approve only after it is recorded as confirmed.</p>
      )}
      {open && (
        <div className="mt-4 space-y-3 border-t border-line-soft pt-4">
          <p className="text-[15px] font-semibold text-navy-900">{v ? 'Record a new check' : 'Record the result'}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldLabel label="Result" required>
              <div className="flex flex-wrap gap-2">
                {(['confirmed', 'not_confirmed'] as const).map((k) => (
                  <label key={k} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-[var(--radius-control)] border border-line px-3 text-[15px] text-navy-900 has-[:checked]:border-navy-900 has-[:checked]:bg-sky-100">
                    <input type="radio" name={`ver-${req.id}`} className="size-4 accent-[#002132]" checked={result === k} onChange={() => setResult(k)} />
                    {k === 'confirmed' ? 'Confirmed' : 'Not confirmed'}
                  </label>
                ))}
              </div>
            </FieldLabel>
            <FieldLabel label="Date checked" required>
              <TextInput type="date" value={checkedOn} max={today()} onChange={(e) => setCheckedOn(e.target.value)} />
            </FieldLabel>
          </div>
          <FieldLabel label="Findings" required>
            <TextArea className="min-h-[80px]" value={findings} onChange={(e) => setFindings(e.target.value)} placeholder="What was checked and what was found." />
          </FieldLabel>
          {error && <p role="alert" className="text-[14.5px] text-danger-ink">{error}</p>}
          <Button onClick={save} loading={busy} disabled={!findings.trim()}>Save {def.title.toLowerCase()}</Button>
        </div>
      )}
    </Panel>
  )
}

/** Fee paid to the Barangay Treasurer (official receipt). */
export function PaymentPanel({ req, actor, onChange }: { req: DocumentRequest; actor: DocActor; onChange: (r: DocumentRequest) => void }) {
  const [orNo, setOrNo] = useState('')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!getDocumentType(req.typeId).fee) return null
  const p = req.payment
  const canRecord = !p && actor.permissions.has('documents.payment') && !['rejected', 'cancelled'].includes(req.status)

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      onChange({ ...(await recordPayment(req.id, { orNo, amount: Number(amount) }, actor)) })
    } catch (e) {
      setError(e instanceof ServiceError ? e.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel title="Fee payment" icon={<Receipt className="size-5" />}>
      {p ? (
        <div className="rounded-[var(--radius-control)] bg-success-tint px-4 py-3 text-[15px] text-navy-900">
          <p className="font-semibold">Paid ₱{p.amount.toFixed(2)} · O.R. No. {p.orNo}</p>
          <p className="text-[13.5px] text-ink-muted">Recorded by {nameOf(p.byUserId)} · {formatDateTime(p.at)}</p>
        </div>
      ) : (
        <p className="text-[15px] text-warning">Not paid yet. The fee is paid to the Barangay Treasurer.</p>
      )}
      {canRecord && (
        <div className="mt-4 space-y-3 border-t border-line-soft pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldLabel label="Official receipt no." required>
              <TextInput value={orNo} onChange={(e) => setOrNo(e.target.value)} />
            </FieldLabel>
            <FieldLabel label="Amount paid (₱)" required>
              <TextInput type="number" min="0" step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </FieldLabel>
          </div>
          {error && <p role="alert" className="text-[14.5px] text-danger-ink">{error}</p>}
          <Button onClick={save} loading={busy} disabled={!orNo.trim() || !amount}>Record payment</Button>
        </div>
      )}
    </Panel>
  )
}
