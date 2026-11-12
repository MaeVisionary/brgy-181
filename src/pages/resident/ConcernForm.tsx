import { useState } from 'react'
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

  const submit = async () => {
    if (busy) return
    setBusy(true)
    setErr(null)
    try {
      const { submission } = await submitConcern({ category, title, details, street: street || undefined, landmark, startedOn, frequency, photoFileId: photo?.id }, user!)
      navigate(`/my/concerns/${submission.id}`, { replace: true })
    } catch (e) {
      setErr(e instanceof ServiceError ? e.message : 'Your concern could not be sent.')
      setBusy(false)
    }
  }

  return (
    <Panel title="Your concern">
      <div className="space-y-4">
        <FieldLabel label="Short title" required><TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Broken streetlight" /></FieldLabel>
        <FieldLabel label="What is happening?" required><TextArea className="min-h-[110px]" value={details} onChange={(e) => setDetails(e.target.value)} placeholder="e.g. The light post near the corner has not worked for a week. The street is dark at night." /></FieldLabel>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FieldLabel label="Street" required>
            <Select value={street} onChange={(e) => setStreet(e.target.value)}>
              <option value="">Not sure</option>
              {AREAS.map((a) => <option key={a}>{a}</option>)}
            </Select>
          </FieldLabel>
          <FieldLabel label="Nearest landmark"><TextInput value={landmark} onChange={(e) => setLandmark(e.target.value)} placeholder="e.g. near the chapel" /></FieldLabel>
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
              <FieldLabel label="When did it start?"><TextInput type="date" max={new Date().toISOString().slice(0, 10)} value={startedOn} onChange={(e) => setStartedOn(e.target.value)} /></FieldLabel>
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
          <Button onClick={submit} loading={busy}>Send concern</Button>
          <Button variant="ghost" onClick={() => navigate('/my/complaints')} disabled={busy}>Cancel</Button>
        </ActionStack>
      </div>
    </Panel>
  )
}
