import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BackLink } from '@/components/ui/BackLink'
import { Button } from '@/components/ui/Button'
import { FieldLabel, Select, TextArea, TextInput } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { getDocumentType } from '@/documents/catalog'
import { useDocActor } from '@/hooks/useDocActor'
import { mockDocumentRequests } from '@/mocks/documentRequests'
import { createCase } from '@/services/caseService'
import { ServiceError } from '@/services/mockApi'

const str = (v: unknown) => (Array.isArray(v) ? v.join(', ') : typeof v === 'string' ? v : '')

/** New blotter entry: walk-in complaint, or an online complaint/report being recorded. */
export function NewCasePage() {
  const actor = useDocActor()!
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const src = useMemo(() => mockDocumentRequests.find((r) => r.id === params.get('from')), [params])
  const v = src?.values ?? {}
  const [f, setF] = useState(() => ({
    complainantName: str(v.complainantName) || src?.requesterName || '',
    complainantAddress: str(v.complainantAddress),
    complainantContact: str(v.complainantContact) || str(v.reporterContact),
    respondentName: str(v.respondentName),
    respondentAddress: str(v.respondentAddress),
    nature: str(v.caseFor) || str(v.offense) || str(v.incidentTypes),
    incidentDate: str(v.incidentDate),
    incidentPlace: str(v.incidentPlace),
    details: str(v.complaintDetails) || str(v.narration) || str(v.narrative),
    filedVia: (src ? 'online' : 'walk_in') as 'online' | 'walk_in',
  }))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const c = await createCase(
        {
          nature: f.nature,
          complainants: [{ name: f.complainantName.trim(), address: f.complainantAddress.trim(), contactNo: f.complainantContact.trim() || undefined, residentId: src?.residentId }],
          respondents: [{ name: f.respondentName.trim(), address: f.respondentAddress.trim() }],
          details: f.details,
          incidentDate: f.incidentDate,
          incidentPlace: f.incidentPlace,
          filedVia: f.filedVia,
          sourceRequestId: src?.id,
        },
        actor,
      )
      navigate(`/cases/${c.id}`, { replace: true })
    } catch (e) {
      setError(e instanceof ServiceError ? e.message : 'Something went wrong.')
      setBusy(false)
    }
  }

  return (
    <>
      <BackLink fallbackTo="/cases" fallbackLabel="Cases" />
      <PageHeader
        title="New blotter entry"
        subtitle={src ? `From ${getDocumentType(src.typeId).name} ${src.referenceNo}. Check the details, then record it.` : 'Record a complaint received at the Barangay Hall. A blotter number and case number are given automatically.'}
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Complainant">
          <div className="grid gap-3">
            <FieldLabel label="Full name" required><TextInput value={f.complainantName} onChange={set('complainantName')} /></FieldLabel>
            <FieldLabel label="Address" required><TextInput value={f.complainantAddress} onChange={set('complainantAddress')} /></FieldLabel>
            <FieldLabel label="Contact number"><TextInput inputMode="tel" value={f.complainantContact} onChange={set('complainantContact')} /></FieldLabel>
          </div>
        </Panel>
        <Panel title="Respondent">
          <div className="grid gap-3">
            <FieldLabel label="Full name" required><TextInput value={f.respondentName} onChange={set('respondentName')} /></FieldLabel>
            <FieldLabel label="Address" required><TextInput value={f.respondentAddress} onChange={set('respondentAddress')} /></FieldLabel>
          </div>
        </Panel>
        <Panel title="Complaint" className="xl:col-span-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FieldLabel label="Nature of the complaint" required><TextInput value={f.nature} onChange={set('nature')} placeholder="e.g. Unpaid debt, noise, boundary dispute" /></FieldLabel>
            <FieldLabel label="Received"><Select value={f.filedVia} onChange={set('filedVia')}><option value="walk_in">At the Barangay Hall</option><option value="online">Online</option></Select></FieldLabel>
            <FieldLabel label="Date of incident"><TextInput type="date" max={new Date().toISOString().slice(0, 10)} value={f.incidentDate} onChange={set('incidentDate')} /></FieldLabel>
            <FieldLabel label="Place of incident"><TextInput value={f.incidentPlace} onChange={set('incidentPlace')} /></FieldLabel>
            <div className="sm:col-span-2">
              <FieldLabel label="What happened" required><TextArea className="min-h-[120px]" value={f.details} onChange={set('details')} /></FieldLabel>
            </div>
          </div>
          {error && <p role="alert" className="mt-3 rounded-md bg-danger-tint px-3 py-2 text-[length:calc(15px*var(--fs))] text-danger-ink">{error}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={submit} loading={busy}>Record in blotter</Button>
            <Button variant="secondary" onClick={() => navigate(-1)}>Cancel</Button>
          </div>
        </Panel>
      </div>
    </>
  )
}
