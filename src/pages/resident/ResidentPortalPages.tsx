import { ArrowLeft, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { StatusBadge } from '@/components/documents/DocParts'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { FieldLabel, Select, TextArea, TextInput } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, Panel } from '@/components/ui/Panel'
import { BORROWING } from '@/config/barangay'
import { getDocumentType } from '@/documents/catalog'
import { useAsync } from '@/hooks/useAsync'
import { useDocActor } from '@/hooks/useDocActor'
import { formatDate, formatDateTime } from '@/lib/format'
import { STAGE_LABEL, STAGE_TONE, getCase, listCases } from '@/services/caseService'
import { listRequests } from '@/services/documentService'
import { listBorrowings, returnState } from '@/services/equipmentService'
import { ServiceError } from '@/services/mockApi'
import { CHANGEABLE_FIELDS, getHousehold, getResident, listChangeRequests, submitChangeRequest } from '@/services/residentService'
import type { KPCase } from '@/types/case'
import { BORROW_STATUS, RETURN_BADGE } from '@/pages/equipment/badges'
import { BorrowForm, itemsText } from '@/pages/equipment/BorrowingPages'
import { CIVIL_LABEL, age, fullName } from '@/pages/residents/common'
import { NotFound } from '@/pages/system/NotFound'

/** Resident's own record; changes go through the Secretary's review (FR11). */
export function MyProfilePage() {
  const { user } = useAuth()
  const [tick, setTick] = useState(0)
  const me = useAsync(() => getResident(user!.residentId!), [user?.residentId, tick]).data
  const hh = useAsync(() => (me ? getHousehold(me.householdId) : Promise.resolve(undefined)), [me?.householdId]).data
  const mine = useAsync(() => listChangeRequests(), [tick]).data?.filter((c) => c.residentId === user?.residentId) ?? []
  const [field, setField] = useState(CHANGEABLE_FIELDS[0])
  const [value, setValue] = useState('')
  const [reason, setReason] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  if (!me) return <div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />
  const F = ({ k, v }: { k: string; v?: string | number }) => (
    <div><dt className="text-[11.5px] text-ink-muted">{k}</dt><dd className="text-[13.5px] text-navy-900">{v ?? '–'}</dd></div>
  )
  return (
    <>
      <PageHeader title="My Profile" subtitle="Your record in the Barangay 181 master list." />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Panel title={fullName(me)} subtitle={`${me.residentNo} · sample record`}>
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
          </Panel>
          {hh && (
            <Panel title="My household" subtitle={`${hh.household.householdNo} · ${hh.household.families.length} famil${hh.household.families.length > 1 ? 'ies' : 'y'} at this address`}>
              <ul className="space-y-1">{hh.members.filter((m) => m.familyId === me.familyId).map((m) => <li key={m.id} className="flex justify-between text-[13px]"><span className="text-navy-900">{fullName(m)}</span><span className="text-ink-muted">{m.relationship}</span></li>)}</ul>
            </Panel>
          )}
        </div>
        <div className="space-y-4">
          <Panel title="Request a correction" subtitle="The Barangay Secretary reviews it before your official record changes.">
            <div className="space-y-3">
              <FieldLabel label="What needs correcting"><Select value={field} onChange={(e) => setField(e.target.value)}>{CHANGEABLE_FIELDS.map((f) => <option key={f}>{f}</option>)}</Select></FieldLabel>
              <FieldLabel label="Correct information" required><TextInput value={value} onChange={(e) => setValue(e.target.value)} /></FieldLabel>
              <FieldLabel label="Reason" required><TextArea className="min-h-[60px]" value={reason} onChange={(e) => setReason(e.target.value)} /></FieldLabel>
              {msg && <p className="text-[12.5px] text-navy-900">{msg}</p>}
              <Button disabled={!value.trim() || !reason.trim()} onClick={async () => { try { await submitChangeRequest(me.id, field, value.trim(), reason.trim(), user!); setValue(''); setReason(''); setMsg('Sent to the Barangay Secretary for review.'); setTick((t) => t + 1) } catch (e) { setMsg(e instanceof ServiceError ? e.message : 'Failed.') } }}>Submit request</Button>
            </div>
          </Panel>
          {mine.length > 0 && (
            <Panel title="My correction requests">
              <ul className="space-y-2">{mine.map((c) => <li key={c.id} className="flex items-center justify-between gap-2 text-[13px]"><span className="text-navy-900">{c.field}: {c.requestedValue}</span><Badge tone={c.status === 'pending' ? 'warning' : c.status === 'approved' ? 'success' : 'danger'}>{c.status === 'pending' ? 'Under review' : c.status === 'approved' ? 'Approved' : 'Not approved'}</Badge></li>)}</ul>
            </Panel>
          )}
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
          {docs.length === 0 ? <p className="px-5 py-6 text-[13px] text-ink-muted">No reports submitted.</p> : (
            <ul>{docs.map((d) => <li key={d.id} className="border-b border-line-soft last:border-0"><Link to={`/my/documents/${d.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-sky-50"><span><span className="block text-[13px] font-semibold text-navy-900">{getDocumentType(d.typeId).name}</span><span className="block text-[12px] text-ink-muted">{d.referenceNo}</span></span><StatusBadge status={d.status} /></Link></li>)}</ul>
          )}
        </Panel>
        <Panel title="My cases" subtitle="Cases where you are the complainant" bodyClassName="px-0 py-0">
          {cases.length === 0 ? <p className="px-5 py-6 text-[13px] text-ink-muted">No cases.</p> : (
            <ul>{cases.map((c) => <li key={c.id} className="border-b border-line-soft last:border-0"><Link to={`/my/complaints/${c.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-sky-50"><span><span className="block text-[13px] font-semibold text-navy-900">{c.caseNo} · {c.title}</span><span className="block text-[12px] text-ink-muted">{c.nature}</span></span><Badge tone={STAGE_TONE[c.stage]}>{STAGE_LABEL[c.stage]}</Badge></Link></li>)}</ul>
          )}
        </Panel>
      </div>
    </>
  )
}

/** Complainant's view of a case: no internal notes, no other party's contact details. */
export function MyCaseDetailPage() {
  const { id = '' } = useParams()
  const actor = useDocActor()!
  const [c, setC] = useState<KPCase | null>(null)
  const [missing, setMissing] = useState(false)
  useEffect(() => {
    getCase(id, actor).then(setC).catch(() => setMissing(true))
  }, [id, actor])
  if (missing) return <NotFound />
  if (!c) return <div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />
  const upcoming = c.hearings.filter((h) => h.status === 'scheduled')
  return (
    <>
      <Link to="/my/complaints" className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-muted hover:text-navy-900"><ArrowLeft className="size-4" /> My Complaints</Link>
      <PageHeader eyebrow={c.caseNo} title={c.title} subtitle={c.nature} actions={<Badge tone={STAGE_TONE[c.stage]}>{STAGE_LABEL[c.stage]}</Badge>} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Your hearings">
          {upcoming.length === 0 ? <p className="text-[13px] text-ink-muted">No upcoming hearing.</p> : upcoming.map((h) => (
            <p key={h.id} className="text-[13.5px] text-navy-900"><strong>{formatDateTime(h.scheduledAt)}</strong> at the {h.place}<span className="block text-[12px] text-ink-muted">{h.kind === 'lupon_mediation' ? 'Lupon mediation' : 'Mediation with the Barangay Chairman'}. Please bring your witnesses and any documents.</span></p>
          ))}
          {c.outcome && <p className="mt-3 rounded-md bg-success-tint px-3 py-2 text-[13px] text-navy-900">{c.outcome.summary}</p>}
        </Panel>
        <Panel title="Updates">
          <ol className="space-y-2">{[...c.history].reverse().map((h, i) => <li key={i} className="text-[13px]"><span className="font-semibold text-navy-900">{h.action}</span><span className="block text-[12px] text-ink-muted">{formatDateTime(h.at)}</span></li>)}</ol>
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
  const [form, setForm] = useState(false)
  const me = useAsync(() => getResident(user!.residentId!), [user?.residentId]).data
  const list = useAsync(() => listBorrowings(actor), [actor, tick]).data ?? []
  return (
    <>
      <PageHeader title="Borrow Equipment" subtitle={`Chairs, tables, ladders and nebulizers. Claim approved equipment at the Barangay 181 Hall; return it within ${BORROWING.periodDays} days (plus a ${BORROWING.graceDays}-day grace period).`} actions={!form && <Button icon={<Plus className="size-4" />} onClick={() => setForm(true)}>New request</Button>} />
      {form && me && <BorrowForm resident={me} onDone={() => { setForm(false); setTick((t) => t + 1) }} />}
      <Card className="divide-y divide-line-soft">
        {list.length === 0 && <p className="px-5 py-6 text-[13px] text-ink-muted">No borrowing requests yet.</p>}
        {list.map((b) => {
          const rs = returnState(b)
          return (
            <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <span>
                <span className="block text-[13.5px] font-semibold text-navy-900">{b.refNo} · {itemsText(b)}</span>
                <span className="block text-[12px] text-ink-muted">Date of use {formatDate(b.dateOfUse)}{b.dueAt && ` · return by ${formatDate(b.dueAt)} (grace until ${formatDate(b.graceEndsAt!)})`}</span>
              </span>
              {b.status === 'released' ? <Badge tone={RETURN_BADGE[rs].tone}>{RETURN_BADGE[rs].label}</Badge> : <Badge tone={BORROW_STATUS[b.status].tone}>{BORROW_STATUS[b.status].label}</Badge>}
            </div>
          )
        })}
      </Card>
    </>
  )
}
