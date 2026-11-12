import { useState } from 'react'
import { FileText, Upload } from '@/icons'
import { Button } from '@/components/ui/Button'
import { fileToJpeg } from '@/lib/faceVerify'
import { sniff } from '@/lib/uploads'
import { ServiceError } from '@/services/mockApi'
import { lookupRegistration, respondToRequest, type AltSubmission, type RegistrationStatusView } from '@/services/registrationService'
import { PublicLayout } from './PublicLayout'

/**
 * Registration status for applicants whose account is not active yet. They open
 * their own registration with the reference number and birth date (wrong tries
 * are limited), see the status, any visit schedule, and answer requests for more
 * information. No other person's data is reachable from here.
 */
const field = 'h-12 w-full rounded-lg border border-line bg-surface px-4 text-[length:calc(17px*var(--fs))] text-navy-900 focus:border-navy-600 focus:outline-none'

export function RegistrationStatusPage() {
  const [ref, setRef] = useState('')
  const [birth, setBirth] = useState('')
  const [view, setView] = useState<RegistrationStatusView | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const open = async () => {
    if (!ref.trim() || !birth) { setErr('Enter your reference number and your birth date.'); return }
    setBusy(true); setErr(null)
    try { setView(await lookupRegistration(ref, birth)) } catch (e) { setErr(e instanceof ServiceError ? e.message : 'Please try again.') } finally { setBusy(false) }
  }
  return (
    <PublicLayout minimal>
      <div className="mx-auto max-w-[760px] px-3 py-6 sm:px-6 sm:py-12">
        <h1 className="font-display text-[length:calc(26px*var(--fs))] font-extrabold text-navy-900">Registration status</h1>
        {!view ? (
          <section className="mt-4 rounded-lg border border-line bg-surface p-4 sm:p-8">
            <p className="text-[length:calc(16px*var(--fs))] text-navy-900">Enter the reference number you received when you registered, and your birth date.</p>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block"><span className="mb-1.5 block text-[length:calc(16px*var(--fs))] font-semibold text-navy-900">Reference number</span><input className={field} value={ref} onChange={(e) => setRef(e.target.value)} placeholder="REG-2026-0000" /></label>
              <label className="block"><span className="mb-1.5 block text-[length:calc(16px*var(--fs))] font-semibold text-navy-900">Birth date</span><input type="date" className={field} value={birth} onChange={(e) => setBirth(e.target.value)} /></label>
            </div>
            {err && <p role="alert" className="mt-3 text-[length:calc(15.5px*var(--fs))] text-danger-ink">{err}</p>}
            <div className="mt-5"><Button className="w-full sm:w-auto" loading={busy} onClick={open}>Show my status</Button></div>
          </section>
        ) : (
          <StatusView view={view} birth={birth} onUpdate={setView} />
        )}
      </div>
    </PublicLayout>
  )
}

function StatusView({ view, birth, onUpdate }: { view: RegistrationStatusView; birth: string; onUpdate: (v: RegistrationStatusView) => void }) {
  const open = view.alt?.requests.filter((r) => !r.response) ?? []
  return (
    <div className="mt-4 space-y-4">
      <section className="rounded-lg border border-line bg-surface p-4 sm:p-6">
        <p className="text-[length:calc(15px*var(--fs))] text-ink-nav">{view.referenceNo}</p>
        <p className="mt-1 font-display text-[length:calc(22px*var(--fs))] font-bold text-navy-900">{view.alt && !view.approved && !view.rejected ? view.alt.label : view.status}</p>
        <p className="mt-2 text-[length:calc(16px*var(--fs))] text-navy-900">
          {view.approved ? 'Your registration was approved. You can now sign in to the resident portal.'
            : view.rejected ? `Your registration was not approved. ${view.reason ?? ''} If something was incomplete or wrong, you can register again with corrected information, or visit the Barangay Hall to ask for reconsideration.`
            : open.length ? 'The Barangay Secretary needs more information. Please answer below.'
            : view.alt?.schedule ? 'Please come to your verification visit below.'
            : 'The Barangay Secretary is checking your registration. You will be told by e-mail when there is news.'}
        </p>
      </section>
      {view.alt?.schedule && !view.approved && !view.rejected && (
        <section className="rounded-lg border-2 border-navy-900/15 bg-surface p-4 sm:p-6">
          <h2 className="text-[length:calc(18px*var(--fs))] font-bold text-navy-900">Your verification visit</h2>
          <p className="mt-1 text-[length:calc(17px*var(--fs))] font-semibold text-navy-900">{new Date(`${view.alt.schedule.date}T12:00:00+08:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}, {view.alt.schedule.time}</p>
          <p className="text-[length:calc(16px*var(--fs))] text-navy-900">{view.alt.schedule.location}</p>
          {view.alt.schedule.instructions && <p className="mt-1 text-[length:calc(16px*var(--fs))] text-ink-nav">{view.alt.schedule.instructions}</p>}
        </section>
      )}
      {view.visit && (
        <section className="rounded-lg border border-line bg-surface p-4 sm:p-6">
          <h2 className="text-[length:calc(18px*var(--fs))] font-bold text-navy-900">Please visit the Barangay Hall</h2>
          <p className="mt-1 text-[length:calc(16px*var(--fs))] text-navy-900">{view.visit.reason}. Bring: {view.visit.bring}.{view.visit.date ? ` Date: ${view.visit.date}${view.visit.time ? `, ${view.visit.time}` : ''}.` : ''}</p>
        </section>
      )}
      {open.map((r) => <Answer key={r.id} refNo={view.referenceNo} birth={birth} request={r} onUpdate={onUpdate} />)}
    </div>
  )
}

function Answer({ refNo, birth, request, onUpdate }: { refNo: string; birth: string; request: NonNullable<RegistrationStatusView['alt']>['requests'][number]; onUpdate: (v: RegistrationStatusView) => void }) {
  const [note, setNote] = useState('')
  const [docs, setDocs] = useState<AltSubmission['documents']>([])
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const add = async (file?: File) => {
    if (!file) return
    const kind = await sniff(file)
    if (kind === 'pdf') {
      if (file.size > 1_500_000) { setErr('This PDF is larger than 1.5 MB.'); return }
      const dataUrl = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(file) })
      setDocs((d) => [...d, { category: 'Requested document', fileName: file.name, dataUrl, kind: 'pdf' }])
    } else if (kind === 'jpeg' || kind === 'png') {
      setDocs((d) => [...d, { category: 'Requested document', fileName: file.name, dataUrl: '', kind: 'image' }])
      const dataUrl = await fileToJpeg(file)
      setDocs((d) => d.map((x) => (x.fileName === file.name && !x.dataUrl ? { ...x, dataUrl } : x)))
    } else setErr('Use a JPG or PNG photo, or a PDF.')
  }
  const send = async () => {
    setBusy(true); setErr(null)
    try { onUpdate(await respondToRequest(refNo, birth, request.id, note, docs)); setDone(true) } catch (e) { setErr(e instanceof ServiceError ? e.message : 'It could not be sent. Please try again.') } finally { setBusy(false) }
  }
  if (done) return <p role="status" className="rounded-lg bg-success-tint px-4 py-3 text-[length:calc(16px*var(--fs))] text-navy-900">Sent. The Barangay Secretary will review it.</p>
  return (
    <section className="rounded-lg border border-line bg-surface p-4 sm:p-6">
      <h2 className="text-[length:calc(18px*var(--fs))] font-bold text-navy-900">Please send: {request.items}</h2>
      <p className="mt-1 text-[length:calc(16px*var(--fs))] text-navy-900">{request.explanation}</p>
      <p className="mt-1 text-[length:calc(16px*var(--fs))] text-ink-nav">{request.instructions}{request.deadline ? ` Please send it by ${request.deadline}.` : ''}</p>
      <label className="mt-3 block"><span className="mb-1.5 block text-[length:calc(16px*var(--fs))] font-semibold text-navy-900">Your answer</span>
        <textarea className="min-h-[96px] w-full rounded-lg border border-line px-4 py-3 text-[length:calc(17px*var(--fs))] text-navy-900 focus:border-navy-600 focus:outline-none" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {docs.length > 0 && <ul className="mt-2 space-y-1">{docs.map((d) => <li key={d.fileName} className="flex items-center gap-2 text-[length:calc(15.5px*var(--fs))] break-all text-navy-900"><FileText className="size-5 shrink-0 text-ink-nav" />{d.fileName}</li>)}</ul>}
      <label className="mt-3 inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-4 text-[length:calc(16px*var(--fs))] font-semibold text-navy-900 hover:bg-surface-muted">
        <Upload className="size-5" /> Add photo or PDF
        <input type="file" accept="image/jpeg,image/png,application/pdf" className="sr-only" onChange={(e) => { void add(e.target.files?.[0]); e.target.value = '' }} />
      </label>
      {err && <p role="alert" className="mt-2 text-[length:calc(15.5px*var(--fs))] text-danger-ink">{err}</p>}
      <div className="mt-4"><Button className="w-full sm:w-auto" loading={busy} onClick={send}>Send</Button></div>
    </section>
  )
}
