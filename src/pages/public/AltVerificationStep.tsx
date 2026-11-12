import { useState } from 'react'
import { FileText, Trash2, Upload } from '@/icons'
import { fileToJpeg } from '@/lib/faceVerify'
import { sniff } from '@/lib/uploads'
import { cn } from '@/lib/cn'
import type { AltSubmission } from '@/services/registrationService'
import { verificationPolicy } from '@/services/verificationPolicy'

/**
 * "I don't have a valid government-issued ID": supporting documents, someone who
 * can vouch for the applicant, and/or an in-person visit. Details already typed
 * in "Your details" are not asked again. Nothing here is accepted automatically:
 * the Barangay Secretary verifies identity and residency.
 */
export type AltForm = AltSubmission & { endorsement: NonNullable<AltSubmission['endorsement']> }
export const EMPTY_ALT: AltForm = { documents: [], noDocuments: false, endorsement: { name: '', relationship: '', source: '', contactNo: '', purok: '' }, inPersonRequested: false }

const field = 'h-12 w-full rounded-lg border border-line bg-surface px-4 text-[length:calc(17px*var(--fs))] text-navy-900 focus:border-navy-600 focus:ring-4 focus:ring-navy-600/10 focus:outline-none aria-[invalid=true]:border-danger'
const MAX_BYTES = 1_500_000

async function readDoc(file: File): Promise<{ dataUrl: string; kind: 'image' | 'pdf' } | string> {
  const kind = await sniff(file)
  if (kind === 'heic') return 'iPhone HEIC photos are not accepted. Use JPG instead (Settings → Camera → Formats → Most Compatible).'
  if (kind === 'pdf') {
    if (file.size > MAX_BYTES) return 'This PDF is larger than 1.5 MB. Please use a smaller file or a photo.'
    return { dataUrl: await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(file) }), kind: 'pdf' }
  }
  if (kind !== 'jpeg' && kind !== 'png') return 'Use a JPG or PNG photo, or a PDF.'
  return { dataUrl: await fileToJpeg(file), kind: 'image' }
}

export function AltVerificationStep({ value, onChange, errors, touched }: { value: AltForm; onChange: (v: AltForm) => void; errors: Record<string, string>; touched: boolean }) {
  const pol = verificationPolicy()
  const [category, setCategory] = useState('')
  const [fileErr, setFileErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const e = (k: string) => (touched ? errors[k] : undefined)
  const set = (patch: Partial<AltForm>) => onChange({ ...value, ...patch })
  const setEn = (patch: Partial<AltForm['endorsement']>) => set({ endorsement: { ...value.endorsement, ...patch } })

  const add = async (file: File | undefined) => {
    if (!file) return
    if (!category) { setFileErr('Choose the type of document first.'); return }
    setBusy(true); setFileErr(null)
    try {
      const r = await readDoc(file)
      if (typeof r === 'string') { setFileErr(r); return }
      set({ documents: [...value.documents.filter((d) => d.category !== category), { category, fileName: file.name, ...r }], noDocuments: false })
      setCategory('')
    } catch { setFileErr('That file could not be read. Please try another photo or PDF.') } finally { setBusy(false) }
  }

  return (
    <div className="mt-5 space-y-6">
      <p className="rounded-lg bg-sky-50 px-4 py-3 text-[length:calc(16px*var(--fs))] text-navy-900">
        You can still register. Because you don't have a valid ID, the Barangay Secretary will check who you are and that you live in Barangay 181 before your account is approved. Please give whatever you have below.
      </p>

      <fieldset>
        <legend className="text-[length:calc(18px*var(--fs))] font-bold text-navy-900">1. Supporting documents</legend>
        <p className="mt-1 text-[length:calc(15.5px*var(--fs))] text-ink-nav">Add a photo or PDF of any document you have. These help the review; none is accepted automatically.</p>
        {value.documents.length > 0 && (
          <ul className="mt-3 divide-y divide-line-soft rounded-lg border border-line">
            {value.documents.map((d) => (
              <li key={d.category} className="flex min-h-14 items-center gap-3 px-3 py-2">
                <FileText className="size-5 shrink-0 text-ink-nav" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[length:calc(16px*var(--fs))] font-semibold break-words text-navy-900">{d.category}</span>
                  <span className="block text-[length:calc(14.5px*var(--fs))] break-all text-ink-nav">{d.fileName}</span>
                </span>
                <button type="button" aria-label={`Remove ${d.category}`} onClick={() => set({ documents: value.documents.filter((x) => x !== d) })} className="grid size-11 shrink-0 place-items-center rounded-lg text-ink-nav hover:bg-surface-muted"><Trash2 className="size-5" /></button>
              </li>
            ))}
          </ul>
        )}
        {!value.noDocuments && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <label className="block">
              <span className="mb-1.5 block text-[length:calc(16px*var(--fs))] font-semibold text-navy-900">Type of document</span>
              <select className={field} value={category} onChange={(x) => setCategory(x.target.value)}>
                <option value="">Choose</option>
                {pol.documentCategories.map((c) => <option key={c} value={c}>{c}{value.documents.some((d) => d.category === c) ? ' (added)' : ''}</option>)}
              </select>
            </label>
            <label className={cn('inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 text-[length:calc(16px*var(--fs))] font-semibold text-navy-900 hover:bg-surface-muted', busy && 'opacity-60')}>
              <Upload className="size-5" /> {busy ? 'Reading…' : 'Add photo or PDF'}
              <input type="file" accept="image/jpeg,image/png,application/pdf" className="sr-only" disabled={busy} onChange={(x) => { void add(x.target.files?.[0]); x.target.value = '' }} />
            </label>
          </div>
        )}
        {fileErr && <p role="alert" className="mt-2 text-[length:calc(15px*var(--fs))] text-danger-ink">{fileErr}</p>}
        <label className="mt-3 flex min-h-12 items-center gap-3 rounded-lg border border-line px-3 text-[length:calc(16px*var(--fs))] text-navy-900">
          <input type="checkbox" className="size-5 accent-[#002132]" checked={value.noDocuments} onChange={(x) => set({ noDocuments: x.target.checked, documents: x.target.checked ? [] : value.documents })} />
          I don't have any supporting documents
        </label>
        {e('documents') && <p data-invalid="true" tabIndex={-1} className="mt-2 text-[length:calc(15px*var(--fs))] text-danger-ink">{e('documents')}</p>}
      </fieldset>

      <fieldset>
        <legend className="text-[length:calc(18px*var(--fs))] font-bold text-navy-900">2. Someone who can vouch for you {!value.noDocuments && <span className="font-normal text-ink-nav">(optional)</span>}</legend>
        <p className="mt-1 text-[length:calc(15.5px*var(--fs))] text-ink-nav">For example: {pol.endorsementSources.join(', ').toLowerCase()}. The barangay may contact them.</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block"><span className="mb-1.5 block text-[length:calc(16px*var(--fs))] font-semibold text-navy-900">Full name</span>
            <input className={field} value={value.endorsement.name} onChange={(x) => setEn({ name: x.target.value })} aria-invalid={!!e('endorser')} />
            {e('endorser') && <span data-invalid="true" className="mt-1.5 block text-[length:calc(15px*var(--fs))] text-danger-ink">{e('endorser')}</span>}
          </label>
          <label className="block"><span className="mb-1.5 block text-[length:calc(16px*var(--fs))] font-semibold text-navy-900">How they know you, or their position</span>
            <input className={field} value={value.endorsement.relationship} onChange={(x) => setEn({ relationship: x.target.value })} placeholder="e.g. Purok 3 leader, neighbor" aria-invalid={!!e('endorserRole')} />
            {e('endorserRole') && <span data-invalid="true" className="mt-1.5 block text-[length:calc(15px*var(--fs))] text-danger-ink">{e('endorserRole')}</span>}
          </label>
          <label className="block"><span className="mb-1.5 block text-[length:calc(16px*var(--fs))] font-semibold text-navy-900">Their mobile number <span className="font-normal text-ink-nav">(optional)</span></span>
            <input className={field} inputMode="numeric" value={value.endorsement.contactNo ?? ''} onChange={(x) => setEn({ contactNo: x.target.value })} aria-invalid={!!e('endorserContact')} />
            {e('endorserContact') && <span data-invalid="true" className="mt-1.5 block text-[length:calc(15px*var(--fs))] text-danger-ink">{e('endorserContact')}</span>}
          </label>
          <label className="block"><span className="mb-1.5 block text-[length:calc(16px*var(--fs))] font-semibold text-navy-900">Purok or household <span className="font-normal text-ink-nav">(optional)</span></span>
            <input className={field} value={value.endorsement.purok ?? ''} onChange={(x) => setEn({ purok: x.target.value })} />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-[length:calc(18px*var(--fs))] font-bold text-navy-900">3. In-person verification</legend>
        <label className="mt-2 flex min-h-14 items-start gap-3 rounded-lg border border-line px-3 py-3 text-[length:calc(16px*var(--fs))] text-navy-900">
          <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-[#002132]" checked={value.inPersonRequested} onChange={(x) => set({ inPersonRequested: x.target.checked })} />
          <span>I would like to request in-person verification at the Barangay Hall.<span className="block text-[length:calc(14.5px*var(--fs))] text-ink-nav">The Barangay Secretary will contact you to set the date and time.</span></span>
        </label>
        {e('choice') && <p data-invalid="true" tabIndex={-1} className="mt-2 text-[length:calc(15px*var(--fs))] text-danger-ink">{e('choice')}</p>}
      </fieldset>
    </div>
  )
}
