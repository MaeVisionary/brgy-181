import { Paperclip, Plus } from '@/icons'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { StatusLabel } from '@/components/ui/StatusLabel'
import { borrowingStatusForResident, caseStageForResident, documentStatusForResident } from '@/lib/residentStatus'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { FieldLabel, Select, TextArea, TextInput } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, Panel } from '@/components/ui/Panel'
import { BORROWING } from '@/config/barangay'
import { getDocumentType } from '@/documents/catalog'
import { useAsync } from '@/hooks/useAsync'
import { useDocActor } from '@/hooks/useDocActor'
import { formatDate } from '@/lib/format'
import { listCases } from '@/services/caseService'
import { listRequests } from '@/services/documentService'
import { listBorrowings, returnState } from '@/services/equipmentService'
import { ServiceError } from '@/services/mockApi'
import { CHANGEABLE_FIELDS, PROOF_REQUIRED, displayRequestedValue, getHousehold, getResident, listChangeRequests, submitChangeRequest } from '@/services/residentService'
import { RETURN_BADGE } from '@/pages/equipment/badges'
import { BorrowForm, itemsText } from '@/pages/equipment/BorrowingPages'
import { CIVIL_LABEL, age, fullName } from '@/pages/residents/common'

/** Resident's own record and family; corrections go through the Secretary's review. */
export function MyProfilePage() {
  const { user } = useAuth()
  const [tick, setTick] = useState(0)
  const me = useAsync(() => getResident(user!.residentId!), [user?.residentId, tick]).data
  const hh = useAsync(() => (me ? getHousehold(me.householdId) : Promise.resolve(undefined)), [me?.householdId, tick]).data
  const family = hh?.members.filter((m) => m.familyId === me?.familyId) ?? []
  const mine = useAsync(() => listChangeRequests(), [tick]).data?.filter((c) => c.residentId === user?.residentId || c.requestedByResidentId === user?.residentId) ?? []
  const [whoId, setWhoId] = useState('')
  const [field, setField] = useState<string>(CHANGEABLE_FIELDS[0])
  const [value, setValue] = useState('')
  const [name, setName] = useState({ first: '', middle: '', last: '', suffix: '' })
  const [reason, setReason] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [onsite, setOnsite] = useState(false)
  if (!me) return <div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />
  const who = family.find((m) => m.id === whoId) ?? me
  const requested = field === 'Full name' ? [name.first, name.middle, name.last, name.suffix].join('|') : value
  const filled = field === 'Full name' ? !!(name.first.trim() && name.last.trim()) : !!value.trim()
  const needsProof = PROOF_REQUIRED[field]
  const proofOk = !needsProof || !!proofFile || onsite
  const reset = () => {
    setValue('')
    setName({ first: '', middle: '', last: '', suffix: '' })
    setReason('')
    setProofFile(null)
    setOnsite(false)
  }
  const submit = async () => {
    try {
      await submitChangeRequest(who.id, field, requested.trim(), reason.trim(), user!, needsProof ? { fileName: proofFile?.name, url: proofFile ? URL.createObjectURL(proofFile) : undefined, bringOnsite: onsite && !proofFile } : undefined)
      reset()
      setMsg({ ok: true, text: 'Sent to the Barangay Secretary for review. The record changes once it is approved.' })
      setTick((t) => t + 1)
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ServiceError ? e.message : 'Your request could not be sent.' })
    }
  }
  const F = ({ k, v }: { k: string; v?: string | number }) => (
    <div><dt className="text-[13.5px] text-ink-muted">{k}</dt><dd className="text-[15.5px] text-navy-900">{v || '–'}</dd></div>
  )
  const sectors = [me.sectors.seniorCitizen && 'Senior citizen', me.sectors.pwd && 'PWD', me.sectors.soloParent && 'Solo parent', me.sectors.fourPs && '4Ps member', me.sectors.programBeneficiary && 'Program beneficiary'].filter(Boolean) as string[]
  return (
    <>
      <PageHeader title="My Profile" subtitle="Your record in the Barangay 181 master list." />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Panel keepSubtitle title={fullName(me)} subtitle={`Resident no. ${me.residentNo}`}>
            <dl className="grid gap-3 sm:grid-cols-3">
              <F k="Birthdate" v={formatDate(me.birthDate)} />
              <F k="Age" v={age(me)} />
              <F k="Civil status" v={CIVIL_LABEL[me.civilStatus]} />
              <F k="Address" v={`${me.houseNo} ${me.street}`} />
              <F k="Contact number" v={me.contactNo} />
              <F k="Resident since" v={me.residentSince} />
              <F k="Employment" v={me.employment} />
              <F k="Educational attainment" v={me.education} />
              <F k="Registered voter" v={me.voter ? 'Yes' : 'No'} />
            </dl>
            <div className="mt-4 border-t border-line-soft pt-3">
              <p className="text-[13.5px] text-ink-muted">Sectors</p>
              {sectors.length ? (
                <p className="mt-1 flex flex-wrap gap-1.5">{sectors.map((x) => <Badge key={x} dot={false} tone="info">{x}</Badge>)}</p>
              ) : (
                <p className="mt-1 text-[15px] text-ink-muted">No sector recorded (senior citizen, PWD, solo parent, 4Ps or program beneficiary).</p>
              )}
            </div>
          </Panel>
          {hh && (
            <Panel keepSubtitle title="My family" subtitle={`Household ${hh.household.householdNo} · ${hh.household.families.length} famil${hh.household.families.length > 1 ? 'ies' : 'y'} at this address`} bodyClassName="px-0 py-0">
              <table className="w-full text-[15px]">
                <thead><tr className="bg-surface-muted text-left">{['Name', 'Relationship', 'Age'].map((h) => <th key={h} className="label-caps px-5 py-2">{h}</th>)}</tr></thead>
                <tbody>
                  {family.map((m) => (
                    <tr key={m.id} className="border-t border-line-soft">
                      <td className="px-5 py-2.5 font-semibold text-navy-900">{fullName(m)}{m.id === me.id && <span className="ml-1 font-normal text-ink-muted">(you)</span>}</td>
                      <td className="px-5 py-2.5 text-ink-nav">{m.relationship}</td>
                      <td className="px-5 py-2.5 tabular-nums text-ink-nav">{age(m)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          )}
        </div>
        <div className="space-y-4">
          <Panel title="Request a correction" subtitle="The Barangay Secretary reviews it before the official record changes.">
            <div className="space-y-3">
              <FieldLabel label="Whose record">
                <Select value={who.id} onChange={(e) => { setWhoId(e.target.value === me.id ? '' : e.target.value); setMsg(null) }}>
                  {family.map((m) => <option key={m.id} value={m.id}>{m.id === me.id ? `Me (${fullName(m)})` : `${fullName(m)} · ${m.relationship}`}</option>)}
                </Select>
              </FieldLabel>
              <FieldLabel label="What needs correcting">
                <Select value={field} onChange={(e) => { setField(e.target.value); reset(); setMsg(null) }}>{CHANGEABLE_FIELDS.map((f) => <option key={f}>{f}</option>)}</Select>
              </FieldLabel>
              {field === 'Full name' ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <FieldLabel label="First name" required><TextInput value={name.first} onChange={(e) => setName((n) => ({ ...n, first: e.target.value }))} /></FieldLabel>
                  <FieldLabel label="Middle name"><TextInput value={name.middle} onChange={(e) => setName((n) => ({ ...n, middle: e.target.value }))} /></FieldLabel>
                  <FieldLabel label="Last name" required><TextInput value={name.last} onChange={(e) => setName((n) => ({ ...n, last: e.target.value }))} /></FieldLabel>
                  <FieldLabel label="Suffix"><TextInput value={name.suffix} onChange={(e) => setName((n) => ({ ...n, suffix: e.target.value }))} placeholder="Jr., Sr., III" /></FieldLabel>
                </div>
              ) : field === 'Birthdate' ? (
                <FieldLabel label="Correct birthdate" required hint="Age updates automatically once the correction is approved.">
                  <TextInput type="date" max={new Date().toISOString().slice(0, 10)} value={value} onChange={(e) => setValue(e.target.value)} />
                </FieldLabel>
              ) : field === 'Civil status' ? (
                <FieldLabel label="Correct civil status" required>
                  <Select value={value} onChange={(e) => setValue(e.target.value)}><option value="">Select</option>{['Single', 'Married', 'Widowed', 'Separated', 'Live-in'].map((o) => <option key={o}>{o}</option>)}</Select>
                </FieldLabel>
              ) : field === 'Relationship in the family' ? (
                <FieldLabel label="Correct relationship" required>
                  <Select value={value} onChange={(e) => setValue(e.target.value)}><option value="">Select</option>{['Head', 'Spouse', 'Partner', 'Son', 'Daughter', 'Mother', 'Father', 'Grandchild', 'Sibling', 'Relative'].map((o) => <option key={o}>{o}</option>)}</Select>
                </FieldLabel>
              ) : (
                <FieldLabel label="Correct information" required><TextInput value={value} onChange={(e) => setValue(e.target.value)} /></FieldLabel>
              )}
              {needsProof && (
                <div className="rounded-[var(--radius-control)] border border-warning/50 bg-warning-tint/40 p-3">
                  <p className="text-[14.5px] font-semibold text-navy-900">Proof needed <span className="text-danger-ink">*</span> <span className="font-normal text-ink-muted">(required)</span></p>
                  <p className="text-[14px] text-ink-nav">{needsProof}</p>
                  <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-2 rounded-[var(--radius-control)] border border-dashed border-line bg-surface px-3 py-2 text-[15px] text-navy-900 hover:border-navy-600 hover:bg-sky-50">
                    <Paperclip className="size-4 shrink-0 text-ink-muted" />
                    <span className="min-w-0 flex-1 truncate">{proofFile ? proofFile.name : 'Attach a photo or PDF'}</span>
                    <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setProofFile(f); setOnsite(false) } }} />
                  </label>
                  <label className="mt-2 flex items-center gap-2 text-[14.5px] text-navy-900">
                    <input type="checkbox" className="size-4 accent-[#002132]" checked={onsite} disabled={!!proofFile} onChange={(e) => setOnsite(e.target.checked)} />
                    I will bring the original document to the Barangay Hall instead
                  </label>
                </div>
              )}
              <FieldLabel label="Reason" required><TextArea className="min-h-[60px]" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: My birthdate on record does not match my birth certificate." /></FieldLabel>
              {msg && <p className={`rounded-md px-3 py-2 text-[14.5px] ${msg.ok ? 'bg-success-tint text-navy-900' : 'bg-danger-tint text-danger-ink'}`}>{msg.text}</p>}
              <Button disabled={!filled || !reason.trim() || !proofOk} onClick={submit}>Submit request</Button>
            </div>
          </Panel>
          <Panel title="My correction requests" bodyClassName={mine.length ? undefined : 'px-0 py-0'}>
            {mine.length === 0 ? (
              <p className="px-5 py-5 text-[15px] text-ink-muted">You have not requested any corrections.</p>
            ) : (
              <ul className="space-y-2">
                {mine.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 text-[15px]">
                    <span className="text-navy-900">{c.field}: {displayRequestedValue(c.field, c.requestedValue)}</span>
                    <Badge tone={c.status === 'pending' ? 'warning' : c.status === 'approved' ? 'success' : 'danger'}>{c.status === 'pending' ? 'Under review' : c.status === 'approved' ? 'Approved' : 'Not approved'}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  )
}

/** Resident's complaints, incident and blotter reports, and KP cases they filed. */
export function MyComplaintsPage() {
  const actor = useDocActor()!
  const docs = useAsync(() => listRequests(actor), [actor]).data?.filter((d) => getDocumentType(d.typeId).category === 'case') ?? []
  const cases = useAsync(() => listCases(actor), [actor]).data ?? []
  return (
    <>
      <PageHeader title="My Complaints and Reports" subtitle="Summons requests, incident reports, blotter reports and Katarungang Pambarangay cases you filed." actions={<ButtonLink to="/my/documents/new" icon={<Plus className="size-4" />}>File a report</ButtonLink>} />
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Submitted reports" bodyClassName="px-0 py-0">
          {docs.length === 0 ? <p className="px-5 py-6 text-[15px] text-ink-muted">No reports submitted.</p> : (
            <ul>{docs.map((d) => <li key={d.id} className="border-b border-line-soft last:border-0"><Link to={`/my/documents/${d.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-sky-50"><span><span className="block text-[15px] font-semibold text-navy-900">{getDocumentType(d.typeId).name}</span><span className="block text-[14px] text-ink-muted">{d.referenceNo}</span></span><StatusLabel status={documentStatusForResident(d.status)} /></Link></li>)}</ul>
          )}
        </Panel>
        <Panel title="My cases" subtitle="Cases where you are the complainant" bodyClassName="px-0 py-0">
          {cases.length === 0 ? <p className="px-5 py-6 text-[15px] text-ink-muted">No cases.</p> : (
            <ul>{cases.map((c) => <li key={c.id} className="border-b border-line-soft last:border-0"><Link to={`/my/complaints/${c.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-sky-50"><span><span className="block text-[15px] font-semibold text-navy-900">{c.caseNo} · {c.title}</span><span className="block text-[14px] text-ink-muted">{c.nature}</span></span><StatusLabel status={caseStageForResident(c.stage)} /></Link></li>)}</ul>
          )}
        </Panel>
      </div>
    </>
  )
}

/** Resident's equipment borrowing: request and track (FR21–FR22). */
export function MyBorrowingPage() {
  const { user } = useAuth()
  const actor = useDocActor()!
  const [tick, setTick] = useState(0)
  const [params] = useSearchParams()
  const [form, setForm] = useState(params.get('new') === '1')
  const me = useAsync(() => getResident(user!.residentId!), [user?.residentId]).data
  const list = useAsync(() => listBorrowings(actor), [actor, tick]).data ?? []
  return (
    <>
      <PageHeader title="Equipment Borrowing" subtitle={`Chairs, tables, ladders and nebulizers. Claim approved equipment at the Barangay 181 Hall; return it within ${BORROWING.periodDays} days (plus a ${BORROWING.graceDays}-day grace period).`} actions={!form && <Button icon={<Plus className="size-4" />} onClick={() => setForm(true)}>New request</Button>} />
      {form && me && <BorrowForm resident={me} onDone={() => { setForm(false); setTick((t) => t + 1) }} />}
      <Card className="divide-y divide-line-soft">
        {list.length === 0 && <p className="px-5 py-6 text-[15px] text-ink-muted">No borrowing requests yet.</p>}
        {list.map((b) => {
          const rs = returnState(b)
          return (
            <Link key={b.id} to={`/my/borrowing/${b.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 hover:bg-sky-50 sm:px-5">
              <span>
                <span className="block text-[15.5px] font-semibold text-navy-900">{b.refNo} · {itemsText(b)}</span>
                <span className="block text-[14px] text-ink-muted">Date of use {formatDate(b.dateOfUse)}{b.dueAt && ` · return by ${formatDate(b.dueAt)} (grace until ${formatDate(b.graceEndsAt!)})`}</span>
              </span>
              <span className="flex items-center gap-2">
                {b.status === 'released' && rs !== 'overdue' && <Badge tone={RETURN_BADGE[rs].tone}>{RETURN_BADGE[rs].label}</Badge>}
                <StatusLabel status={borrowingStatusForResident(b)} />
              </span>
            </Link>
          )
        })}
      </Card>
    </>
  )
}
