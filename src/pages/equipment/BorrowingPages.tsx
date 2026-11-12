import { RowList } from '@/components/ui/RowList'
import { BellRing, Plus } from '@/icons'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BackLink } from '@/components/ui/BackLink'
import { useAuth } from '@/auth/useAuth'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { FieldLabel, Select, TextArea, TextInput } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, Panel } from '@/components/ui/Panel'
import { useAsync } from '@/hooks/useAsync'
import { useDocActor } from '@/hooks/useDocActor'
import { formatDate, formatDateTime } from '@/lib/format'
import { mockEquipment } from '@/mocks/equipment'
import { userById } from '@/mocks/users'
import { actOnBorrowing, approvedDaysFor, availableFor, availableQty, borrowingPolicy, extendReturn, fmtDue, getBorrowing, listBorrowings, listEquipment, outstanding, qtyOf, requestBorrowing, returnState, runBorrowingJobs, sendLateNotice } from '@/services/equipmentService'
import { appointmentFor, formatTime } from '@/services/appointmentService'
import { ServiceError } from '@/services/mockApi'
import { searchResidents } from '@/services/residentService'
import type { Borrowing } from '@/types/equipment'
import type { Resident } from '@/types/resident'
import { NotFound } from '@/pages/system/NotFound'
import { SampleBadge } from '@/pages/dashboard/shared'
import { BORROW_STATUS, RETURN_BADGE } from './badges'
import { useStickyState } from '@/hooks/useStickyState'
import { Timeline } from '@/components/ui/Timeline'
import { ActionStack } from '@/components/ui/ActionStack'

const eqName = (id: string) => mockEquipment.find((e) => e.id === id)?.name ?? id
export const itemsText = (b: Borrowing) => b.items.map((i) => `${qtyOf(i)} × ${eqName(i.equipmentId)}`).join(', ')

/** Borrowing requests, releases and returns (FR21–FR22). */
export function BorrowingPage() {
  const actor = useDocActor()!
  const { can } = useAuth()
  const navigate = useNavigate()
  const [tick, setTick] = useState(0)
  const list = useAsync(() => listBorrowings(actor), [actor, tick]).data
  const [status, setStatus] = useStickyState('status', '')
  const [encoding, setEncoding] = useState(false)
  const rows = (list ?? []).filter((b) => !status || (status === 'overdue' ? returnState(b) === 'overdue' : b.status === status))
  return (
    <>
      <PageHeader
        title="Equipment Borrowing"
        actions={<><SampleBadge />{can('borrowing.approve') && <Button icon={<Plus className="size-4" />} onClick={() => setEncoding((x) => !x)}>Encode walk-in request</Button>}</>}
      />
      {encoding && <BorrowForm assisted onDone={(b) => { setEncoding(false); setTick((t) => t + 1); if (b) navigate(`/borrowing/${b.id}`) }} />}
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-line-soft p-4">
          <Select className="w-56" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
            <option value="">All transactions</option>
            <option value="pending">New requests</option>
            <option value="approved">Approved: to prepare</option>
            <option value="ready">Ready for pickup</option>
            <option value="released">Borrowed</option>
            <option value="overdue">Overdue</option>
            <option value="returned">Damage review</option>
            <option value="completed">Completed</option>
            <option value="rejected">Not approved</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        </div>
        <RowList rows={rows.map((b) => { const rs = returnState(b); const st = b.status === 'released' ? RETURN_BADGE[rs] : BORROW_STATUS[b.status]; return { key: b.id, to: `/borrowing/${b.id}`, title: b.borrowerName, subtitle: `${b.refNo} · ${itemsText(b)}`, trailing: <Badge tone={st.tone}>{st.label}</Badge> } })} />
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[820px] text-[length:calc(15px*var(--fs))]">
            <thead><tr className="bg-surface-muted text-left">{['Ref. no.', 'Borrower', 'Items', 'Date of use', 'Due / grace', 'Status'].map((h) => <th key={h} className="label-caps px-4 py-2.5">{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((b) => {
                const rs = returnState(b)
                return (
                  <tr key={b.id} onClick={() => navigate(`/borrowing/${b.id}`)} className="cursor-pointer border-t border-line-soft hover:bg-sky-50">
                    <td className="px-4 py-3 font-semibold whitespace-nowrap text-navy-900">{b.refNo}</td>
                    <td className="px-4 py-3"><span className="block text-navy-900">{b.borrowerName}</span><span className="block text-[length:calc(13.5px*var(--fs))] text-ink-muted">{b.address}</span></td>
                    <td className="px-4 py-3">{itemsText(b)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(b.dateOfUse)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{b.dueAt ? <>{formatDate(b.dueAt)}<span className="block text-[length:calc(13.5px*var(--fs))] text-ink-muted">grace to {formatDate(b.graceEndsAt!)}</span></> : <span className="text-ink-subtle">Set on release</span>}</td>
                    <td className="px-4 py-3">{b.status === 'released' ? <Badge tone={RETURN_BADGE[rs].tone}>{RETURN_BADGE[rs].label}</Badge> : <Badge tone={BORROW_STATUS[b.status].tone}>{BORROW_STATUS[b.status].label}</Badge>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

export function BorrowingDetailPage() {
  const { id = '' } = useParams()
  const actor = useDocActor()!
  const { can } = useAuth()
  const [b, setB] = useState<Borrowing | null>(null)
  const [missing, setMissing] = useState(false)
  const [remarks, setRemarks] = useState('')
  const [condition, setCondition] = useState('Good')
  const [idOk, setIdOk] = useState(false)
  const [ack, setAck] = useState(false)
  const [approve, setApprove] = useState<Record<string, string>>({})
  const [ret, setRet] = useState<Record<string, { good: string; damaged: string; missing: string }>>({})
  const [newDate, setNewDate] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = (x: Borrowing) => {
    setB(x)
    setApprove(Object.fromEntries(x.items.map((i) => [i.equipmentId, String(i.qty)])))
    setRet(Object.fromEntries(x.items.map((i) => [i.equipmentId, { good: String(Math.max(0, outstanding(i))), damaged: '0', missing: '0' }])))
  }
  useEffect(() => { runBorrowingJobs(); getBorrowing(id, actor).then(load).catch(() => setMissing(true)) }, [id, actor])
  if (missing) return <NotFound />
  if (!b) return <div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />

  const rs = returnState(b)
  const act = async (fn: () => Promise<Borrowing>, ok: string) => {
    setMsg(null)
    try { load(await fn()); setRemarks(''); setMsg({ ok: true, text: ok }) } catch (e) { setMsg({ ok: false, text: e instanceof ServiceError ? e.message : 'Not saved.' }) }
  }
  const badge = b.status === 'released' ? RETURN_BADGE[rs] : BORROW_STATUS[b.status]
  const pickup = appointmentFor('equipment_pickup', b.id)
  const policy = borrowingPolicy()
  const len = (b.approvedDays ?? approvedDaysFor(b)) + policy.graceDays
  const until = new Date(new Date(`${b.dateOfUse}T12:00:00+08:00`).getTime() + len * 86_400_000).toISOString().slice(0, 10)
  const box = 'rounded-[var(--radius-control)] bg-surface-muted px-4 py-3 text-[length:calc(16px*var(--fs))] text-navy-900'

  return (
    <>
      <BackLink fallbackTo="/borrowing" fallbackLabel="Borrowing" />
      <PageHeader eyebrow={b.refNo} title={b.borrowerName} actions={<Badge tone={badge.tone}>{badge.label}</Badge>} />
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`mb-3 rounded-[var(--radius-control)] px-4 py-3 text-[length:calc(16px*var(--fs))] ${msg.ok ? 'bg-success-tint text-navy-900' : 'bg-danger-tint text-danger-ink'}`}>{msg.text}</p>}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Panel title="Equipment">
            <ul className="divide-y divide-line-soft">
              {b.items.map((i) => (
                <li key={i.equipmentId} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 text-[length:calc(16px*var(--fs))]">
                  <span className="font-semibold text-navy-900">{eqName(i.equipmentId)} × {qtyOf(i)}{i.approvedQty !== undefined && <span className="font-normal text-ink-muted"> (asked {i.qty})</span>}</span>
                  {i.returnedGood !== undefined && <span className="text-ink-nav">Good {i.returnedGood} · Damaged {i.returnedDamaged ?? 0} · Missing {i.missing ?? 0}{outstanding(i) > 0 ? ` · Still out ${outstanding(i)}` : ''}</span>}
                </li>
              ))}
            </ul>
            <dl className="mt-3 grid grid-cols-1 gap-3 text-[length:calc(16px*var(--fs))] sm:grid-cols-2">
              <div><dt className="text-ink-muted">Date of use</dt><dd className="text-navy-900">{formatDate(b.dateOfUse)}{b.statedReturnDate ? ` to ${formatDate(b.statedReturnDate)}` : ''}</dd></div>
              <div><dt className="text-ink-muted">Pickup</dt><dd className="text-navy-900">{pickup?.date ? `${formatDate(pickup.date)} · ${formatTime(pickup.time)}` : b.status === 'approved' || b.status === 'ready' ? 'Resident has not chosen a time' : '–'}</dd></div>
              <div><dt className="text-ink-muted">Released</dt><dd className="text-navy-900">{b.releasedAt ? formatDateTime(b.releasedAt) : '–'}</dd></div>
              <div><dt className="text-ink-muted">Return deadline</dt><dd className="font-semibold text-navy-900">{b.dueAt ? fmtDue(b.dueAt) : 'Set on release'}{b.graceEndsAt && b.graceEndsAt !== b.dueAt ? <span className="block font-normal text-ink-muted">Grace until {fmtDue(b.graceEndsAt)}</span> : null}</dd></div>
              <div><dt className="text-ink-muted">Address</dt><dd className="text-navy-900">{b.address}</dd></div>
              {b.returnedAt && <div><dt className="text-ink-muted">Returned</dt><dd className="text-navy-900">{formatDateTime(b.returnedAt)}</dd></div>}
            </dl>
            {b.conditionOnRelease && <p className="mt-3 text-[length:calc(16px*var(--fs))] text-ink-nav">Condition on release: {b.conditionOnRelease}</p>}
            {b.returnNotes && <p className="mt-1 text-[length:calc(16px*var(--fs))] text-navy-900">Return notes: {b.returnNotes}</p>}
          </Panel>
          <Panel title="History">
            <Timeline items={b.history.map((h) => ({
              at: h.at, title: h.action + (h.internal ? ' (Barangay Personnel only)' : ''), by: h.byUserId === 'system' ? 'System' : userById(h.byUserId)?.fullName ?? 'Resident',
              tone: /(reject|not approved|overdue|cancel|no-show|not verified|damage|referred|settled|closed|approved|decided)/i.test(h.action) ? 'important' as const : undefined,
              details: h.remarks ? <p>{h.remarks}</p> : undefined,
            }))} />
          </Panel>
        </div>

        <Panel title="Next step">
          <div className="space-y-4">
            {b.status === 'pending' && (
              <>
                <div className={box}>
                  <p className="font-semibold">Free for {formatDate(b.dateOfUse)} to {formatDate(until)}</p>
                  <ul className="mt-1">{b.items.map((i) => { const free = availableFor(i.equipmentId, b.dateOfUse, until, b.id); return <li key={i.equipmentId} className={free < i.qty ? 'text-danger-ink' : ''}>{eqName(i.equipmentId)}: {free} free, {i.qty} asked</li> })}</ul>
                  {b.estimate && !b.estimate.ok && <p className="mt-1 text-ink-nav">{b.estimate.note}</p>}
                </div>
                {can('borrowing.approve') && (
                  <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {b.items.map((i) => (
                        <FieldLabel key={i.equipmentId} label={`Approve ${eqName(i.equipmentId)}`}>
                          <TextInput inputMode="numeric" value={approve[i.equipmentId] ?? ''} onChange={(e) => setApprove((s) => ({ ...s, [i.equipmentId]: e.target.value.replace(/\D/g, '') }))} />
                        </FieldLabel>
                      ))}
                    </div>
                    <TextArea className="min-h-[60px]" placeholder="Reason (needed when approving fewer or not approving)" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                    <ActionStack>
                      <Button onClick={() => act(() => actOnBorrowing(b.id, 'approve', actor, { remarks, approvedQty: Object.fromEntries(Object.entries(approve).map(([k, v]) => [k, Number(v || 0)])) }), 'Approved. The resident was asked to choose a pickup time.')}>Approve</Button>
                      <Button variant="danger" onClick={() => act(() => actOnBorrowing(b.id, 'reject', actor, { remarks }), 'Marked as not approved. The resident was told.')}>Not approved</Button>
                    </ActionStack>
                  </>
                )}
              </>
            )}

            {b.status === 'approved' && can('borrowing.release') && (
              <>
                <FieldLabel label="Condition after preparing"><TextInput value={condition} onChange={(e) => setCondition(e.target.value)} /></FieldLabel>
                <Button variant="secondary" onClick={() => act(() => actOnBorrowing(b.id, 'ready', actor, { condition }), 'Marked as ready for pickup. The resident was told.')}>Prepared: ready for pickup</Button>
              </>
            )}

            {(b.status === 'approved' || b.status === 'ready') && can('borrowing.release') && (
              <div className="space-y-2 border-t border-line-soft pt-4">
                <p className="text-[length:calc(16px*var(--fs))] font-semibold text-navy-900">Release to the borrower</p>
                <label className="flex min-h-11 items-center gap-2.5 text-[length:calc(16px*var(--fs))] text-navy-900"><input type="checkbox" className="size-5 accent-[#002132]" checked={idOk} onChange={(e) => setIdOk(e.target.checked)} /> Valid ID checked and matches</label>
                <label className="flex min-h-11 items-center gap-2.5 text-[length:calc(16px*var(--fs))] text-navy-900"><input type="checkbox" className="size-5 accent-[#002132]" checked={ack} onChange={(e) => setAck(e.target.checked)} /> Borrower confirmed the items and quantities</label>
                <FieldLabel label="Condition on release"><TextInput value={condition} onChange={(e) => setCondition(e.target.value)} /></FieldLabel>
                <p className="text-[length:calc(15.5px*var(--fs))] text-ink-nav">Return deadline will be {b.approvedDays ?? approvedDaysFor(b)} days from today at {policy.returnTime}.</p>
                <Button disabled={!idOk || !ack} onClick={() => act(() => actOnBorrowing(b.id, 'release', actor, { condition, idPresented: idOk, acknowledged: ack }), 'Released. The deadline was set and the resident was told.')}>Record release</Button>
              </div>
            )}

            {b.status === 'released' && can('borrowing.release') && (
              <>
                {(rs === 'overdue' || rs === 'grace') && <p role="alert" className="rounded-[var(--radius-control)] bg-danger-tint px-4 py-3 text-[length:calc(16px*var(--fs))] text-danger-ink">Due {fmtDue(b.dueAt!)}.</p>}
                <p className="text-[length:calc(16px*var(--fs))] font-semibold text-navy-900">Return inspection</p>
                {b.items.filter((i) => outstanding(i) > 0).map((i) => (
                  <div key={i.equipmentId} className="rounded-[var(--radius-control)] border border-line p-3">
                    <p className="text-[length:calc(16px*var(--fs))] font-semibold text-navy-900">{eqName(i.equipmentId)} ({outstanding(i)} still out)</p>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {(['good', 'damaged', 'missing'] as const).map((k) => (
                        <label key={k} className="text-[length:calc(15px*var(--fs))] text-ink-nav capitalize">{k}
                          <TextInput inputMode="numeric" value={ret[i.equipmentId]?.[k] ?? ''} onChange={(e) => setRet((s) => ({ ...s, [i.equipmentId]: { ...s[i.equipmentId], [k]: e.target.value.replace(/\D/g, '') } }))} />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                <TextArea className="min-h-[60px]" placeholder="Notes on damaged or missing items" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                <Button onClick={() => act(() => actOnBorrowing(b.id, 'return', actor, { remarks, returns: b.items.filter((i) => outstanding(i) > 0).map((i) => ({ equipmentId: i.equipmentId, good: Number(ret[i.equipmentId]?.good || 0), damaged: Number(ret[i.equipmentId]?.damaged || 0), missing: Number(ret[i.equipmentId]?.missing || 0) })) }), 'Return recorded.')}>Record return</Button>
                {can('borrowing.approve') && (
                  <div className="space-y-2 border-t border-line-soft pt-4">
                    <p className="text-[length:calc(16px*var(--fs))] font-semibold text-navy-900">Move the return date</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <TextInput type="date" aria-label="New return date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                      <TextInput aria-label="Reason" placeholder="Reason" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                    </div>
                    <Button variant="secondary" disabled={!newDate} onClick={() => act(() => extendReturn(b.id, newDate, remarks, actor), 'New return date saved. The resident was told.')}>Save new date</Button>
                  </div>
                )}
                {(rs === 'overdue' || rs === 'grace') && <Button variant="ghost" icon={<BellRing className="size-4" />} onClick={() => act(() => sendLateNotice(b.id, actor), 'Reminder sent.')}>Send a reminder now</Button>}
              </>
            )}

            {b.status === 'returned' && can('borrowing.approve') && (
              <>
                <p className={box}>Damaged or missing items need a decision.</p>
                <TextArea className="min-h-[60px]" placeholder="How it was settled" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                <Button onClick={() => act(() => actOnBorrowing(b.id, 'close_review', actor, { remarks }), 'Review closed.')}>Close review</Button>
              </>
            )}

            {['pending', 'approved', 'ready'].includes(b.status) && can('borrowing.approve') && (
              <div className="border-t border-line-soft pt-4">
                <Button variant="ghost" onClick={() => act(() => actOnBorrowing(b.id, 'cancel', actor, { remarks }), 'Cancelled. The resident was told.')}>Cancel request (reason above)</Button>
              </div>
            )}
            {['completed', 'rejected', 'cancelled'].includes(b.status) && <p className="text-[length:calc(16px*var(--fs))] text-ink-nav">Closed.</p>}
          </div>
        </Panel>
      </div>
    </>
  )
}

/** Borrowing request form: resident (own name) or staff encoding a walk-in. */
export function BorrowForm({ assisted, resident, onDone }: { assisted?: boolean; resident?: Resident; onDone: (b?: Borrowing) => void }) {
  const actor = useDocActor()!
  const equipment = useAsync(listEquipment).data
  const [who, setWho] = useState<Resident | null>(resident ?? null)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Resident[]>([])
  const [qty, setQty] = useState<Record<string, string>>({})
  const [dateOfUse, setDateOfUse] = useState('')
  const [stated, setStated] = useState('')
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!assisted || q.trim().length < 2) { setResults([]); return }
    searchResidents(q).then(setResults)
  }, [q, assisted])

  const submit = async () => {
    if (!who) { setErr('Choose the borrower.'); return }
    setErr(null)
    try {
      const b = await requestBorrowing({
        residentId: who.id,
        borrowerName: `${who.firstName} ${who.lastName}`,
        address: `${who.houseNo} ${who.street}, Gagalangin, Tondo, Manila`,
        items: Object.entries(qty).map(([equipmentId, v]) => ({ equipmentId, qty: Number(v || 0) })),
        dateOfUse,
        statedReturnDate: stated,
        assisted: !!assisted,
      }, actor)
      onDone(b)
    } catch (e) {
      setErr(e instanceof ServiceError ? e.message : 'Failed.')
    }
  }

  return (
    <Panel className="mb-4" title={assisted ? 'Encode walk-in borrowing request' : 'What do you need?'} >
      {assisted && !who && (
        <FieldLabel label="Borrower (resident)" required>
          <TextInput placeholder="Search name" value={q} onChange={(e) => setQ(e.target.value)} />
          {results.length > 0 && <ul className="mt-1 rounded-md border border-line">{results.map((r) => <li key={r.id}><button type="button" onClick={() => setWho(r)} className="w-full px-3 py-1.5 text-left text-[length:calc(15px*var(--fs))] hover:bg-sky-50">{r.firstName} {r.lastName} · {r.houseNo} {r.street}</button></li>)}</ul>}
        </FieldLabel>
      )}
      {who && <p className="text-[length:calc(15px*var(--fs))] text-navy-900"><strong>{who.firstName} {who.lastName}</strong> · {who.houseNo} {who.street}, Gagalangin, Tondo, Manila {assisted && <button type="button" className="ml-2 text-[length:calc(14px*var(--fs))] font-semibold text-info" onClick={() => setWho(null)}>Change</button>}</p>}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(equipment ?? []).map((e) => (
          <FieldLabel key={e.id} label={`${e.name} (${availableQty(e)} available)`}>
            <TextInput inputMode="numeric" placeholder="0" value={qty[e.id] ?? ''} onChange={(ev) => setQty((s) => ({ ...s, [e.id]: ev.target.value.replace(/\D/g, '') }))} />
          </FieldLabel>
        ))}
        <FieldLabel label="Date of use" required><TextInput type="date" value={dateOfUse} onChange={(e) => setDateOfUse(e.target.value)} /></FieldLabel>
        <FieldLabel label="Return date"><TextInput type="date" value={stated} onChange={(e) => setStated(e.target.value)} /></FieldLabel>
      </div>
      {err && <p className="mt-2 text-[length:calc(14.5px*var(--fs))] text-danger-ink">{err}</p>}
      <ActionStack className="mt-3"><Button onClick={submit}>Submit request</Button><Button variant="ghost" onClick={() => onDone()}>Cancel</Button></ActionStack>
    </Panel>
  )
}

export { Select }
