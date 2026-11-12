import { useMemo, useState } from 'react'
import { fileMeta } from '@/services/fileStore'
import { DraftConflictNote, DraftIndicator, DraftRecoveryCard, useDraft } from '@/hooks/useDraft'
import { MSG, focusFirstInvalid, hasErrors } from '@/lib/validation'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/ui/Button'
import { FieldLabel, Select, TextArea, TextInput } from '@/components/ui/Field'
import { FileField } from '@/components/ui/FileField'
import { Panel } from '@/components/ui/Panel'
import { CONCERN_CATEGORIES, FREQUENCIES, type ConcernCategory } from '@/concerns/engine'
import { AREAS } from '@/mocks/residents'
import { submitConcern } from '@/services/concernService'
import type { StoredFile } from '@/services/fileStore'
import { ServiceError } from '@/services/mockApi'
import { ActionStack } from '@/components/ui/ActionStack'

/** Community concern: short, plain form. The type is optional; the system suggests one. */
export function ConcernForm() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [category, setCategory] = useState<ConcernCategory | 'Not sure'>('Not sure')
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const [street, setStreet] = useState('')
  const [landmark, setLandmark] = useState('')
  const [startedOn, setStartedOn] = useState('')
  const [frequency, setFrequency] = useState('')
  const [photo, setPhoto] = useState<StoredFile | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [touched, setTouched] = useState(false)
  const draftValue = useMemo(() => ({ category, title, details, street, landmark, startedOn, frequency, photoId: photo?.id ?? '' }), [category, title, details, street, landmark, startedOn, frequency, photo])
  const draft = useDraft('community-concern', draftValue, { isEmpty: (v) => !v.title.trim() && !v.details.trim() && !v.landmark.trim() && !v.photoId })
  const load = (d: typeof draftValue | null) => {
    if (!d) return
    setCategory(d.category); setTitle(d.title); setDetails(d.details); setStreet(d.street); setLandmark(d.landmark); setStartedOn(d.startedOn); setFrequency(d.frequency)
    setPhoto(d.photoId ? fileMeta(d.photoId) ?? null : null)
  }
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
  // Same rules as submitConcern in the service layer.
  const errors = {
    title: title.trim().length < 3 ? (title.trim() ? 'Please make the title a little longer (at least 3 characters).' : MSG.required('a short title') + ' Example: Broken streetlight') : '',
    details: details.trim().length < 10 ? (details.trim() ? 'Please describe it in a little more detail (at least 10 characters).' : MSG.required('what is happening')) : '',
    place: !street && !landmark.trim() ? 'Please choose the street or type the nearest landmark, so we know where it is.' : '',
    startedOn: startedOn && startedOn > today ? 'The start date cannot be in the future.' : '',
  }
  const show = (k: keyof typeof errors) => (touched ? errors[k] : '')
  const invalid = (k: keyof typeof errors) => (touched && !!errors[k]) || undefined

  const submit = async () => {
    if (busy) return
    setTouched(true)
    if (hasErrors(errors)) { focusFirstInvalid(); return }
    setBusy(true)
    setErr(null)
    try {
      const { submission } = await submitConcern({ category, title, details, street: street || undefined, landmark, startedOn, frequency, photoFileId: photo?.id }, user!, draft.draftId)
      draft.clear()
      navigate(`/my/concerns/${submission.id}`, { replace: true })
    } catch (e) {
      setErr(e instanceof ServiceError ? e.message : 'Your concern could not be sent because of a problem on our side. What you typed is kept. Please press Send concern again.')
      setBusy(false)
    }
  }

  return (
    <Panel title="Your concern">
      <div className="space-y-4">
        {draft.recovered && <DraftRecoveryCard savedAt={draft.recovered.savedAt} onContinue={() => load(draft.resume())} onStartOver={draft.startOver} />}
        {draft.conflict && <DraftConflictNote onTake={() => load(draft.takeOther())} onKeep={draft.keepMine} />}
        <FieldLabel label="Short title" required error={show('title')}><TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Broken streetlight" aria-invalid={invalid('title')} /></FieldLabel>
        <FieldLabel label="What is happening?" required error={show('details')}><TextArea className="min-h-[110px]" value={details} onChange={(e) => setDetails(e.target.value)} aria-invalid={invalid('details')} placeholder="e.g. The light post near the corner has not worked for a week. The street is dark at night." /></FieldLabel>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FieldLabel label="Street" error={show('place')}>
            <Select value={street} onChange={(e) => setStreet(e.target.value)} aria-invalid={invalid('place')}>
              <option value="">Not sure</option>
              {AREAS.map((a) => <option key={a}>{a}</option>)}
            </Select>
          </FieldLabel>
          <FieldLabel label="Nearest landmark (if street is not sure)"><TextInput value={landmark} onChange={(e) => setLandmark(e.target.value)} placeholder="e.g. near the chapel" /></FieldLabel>
        </div>
        <FieldLabel label="Type of concern">
          <Select value={category} onChange={(e) => setCategory(e.target.value as ConcernCategory | 'Not sure')}>
            <option value="Not sure">Not sure (we will sort it)</option>
            {CONCERN_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </Select>
        </FieldLabel>
        <details className="rounded-[var(--radius-control)] border border-line-soft px-3 py-2">
          <summary className="min-h-11 cursor-pointer py-2 text-[length:calc(16px*var(--fs))] font-semibold text-navy-900">More details (optional)</summary>
          <div className="space-y-3 pb-2">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FieldLabel label="When did it start?" error={show('startedOn')}><TextInput type="date" max={today} value={startedOn} onChange={(e) => setStartedOn(e.target.value)} aria-invalid={invalid('startedOn')} /></FieldLabel>
              <FieldLabel label="How often?">
                <Select value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                  <option value="">Choose</option>
                  {FREQUENCIES.map((f) => <option key={f}>{f}</option>)}
                </Select>
              </FieldLabel>
            </div>
            <FileField label="Photo" category="proof" value={photo} onChange={setPhoto} />
          </div>
        </details>
        <p className="text-[length:calc(14.5px*var(--fs))] text-ink-muted">Other residents never see your name. If others report the same problem, we handle them together.</p>
        {err && <p role="alert" className="rounded-md bg-danger-tint px-3 py-2 text-[length:calc(15px*var(--fs))] text-danger-ink">{err}</p>}
        <ActionStack>
          <DraftIndicator status={draft.status} />
          <Button onClick={submit} loading={busy}>Send concern</Button>
          <Button variant="secondary" onClick={() => { draft.clear(); navigate('/my/complaints') }} disabled={busy}>Cancel</Button>
        </ActionStack>
      </div>
    </Panel>
  )
}
