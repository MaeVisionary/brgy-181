import { useMemo, useState } from 'react'
import { hasContent } from '@/lib/drafts'
import { DraftConflictNote, DraftIndicator, DraftRecoveryCard, useDraft } from '@/hooks/useDraft'
import { MSG, focusFirstInvalid, hasErrors, isMobile } from '@/lib/validation'
import { FileField } from '@/components/ui/FileField'
import { attachUploads, type StoredFile, fileMeta } from '@/services/fileStore'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/ui/Button'
import { FieldError, FieldLabel, Select, TextArea, TextInput } from '@/components/ui/Field'
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
    setBasis(b); setMsg(null); reset(false); setTouched(false)
    setField(b === 'household' ? HOUSEHOLD_UPDATES[0] : CORRECTABLE_FIELDS[0])
  }

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
  // Same rules as submitCorrection in the service layer.
  const errors = {
    who: !targetId ? MSG.choose(basis === 'dependent' ? 'your child or dependent' : 'the person you represent') : '',
    authKind: basis === 'representative' && !authKind ? MSG.choose('the basis of your authorization') : '',
    auth: (basis === 'dependent' || basis === 'representative') && !auth && !authOnsite ? 'Please attach the document, or tick “I will bring it to the Barangay Hall”.' : '',
    first: field === 'Full name' && !name.first.trim() ? MSG.required('the first name') : '',
    last: field === 'Full name' && !name.last.trim() ? MSG.required('the last name') : '',
    value: field === 'Full name' ? ''
      : !value.trim() ? (field === 'Civil status' || field === 'Relationship in the family' ? MSG.choose('the correct answer') : MSG.required('the correct information'))
      : field === 'Contact number' && !isMobile(value) ? MSG.mobile
      : field === 'Birthdate' && value > today ? 'The birthdate cannot be in the future. Please check the year.'
      : '',
    proof: needsProof && !proof && !proofOnsite ? 'Please attach the proof, or tick “I will bring it to the Barangay Hall”.' : '',
    reason: !reason.trim() ? MSG.required('the reason for this correction') + ' Example: My name was misspelled.' : '',
  }
  const [touched, setTouched] = useState(false)
  const draftValue = useMemo(() => ({ basis, whoId, field, value, name, reason, authKind, proofId: proof?.id ?? '', proofOnsite, authId: auth?.id ?? '', authOnsite }),
    [basis, whoId, field, value, name, reason, authKind, proof, proofOnsite, auth, authOnsite])
  const draft = useDraft('profile-correction', draftValue, { isEmpty: (v) => !v.value.trim() && !hasContent(v.name) && !v.reason.trim() && !v.proofId && !v.authId })
  const load = (d: typeof draftValue | null) => {
    if (!d) return
    setBasis(d.basis); setWhoId(d.whoId); setField(d.field); setValue(d.value); setName(d.name); setReason(d.reason); setAuthKind(d.authKind)
    setProof(d.proofId ? fileMeta(d.proofId) ?? null : null); setProofOnsite(d.proofOnsite)
    setAuth(d.authId ? fileMeta(d.authId) ?? null : null); setAuthOnsite(d.authOnsite)
  }
  const show = (k: keyof typeof errors) => (touched ? errors[k] : '')
  const invalid = (k: keyof typeof errors) => (touched && !!errors[k]) || undefined

  const submit = async () => {
    if (busy) return
    setTouched(true)
    if (hasErrors(errors)) { setMsg(null); focusFirstInvalid(); return }
    if (!targetId) return
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
      }, user!, draft.draftId)
      draft.clear()
      attachUploads([proof?.id, auth?.id].filter((x): x is string => !!x), `correction-${Date.now().toString(36)}`)
      reset()
      setTouched(false)
      setMsg({ ok: true, text: 'Sent for review. You will be notified of the decision.' })
      onSent()
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ServiceError ? e.message : 'Your request could not be sent because of a problem on our side. What you typed is kept. Please press Submit request again.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel title="Request a correction">
      <div className="space-y-4">
        {draft.recovered && <DraftRecoveryCard savedAt={draft.recovered.savedAt} onContinue={() => load(draft.resume())} onStartOver={draft.startOver} />}
        {draft.conflict && <DraftConflictNote onTake={() => load(draft.takeOther())} onKeep={draft.keepMine} />}
        <div role="radiogroup" aria-label="Who is this for" className="grid grid-cols-2 gap-2">
          {options.map((b) => (
            <button key={b.id} type="button" role="radio" aria-checked={basis === b.id} onClick={() => pickBasis(b.id)} className={cn('min-h-11 rounded-[var(--radius-control)] border px-3 py-2 text-left text-[length:calc(14.5px*var(--fs))] font-semibold', basis === b.id ? 'border-navy-900 bg-sky-100 text-navy-900' : 'border-line text-ink-nav hover:bg-surface-muted')}>
              {b.label}
            </button>
          ))}
        </div>

        {people.length > 0 && (
          <FieldLabel label={basis === 'dependent' ? 'Child or dependent' : 'Person you represent'} required error={show('who')}>
            <Select value={whoId} onChange={(e) => setWhoId(e.target.value)} aria-invalid={invalid('who')}>
              <option value="">Select</option>
              {people.map((m) => <option key={m.id} value={m.id}>{fullName(m)}</option>)}
            </Select>
          </FieldLabel>
        )}

        {basis === 'dependent' && (
          <div>
            <p className="mb-1 text-[length:calc(14.5px*var(--fs))] font-semibold text-navy-900">Proof you are the parent or guardian</p>
            <p className="mb-2 text-[length:calc(14px*var(--fs))] text-ink-muted">{GUARDIAN_PROOF}</p>
            <div data-invalid={invalid('auth')} tabIndex={-1}><FilePick category="authorization" ownerResidentId={targetId} file={auth} onFile={setAuth} onsite={authOnsite} onOnsite={setAuthOnsite} /></div>
            {show('auth') && <FieldError>{show('auth')}</FieldError>}
          </div>
        )}
        {basis === 'representative' && (
          <div className="space-y-2">
            <FieldLabel label="Your authorization" required error={show('authKind')}>
              <Select value={authKind} onChange={(e) => setAuthKind(e.target.value)} aria-invalid={invalid('authKind')}>
                <option value="">Select</option>
                {REPRESENTATION_KINDS.map((k) => <option key={k}>{k}</option>)}
              </Select>
            </FieldLabel>
            <div data-invalid={invalid('auth')} tabIndex={-1}><FilePick category="authorization" ownerResidentId={targetId} file={auth} onFile={setAuth} onsite={authOnsite} onOnsite={setAuthOnsite} /></div>
            {show('auth') && <FieldError>{show('auth')}</FieldError>}
          </div>
        )}

        <FieldLabel label={basis === 'household' ? 'Update' : 'What needs correcting'}>
          <Select value={field} onChange={(e) => { setField(e.target.value); setValue(''); setMsg(null) }}>{fields.map((f) => <option key={f}>{f}</option>)}</Select>
        </FieldLabel>

        {field === 'Full name' ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <FieldLabel label="First name" required error={show('first')}><TextInput value={name.first} onChange={(e) => setName((n) => ({ ...n, first: e.target.value }))} aria-invalid={invalid('first')} /></FieldLabel>
            <FieldLabel label="Middle name (optional)"><TextInput value={name.middle} onChange={(e) => setName((n) => ({ ...n, middle: e.target.value }))} /></FieldLabel>
            <FieldLabel label="Last name" required error={show('last')}><TextInput value={name.last} onChange={(e) => setName((n) => ({ ...n, last: e.target.value }))} aria-invalid={invalid('last')} /></FieldLabel>
            <FieldLabel label="Suffix (optional)"><TextInput value={name.suffix} onChange={(e) => setName((n) => ({ ...n, suffix: e.target.value }))} placeholder="Jr., Sr., III" /></FieldLabel>
          </div>
        ) : field === 'Birthdate' ? (
          <FieldLabel label="Correct birthdate" required error={show('value')}><TextInput type="date" max={today} value={value} onChange={(e) => setValue(e.target.value)} aria-invalid={invalid('value')} /></FieldLabel>
        ) : field === 'Civil status' ? (
          <FieldLabel label="Correct civil status" required error={show('value')}>
            <Select value={value} onChange={(e) => setValue(e.target.value)} aria-invalid={invalid('value')}><option value="">Select</option>{['Single', 'Married', 'Widowed', 'Separated', 'Live-in'].map((o) => <option key={o}>{o}</option>)}</Select>
          </FieldLabel>
        ) : field === 'Relationship in the family' ? (
          <FieldLabel label="Correct relationship" required error={show('value')}>
            <Select value={value} onChange={(e) => setValue(e.target.value)} aria-invalid={invalid('value')}><option value="">Select</option>{['Head', 'Spouse', 'Partner', 'Son', 'Daughter', 'Mother', 'Father', 'Grandchild', 'Sibling', 'Relative'].map((o) => <option key={o}>{o}</option>)}</Select>
          </FieldLabel>
        ) : field === 'Contact number' ? (
          <FieldLabel label="Correct contact number" required error={show('value')}><TextInput type="tel" inputMode="tel" placeholder="09XXXXXXXXX" value={value} onChange={(e) => setValue(e.target.value)} aria-invalid={invalid('value')} /></FieldLabel>
        ) : (
          <FieldLabel label={basis === 'household' ? 'Details' : 'Correct information'} required error={show('value')}><TextInput value={value} onChange={(e) => setValue(e.target.value)} aria-invalid={invalid('value')} /></FieldLabel>
        )}

        {needsProof && (
          <div>
            <p className="mb-1 text-[length:calc(14.5px*var(--fs))] font-semibold text-navy-900">Proof</p>
            <p className="mb-2 text-[length:calc(14px*var(--fs))] text-ink-muted">{needsProof}</p>
            <div data-invalid={invalid('proof')} tabIndex={-1}><FilePick category="proof" ownerResidentId={targetId} file={proof} onFile={setProof} onsite={proofOnsite} onOnsite={setProofOnsite} /></div>
            {show('proof') && <FieldError>{show('proof')}</FieldError>}
          </div>
        )}

        <FieldLabel label="Reason" required error={show('reason')}><TextArea className="min-h-[60px]" value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={invalid('reason')} /></FieldLabel>
        {msg && <p role="status" className={`rounded-md px-3 py-2 text-[length:calc(14.5px*var(--fs))] ${msg.ok ? 'bg-success-tint text-navy-900' : 'bg-danger-tint text-danger-ink'}`}>{msg.text}</p>}
        <DraftIndicator status={draft.status} />
        <Button onClick={submit} loading={busy}>Submit request</Button>
      </div>
    </Panel>
  )
}
