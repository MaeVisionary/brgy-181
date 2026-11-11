import { AlertCircle } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { TextArea } from '@/components/ui/Field'
import { Panel } from '@/components/ui/Panel'
import { getDocumentType } from '@/documents/catalog'
import { STATUS_META } from '@/documents/workflows'
import { applyTransition, availableTransitions, type DocActor } from '@/services/documentService'
import { ServiceError } from '@/services/mockApi'
import type { DocumentRequest, Transition } from '@/types/document'

/** The next steps this user may take, with a confirmation step for each. */
export function TransitionPanel({
  req,
  actor,
  onChange,
  dirty,
  missingCount,
  ownerView,
  exclude,
}: {
  req: DocumentRequest
  actor: DocActor
  onChange: (r: DocumentRequest) => void
  dirty?: boolean
  missingCount?: number
  ownerView?: boolean
  /** Hide steps shown elsewhere on the page (e.g. the resident's reply form). */
  exclude?: (t: Transition) => boolean
}) {
  const options = availableTransitions(req, actor).filter((t) => (ownerView ? t.by === 'owner' : t.by !== 'owner') && !exclude?.(t))
  const [asked, setAsked] = useState<string[]>([])
  const askable = [...getDocumentType(req.typeId).requirements.map((r) => r.label), 'Clearer photo of a valid ID', 'Photo of yourself holding your valid ID', 'Other supporting document']
    .filter((v, i, a) => a.indexOf(v) === i)
  const [picked, setPicked] = useState<Transition | null>(null)
  const [remarks, setRemarks] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setPicked(null)
    setRemarks('')
    setError(null)
    setAsked([])
  }

  const confirm = async () => {
    if (!picked) return
    setBusy(true)
    setError(null)
    try {
      if (picked.to === 'needs_info' && asked.length === 0) throw new ServiceError('items', 'Choose what the requester needs to send.')
      const r = await applyTransition(req.id, picked, remarks, actor, { requestedItems: picked.to === 'needs_info' ? asked : undefined })
      reset()
      onChange(r)
    } catch (e) {
      setError(e instanceof ServiceError ? e.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel title={ownerView ? 'What you can do' : 'Next step'} subtitle={`Current status: ${STATUS_META[req.status].label}`}>
      {options.length === 0 ? (
        <p className="text-[14.5px] text-ink-muted">
          {ownerView ? 'Nothing is needed from you right now.' : 'No step is available to your role at this stage.'}
        </p>
      ) : picked ? (
        <div className="space-y-3">
          <p className="text-[15px] font-semibold text-navy-900">{picked.label}</p>
          {picked.hint && <p className="text-[14px] text-ink-muted">{picked.hint}</p>}
          {picked.to === 'needs_info' && !ownerView && (
            <fieldset>
              <legend className="mb-1.5 text-[14px] font-semibold text-navy-900">What should the requester send? <span className="text-danger-ink">*</span></legend>
              <div className="grid gap-1.5">
                {askable.map((item) => (
                  <label key={item} className="flex cursor-pointer items-center gap-2 text-[14.5px] text-navy-900">
                    <input type="checkbox" className="size-4 accent-[#002132]" checked={asked.includes(item)} onChange={(e) => setAsked((a) => (e.target.checked ? [...a, item] : a.filter((x) => x !== item)))} />
                    {item}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {picked.remarks && (
            <label className="block">
              <span className="mb-1 block text-[14px] font-semibold text-navy-900">
                {ownerView ? 'Your message' : 'Note'} {picked.remarks === 'required' ? <span className="text-danger-ink">*</span> : <span className="font-normal text-ink-muted">(optional)</span>}
              </span>
              <TextArea value={remarks} onChange={(e) => setRemarks(e.target.value)} autoFocus />
            </label>
          )}
          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-md bg-danger-tint px-3 py-2 text-[14.5px] text-danger-ink">
              <AlertCircle className="mt-px size-4 shrink-0" />
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button variant={picked.tone === 'danger' ? 'danger' : 'primary'} onClick={confirm} loading={busy} disabled={picked.remarks === 'required' && !remarks.trim()}>
              Confirm
            </Button>
            <Button variant="ghost" onClick={reset} disabled={busy}>
              Back
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {dirty && <p className="rounded-md bg-warning-tint px-3 py-2 text-[14px] text-warning">Save your changes to the details first.</p>}
          {options.map((t, i) => {
            const blocked = (t.requiresComplete && (missingCount ?? 0) > 0) || dirty
            return (
              <div key={i}>
                <Button
                  variant={t.tone === 'danger' ? 'danger' : t.tone === 'secondary' || i > 0 ? 'secondary' : 'primary'}
                  className="w-full"
                  disabled={blocked}
                  onClick={() => setPicked(t)}
                >
                  {t.label}
                </Button>
                {t.requiresComplete && (missingCount ?? 0) > 0 && (
                  <p className="mt-1 text-[13.5px] text-danger-ink">Complete the missing details first.</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Panel>
  )
}
