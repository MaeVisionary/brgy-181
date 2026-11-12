import { useEffect, useMemo, useState } from 'react'
import { DraftConflictNote, DraftIndicator, DraftRecoveryCard, useDraft } from '@/hooks/useDraft'
import { MSG, focusFirstInvalid, hasErrors } from '@/lib/validation'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/ui/Button'
import { FieldLabel, TextArea, TextInput } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { residentFullName } from '@/documents/fill'
import { useDocActor } from '@/hooks/useDocActor'
import { COMPLAINT_CATEGORIES, submitComplaint, type ComplaintCategory } from '@/services/caseService'
import { ServiceError } from '@/services/mockApi'
import { getResident } from '@/services/residentService'
import type { Resident } from '@/types/resident'
import { SelectionCard, SelectionGrid } from '@/components/ui/SelectionCard'
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
  const [touched, setTouched] = useState(false)
  const draftValue = useMemo(() => ({ nature, details, date, place, who }), [nature, details, date, place, who])
  const draft = useDraft(`complaint:${kind ?? ''}`, draftValue, { enabled: !!category && category !== 'Community concern' })
  const load = (d: typeof draftValue | null) => { if (!d) return; setNature(d.nature); setDetails(d.details); setDate(d.date); setPlace(d.place); setWho(d.who) }
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
  // Same rules as submitComplaint in the service layer.
  const errors = {
    nature: !nature.trim() ? MSG.required('a short subject') + ' Example: Unpaid loan' : '',
    who: category === 'Complaint against a person' && !who.name.trim() ? MSG.required('the name of the person you are complaining about') : '',
    date: date && date > today ? 'The date cannot be in the future. Please check the date.' : '',
    details: !details.trim() ? MSG.required('what happened') : details.trim().length < 10 ? 'Please describe what happened in a little more detail (at least 10 characters).' : '',
  }
  const show = (k: keyof typeof errors) => (touched ? errors[k] : '')
  const invalid = (k: keyof typeof errors) => (touched && !!errors[k]) || undefined

  useEffect(() => {
    if (user?.residentId) getResident(user.residentId).then((r) => setMe(r ?? null))
  }, [user?.residentId])

  const submit = async () => {
    if (!actor || !me || !category || busy) return
    setTouched(true)
    if (hasErrors(errors)) { focusFirstInvalid(); return }
    setBusy(true)
    setErr(null)
    try {
      const c = await submitComplaint(
        { category, nature, details, incidentDate: date || undefined, incidentPlace: place, respondents: category === 'Complaint against a person' ? [who] : [] },
        actor,
        { residentId: me.id, name: residentFullName(me), address: `${me.houseNo} ${me.street}`, contactNo: me.contactNo },
        draft.draftId,
      )
      draft.clear()
      navigate(`/my/complaints/${c.id}`, { replace: true })
    } catch (e) {
      setErr(e instanceof ServiceError ? e.message : 'Your report could not be sent because of a problem on our side. What you typed is kept. Please press Submit report again.')
      setBusy(false)
    }
  }

  if (kind && !category) return <Navigate to="/my/complaints/new" replace />
  if (!category) return (
    <>
      <BackLink to="/my/complaints">My Complaints and Reports</BackLink>
      <PageHeader title="What are you reporting?" />
      <SelectionGrid cols="row">
        {COMPLAINT_CATEGORIES.map((c) => <SelectionCard key={c} title={c} onClick={() => navigate(`/my/complaints/new/${SLUG[c]}`)} />)}
      </SelectionGrid>
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
              {draft.recovered && <DraftRecoveryCard savedAt={draft.recovered.savedAt} onContinue={() => load(draft.resume())} onStartOver={draft.startOver} />}
              {draft.conflict && <DraftConflictNote onTake={() => load(draft.takeOther())} onKeep={draft.keepMine} />}
              <FieldLabel label="Subject" required error={show('nature')}><TextInput value={nature} onChange={(e) => setNature(e.target.value)} placeholder="e.g. Unpaid loan" aria-invalid={invalid('nature')} /></FieldLabel>
              {category === 'Complaint against a person' && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FieldLabel label="Person you are complaining about" required error={show('who')}><TextInput value={who.name} onChange={(e) => setWho((w) => ({ ...w, name: e.target.value }))} aria-invalid={invalid('who')} /></FieldLabel>
                  <FieldLabel label="Their address, if known"><TextInput value={who.address} onChange={(e) => setWho((w) => ({ ...w, address: e.target.value }))} /></FieldLabel>
                </div>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FieldLabel label="Date (optional)" error={show('date')}><TextInput type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={invalid('date')} /></FieldLabel>
                <FieldLabel label="Place (optional)"><TextInput value={place} onChange={(e) => setPlace(e.target.value)} /></FieldLabel>
              </div>
              <FieldLabel label="What happened" required error={show('details')}><TextArea className="min-h-[120px]" value={details} onChange={(e) => setDetails(e.target.value)} aria-invalid={invalid('details')} /></FieldLabel>
              {me && <p className="text-[length:calc(14px*var(--fs))] text-ink-muted">Filed as {residentFullName(me)} · {me.houseNo} {me.street}</p>}
              {err && <p role="alert" className="rounded-md bg-danger-tint px-3 py-2 text-[length:calc(14.5px*var(--fs))] text-danger-ink">{err}</p>}
              <DraftIndicator status={draft.status} />
              <ActionStack>
                <Button onClick={submit} loading={busy}>Submit report</Button>
                <Button variant="ghost" onClick={() => { draft.clear(); navigate('/my/complaints') }} disabled={busy}>Cancel</Button>
              </ActionStack>
            </div>
          </Panel>
        )}
      </div>
    </>
  )
}
