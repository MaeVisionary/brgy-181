import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock, IdCard, XCircle } from '@/icons'
import { Button } from '@/components/ui/Button'
import { ID_FILE_TYPES, ID_TYPES, idHasExpiry, maskIdNumber } from '@/config/idTypes'
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
  const detail = doc && [doc.idType, maskIdNumber(doc.idNumber), doc.expiresAt && `${state === 'expired' ? 'expired' : 'expires'} ${formatShortDate(doc.expiresAt + 'T12:00:00')}`].filter(Boolean).join(' · ')
  return (
    <div className={cn('flex items-start gap-2', className)}>
      <Icon className={cn('mt-0.5 size-4 shrink-0', s.cls)} />
      <div className="min-w-0 text-[14.5px]">
        <p className={cn('font-semibold', s.cls)}>{s.label}</p>
        {detail && <p className="text-ink-muted">{detail}</p>}
        {state === 'rejected' && doc?.reviewNote && <p className="text-danger-ink">{doc.reviewNote}</p>}
      </div>
    </div>
  )
}

const input = 'h-11 w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 text-[15.5px] text-navy-900 focus:border-navy-600 focus:outline-none'

async function toDataUrl(file: File, max = 1000): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = rej
      i.src = url
    })
    const scale = Math.min(1, max / Math.max(img.width, img.height))
    const c = document.createElement('canvas')
    c.width = Math.round(img.width * scale)
    c.height = Math.round(img.height * scale)
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', 0.85)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Upload a (replacement) ID: type, number, expiry when the ID has one, and a photo. */
export function IdUploadForm({ name, onSubmit, onCancel, submitLabel = 'Submit ID' }: {
  name: { firstName: string; lastName: string }
  onSubmit: (u: IdUpload) => Promise<void>
  onCancel?: () => void
  submitLabel?: string
}) {
  const [idType, setIdType] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })

  const submit = async () => {
    setErr(null)
    const base = { idType, idNumber, expiresAt: idHasExpiry(idType) ? expiresAt : undefined, fileType: file?.type ?? '', fileSize: file?.size ?? 0 }
    const problem = idUploadProblem({ ...base, image: file ? 'pending' : undefined })
    if (problem) { setErr(problem); return }
    try {
      setBusy('Reading your ID…')
      const image = await toDataUrl(file!)
      // Text reading only checks the details match; staff still verify the ID itself.
      const text = await readIdText(image, 25_000).catch(() => '')
      const ocr = checkIdText(text, { ...name, idNumber, expiry: base.expiresAt })
      setBusy('Saving…')
      await onSubmit({ ...base, image, ocr: { name: ocr.found.firstName && ocr.found.lastName, idNumber: ocr.found.idNumber, expiry: ocr.found.expiry } })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'The ID could not be saved.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-[14px] font-semibold text-navy-900">Type of ID
          <select className={cn(input, 'mt-1')} value={idType} onChange={(e) => setIdType(e.target.value)}>
            <option value="">Select</option>
            {ID_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label className="block text-[14px] font-semibold text-navy-900">ID number
          <input className={cn(input, 'mt-1')} value={idNumber} autoComplete="off" onChange={(e) => setIdNumber(e.target.value)} />
        </label>
        {idHasExpiry(idType) && (
          <label className="block text-[14px] font-semibold text-navy-900">Expiry date
            <input type="date" min={today} className={cn(input, 'mt-1')} value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </label>
        )}
      </div>
      <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-[var(--radius-control)] border border-dashed border-line px-3 py-2.5 text-[14.5px] text-ink-nav hover:border-navy-600 hover:bg-sky-50">
        {preview ? <img src={preview} alt="" className="h-12 w-[76px] rounded object-cover" /> : <IdCard className="size-5 text-ink-subtle" />}
        <span className="min-w-0 truncate">{file ? file.name : 'Photo of the front of your ID'}</span>
        <input
          type="file"
          accept={ID_FILE_TYPES.join(',')}
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null
            setFile(f)
            if (preview) URL.revokeObjectURL(preview)
            setPreview(f ? URL.createObjectURL(f) : null)
          }}
        />
      </label>
      {err && <p role="alert" className="text-[14px] text-danger-ink">{err}</p>}
      <div className="flex flex-wrap gap-2">
        <Button onClick={submit} loading={!!busy}>{busy ?? submitLabel}</Button>
        {onCancel && <Button variant="ghost" onClick={onCancel} disabled={!!busy}>Cancel</Button>}
      </div>
    </div>
  )
}
