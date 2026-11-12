import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { ChevronRight } from '@/icons'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/ui/Button'
import { FieldLabel, TextArea, TextInput } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { residentFullName } from '@/documents/fill'
import { useDocActor } from '@/hooks/useDocActor'
import { cn } from '@/lib/cn'
import { COMPLAINT_CATEGORIES, submitComplaint, type ComplaintCategory } from '@/services/caseService'
import { ServiceError } from '@/services/mockApi'
import { getResident } from '@/services/residentService'
import type { Resident } from '@/types/resident'
import { BackLink } from './parts'
import { ConcernForm } from './ConcernForm'
import { ActionStack } from '@/components/ui/ActionStack'

/** URL part for each report type, so each form has its own page. */
const SLUG: Record<ComplaintCategory, string> = { 'Complaint against a person': 'person', 'Incident report': 'incident', 'Community concern': 'concern' }
const BY_SLUG = Object.fromEntries(Object.entries(SLUG).map(([k, v]) => [v, k])) as Record<string, ComplaintCategory>

/** Step 1 chooses the type; step 2 is that type's form on its own page (never a document request). */
export function NewComplaintPage() {
  const { kind } = useParams()
  const actor = useDocActor()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [me, setMe] = useState<Resident | null>(null)
  const category: ComplaintCategory | null = kind ? BY_SLUG[kind] ?? null : null
  const [nature, setNature] = useState('')
  const [details, setDetails] = useState('')
  const [date, setDate] = useState('')
  const [place, setPlace] = useState('')
  const [who, setWho] = useState({ name: '', address: '' })
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (user?.residentId) getResident(user.residentId).then((r) => setMe(r ?? null))
  }, [user?.residentId])

  const submit = async () => {
    if (!actor || !me || !category || busy) return
    setBusy(true)
    setErr(null)
    try {
      const c = await submitComplaint(
        { category, nature, details, incidentDate: date || undefined, incidentPlace: place, respondents: category === 'Complaint against a person' ? [who] : [] },
        actor,
        { residentId: me.id, name: residentFullName(me), address: `${me.houseNo} ${me.street}`, contactNo: me.contactNo },
      )
      navigate(`/my/complaints/${c.id}`, { replace: true })
    } catch (e) {
      setErr(e instanceof ServiceError ? e.message : 'Your report could not be sent.')
      setBusy(false)
    }
  }

  if (kind && !category) return <Navigate to="/my/complaints/new" replace />
  if (!category) return (
    <>
      <BackLink to="/my/complaints">My Complaints and Reports</BackLink>
      <PageHeader title="What are you reporting?" />
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {COMPLAINT_CATEGORIES.map((c) => (
          <li key={c}>
            <button type="button" onClick={() => navigate(`/my/complaints/new/${SLUG[c]}`)} className={cn('flex min-h-14 w-full items-center justify-between gap-3 rounded-[var(--radius-control)] border border-line bg-surface px-4 py-3 text-left text-[length:calc(16.5px*var(--fs))] font-semibold text-navy-900 hover:border-navy-600 hover:bg-sky-50')}>
              {c} <ChevronRight className="size-5 shrink-0 text-ink-subtle" />
            </button>
          </li>
        ))}
      </ul>
    </>
  )

  return (
    <>
      <BackLink to="/my/complaints/new">Report types</BackLink>
      <PageHeader title={category} />
      <div className="space-y-4">

        {category === 'Community concern' && <ConcernForm />}

        {category && category !== 'Community concern' && (
          <Panel title="Details">
            <div className="space-y-3">
              <FieldLabel label="Subject" required><TextInput value={nature} onChange={(e) => setNature(e.target.value)} placeholder="e.g. Unpaid loan" /></FieldLabel>
              {category === 'Complaint against a person' && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FieldLabel label="Person you are complaining about" required><TextInput value={who.name} onChange={(e) => setWho((w) => ({ ...w, name: e.target.value }))} /></FieldLabel>
                  <FieldLabel label="Their address, if known"><TextInput value={who.address} onChange={(e) => setWho((w) => ({ ...w, address: e.target.value }))} /></FieldLabel>
                </div>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FieldLabel label="Date"><TextInput type="date" max={new Date().toISOString().slice(0, 10)} value={date} onChange={(e) => setDate(e.target.value)} /></FieldLabel>
                <FieldLabel label="Place"><TextInput value={place} onChange={(e) => setPlace(e.target.value)} /></FieldLabel>
              </div>
              <FieldLabel label="What happened" required><TextArea className="min-h-[120px]" value={details} onChange={(e) => setDetails(e.target.value)} /></FieldLabel>
              {me && <p className="text-[length:calc(14px*var(--fs))] text-ink-muted">Filed as {residentFullName(me)} · {me.houseNo} {me.street}</p>}
              {err && <p role="alert" className="rounded-md bg-danger-tint px-3 py-2 text-[length:calc(14.5px*var(--fs))] text-danger-ink">{err}</p>}
              <ActionStack>
                <Button onClick={submit} loading={busy} disabled={busy}>Submit report</Button>
                <Button variant="ghost" onClick={() => navigate('/my/complaints')} disabled={busy}>Cancel</Button>
              </ActionStack>
            </div>
          </Panel>
        )}
      </div>
    </>
  )
}
