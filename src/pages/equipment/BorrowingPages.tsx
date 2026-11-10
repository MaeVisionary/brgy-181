import { BellRing, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BackLink } from '@/components/ui/BackLink'
import { useAuth } from '@/auth/useAuth'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { FieldLabel, Select, TextArea, TextInput } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, Panel } from '@/components/ui/Panel'
import { BORROWING } from '@/config/barangay'
import { ROLES } from '@/config/permissions'
import { useAsync } from '@/hooks/useAsync'
import { useDocActor } from '@/hooks/useDocActor'
import { formatDate, formatDateTime } from '@/lib/format'
import { mockEquipment } from '@/mocks/equipment'
import { userById } from '@/mocks/users'
import { actOnBorrowing, availableQty, getBorrowing, listBorrowings, listEquipment, requestBorrowing, returnState, sendLateNotice } from '@/services/equipmentService'
import { ServiceError } from '@/services/mockApi'
import { searchResidents } from '@/services/residentService'
import type { Borrowing } from '@/types/equipment'
import type { Resident } from '@/types/resident'
import { NotFound } from '@/pages/system/NotFound'
import { SampleBadge } from '@/pages/dashboard/shared'
import { BORROW_STATUS, RETURN_BADGE } from './badges'

const eqName = (id: string) => mockEquipment.find((e) => e.id === id)?.name ?? id
export const itemsText = (b: Borrowing) => b.items.map((i) => `${i.qty} × ${eqName(i.equipmentId)}`).join(', ')

/** Borrowing requests, releases and returns (FR21–FR22). */
export function BorrowingPage() {
  const actor = useDocActor()!
  const { can } = useAuth()
  const navigate = useNavigate()
  const [tick, setTick] = useState(0)
  const list = useAsync(() => listBorrowings(actor), [actor, tick]).data
  const [status, setStatus] = useState('')
  const [encoding, setEncoding] = useState(false)
  const rows = (list ?? []).filter((b) => !status || (status === 'overdue' ? returnState(b) === 'overdue' : b.status === status))
  return (
    <>
      <PageHeader
        title="Equipment Borrowing"
        subtitle={`Fixed ${BORROWING.periodDays}-day borrowing period from release, plus a ${BORROWING.graceDays}-day grace period. ${BORROWING.note}`}
        actions={<><SampleBadge />{can('borrowing.approve') && <Button icon={<Plus className="size-4" />} onClick={() => setEncoding((x) => !x)}>Encode walk-in request</Button>}</>}
      />
      {encoding && <BorrowForm assisted onDone={(b) => { setEncoding(false); setTick((t) => t + 1); if (b) navigate(`/borrowing/${b.id}`) }} />}
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-line-soft p-4">
          <Select className="w-56" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
            <option value="">All transactions</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved: to claim</option>
            <option value="released">Released (on loan)</option>
            <option value="overdue">Overdue</option>
            <option value="returned">Returned</option>
            <option value="rejected">Not approved</option>
          </Select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-[13px]">
            <thead><tr className="bg-surface-muted text-left">{['Ref. no.', 'Borrower', 'Items', 'Date of use', 'Due / grace', 'Status'].map((h) => <th key={h} className="label-caps px-4 py-2.5">{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((b) => {
                const rs = returnState(b)
                return (
                  <tr key={b.id} onClick={() => navigate(`/borrowing/${b.id}`)} className="cursor-pointer border-t border-line-soft hover:bg-sky-50">
                    <td className="px-4 py-3 font-semibold whitespace-nowrap text-navy-900">{b.refNo}</td>
                    <td className="px-4 py-3"><span className="block text-navy-900">{b.borrowerName}</span><span className="block text-[11.5px] text-ink-muted">{b.address}</span></td>
                    <td className="px-4 py-3">{itemsText(b)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(b.dateOfUse)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{b.dueAt ? <>{formatDate(b.dueAt)}<span className="block text-[11.5px] text-ink-muted">grace to {formatDate(b.graceEndsAt!)}</span></> : <span className="text-ink-subtle">Set on release</span>}</td>
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
  const [ret, setRet] = useState<Record<string, { good: string; damaged: string; missing: string }>>({})
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    getBorrowing(id, actor).then((x) => { setB(x); setRet(Object.fromEntries(x.items.map((i) => [i.equipmentId, { good: String(i.qty), damaged: '0', missing: '0' }]))) }).catch(() => setMissing(true))
  }, [id, actor])
  if (missing) return <NotFound />
  if (!b) return <div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />

  const rs = returnState(b)
  const act = async (fn: () => Promise<Borrowing>) => {
    setErr(null)
    try { setB({ ...(await fn()) }); setRemarks('') } catch (e) { setErr(e instanceof ServiceError ? e.message : 'Failed.') }
  }

  return (
    <>
      <BackLink fallbackTo="/borrowing" fallbackLabel="Borrowing" />
      <PageHeader eyebrow={`${b.refNo} · requested ${formatDateTime(b.requestedAt)}`} title={b.borrowerName} subtitle={b.address} actions={b.status === 'released' ? <Badge tone={RETURN_BADGE[rs].tone}>{RETURN_BADGE[rs].label}</Badge> : <Badge tone={BORROW_STATUS[b.status].tone}>{BORROW_STATUS[b.status].label}</Badge>} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Panel title="Borrowing details">
            <dl className="grid gap-3 text-[13px] sm:grid-cols-3">
              <div><dt className="text-[11.5px] text-ink-muted">Date of use</dt><dd className="text-navy-900">{formatDate(b.dateOfUse)}</dd></div>
              <div><dt className="text-[11.5px] text-ink-muted">Return date stated by borrower</dt><dd className="text-navy-900">{b.statedReturnDate ? formatDate(b.statedReturnDate) : '–'}</dd></div>
              <div><dt className="text-[11.5px] text-ink-muted">Released</dt><dd className="text-navy-900">{b.releasedAt ? formatDateTime(b.releasedAt) : '–'}</dd></div>
              <div><dt className="text-[11.5px] text-ink-muted">Due date ({BORROWING.periodDays} days)</dt><dd className="font-semibold text-navy-900">{b.dueAt ? formatDate(b.dueAt) : 'Set on release'}</dd></div>
              <div><dt className="text-[11.5px] text-ink-muted">Grace period ends (+{BORROWING.graceDays} days)</dt><dd className="font-semibold text-navy-900">{b.graceEndsAt ? formatDate(b.graceEndsAt) : 'Set on release'}</dd></div>
              <div><dt className="text-[11.5px] text-ink-muted">Returned</dt><dd className="text-navy-900">{b.returnedAt ? formatDateTime(b.returnedAt) : '–'}</dd></div>
            </dl>
            <table className="mt-4 w-full text-[13px]">
              <thead><tr className="text-left">{['Equipment', 'Qty', 'Good', 'Damaged', 'Missing'].map((h) => <th key={h} className="label-caps py-2">{h}</th>)}</tr></thead>
              <tbody>
                {b.items.map((i) => (
                  <tr key={i.equipmentId} className="border-t border-line-soft">
                    <td className="py-2 font-semibold text-navy-900">{eqName(i.equipmentId)}</td>
                    <td className="py-2 tabular-nums">{i.qty}</td>
                    <td className="py-2 tabular-nums">{i.returnedGood ?? '–'}</td>
                    <td className="py-2 tabular-nums">{i.returnedDamaged ?? '–'}</td>
                    <td className="py-2 tabular-nums">{i.missing ?? '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {b.conditionOnRelease && <p className="mt-3 text-[12.5px] text-ink-muted">Condition on release: {b.conditionOnRelease}</p>}
            {b.returnNotes && <p className="mt-1 text-[12.5px] text-navy-900">Return notes: {b.returnNotes}</p>}
            <p className="mt-3 text-[12px] text-ink-muted">Damaged or missing items are handled according to Barangay policy. No fines are computed by the system.</p>
          </Panel>
          <Panel title="History">
            <ol className="space-y-3">
              {[...b.history].reverse().map((h, i) => (
                <li key={i} className="border-l-2 border-line-soft pl-3">
                  <p className="text-[12.5px] font-semibold text-navy-900">{h.action}</p>
                  <p className="text-[11.5px] text-ink-muted">{formatDateTime(h.at)} · {userById(h.byUserId)?.fullName ?? 'Resident'} ({ROLES[h.byRole].name})</p>
                  {h.remarks && <p className="mt-1 text-[12.5px] text-navy-900">{h.remarks}</p>}
                </li>
              ))}
            </ol>
          </Panel>
        </div>
        <Panel title="Next step">
          {b.status === 'pending' && can('borrowing.approve') && (
            <div className="space-y-3">
              <p className="text-[12.5px] text-ink-muted">Available now: {b.items.map((i) => `${eqName(i.equipmentId)} ${availableQty(mockEquipment.find((e) => e.id === i.equipmentId)!, b.id)}`).join(', ')}</p>
              <TextArea className="min-h-[60px]" placeholder="Note (required when not approving)" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
              <div className="flex gap-2">
                <Button onClick={() => act(() => actOnBorrowing(b.id, 'approve', actor, { remarks }))}>Approve</Button>
                <Button variant="danger" onClick={() => act(() => actOnBorrowing(b.id, 'reject', actor, { remarks }))}>Not approved</Button>
              </div>
            </div>
          )}
          {b.status === 'approved' && can('borrowing.release') && (
            <div className="space-y-3">
              <p className="text-[12.5px] text-ink-muted">Confirm the borrowing details with the resident at the Barangay Hall, then release. The due date is set to {BORROWING.periodDays} days from today.</p>
              <FieldLabel label="Condition on release"><TextInput value={condition} onChange={(e) => setCondition(e.target.value)} /></FieldLabel>
              <Button onClick={() => act(() => actOnBorrowing(b.id, 'release', actor, { condition }))}>Record release</Button>
            </div>
          )}
          {b.status === 'released' && can('borrowing.release') && (
            <div className="space-y-3">
              <p className="text-[12.5px] font-semibold text-navy-900">Return inspection</p>
              {b.items.map((i) => (
                <div key={i.equipmentId} className="rounded-md border border-line p-3">
                  <p className="text-[12.5px] font-semibold text-navy-900">{eqName(i.equipmentId)} (borrowed {i.qty})</p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {(['good', 'damaged', 'missing'] as const).map((k) => (
                      <label key={k} className="text-[11.5px] text-ink-muted capitalize">{k}
                        <TextInput className="h-8" inputMode="numeric" value={ret[i.equipmentId]?.[k] ?? ''} onChange={(e) => setRet((s) => ({ ...s, [i.equipmentId]: { ...s[i.equipmentId], [k]: e.target.value.replace(/\D/g, '') } }))} />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <TextArea className="min-h-[60px]" placeholder="Notes on damaged or missing items" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
              <Button onClick={() => act(() => actOnBorrowing(b.id, 'return', actor, { remarks, returns: b.items.map((i) => ({ equipmentId: i.equipmentId, good: Number(ret[i.equipmentId].good || 0), damaged: Number(ret[i.equipmentId].damaged || 0), missing: Number(ret[i.equipmentId].missing || 0) })) }))}>Record return</Button>
              {(rs === 'overdue' || rs === 'grace') && <Button variant="secondary" icon={<BellRing className="size-3.5" />} onClick={() => act(() => sendLateNotice(b.id, actor))}>Send late-return notice (simulated)</Button>}
            </div>
          )}
          {['returned', 'rejected', 'cancelled'].includes(b.status) && <p className="text-[12.5px] text-ink-muted">This transaction is complete.</p>}
          {err && <p className="mt-3 text-[12.5px] text-danger-ink">{err}</p>}
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
    <Panel className="mb-4" title={assisted ? 'Encode walk-in borrowing request' : 'Request to borrow equipment'} subtitle="Name, address, equipment, quantity, date of use and expected return date.">
      {assisted && !who && (
        <FieldLabel label="Borrower (resident)" required>
          <TextInput placeholder="Search name" value={q} onChange={(e) => setQ(e.target.value)} />
          {results.length > 0 && <ul className="mt-1 rounded-md border border-line">{results.map((r) => <li key={r.id}><button type="button" onClick={() => setWho(r)} className="w-full px-3 py-1.5 text-left text-[13px] hover:bg-sky-50">{r.firstName} {r.lastName} · {r.houseNo} {r.street}</button></li>)}</ul>}
        </FieldLabel>
      )}
      {who && <p className="text-[13px] text-navy-900"><strong>{who.firstName} {who.lastName}</strong> · {who.houseNo} {who.street}, Gagalangin, Tondo, Manila {assisted && <button type="button" className="ml-2 text-[12px] font-semibold text-info" onClick={() => setWho(null)}>Change</button>}</p>}
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(equipment ?? []).map((e) => (
          <FieldLabel key={e.id} label={`${e.name} (${availableQty(e)} available)`}>
            <TextInput inputMode="numeric" placeholder="0" value={qty[e.id] ?? ''} onChange={(ev) => setQty((s) => ({ ...s, [e.id]: ev.target.value.replace(/\D/g, '') }))} />
          </FieldLabel>
        ))}
        <FieldLabel label="Date of use" required><TextInput type="date" value={dateOfUse} onChange={(e) => setDateOfUse(e.target.value)} /></FieldLabel>
        <FieldLabel label="Expected return date" hint={`The official due date is ${BORROWING.periodDays} days after release.`}><TextInput type="date" value={stated} onChange={(e) => setStated(e.target.value)} /></FieldLabel>
      </div>
      {err && <p className="mt-2 text-[12.5px] text-danger-ink">{err}</p>}
      <div className="mt-3 flex gap-2"><Button onClick={submit}>Submit request</Button><Button variant="ghost" onClick={() => onDone()}>Cancel</Button></div>
    </Panel>
  )
}

export { Select }
