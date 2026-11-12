import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

/** Dedicated complaint / report form (never a document request). */
export function NewComplaintPage() {
  const actor = useDocActor()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [me, setMe] = useState<Resident | null>(null)
  const [category, setCategory] = useState<ComplaintCategory | null>(null)
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

  return (
    <>
      <BackLink to="/my/complaints">My Complaints and Reports</BackLink>
      <PageHeader title="File a report" />
      <div className="space-y-4">
        <Panel title="What are you reporting?">
          <div role="radiogroup" aria-label="Report type" className="grid gap-2 sm:grid-cols-3">
            {COMPLAINT_CATEGORIES.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={category === c} onClick={() => { setCategory(c); setErr(null) }} className={cn('min-h-12 rounded-[var(--radius-control)] border px-3.5 py-2.5 text-left text-[15px] font-semibold', category === c ? 'border-navy-900 bg-sky-100 text-navy-900' : 'border-line text-navy-900 hover:bg-sky-50')}>
                {c}
              </button>
            ))}
          </div>
        </Panel>

        {category && (
          <Panel title="Details">
            <div className="space-y-3">
              <FieldLabel label="Subject" required><TextInput value={nature} onChange={(e) => setNature(e.target.value)} placeholder={category === 'Community concern' ? 'e.g. Broken streetlight' : 'e.g. Unpaid loan'} /></FieldLabel>
              {category === 'Complaint against a person' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <FieldLabel label="Person you are complaining about" required><TextInput value={who.name} onChange={(e) => setWho((w) => ({ ...w, name: e.target.value }))} /></FieldLabel>
                  <FieldLabel label="Their address, if known"><TextInput value={who.address} onChange={(e) => setWho((w) => ({ ...w, address: e.target.value }))} /></FieldLabel>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <FieldLabel label="Date"><TextInput type="date" max={new Date().toISOString().slice(0, 10)} value={date} onChange={(e) => setDate(e.target.value)} /></FieldLabel>
                <FieldLabel label="Place"><TextInput value={place} onChange={(e) => setPlace(e.target.value)} /></FieldLabel>
              </div>
              <FieldLabel label="What happened" required><TextArea className="min-h-[120px]" value={details} onChange={(e) => setDetails(e.target.value)} /></FieldLabel>
              {me && <p className="text-[14px] text-ink-muted">Filed as {residentFullName(me)} · {me.houseNo} {me.street}</p>}
              {err && <p role="alert" className="rounded-md bg-danger-tint px-3 py-2 text-[14.5px] text-danger-ink">{err}</p>}
              <div className="flex gap-2">
                <Button onClick={submit} loading={busy} disabled={busy}>Submit report</Button>
                <Button variant="ghost" onClick={() => navigate('/my/complaints')} disabled={busy}>Cancel</Button>
              </div>
            </div>
          </Panel>
        )}
      </div>
    </>
  )
}
