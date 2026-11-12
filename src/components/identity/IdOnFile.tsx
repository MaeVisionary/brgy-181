import { useState } from 'react'
import { focusFirstInvalid } from '@/lib/validation'
import { FieldError } from '@/components/ui/Field'
import { AlertTriangle, CheckCircle2, Clock, IdCard, XCircle } from '@/icons'
import { Button } from '@/components/ui/Button'
import { ID_TYPES, idHasExpiry, maskIdNumber } from '@/config/idTypes'
import { useAuth } from '@/auth/useAuth'
import { FileField } from '@/components/ui/FileField'
import { openFile, type StoredFile } from '@/services/fileStore'
import { cn } from '@/lib/cn'
import { formatShortDate } from '@/lib/format'
import { checkIdText, readIdText } from '@/lib/idOcr'
import { idUploadProblem, type IdDocument, type IdState, type IdUpload } from '@/services/identityService'

const STATE = {
  verified: { label: 'Verified ID', icon: CheckCircle2, cls: 'text-success' },
  expiring: { label: 'ID expires soon', icon: AlertTriangle, cls: 'text-warning' },
  pending: { label: 'ID being verified', icon: Clock, cls: 'text-info' },
  expired: { label: 'ID expired', icon: XCircle, cls: 'text-danger-ink' },
  rejected: { label: 'ID not accepted', icon: XCircle, cls: 'text-danger-ink' },
  missing: { label: 'No ID on file', icon: IdCard, cls: 'text-ink-nav' },
} as const

/** One line: icon, state and the ID (masked number, expiry). */
export function IdStatusLine({ doc, state, className }: { doc?: IdDocument; state: IdState; className?: string }) {
  const s = STATE[state]
  const Icon = s.icon
  const detail = doc && [doc.idType, maskIdNumber(doc.idNumber), doc.expiresAt && `${state === 'expired' ? 'expired' : 'expires'} ${formatShortDate(doc.expiresAt + 'T12:00:00+08:00')}`].filter(Boolean).join(' · ')
  return (
    <div className={cn('flex items-start gap-2', className)}>
      <Icon className={cn('icon-line w-4', s.cls)} />
      <div className="min-w-0 text-[length:calc(14.5px*var(--fs))]">
        <p className={cn('font-semibold', s.cls)}>{s.label}</p>
        {detail && <p className="text-ink-muted">{detail}</p>}
        {state === 'rejected' && doc?.reviewNote && <p className="text-danger-ink">{doc.reviewNote}</p>}
      </div>
    </div>
  )
}

const input = 'h-11 w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 text-[length:calc(15.5px*var(--fs))] text-navy-900 focus:border-navy-600 focus:outline-none'


/** Upload a (replacement) ID: type, number, expiry when the ID has one, and a photo. */
export function IdUploadForm({ name, onSubmit, onCancel, submitLabel = 'Submit ID' }: {
  name: { firstName: string; lastName: string; id: string }
  onSubmit: (u: IdUpload) => Promise<void>
  onCancel?: () => void
  submitLabel?: string
}) {
  const [idType, setIdType] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [file, setFile] = useState<StoredFile | null>(null)
  const { user } = useAuth()
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })

  const [touched, setTouched] = useState(false)
  const errors = {
    idType: !idType ? 'Please select the type of ID.' : '',
    idNumber: idNumber.trim().length < 4 ? (idNumber.trim() ? 'This ID number looks too short. Please type it exactly as printed on the card.' : 'Please enter the ID number printed on your card.') : '',
    expiresAt: idHasExpiry(idType) && !expiresAt ? 'Please enter the expiry date printed on the ID.' : idHasExpiry(idType) && expiresAt < today ? 'This ID has expired. Please use an ID that is still valid.' : '',
    file: !file ? 'Please add a photo or scan of the front of your ID.' : '',
  }
  const show = (k: keyof typeof errors) => (touched ? errors[k] : '')

  const submit = async () => {
    if (busy) return
    setErr(null)
    setTouched(true)
    if (Object.values(errors).some(Boolean)) { focusFirstInvalid(); return }
    const base = { idType, idNumber, expiresAt: idHasExpiry(idType) ? expiresAt : undefined }
    const problem = idUploadProblem({ ...base, fileId: file?.id })
    if (problem) { setErr(problem); return }
    try {
      setBusy('Reading your ID…')
      // Text reading only checks the details match; staff still verify the ID itself. PDFs are not read.
      const text = file!.mimeType.startsWith('image/') ? await openFile(file!.id, user!).then((u) => readIdText(u, 25_000)).catch(() => '') : ''
      const ocr = checkIdText(text, { ...name, idNumber, expiry: base.expiresAt })
      setBusy('Saving…')
      await onSubmit({ ...base, fileId: file!.id, ocr: { name: ocr.found.firstName && ocr.found.lastName, idNumber: ocr.found.idNumber, expiry: ocr.found.expiry } })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'The ID could not be saved.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-[length:calc(14px*var(--fs))] font-semibold text-navy-900">Type of ID
          <select className={cn(input, 'mt-1 aria-[invalid=true]:border-danger')} value={idType} onChange={(e) => setIdType(e.target.value)} aria-invalid={!!show('idType') || undefined}>
            <option value="">Select</option>
            {ID_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
          {show('idType') && <FieldError>{show('idType')}</FieldError>}
        </label>
        <label className="block text-[length:calc(14px*var(--fs))] font-semibold text-navy-900">ID number
          <input className={cn(input, 'mt-1 aria-[invalid=true]:border-danger')} value={idNumber} autoComplete="off" onChange={(e) => setIdNumber(e.target.value)} aria-invalid={!!show('idNumber') || undefined} />
          {show('idNumber') && <FieldError>{show('idNumber')}</FieldError>}
        </label>
        {idHasExpiry(idType) && (
          <label className="block text-[length:calc(14px*var(--fs))] font-semibold text-navy-900">Expiry date
            <input type="date" min={today} className={cn(input, 'mt-1 aria-[invalid=true]:border-danger')} value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} aria-invalid={!!show('expiresAt') || undefined} />
            {show('expiresAt') && <FieldError>{show('expiresAt')}</FieldError>}
          </label>
        )}
      </div>
      <div data-invalid={!!show('file') || undefined} tabIndex={-1}><FileField category="id" ownerResidentId={name.id} value={file} onChange={setFile} /></div>
      {show('file') && <FieldError>{show('file')}</FieldError>}
      {err && <p role="alert" className="text-[length:calc(14px*var(--fs))] text-danger-ink">{err}</p>}
      <div className="flex flex-wrap gap-2">
        <Button onClick={submit} loading={!!busy}>{busy ?? submitLabel}</Button>
        {onCancel && <Button variant="secondary" onClick={onCancel} disabled={!!busy}>Cancel</Button>}
      </div>
    </div>
  )
}
