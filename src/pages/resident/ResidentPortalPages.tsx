import { RowList } from '@/components/ui/RowList'
import { Plus } from '@/icons'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { StatusLabel } from '@/components/ui/StatusLabel'
import { borrowingStatusForResident, caseStageForResident, documentStatusForResident } from '@/lib/residentStatus'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
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
import { displayRequestedValue, getHousehold, getResident, listChangeRequests } from '@/services/residentService'
import { getIdOnFile, needsUpload, stateOf, submitReplacementId, type IdDocument } from '@/services/identityService'
import { IdStatusLine, IdUploadForm } from '@/components/identity/IdOnFile'
import { CorrectionPanel } from './CorrectionPanel'
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
  const [idDoc, setIdDoc] = useState<IdDocument | undefined | null>(null)
  const [replacing, setReplacing] = useState(false)
  useEffect(() => {
    if (user?.residentId) getIdOnFile(user.residentId, user).then(setIdDoc).catch(() => setIdDoc(undefined))
  }, [user, tick])
  if (!me) return <div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />
  const idState = stateOf(idDoc ?? undefined)
  const F = ({ k, v }: { k: string; v?: string | number }) => (
    <div><dt className="text-[length:calc(13.5px*var(--fs))] text-ink-muted">{k}</dt><dd className="text-[length:calc(15.5px*var(--fs))] text-navy-900">{v || '–'}</dd></div>
  )
  const sectors = [me.sectors.seniorCitizen && 'Senior citizen', me.sectors.pwd && 'PWD', me.sectors.soloParent && 'Solo parent', me.sectors.fourPs && '4Ps member', me.sectors.programBeneficiary && 'Program beneficiary'].filter(Boolean) as string[]
  return (
    <>
      <PageHeader title="My Profile" />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Panel keepSubtitle title={fullName(me)} subtitle={`Resident no. ${me.residentNo}`}>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
              <p className="text-[length:calc(13.5px*var(--fs))] text-ink-muted">Sectors</p>
              {sectors.length ? (
                <p className="mt-1 flex flex-wrap gap-1.5">{sectors.map((x) => <Badge key={x} dot={false} tone="info">{x}</Badge>)}</p>
              ) : (
                <p className="mt-1 text-[length:calc(15px*var(--fs))] text-ink-muted">No sector recorded (senior citizen, PWD, solo parent, 4Ps or program beneficiary).</p>
              )}
            </div>
          </Panel>
          {hh && (
            <Panel keepSubtitle title="My family" subtitle={`Household ${hh.household.householdNo} · ${hh.household.families.length} famil${hh.household.families.length > 1 ? 'ies' : 'y'} at this address`} bodyClassName="px-0 py-0">
              <RowList rows={family.map((m) => ({ key: m.id, title: <>{fullName(m)}{m.id === me.id && <span className="ml-1 font-normal text-ink-muted">(you)</span>}</>, subtitle: `${m.relationship} · ${age(m)}` }))} />
              <table className="hidden w-full text-[length:calc(15px*var(--fs))] md:table">
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
          {idDoc !== null && (
            <Panel title="Valid ID">
              <IdStatusLine doc={idDoc} state={idState} />
              {idState === 'expiring' && <p className="mt-2 text-[length:calc(14px*var(--fs))] text-ink-nav">Upload your renewed ID so your requests are not delayed.</p>}
              {idState !== 'pending' && !replacing && (
                <Button className="mt-3" size="sm" variant={needsUpload(idState) ? 'primary' : 'secondary'} onClick={() => setReplacing(true)}>{idState === 'missing' ? 'Add ID' : 'Replace ID'}</Button>
              )}
              {replacing && (
                <div className="mt-4 border-t border-line-soft pt-4">
                  <IdUploadForm name={me} onCancel={() => setReplacing(false)} onSubmit={async (u) => { await submitReplacementId(me.id, u, user!); setReplacing(false); setTick((x) => x + 1) }} />
                </div>
              )}
            </Panel>
          )}
          <CorrectionPanel onSent={() => setTick((x) => x + 1)} />
          <Panel title="My correction requests" bodyClassName={mine.length ? undefined : 'px-0 py-0'}>
            {mine.length === 0 ? (
              <p className="px-5 py-5 text-[length:calc(15px*var(--fs))] text-ink-muted">You have not requested any corrections.</p>
            ) : (
              <ul className="space-y-2">
                {mine.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 text-[length:calc(15px*var(--fs))]">
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
      <PageHeader title="My Complaints and Reports" actions={<ButtonLink to="/my/complaints/new" icon={<Plus className="size-4" />}>File a report</ButtonLink>} />
      <Panel title="My complaints" bodyClassName="px-0 py-0">
        {cases.length === 0 ? <p className="px-5 py-6 text-[length:calc(15px*var(--fs))] text-ink-muted">No complaints yet.</p> : (
          <ul>{cases.map((c) => <li key={c.id} className="border-b border-line-soft last:border-0"><Link to={`/my/complaints/${c.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-sky-50"><span className="min-w-0"><span className="block truncate text-[length:calc(15px*var(--fs))] font-semibold text-navy-900">{c.nature}</span><span className="block text-[length:calc(14px*var(--fs))] text-ink-muted">{c.caseNo} · {formatDate(c.filedAt)}</span></span><StatusLabel status={caseStageForResident(c.stage)} /></Link></li>)}</ul>
        )}
      </Panel>
      {/* Reports filed through the earlier online forms stay viewable. */}
      {docs.length > 0 && (
        <Panel className="mt-4" title="Earlier reports" bodyClassName="px-0 py-0">
          <ul>{docs.map((d) => <li key={d.id} className="border-b border-line-soft last:border-0"><Link to={`/my/documents/${d.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-sky-50"><span className="min-w-0"><span className="block truncate text-[length:calc(15px*var(--fs))] font-semibold text-navy-900">{getDocumentType(d.typeId).name}</span><span className="block text-[length:calc(14px*var(--fs))] text-ink-muted">{d.referenceNo}</span></span><StatusLabel status={documentStatusForResident(d.status)} /></Link></li>)}</ul>
        </Panel>
      )}
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
        {list.length === 0 && <p className="px-5 py-6 text-[length:calc(15px*var(--fs))] text-ink-muted">No borrowing requests yet.</p>}
        {list.map((b) => {
          const rs = returnState(b)
          return (
            <Link key={b.id} to={`/my/borrowing/${b.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 hover:bg-sky-50 sm:px-5">
              <span>
                <span className="block text-[length:calc(15.5px*var(--fs))] font-semibold text-navy-900">{b.refNo} · {itemsText(b)}</span>
                <span className="block text-[length:calc(14px*var(--fs))] text-ink-muted">Date of use {formatDate(b.dateOfUse)}{b.dueAt && ` · return by ${formatDate(b.dueAt)} (grace until ${formatDate(b.graceEndsAt!)})`}</span>
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
