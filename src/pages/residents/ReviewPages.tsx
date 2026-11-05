import { CheckCircle2, CircleHelp, XCircle } from 'lucide-react'
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
import { decideChangeRequest, decideRegistration, listChangeRequests, listRegistrations } from '@/services/residentService'
import type { ResidentChangeRequest, ResidentRegistration } from '@/types/resident'
import { fullName } from './common'

const CHECK_LABEL = { ocr: 'ID details read (OCR)', masterListMatch: 'Master list match', faceMatch: 'Face matches ID', liveness: 'Live person check' } as const

function CheckIcon({ v }: { v: 'passed' | 'failed' | 'inconclusive' }) {
  if (v === 'passed') return <CheckCircle2 className="size-4 text-success" />
  if (v === 'failed') return <XCircle className="size-4 text-danger" />
  return <CircleHelp className="size-4 text-warning" />
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
      {err && <p className="text-[12px] text-danger-ink">{err}</p>}
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
      <p className="mb-3 text-[12.5px] text-ink-muted">Prototype: OCR, face matching and liveness results are sample values. The real checks run on the server (NFR7).</p>
      <div className="space-y-3">
        {queue.length === 0 && items && <Card className="px-5 py-6 text-[13px] text-ink-muted">No registrations waiting for review.</Card>}
        {queue.map((r) => {
          const match = r.matchedResidentId ? residentById(r.matchedResidentId) : undefined
          return (
            <Card key={r.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[1.2fr_1fr_1fr]">
              <div>
                <p className="label-caps">{r.referenceNo} · {formatDateTime(r.submittedAt)}</p>
                <p className="mt-1 font-display text-[16px] font-extrabold text-navy-900">{r.applicant.firstName} {r.applicant.lastName}</p>
                <p className="text-[12.5px] text-ink-muted">Born {r.applicant.birthDate} · {r.applicant.address}</p>
                <p className="mt-2 text-[12.5px]">
                  {match ? <>Possible master-list record: <Link to={`/residents/${match.id}`} className="font-semibold text-info hover:underline">{fullName(match)}</Link></> : <span className="text-warning">No matching master-list record found.</span>}
                </p>
              </div>
              <ul className="space-y-1.5">
                {(Object.keys(CHECK_LABEL) as (keyof typeof CHECK_LABEL)[]).map((k) => (
                  <li key={k} className="flex items-center gap-2 text-[12.5px] text-navy-900"><CheckIcon v={r.verification[k]} /> {CHECK_LABEL[k]}: {r.verification[k]}</li>
                ))}
              </ul>
              <Decide disabled={!can('residents.approve')} onDecide={async (d, note) => { await decideRegistration(r.id, d, note, user!); await load() }} />
            </Card>
          )
        })}
      </div>
      {done.length > 0 && (
        <>
          <p className="label-caps mt-6 mb-2">Decided and auto-approved</p>
          <Card className="divide-y divide-line-soft">
            {done.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 px-5 py-3 text-[13px]">
                <span className="text-navy-900">{r.referenceNo} · {r.applicant.firstName} {r.applicant.lastName}</span>
                <span className="flex items-center gap-2">
                  {r.decidedBy && <span className="text-[12px] text-ink-muted">{userById(r.decidedBy)?.fullName}</span>}
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
export function ChangeRequestsPage() {
  const { user, can } = useAuth()
  const [items, setItems] = useState<ResidentChangeRequest[] | null>(null)
  const load = () => listChangeRequests().then(setItems)
  useEffect(() => {
    load()
  }, [])
  return (
    <>
      <PageHeader title="Resident Update Requests" subtitle="Residents' requests to correct their information. The official record is updated only when you approve." />
      <div className="space-y-3">
        {(items ?? []).map((c) => {
          const r = residentById(c.residentId)
          return (
            <Card key={c.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[1.4fr_1fr]">
              <div>
                <p className="label-caps">{formatDateTime(c.submittedAt)}</p>
                <p className="mt-1 text-[14px] font-semibold text-navy-900">{r ? <Link to={`/residents/${r.id}`} className="hover:underline">{fullName(r)}</Link> : 'Unknown resident'} · {c.field}</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-md bg-surface-muted px-3 py-2"><p className="text-[11px] text-ink-muted">Current record</p><p className="text-[13px] text-navy-900">{c.originalValue || '–'}</p></div>
                  <div className="rounded-md bg-sky-100 px-3 py-2"><p className="text-[11px] text-ink-muted">Requested</p><p className="text-[13px] font-semibold text-navy-900">{c.requestedValue}</p></div>
                </div>
                <p className="mt-2 text-[12.5px] text-ink-muted">Reason: {c.reason}</p>
              </div>
              {c.status === 'pending' ? (
                <Decide disabled={!can('residents.approve')} onDecide={async (d, note) => { await decideChangeRequest(c.id, d, note, user!); await load() }} />
              ) : (
                <div className="text-[12.5px]">
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
