import { CheckCircle2, ChevronDown, FileText, Inbox, Paperclip } from '@/icons'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { TextArea } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Panel'
import { getDocumentType } from '@/documents/catalog'
import { effectiveValues } from '@/documents/fill'
import { useAsync } from '@/hooks/useAsync'
import { useDocActor } from '@/hooks/useDocActor'
import { formatDate, formatDateTime } from '@/lib/format'
import { mockUsers } from '@/mocks/users'
import { applyTransition, availableTransitions, listRequests, type DocActor } from '@/services/documentService'
import { ServiceError } from '@/services/mockApi'
import type { DocumentRequest, Transition } from '@/types/document'

const nameOf = (id?: string) => mockUsers.find((u) => u.id === id)?.fullName ?? 'Barangay Secretary'

/**
 * Chairman's approvals on one page (Chairman interview, 10 Nov 2026: "convenient,
 * easy to use"). Each request shows what was verified; the decision is made here
 * without opening another page. "Open full record" is there when more is needed.
 */
export function ApprovalsPage() {
  const actor = useDocActor()!
  const [tick, setTick] = useState(0)
  const docs = useAsync(() => listRequests(actor), [actor, tick]).data
  const [done, setDone] = useState<{ ref: string; text: string }[]>([])
  const queue = docs?.filter((d) => d.status === 'pending_approval' || d.status === 'for_assessment') ?? null

  return (
    <>
      <PageHeader title="Approvals" subtitle="Requests verified by the Barangay Secretary and forwarded to you. Decide on each one here." />
      {done.length > 0 && (
        <div role="status" className="mb-4 space-y-1 rounded-[var(--radius-control)] bg-success-tint px-4 py-3">
          {done.map((d) => (
            <p key={d.ref} className="flex items-center gap-2 text-[length:calc(15px*var(--fs))] text-navy-900"><CheckCircle2 className="size-4 shrink-0 text-success" /> {d.ref}: {d.text}</p>
          ))}
        </div>
      )}
      {queue === null ? (
        <div className="h-48 animate-pulse rounded-[var(--radius-card)] bg-surface" />
      ) : queue.length === 0 ? (
        <Card><EmptyState icon={<Inbox className="size-5" />} title="Nothing to approve" body="New requests appear here once the Secretary forwards them." /></Card>
      ) : (
        <div className="space-y-3">
          {queue.map((r) => (
            <ApprovalCard
              key={r.id}
              req={r}
              actor={actor}
              onDone={(text) => {
                setDone((d) => [{ ref: r.referenceNo, text }, ...d].slice(0, 5))
                setTick((t) => t + 1)
              }}
            />
          ))}
        </div>
      )}
    </>
  )
}

function ApprovalCard({ req, actor, onDone }: { req: DocumentRequest; actor: DocActor; onDone: (text: string) => void }) {
  const type = getDocumentType(req.typeId)
  const values = effectiveValues(req)
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<Transition | null>(null)
  const [remarks, setRemarks] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const actions = availableTransitions(req, actor).filter((t) => t.by !== 'owner')
  const purposeField = type.fields.find((f) => /purpose/i.test(f.key) || /purpose/i.test(f.label))
  const purpose = purposeField ? String(values[purposeField.key] ?? '') : ''
  const forwarded = [...req.history].reverse().find((h) => h.status === 'pending_approval' || h.status === 'for_assessment')
  const verifiedStep = [...req.history].reverse().find((h) => h.status === 'processing')
  const provided = type.requirements.filter((x) => req.requirements[x.label]?.provided)

  const decide = async () => {
    if (!picked) return
    setBusy(true)
    setError(null)
    try {
      await applyTransition(req.id, picked, remarks, actor)
      onDone(`${picked.label} (${type.name}, ${req.requesterName})`)
    } catch (e) {
      setError(e instanceof ServiceError ? e.message : 'Something went wrong.')
      setBusy(false)
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-sky-300 bg-bar px-5 py-3.5">
        <div className="min-w-0">
          <h2 className="font-display text-[length:calc(19px*var(--fs))] font-bold text-navy-900">{type.name}</h2>
          <p className="text-[length:calc(16px*var(--fs))] text-navy-900">{req.requesterName}</p>
          <p className="text-[length:calc(14px*var(--fs))] text-ink-muted">{req.referenceNo} · {formatDate(req.submittedAt)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <dl className="space-y-2.5 text-[length:calc(15px*var(--fs))]">
          <div>
            <dt className="label-caps">Purpose</dt>
            <dd className="text-navy-900">{purpose || 'Not stated on this document'}</dd>
          </div>
          <div>
            <dt className="label-caps">Secretary verification</dt>
            <dd className="text-navy-900">
              {verifiedStep ? `Verified by ${nameOf(verifiedStep.byUserId)} on ${formatDateTime(verifiedStep.at)}` : forwarded ? `Forwarded by ${nameOf(forwarded.byUserId)}` : 'Not recorded'}
              {forwarded?.remarks && <span className="block text-ink-nav">Note: {forwarded.remarks}</span>}
            </dd>
          </div>
          {type.verification && (
            <div>
              <dt className="label-caps">{type.verification.title}</dt>
              <dd className={req.verification?.result === 'confirmed' ? 'text-success' : 'text-warning'}>
                {req.verification ? `${req.verification.result === 'confirmed' ? 'Confirmed' : 'Not confirmed'}: ${req.verification.findings}` : 'Not recorded'}
              </dd>
            </div>
          )}
          {type.fee && (
            <div>
              <dt className="label-caps">Fee</dt>
              <dd className="text-navy-900">{req.payment ? `Paid ₱${req.payment.amount.toFixed(2)} (O.R. ${req.payment.orNo})` : 'Not yet paid'}</dd>
            </div>
          )}
        </dl>
        <div>
          <p className="label-caps flex items-center gap-1.5"><Paperclip className="size-3.5" /> Supporting documents</p>
          {type.requirements.length === 0 ? (
            <p className="text-[length:calc(15px*var(--fs))] text-ink-muted">None required.</p>
          ) : (
            <ul className="mt-1 space-y-1 text-[length:calc(15px*var(--fs))]">
              {type.requirements.map((x) => (
                <li key={x.label} className={req.requirements[x.label]?.provided ? 'text-navy-900' : 'text-warning'}>
                  {req.requirements[x.label]?.provided ? '✓' : '•'} {x.label}
                  {!req.requirements[x.label]?.provided && ' (not checked)'}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-1 text-[length:calc(13.5px*var(--fs))] text-ink-muted">{provided.length} of {type.requirements.length} checked by the Secretary.</p>
        </div>
      </div>

      <div className="border-t border-line-soft px-5 py-3">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="inline-flex min-h-11 items-center gap-1.5 text-[length:calc(15px*var(--fs))] font-semibold text-info hover:underline">
          <ChevronDown className={open ? 'size-4 rotate-180 transition-transform' : 'size-4 transition-transform'} /> {open ? 'Hide details' : 'View details'}
        </button>
        {open && (
          <div className="mt-2">
            <dl className="grid grid-cols-1 gap-2 text-[length:calc(15px*var(--fs))] sm:grid-cols-2">
              {type.fields.filter((f) => f.by !== 'system' && values[f.key] !== undefined && values[f.key] !== '').map((f) => (
                <div key={f.key} className="rounded-md bg-surface-muted px-3 py-2">
                  <dt className="text-[length:calc(13.5px*var(--fs))] text-ink-muted">{f.group ? `${f.group}: ` : ''}{f.label}</dt>
                  <dd className="break-words text-navy-900">{Array.isArray(values[f.key]) ? (values[f.key] as string[]).join(', ') : String(values[f.key])}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-2 flex flex-wrap gap-3">
              <Link to={`/documents/${req.id}/preview`} className="inline-flex min-h-11 items-center gap-1.5 text-[length:calc(15px*var(--fs))] font-semibold text-info hover:underline"><FileText className="size-4" /> Preview the document</Link>
              <Link to={`/documents/${req.id}`} className="inline-flex min-h-11 items-center text-[length:calc(15px*var(--fs))] font-semibold text-info hover:underline">Open full record and history</Link>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-line-soft bg-surface-muted/60 px-5 py-4">
        {!picked ? (
          <div className="flex flex-wrap gap-2">
            {actions.map((t) => (
              <Button key={t.label} variant={t.tone === 'danger' ? 'danger' : t.tone === 'secondary' ? 'secondary' : 'primary'} onClick={() => { setPicked(t); setRemarks(''); setError(null) }}>
                {t.label}
              </Button>
            ))}
            {actions.length === 0 && <p className="text-[length:calc(15px*var(--fs))] text-ink-muted">No actions available.</p>}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[length:calc(16px*var(--fs))] font-semibold text-navy-900">{picked.label}: {type.name} for {req.requesterName}?</p>
            <label className="block">
              <span className="mb-1 block text-[length:calc(14.5px*var(--fs))] font-semibold text-navy-900">
                Remarks {picked.remarks === 'required' ? <span className="text-danger-ink">* (required)</span> : <span className="font-normal text-ink-muted">(optional)</span>}
              </span>
              <TextArea className="min-h-[70px]" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </label>
            {error && <p role="alert" className="text-[length:calc(14.5px*var(--fs))] text-danger-ink">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <Button variant={picked.tone === 'danger' ? 'danger' : 'primary'} loading={busy} disabled={picked.remarks === 'required' && !remarks.trim()} onClick={decide}>
                Confirm: {picked.label}
              </Button>
              <Button variant="secondary" onClick={() => setPicked(null)} disabled={busy}>Go back</Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
