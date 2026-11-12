import { useSteps } from '@/hooks/useSteps'
import { StepProgress } from '@/components/ui/StepProgress'
import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, Clock } from '@/icons'
import { useAuth } from '@/auth/useAuth'
import { ActionStack } from '@/components/ui/ActionStack'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { BARANGAY_CONTACT } from '@/config/barangay'
import { getDocumentType } from '@/documents/catalog'
import { SlotChooser } from '@/pages/appointments/AppointmentPages'
import { claimFor, dateLong, formatTime, lengthOf } from '@/services/appointmentService'
import { ServiceError } from '@/services/mockApi'
import { cancelMyPickup, pickupDays, pickupEligibility, pickupTimes, runPickupChecks, schedulePickup } from '@/services/pickupService'
import type { DocumentRequest } from '@/types/document'
import { InfoRows, Section } from './parts'

const when = (d: Date) => `${dateLong(d.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }))}, ${formatTime(d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Manila' }))}`

/**
 * Pickup for a document request: book a time from the estimated ready time
 * on, change or cancel it. The pickup is linked to this request only; booking
 * it does not make the document ready.
 */
export function PickupSection({ req, onChange }: { req: DocumentRequest; onChange: () => void }) {
  const { user } = useAuth()
  const [tick, setTick] = useState(0)
  useEffect(() => { runPickupChecks(); setTick((t) => t + 1) }, [req.status])
  const claim = useMemo(() => claimFor(req.id), [req.id, tick]) // eslint-disable-line react-hooks/exhaustive-deps
  const el = useMemo(() => pickupEligibility(req), [req, tick]) // eslint-disable-line react-hooks/exhaustive-deps
  // Same step controller as every other form: one move per tap, Back keeps the chosen time.
  const steps = useSteps(['view', 'pick', 'review'] as const)
  const mode = steps.current
  const [slot, setSlot] = useState({ date: '', time: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const type = getDocumentType(req.typeId)
  const days = useMemo(() => (mode === 'pick' ? pickupDays(req) : []), [mode, req, tick]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!user) return null
  const ready = req.status === 'ready_for_pickup'
  const booked = claim?.date ? claim : undefined
  const minutes = lengthOf('document_claim', [])
  const refresh = () => { setTick((t) => t + 1); onChange() }
  const book = async () => {
    setBusy(true); setErr(null)
    try { await schedulePickup(req.id, slot.date, slot.time, user); setOk(booked ? 'Your pickup time was changed.' : 'Your pickup time is booked.'); steps.goTo('view'); refresh() }
    catch (e) { setErr(e instanceof ServiceError ? e.message : 'The pickup time could not be saved. Please try again.'); steps.goTo('pick') }
    finally { setBusy(false) }
  }
  const cancel = async () => {
    setBusy(true); setErr(null)
    try { await cancelMyPickup(req.id, user); setOk('Your pickup time was cancelled. You can choose a new one anytime.'); setCancelling(false); refresh() }
    catch (e) { setErr(e instanceof ServiceError ? e.message : 'The pickup time could not be cancelled.'); setCancelling(false) }
    finally { setBusy(false) }
  }

  return (
    <Section title="Pickup at the Barangay Hall">
      {ok && <p role="status" className="mb-3 rounded-[var(--radius-control)] bg-success-tint px-4 py-3 text-[length:calc(15.5px*var(--fs))] text-navy-900">{ok}</p>}
      {err && mode === 'view' && <p role="alert" className="mb-3 rounded-[var(--radius-control)] bg-danger-tint px-4 py-3 text-[length:calc(15.5px*var(--fs))] text-danger-ink">{err}</p>}

      {mode === 'view' && (booked ? (
        <div className="rounded-[var(--radius-control)] border-2 border-navy-900/15 bg-surface px-4 py-4">
          <p className="flex items-center gap-2 text-[length:calc(15px*var(--fs))] font-semibold text-ink-nav"><CalendarClock className="size-5 shrink-0" /> Your pickup</p>
          <p className="mt-1 text-[length:calc(19px*var(--fs))] font-bold text-navy-900">{dateLong(booked.date)}, {formatTime(booked.time)}</p>
          <p className="mt-1 text-[length:calc(15.5px*var(--fs))] text-navy-900">
            {ready ? 'Your document is ready. Please come at this time.' : 'Booked. Your document is still being prepared; this time stands once it is ready, and we will notify you.'}
          </p>
          <ActionStack className="mt-3">
            <Button variant="secondary" onClick={() => { setSlot({ date: '', time: '' }); setErr(null); setOk(null); steps.next() }}>Change pickup time</Button>
            <Button variant="ghost" onClick={() => setCancelling(true)}>Cancel pickup time</Button>
          </ActionStack>
        </div>
      ) : 'blocked' in el ? (
        <p className="flex items-start gap-2 text-[length:calc(15.5px*var(--fs))] text-navy-900"><Clock className="icon-line w-5 text-ink-nav" /> {el.blocked}</p>
      ) : (
        <div>
          <p className="text-[length:calc(16px*var(--fs))] text-navy-900">
            {ready ? 'Your document is ready. Choose when you will pick it up.' : <>You can choose your pickup time now. The earliest is <strong>{when(el.from)}</strong>, after your document is expected to be ready.</>}
          </p>
          <ActionStack className="mt-3">
            <Button onClick={() => { setSlot({ date: '', time: '' }); setErr(null); setOk(null); steps.next() }}>Choose pickup time</Button>
          </ActionStack>
        </div>
      ))}

      {mode !== 'view' && <StepProgress labels={['Choose a time', 'Check and book']} index={steps.index - 1} className="mb-3" />}
      {mode === 'pick' && (
        <div className="space-y-3">
          {err && <p role="alert" className="rounded-[var(--radius-control)] bg-danger-tint px-4 py-3 text-[length:calc(15.5px*var(--fs))] text-danger-ink">{err}</p>}
          {!('blocked' in el) && !ready && <p className="text-[length:calc(15.5px*var(--fs))] text-ink-nav">Only times after {when(el.from)} are shown.</p>}
          <SlotChooser kind="document_claim" minutes={minutes} value={slot} onChange={setSlot} days={days} timesFor={(d) => pickupTimes(req, d)} nextLabel="Next: review" onNext={() => steps.next(() => !!slot.date && !!slot.time)} onBack={() => steps.back()} />
        </div>
      )}

      {mode === 'review' && (
        <div className="space-y-3">
          <p className="text-[length:calc(18px*var(--fs))] font-bold text-navy-900">Please check your pickup</p>
          <InfoRows rows={[
            ['Document', `${type.name} (${req.referenceNo})`],
            ['Date', dateLong(slot.date)],
            ['Time', formatTime(slot.time)],
            ['Status', ready ? 'Ready for pickup' : 'Still being prepared. We will notify you when it is ready.'],
          ]} />
          <ActionStack row>
            <Button loading={busy} onClick={book}>{booked ? 'Change pickup time' : 'Book pickup time'}</Button>
            <Button variant="secondary" onClick={() => steps.back()}>Choose another time</Button>
          </ActionStack>
        </div>
      )}

      <div className="mt-4 border-t border-line-soft pt-3">
        <InfoRows rows={[
          ['Where', `${BARANGAY_CONTACT.hall}, ${BARANGAY_CONTACT.address}`],
          ['Bring', `A valid ID and your reference number ${req.referenceNo}${type.fee ? '. The fee is paid at the Barangay Hall before release' : ''}.`],
          ['Someone claiming for you', 'They bring an authorization letter signed by you, a copy of your valid ID, and their own valid ID.'],
        ]} />
      </div>
      {cancelling && (
        <ConfirmDialog title="Cancel this pickup time?" confirmLabel="Cancel pickup time" cancelLabel="Keep it" destructive busy={busy} onCancel={() => setCancelling(false)} onConfirm={cancel}>
          Your request stays open. You can choose a new pickup time anytime.
        </ConfirmDialog>
      )}
    </Section>
  )
}
