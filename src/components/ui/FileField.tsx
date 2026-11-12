import { useEffect, useRef, useState } from 'react'
import { FileText, Paperclip, X } from '@/icons'
import { useAuth } from '@/auth/useAuth'
import { UPLOAD_ACCEPT, UPLOAD_HINT } from '@/config/uploads'
import { cn } from '@/lib/cn'
import { formatBytes, prepareUpload } from '@/lib/uploads'
import { discardUpload, recordFailedUpload, saveUpload, type FileCategory, type StoredFile } from '@/services/fileStore'
import { ServiceError } from '@/services/mockApi'

/**
 * One upload: checks the real file type, shrinks photos (dropping location
 * data), stores it as a temporary upload, and shows name, size, preview and
 * Remove. The parent receives the stored file's metadata (or null).
 */
export function FileField({ label, category, ownerResidentId, value, onChange, hint = UPLOAD_HINT }: {
  label?: string
  category: FileCategory
  ownerResidentId?: string
  value: StoredFile | null
  onChange: (f: StoredFile | null) => void
  hint?: string
}) {
  const { user } = useAuth()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const pick = async (f: File) => {
    setErr(null)
    setBusy(true)
    try {
      const prepared = await prepareUpload(f)
      if ('error' in prepared) { recordFailedUpload(); setErr(prepared.error); return }
      const meta = await saveUpload(prepared.file, { category, ownerResidentId }, user!)
      if (value && value.id !== meta.id) await discardUpload(value.id, user!)
      setPreview(prepared.kind === 'pdf' ? null : URL.createObjectURL(prepared.file))
      onChange(meta)
    } catch (e) {
      setErr(e instanceof ServiceError ? e.message : 'The file could not be added.')
    } finally {
      setBusy(false)
    }
  }
  const remove = async () => {
    if (value) await discardUpload(value.id, user!)
    setPreview(null)
    onChange(null)
  }

  return (
    <div>
      {label && <p className="mb-1 text-[length:calc(14.5px*var(--fs))] font-semibold text-navy-900">{label}</p>}
      {value ? (
        <div className="flex items-center gap-3 rounded-[var(--radius-control)] border border-line bg-surface px-3 py-2">
          {preview ? <img src={preview} alt="" className="size-11 shrink-0 rounded object-cover" /> : <span className="grid size-11 shrink-0 place-items-center rounded bg-surface-muted text-ink-nav"><FileText className="size-5" /></span>}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[length:calc(15px*var(--fs))] text-navy-900">{value.originalName}</span>
            <span className="block text-[length:calc(13.5px*var(--fs))] text-ink-muted">{formatBytes(value.size)}</span>
          </span>
          <button type="button" onClick={remove} aria-label={`Remove ${value.originalName}`} className="grid size-11 shrink-0 place-items-center rounded-full text-ink-nav hover:bg-surface-muted"><X className="size-4" /></button>
        </div>
      ) : (
        <button type="button" onClick={() => input.current?.click()} disabled={busy} className={cn('flex min-h-12 w-full items-center gap-2 rounded-[var(--radius-control)] border border-dashed border-line bg-surface px-3 py-2.5 text-left text-[length:calc(15px*var(--fs))] text-navy-900 hover:border-navy-600 hover:bg-sky-50', busy && 'opacity-60')}>
          <Paperclip className="size-4 shrink-0 text-ink-muted" />
          <span className="min-w-0 flex-1">
            <span className="block">{busy ? 'Preparing…' : 'Choose file'}</span>
            <span className="block text-[length:calc(13.5px*var(--fs))] text-ink-muted">{hint}</span>
          </span>
        </button>
      )}
      <input ref={input} type="file" accept={UPLOAD_ACCEPT} className="sr-only" tabIndex={-1} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) pick(f) }} />
      {err && <p role="alert" className="mt-1 text-[length:calc(14px*var(--fs))] text-danger-ink">{err}</p>}
    </div>
  )
}
