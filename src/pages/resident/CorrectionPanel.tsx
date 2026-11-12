import { useMemo, useState } from 'react'
import { FileField } from '@/components/ui/FileField'
import { attachUploads, type StoredFile } from '@/services/fileStore'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/ui/Button'
import { FieldLabel, Select, TextArea, TextInput } from '@/components/ui/Field'
import { Panel } from '@/components/ui/Panel'
import { cn } from '@/lib/cn'
import { ServiceError } from '@/services/mockApi'
import {
  CORRECTABLE_FIELDS,
  GUARDIAN_PROOF,
  HOUSEHOLD_UPDATES,
  PROOF_REQUIRED,
  REPRESENTATION_KINDS,
  correctionTargets,
  submitCorrection,
  type CorrectionBasis,
} from '@/services/residentService'
import { fullName } from '../residents/common'

const BASIS: { id: CorrectionBasis; label: string }[] = [
  { id: 'self', label: 'My own record' },
  { id: 'dependent', label: 'My child or dependent' },
  { id: 'representative', label: 'Someone I represent' },
  { id: 'household', label: 'Household update' },
]

function FilePick({ file, onFile, onsite, onOnsite, category, ownerResidentId }: { file: StoredFile | null; onFile: (f: StoredFile | null) => void; onsite: boolean; onOnsite: (v: boolean) => void; category: 'proof' | 'authorization'; ownerResidentId?: string }) {
  return (
    <div>
      {!onsite && <FileField category={category} ownerResidentId={ownerResidentId} value={file} onChange={(f) => { onFile(f); if (f) onOnsite(false) }} />}
      <label className="mt-2 flex items-center gap-2 text-[length:calc(14.5px*var(--fs))] text-navy-900">
        <input type="checkbox" className="size-4 accent-[#002132]" checked={onsite} disabled={!!file} onChange={(e) => onOnsite(e.target.checked)} />
        I'll bring the original to the Barangay Hall
      </label>
    </div>
  )
}

/** Correction request: who it is for decides what may be changed and what proof is needed. */
export function CorrectionPanel({ onSent }: { onSent: () => void }) {
  const { user } = useAuth()
  const t = useMemo(() => correctionTargets(user!), [user])
  const [basis, setBasis] = useState<CorrectionBasis>('self')
  const [whoId, setWhoId] = useState('')
  const [field, setField] = useState<string>(CORRECTABLE_FIELDS[0])
  const [value, setValue] = useState('')
  const [name, setName] = useState({ first: '', middle: '', last: '', suffix: '' })
  const [reason, setReason] = useState('')
  const [proof, setProof] = useState<StoredFile | null>(null)
  const [proofOnsite, setProofOnsite] = useState(false)
  const [authKind, setAuthKind] = useState('')
  const [auth, setAuth] = useState<StoredFile | null>(null)
  const [authOnsite, setAuthOnsite] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const people = basis === 'dependent' ? t.dependents : basis === 'representative' ? t.adults : []
  const options = BASIS.filter((b) => b.id === 'self' || (b.id === 'dependent' && t.dependents.length) || (b.id === 'representative' && t.adults.length) || (b.id === 'household' && t.isHead))
  const fields = basis === 'household' ? [...HOUSEHOLD_UPDATES] : [...CORRECTABLE_FIELDS]
  const targetId = basis === 'self' || basis === 'household' ? t.self?.id : whoId
  const needsProof = basis !== 'household' ? PROOF_REQUIRED[field] : undefined
  const requested = field === 'Full name' ? [name.first, name.middle, name.last, name.suffix].join('|') : value

  const reset = (keepBasis = true) => {
    setValue(''); setName({ first: '', middle: '', last: '', suffix: '' }); setReason('')
    setProof(null); setProofOnsite(false); setAuth(null); setAuthOnsite(false); setAuthKind('')
    if (!keepBasis) setWhoId('')
  }
  const pickBasis = (b: CorrectionBasis) => {
    setBasis(b); setMsg(null); reset(false)
    setField(b === 'household' ? HOUSEHOLD_UPDATES[0] : CORRECTABLE_FIELDS[0])
  }

  const submit = async () => {
    if (!targetId) { setMsg({ ok: false, text: 'Choose whose record this is for.' }); return }
    setBusy(true); setMsg(null)
    try {
      await submitCorrection({
        basis,
        residentId: targetId,
        field,
        requestedValue: requested,
        reason,
        proof: needsProof ? { fileName: proof?.originalName, fileId: proof?.id, bringOnsite: proofOnsite && !proof } : undefined,
        authorization: basis === 'dependent' || basis === 'representative'
          ? { kind: basis === 'dependent' ? 'Parent or guardian' : authKind, fileName: auth?.originalName, fileId: auth?.id, bringOnsite: authOnsite && !auth }
          : undefined,
      }, user!)
      attachUploads([proof?.id, auth?.id].filter((x): x is string => !!x), `correction-${Date.now().toString(36)}`)
      reset()
      setMsg({ ok: true, text: 'Sent for review. You will be notified of the decision.' })
      onSent()
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ServiceError ? e.message : 'Your request could not be sent.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel title="Request a correction">
      <div className="space-y-4">
        <div role="radiogroup" aria-label="Who is this for" className="grid grid-cols-2 gap-2">
          {options.map((b) => (
            <button key={b.id} type="button" role="radio" aria-checked={basis === b.id} onClick={() => pickBasis(b.id)} className={cn('min-h-11 rounded-[var(--radius-control)] border px-3 py-2 text-left text-[length:calc(14.5px*var(--fs))] font-semibold', basis === b.id ? 'border-navy-900 bg-sky-100 text-navy-900' : 'border-line text-ink-nav hover:bg-surface-muted')}>
              {b.label}
            </button>
          ))}
        </div>

        {people.length > 0 && (
          <FieldLabel label={basis === 'dependent' ? 'Child or dependent' : 'Person you represent'}>
            <Select value={whoId} onChange={(e) => setWhoId(e.target.value)}>
              <option value="">Select</option>
              {people.map((m) => <option key={m.id} value={m.id}>{fullName(m)}</option>)}
            </Select>
          </FieldLabel>
        )}

        {basis === 'dependent' && (
          <div>
            <p className="mb-1 text-[length:calc(14.5px*var(--fs))] font-semibold text-navy-900">Proof you are the parent or guardian</p>
            <p className="mb-2 text-[length:calc(14px*var(--fs))] text-ink-muted">{GUARDIAN_PROOF}</p>
            <FilePick category="authorization" ownerResidentId={targetId} file={auth} onFile={setAuth} onsite={authOnsite} onOnsite={setAuthOnsite} />
          </div>
        )}
        {basis === 'representative' && (
          <div className="space-y-2">
            <FieldLabel label="Your authorization">
              <Select value={authKind} onChange={(e) => setAuthKind(e.target.value)}>
                <option value="">Select</option>
                {REPRESENTATION_KINDS.map((k) => <option key={k}>{k}</option>)}
              </Select>
            </FieldLabel>
            <FilePick category="authorization" ownerResidentId={targetId} file={auth} onFile={setAuth} onsite={authOnsite} onOnsite={setAuthOnsite} />
          </div>
        )}

        <FieldLabel label={basis === 'household' ? 'Update' : 'What needs correcting'}>
          <Select value={field} onChange={(e) => { setField(e.target.value); setValue(''); setMsg(null) }}>{fields.map((f) => <option key={f}>{f}</option>)}</Select>
        </FieldLabel>

        {field === 'Full name' ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <FieldLabel label="First name" required><TextInput value={name.first} onChange={(e) => setName((n) => ({ ...n, first: e.target.value }))} /></FieldLabel>
            <FieldLabel label="Middle name"><TextInput value={name.middle} onChange={(e) => setName((n) => ({ ...n, middle: e.target.value }))} /></FieldLabel>
            <FieldLabel label="Last name" required><TextInput value={name.last} onChange={(e) => setName((n) => ({ ...n, last: e.target.value }))} /></FieldLabel>
            <FieldLabel label="Suffix"><TextInput value={name.suffix} onChange={(e) => setName((n) => ({ ...n, suffix: e.target.value }))} placeholder="Jr., Sr., III" /></FieldLabel>
          </div>
        ) : field === 'Birthdate' ? (
          <FieldLabel label="Correct birthdate" required><TextInput type="date" max={new Date().toISOString().slice(0, 10)} value={value} onChange={(e) => setValue(e.target.value)} /></FieldLabel>
        ) : field === 'Civil status' ? (
          <FieldLabel label="Correct civil status" required>
            <Select value={value} onChange={(e) => setValue(e.target.value)}><option value="">Select</option>{['Single', 'Married', 'Widowed', 'Separated', 'Live-in'].map((o) => <option key={o}>{o}</option>)}</Select>
          </FieldLabel>
        ) : field === 'Relationship in the family' ? (
          <FieldLabel label="Correct relationship" required>
            <Select value={value} onChange={(e) => setValue(e.target.value)}><option value="">Select</option>{['Head', 'Spouse', 'Partner', 'Son', 'Daughter', 'Mother', 'Father', 'Grandchild', 'Sibling', 'Relative'].map((o) => <option key={o}>{o}</option>)}</Select>
          </FieldLabel>
        ) : field === 'Contact number' ? (
          <FieldLabel label="Correct contact number" required><TextInput type="tel" inputMode="tel" value={value} onChange={(e) => setValue(e.target.value)} /></FieldLabel>
        ) : (
          <FieldLabel label={basis === 'household' ? 'Details' : 'Correct information'} required><TextInput value={value} onChange={(e) => setValue(e.target.value)} /></FieldLabel>
        )}

        {needsProof && (
          <div>
            <p className="mb-1 text-[length:calc(14.5px*var(--fs))] font-semibold text-navy-900">Proof</p>
            <p className="mb-2 text-[length:calc(14px*var(--fs))] text-ink-muted">{needsProof}</p>
            <FilePick category="proof" ownerResidentId={targetId} file={proof} onFile={setProof} onsite={proofOnsite} onOnsite={setProofOnsite} />
          </div>
        )}

        <FieldLabel label="Reason" required><TextArea className="min-h-[60px]" value={reason} onChange={(e) => setReason(e.target.value)} /></FieldLabel>
        {msg && <p role="status" className={`rounded-md px-3 py-2 text-[length:calc(14.5px*var(--fs))] ${msg.ok ? 'bg-success-tint text-navy-900' : 'bg-danger-tint text-danger-ink'}`}>{msg.text}</p>}
        <Button onClick={submit} loading={busy}>Submit request</Button>
      </div>
    </Panel>
  )
}
