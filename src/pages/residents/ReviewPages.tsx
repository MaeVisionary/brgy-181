import { CheckCircle2, CircleHelp, Paperclip, XCircle } from '@/icons'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { TextArea } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Panel'
import { formatDateTime } from '@/lib/format'
import { residentById } from '@/mocks/residents'
import { userById } from '@/mocks/users'
import { ServiceError } from '@/services/mockApi'
import { decideRegistration, listRegistrations } from '@/services/registrationService'
import { PROOF_REQUIRED, decideChangeRequest, displayRequestedValue, listChangeRequests } from '@/services/residentService'
import type { ResidentChangeRequest, ResidentRegistration } from '@/types/resident'
import { fullName } from './common'

const CHECK_LABEL = { ocr: 'ID details read (OCR)', masterListMatch: 'Master list match', faceMatch: 'Face matches ID', liveness: 'Live person check' } as const

function CheckIcon({ v }: { v: 'passed' | 'failed' | 'inconclusive' }) {
  if (v === 'passed') return <CheckCircle2 className="mt-px size-4 shrink-0 text-success" />
  if (v === 'failed') return <XCircle className="mt-px size-4 shrink-0 text-danger" />
  return <CircleHelp className="mt-px size-4 shrink-0 text-warning" />
}

function Decide({ onDecide, disabled }: { onDecide: (d: 'approved' | 'rejected', note: string) => Promise<void>; disabled?: boolean }) {
  const [note, setNote] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const run = async (d: 'approved' | 'rejected') => {
    setBusy(true)
    setErr(null)
    try {
      await onDecide(d, note)
    } catch (e) {
      setErr(e instanceof ServiceError ? e.message : 'Failed.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-2">
      <TextArea className="min-h-[60px]" placeholder="Note (required when denying)" value={note} onChange={(e) => setNote(e.target.value)} disabled={disabled} />
      {err && <p className="text-[14px] text-danger-ink">{err}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={() => run('approved')} loading={busy} disabled={disabled}>Approve</Button>
        <Button size="sm" variant="danger" onClick={() => run('rejected')} disabled={disabled || busy}>Deny</Button>
      </div>
    </div>
  )
}

/** FR10: registrations that did not pass every check wait for the Secretary's manual verification. */
export function RegistrationsPage() {
  const { user, can } = useAuth()
  const [items, setItems] = useState<ResidentRegistration[] | null>(null)
  const load = () => listRegistrations().then(setItems)
  useEffect(() => {
    load()
  }, [])
  const queue = items?.filter((r) => r.status === 'manual_review') ?? []
  const done = items?.filter((r) => r.status !== 'manual_review') ?? []
  return (
    <>
      <PageHeader title="Resident Registrations" subtitle="Online registrations that need manual verification. A failed face or liveness check is never an automatic denial; in-person verification at the Barangay Hall is always possible." />
      <p className="mb-3 text-[14.5px] text-ink-muted">
        Online registrations are approved automatically only when the ID name, face comparison, live selfie and barangay records all match. Everything else lands here.
      </p>
      <div className="space-y-3">
        {queue.length === 0 && items && <Card className="px-5 py-6 text-[15px] text-ink-muted">No registrations waiting for review.</Card>}
        {queue.map((r) => {
          const match = r.matchedResidentId ? residentById(r.matchedResidentId) : undefined
          const a = r.applicant
          const ev = r.evidence
          return (
            <Card key={r.id} className="space-y-4 px-5 py-4">
              <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr]">
                <div>
                  <p className="label-caps">{r.referenceNo} · {formatDateTime(r.submittedAt)}</p>
                  <p className="mt-1 font-display text-[18px] font-extrabold text-navy-900">{[a.firstName, a.middleName, a.lastName, a.suffix].filter(Boolean).join(' ')}</p>
                  <p className="text-[14.5px] text-ink-muted">Born {a.birthDate} · {a.address}</p>
                  {(a.sex || a.contactNo || a.email) && (
                    <p className="text-[14.5px] text-ink-muted">
                      {[a.sex && (a.sex === 'male' ? 'Male' : 'Female'), a.civilStatus?.replace('_', '-'), a.contactNo, a.email, a.residentSince && `Resident since ${a.residentSince}`, a.voter !== undefined && (a.voter ? 'Voter' : 'Not a voter')].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  {(a.pwd || a.soloParent || a.fourPs || a.oscaId) && (
                    <p className="text-[14.5px] text-ink-muted">{[a.oscaId && `OSCA ID ${a.oscaId}`, a.pwd && 'PWD', a.soloParent && 'Solo parent', a.fourPs && '4Ps'].filter(Boolean).join(' · ')}</p>
                  )}
                  <p className="mt-2 text-[14.5px]">
                    {match ? (
                      <>Matching resident record: <Link to={`/residents/${match.id}`} className="font-semibold text-info hover:underline">{fullName(match)}</Link></>
                    ) : ev?.recordSource === 'osca_masterlist' ? (
                      <span className="text-navy-900">Found in the senior citizen (OSCA) masterlist; no resident record yet. Approving creates one.</span>
                    ) : (
                      <span className="text-warning">No matching record found. Approving creates a new resident record.</span>
                    )}
                  </p>
                </div>
                <ul className="space-y-1">
                  {(Object.keys(CHECK_LABEL) as (keyof typeof CHECK_LABEL)[]).map((k) => (
                    <li key={k} className={r.verification[k] === 'passed' ? 'flex items-start gap-2 leading-snug rounded-md px-2 py-1 text-[14.5px] text-navy-900' : 'flex items-start gap-2 leading-snug rounded-md bg-danger-tint px-2 py-1 text-[14.5px] font-semibold text-danger-ink'}>
                      <CheckIcon v={r.verification[k]} /><span>{CHECK_LABEL[k]}: {r.verification[k] === 'passed' ? 'passed' : r.verification[k] === 'failed' ? 'failed' : 'not certain'}</span>
                    </li>
                  ))}
                  {ev?.faceSimilarity !== undefined && <li className="pl-8 text-[14px] text-ink-muted">Face similarity: {ev.faceSimilarity}%</li>}
                  {ev && (
                    <li className="pl-8 text-[14px] text-ink-muted">
                      On the ID: first name {ev.ocrFound.firstName ? '✓' : '✗'} · last name {ev.ocrFound.lastName ? '✓' : '✗'} · ID no. {ev.ocrFound.idNumber ? '✓' : '✗'}
                    </li>
                  )}
                </ul>
                <Decide disabled={!can('residents.approve')} onDecide={async (d, note) => { await decideRegistration(r.id, d, note, user!); await load() }} />
              </div>
              {ev && (
                <div className="grid gap-4 border-t border-line-soft pt-4 md:grid-cols-[1fr_auto_1.2fr]">
                  <figure>
                    <img src={ev.idImage} alt={`ID submitted by ${a.firstName} ${a.lastName}`} className="max-h-[220px] w-full rounded-lg border border-line bg-surface-muted object-contain" />
                    <figcaption className="mt-1 text-[14px] text-ink-muted">{ev.idType} · No. {ev.idNumber}</figcaption>
                  </figure>
                  <figure>
                    <img src={ev.selfieImage} alt={`Selfie of ${a.firstName} ${a.lastName}`} className={`h-[220px] w-[165px] rounded-lg border border-line object-cover ${r.verification.liveness === 'passed' ? '-scale-x-100' : ''}`} />
                    <figcaption className="mt-1 text-[14px] text-ink-muted">{r.verification.liveness === 'passed' ? 'Live selfie' : 'Uploaded photo'}</figcaption>
                  </figure>
                  <div className="text-[14.5px]">
                    <p className="font-semibold text-navy-900">Why it needs review</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-navy-900">
                      {ev.reasons.map((x) => <li key={x}>{x}</li>)}
                    </ul>
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>
      {done.length > 0 && (
        <>
          <p className="label-caps mt-4 mb-2">Decided and auto-approved</p>
          <Card className="divide-y divide-line-soft">
            {done.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 px-5 py-3 text-[15px]">
                <span className="text-navy-900">{r.referenceNo} · {r.applicant.firstName} {r.applicant.lastName}</span>
                <span className="flex items-center gap-2">
                  {r.decidedBy && <span className="text-[14px] text-ink-muted">{userById(r.decidedBy)?.fullName}</span>}
                  <Badge tone={r.status === 'rejected' ? 'danger' : 'success'}>{r.status === 'auto_approved' ? 'Auto-approved' : r.status === 'approved' ? 'Approved' : 'Denied'}</Badge>
                </span>
              </div>
            ))}
          </Card>
        </>
      )}
    </>
  )
}

/** FR11: resident correction requests; the official record changes only after approval. */
/** Decided requests stay listed this many days, then drop off the screen (the record keeps them). */
const DECIDED_VISIBLE_DAYS = 7

export function ChangeRequestsPage() {
  const { user, can } = useAuth()
  const [items, setItems] = useState<ResidentChangeRequest[] | null>(null)
  const [tab, setTab] = useState<'review' | 'decided'>('review')
  const load = () => listChangeRequests().then(setItems)
  useEffect(() => {
    load()
  }, [])
  const since = Date.now() - DECIDED_VISIBLE_DAYS * 86_400_000
  const toReview = (items ?? []).filter((c) => c.status === 'pending')
  const decided = (items ?? []).filter((c) => c.status !== 'pending' && c.decidedAt && new Date(c.decidedAt).getTime() >= since)
  const shown = tab === 'review' ? toReview : decided
  return (
    <>
      <PageHeader title="Record Update Requests" subtitle="Residents' requests to correct their information. The official record changes only when you approve." />
      <div role="tablist" aria-label="Requests" className="mb-3 flex flex-wrap gap-2">
        {([
          ['review', 'To review', toReview.length],
          ['decided', 'Recently decided', decided.length],
        ] as const).map(([k, label, n]) => (
          <button
            key={k}
            role="tab"
            type="button"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={tab === k ? 'inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-control)] border border-navy-900 bg-navy-900 px-4 text-[15px] font-semibold text-white' : 'inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-control)] border border-line bg-surface px-4 text-[15px] font-semibold text-navy-900 hover:bg-surface-muted'}
          >
            {label} <span className={tab === k ? 'text-white/75' : 'text-ink-muted'}>({n})</span>
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {items && shown.length === 0 && (
          <Card className="px-5 py-6 text-[15px] text-ink-muted">{tab === 'review' ? 'No requests waiting for review.' : `No requests decided in the last ${DECIDED_VISIBLE_DAYS} days.`}</Card>
        )}
        {shown.map((c) => {
          const r = residentById(c.residentId)
          return (
            <Card key={c.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[1.4fr_1fr]">
              <div>
                <p className="label-caps">{formatDateTime(c.submittedAt)}</p>
                <p className="mt-1 text-[16px] font-semibold text-navy-900">{r ? <Link to={`/residents/${r.id}`} className="hover:underline">{fullName(r)}</Link> : 'Unknown resident'} · {c.field}</p>
                {c.requestedByResidentId && residentById(c.requestedByResidentId) && <p className="text-[14px] text-ink-muted">Requested by {fullName(residentById(c.requestedByResidentId)!)} (same family)</p>}
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-md bg-surface-muted px-3 py-2"><p className="text-[13px] text-ink-muted">Current record</p><p className="text-[15px] text-navy-900">{c.originalValue || '–'}</p></div>
                  <div className="rounded-md bg-sky-100 px-3 py-2"><p className="text-[13px] text-ink-muted">Requested</p><p className="text-[15px] font-semibold text-navy-900">{displayRequestedValue(c.field, c.requestedValue)}</p></div>
                </div>
                <p className="mt-2 text-[14.5px] text-ink-muted">Reason: {c.reason}</p>
                <ProofLine c={c} />
              </div>
              {c.status === 'pending' ? (
                <Decide disabled={!can('residents.approve')} onDecide={async (d, note) => { await decideChangeRequest(c.id, d, note, user!); await load() }} />
              ) : (
                <div className="text-[14.5px]">
                  <Badge tone={c.status === 'approved' ? 'success' : 'danger'}>{c.status === 'approved' ? 'Approved' : 'Rejected'}</Badge>
                  <p className="mt-1 text-ink-muted">{c.decidedBy && userById(c.decidedBy)?.fullName} · {c.decidedAt && formatDateTime(c.decidedAt)}</p>
                  {c.decisionNote && <p className="mt-1 text-navy-900">{c.decisionNote}</p>}
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </>
  )
}

/** What the resident sent as proof (view it before approving). */
function ProofLine({ c }: { c: ResidentChangeRequest }) {
  const needed = PROOF_REQUIRED[c.field]
  if (!needed && !c.proof) return null
  if (c.proof?.fileName) {
    return (
      <p className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-line px-3 py-2 text-[14.5px] text-navy-900">
        <Paperclip className="size-4 text-ink-muted" /> Proof attached: <strong>{c.proof.fileName}</strong>
        {c.proof.url && <a href={c.proof.url} target="_blank" rel="noreferrer" className="font-semibold text-info hover:underline">View file</a>}
      </p>
    )
  }
  if (c.proof?.bringOnsite) {
    return <p className="mt-2 rounded-md border border-warning/50 bg-warning-tint px-3 py-2 text-[14.5px] text-navy-900">The resident will bring the original document to the Barangay Hall. Check it before approving.</p>
  }
  return <p className="mt-2 rounded-md bg-danger-tint px-3 py-2 text-[14.5px] text-danger-ink">No proof attached ({needed}). Ask the resident to submit it before approving.</p>
}
