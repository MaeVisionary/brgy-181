import { CheckCircle2, CircleHelp, Paperclip, XCircle } from '@/icons'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { TextArea } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Panel'
import { formatDateTime, formatShortDate } from '@/lib/format'
import { residentById } from '@/mocks/residents'
import { userById } from '@/mocks/users'
import { ServiceError } from '@/services/mockApi'
import { decideRegistration, listRegistrations } from '@/services/registrationService'
import { PROOF_REQUIRED, decideChangeRequest, displayRequestedValue, listChangeRequests } from '@/services/residentService'
import type { ResidentChangeRequest, ResidentRegistration } from '@/types/resident'
import { fullName } from './common'

function CheckIcon({ v }: { v: 'passed' | 'failed' | 'inconclusive' }) {
  if (v === 'passed') return <CheckCircle2 className="mt-px size-4 shrink-0 text-success" />
  if (v === 'failed') return <XCircle className="mt-px size-4 shrink-0 text-danger" />
  return <CircleHelp className="mt-px size-4 shrink-0 text-warning" />
}

/** Approve / Reject. A reason is asked for only when rejecting. */
function Decide({ onDecide, disabled, extra }: { onDecide: (d: 'approved' | 'rejected', note: string) => Promise<void>; disabled?: boolean; extra?: ReactNode }) {
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const run = async (d: 'approved' | 'rejected') => {
    if (d === 'rejected' && !note.trim()) { setErr('Add the reason for rejecting.'); return }
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
  if (rejecting) {
    return (
      <div className="w-full space-y-2">
        <TextArea autoFocus className="min-h-[64px]" aria-label="Reason for rejecting" placeholder="Reason for rejecting" value={note} onChange={(e) => setNote(e.target.value)} />
        {err && <p className="text-[14px] text-danger-ink">{err}</p>}
        <div className="flex gap-2">
          <Button size="sm" variant="danger" onClick={() => run('rejected')} loading={busy}>Reject</Button>
          <Button size="sm" variant="secondary" onClick={() => { setRejecting(false); setErr(null) }} disabled={busy}>Cancel</Button>
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-2">
        {extra}
        <Button size="sm" onClick={() => run('approved')} loading={busy} disabled={disabled}>Approve</Button>
        <Button size="sm" variant="secondary" onClick={() => setRejecting(true)} disabled={disabled || busy}>Reject</Button>
      </div>
      {err && <p className="text-[14px] text-danger-ink">{err}</p>}
    </div>
  )
}

type CheckResult = 'passed' | 'failed' | 'inconclusive'
const RESULT = {
  passed: { label: 'Passed', cls: 'text-success', dot: 'bg-success' },
  inconclusive: { label: 'Needs review', cls: 'text-warning', dot: 'bg-warning' },
  failed: { label: 'Failed', cls: 'text-danger-ink', dot: 'bg-danger' },
} as const

function overall(v: ResidentRegistration['verification']): CheckResult {
  const all = Object.values(v) as CheckResult[]
  if (all.includes('failed')) return 'failed'
  if (all.includes('inconclusive')) return 'inconclusive'
  return 'passed'
}

function CheckRow({ label, v, detail }: { label: string; v: CheckResult; detail?: string }) {
  return (
    <li className={v === 'passed' ? 'flex items-start gap-2 py-1.5' : 'flex items-start gap-2 rounded-md bg-danger-tint px-2 py-1.5'}>
      <CheckIcon v={v} />
      <span className="min-w-0 flex-1 text-[14.5px] text-navy-900">{label}{detail && <span className="text-ink-muted"> · {detail}</span>}</span>
      <span className={`shrink-0 text-[14px] font-semibold ${RESULT[v].cls}`}>{RESULT[v].label}</span>
    </li>
  )
}

/** FR10: registrations that did not pass every check wait for the Secretary's manual verification. */
export function RegistrationsPage() {
  const { user, can } = useAuth()
  const [items, setItems] = useState<ResidentRegistration[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const load = () => listRegistrations().then(setItems)
  useEffect(() => {
    load()
  }, [])
  const queue = items?.filter((r) => r.status === 'manual_review') ?? []
  const done = items?.filter((r) => r.status !== 'manual_review') ?? []
  return (
    <>
      <PageHeader title="Resident Registrations" />
      {queue.length === 0 && items && <Card className="px-5 py-6 text-[15px] text-ink-muted">No registrations waiting for review.</Card>}
      {queue.length > 0 && (
        <Card className="divide-y divide-line-soft">
          {queue.map((r) => {
            const match = r.matchedResidentId ? residentById(r.matchedResidentId) : undefined
            const a = r.applicant
            const ev = r.evidence
            const res = overall(r.verification)
            const open = openId === r.id
            const ocrMissing = ev ? [!ev.ocrFound.firstName && 'first name', !ev.ocrFound.lastName && 'last name', !ev.ocrFound.idNumber && 'ID no.'].filter(Boolean).join(', ') : ''
            return (
              <div key={r.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                  <div className="min-w-0 flex-1 basis-[240px]">
                    <p className="text-[16.5px] font-bold text-navy-900">{[a.firstName, a.middleName, a.lastName, a.suffix].filter(Boolean).join(' ')}</p>
                    <p className="text-[14.5px] text-ink-muted">{a.address} · {formatShortDate(r.submittedAt)}</p>
                    <p className={`mt-1 flex items-center gap-1.5 text-[14px] font-semibold ${RESULT[res].cls}`}><span className={`size-2 rounded-full ${RESULT[res].dot}`} />{RESULT[res].label}</p>
                  </div>
                  <Decide
                    disabled={!can('residents.approve')}
                    onDecide={async (d, note) => { await decideRegistration(r.id, d, note, user!); await load() }}
                    extra={<Button size="sm" variant="secondary" aria-expanded={open} onClick={() => setOpenId(open ? null : r.id)}>{open ? 'Hide Details' : 'View Details'}</Button>}
                  />
                </div>
                {open && (
                  <div className="mt-4 grid gap-6 border-t border-line-soft pt-4 lg:grid-cols-2">
                    <section>
                      <h3 className="label-caps mb-1">Identity</h3>
                      <ul>
                        <CheckRow label="ID verification" v={r.verification.ocr} detail={ocrMissing ? `not read: ${ocrMissing}` : ev ? `${ev.idType} · ${ev.idNumber}` : undefined} />
                        <CheckRow label="Face matching" v={r.verification.faceMatch} detail={ev?.faceSimilarity !== undefined ? `${ev.faceSimilarity}% similar` : undefined} />
                        <CheckRow label="Live person" v={r.verification.liveness} />
                      </ul>
                      {ev && (
                        <div className="mt-3 flex gap-3">
                          <img src={ev.idImage} alt={`ID submitted by ${a.firstName} ${a.lastName}`} className="h-[150px] min-w-0 flex-1 rounded-lg border border-line bg-surface-muted object-contain" />
                          <img src={ev.selfieImage} alt={`Selfie of ${a.firstName} ${a.lastName}`} className={`h-[150px] w-[112px] shrink-0 rounded-lg border border-line object-cover ${r.verification.liveness === 'passed' ? '-scale-x-100' : ''}`} />
                        </div>
                      )}
                    </section>
                    <section>
                      <h3 className="label-caps mb-1">Resident record</h3>
                      <ul>
                        <CheckRow label="Masterlist match" v={r.verification.masterListMatch} />
                      </ul>
                      <p className="mt-2 text-[14.5px] text-navy-900">
                        {match ? (
                          <>Matches <Link to={`/residents/${match.id}`} className="font-semibold text-info hover:underline">{fullName(match)}</Link></>
                        ) : ev?.recordSource === 'osca_masterlist' ? 'In the OSCA masterlist · no resident record yet' : 'No existing record · approving creates one'}
                      </p>
                      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[14.5px]">
                        <dt className="text-ink-muted">Reference</dt><dd className="text-navy-900">{r.referenceNo}</dd>
                        <dt className="text-ink-muted">Birthdate</dt><dd className="text-navy-900">{a.birthDate}</dd>
                        {a.sex && <><dt className="text-ink-muted">Sex</dt><dd className="text-navy-900">{a.sex === 'male' ? 'Male' : 'Female'}</dd></>}
                        {a.civilStatus && <><dt className="text-ink-muted">Civil status</dt><dd className="text-navy-900 capitalize">{a.civilStatus.replace('_', '-')}</dd></>}
                        {a.contactNo && <><dt className="text-ink-muted">Contact</dt><dd className="text-navy-900">{a.contactNo}</dd></>}
                        {a.email && <><dt className="text-ink-muted">Email</dt><dd className="break-all text-navy-900">{a.email}</dd></>}
                        {a.residentSince && <><dt className="text-ink-muted">Resident since</dt><dd className="text-navy-900">{a.residentSince}</dd></>}
                        {a.voter !== undefined && <><dt className="text-ink-muted">Voter</dt><dd className="text-navy-900">{a.voter ? 'Yes' : 'No'}</dd></>}
                        {(a.pwd || a.soloParent || a.fourPs || a.oscaId) && <><dt className="text-ink-muted">Sector</dt><dd className="text-navy-900">{[a.oscaId && `OSCA ID ${a.oscaId}`, a.pwd && 'PWD', a.soloParent && 'Solo parent', a.fourPs && '4Ps'].filter(Boolean).join(' · ')}</dd></>}
                      </dl>
                      {ev && ev.reasons.length > 0 && (
                        <ul className="mt-3 space-y-1 text-[14.5px] text-danger-ink">
                          {ev.reasons.map((x) => <li key={x} className="flex gap-2"><XCircle className="mt-0.5 size-4 shrink-0" />{x}</li>)}
                        </ul>
                      )}
                    </section>
                  </div>
                )}
              </div>
            )
          })}
        </Card>
      )}
      {done.length > 0 && (
        <>
          <h2 className="label-caps mt-6 mb-2">Decided</h2>
          <Card className="divide-y divide-line-soft">
            {done.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 px-5 py-3 text-[15px]">
                <span className="min-w-0 truncate text-navy-900">{r.applicant.firstName} {r.applicant.lastName}</span>
                <span className={`shrink-0 text-[14px] font-semibold ${r.status === 'rejected' ? 'text-danger-ink' : 'text-success'}`}>{r.status === 'auto_approved' ? 'Auto-approved' : r.status === 'approved' ? 'Approved' : 'Rejected'}</span>
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
      <PageHeader title="Record Update Requests" />
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
