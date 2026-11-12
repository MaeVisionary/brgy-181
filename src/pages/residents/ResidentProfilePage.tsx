import { Home } from '@/icons'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BackLink } from '@/components/ui/BackLink'
import { useAuth } from '@/auth/useAuth'
import { StatusBadge } from '@/components/documents/DocParts'
import { PageHeader } from '@/components/ui/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { getDocumentType } from '@/documents/catalog'
import { useAsync } from '@/hooks/useAsync'
import { formatDate } from '@/lib/format'
import { mockDocumentRequests } from '@/mocks/documentRequests'
import { mockCases } from '@/mocks/cases'
import { audit } from '@/services/auditService'
import { getHousehold, getResident, listHouseholds, moveResident, setFamilyHead } from '@/services/residentService'
import { Button } from '@/components/ui/Button'
import { FieldLabel, Select, TextArea } from '@/components/ui/Field'
import { ServiceError } from '@/services/mockApi'
import type { Relationship, Resident } from '@/types/resident'
import type { User } from '@/types/auth'
import { NotFound } from '@/pages/system/NotFound'
import { CIVIL_LABEL, RegistrationBadge, SectorBadges, age, fullName } from './common'

/** Resident profile (FR12). Viewing an identifiable record is logged (FR24). */
export function ResidentProfilePage() {
  const { id = '' } = useParams()
  const { user, can } = useAuth()
  const [tick, setTick] = useState(0)
  const r = useAsync(() => getResident(id), [id, tick])
  const hh = useAsync(() => (r.data ? getHousehold(r.data.householdId) : Promise.resolve(undefined)), [r.data?.householdId, tick])
  const [logged, setLogged] = useState(false)

  useEffect(() => {
    if (r.data && user && !logged) {
      audit(user, 'Viewed resident record', 'Residents', r.data.residentNo)
      setLogged(true)
    }
  }, [r.data, user, logged])

  if (r.loading) return <div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />
  if (!r.data) return <NotFound />
  const res = r.data
  const family = hh.data?.household.families.find((f) => f.id === res.familyId)
  const familyMembers = hh.data?.members.filter((m) => m.familyId === res.familyId) ?? []
  const requests = can('documents.view') ? mockDocumentRequests.filter((d) => d.residentId === res.id) : []
  const cases = can('cases.view') || can('cases.manage') ? mockCases.filter((c) => [...c.complainants, ...c.respondents].some((p) => p.residentId === res.id)) : []

  const Field = ({ k, v }: { k: string; v: React.ReactNode }) => (
    <div>
      <dt className="text-[length:calc(13.5px*var(--fs))] text-ink-muted">{k}</dt>
      <dd className="text-[length:calc(15.5px*var(--fs))] text-navy-900">{v || <span className="text-ink-subtle">Not recorded</span>}</dd>
    </div>
  )

  return (
    <>
      <BackLink fallbackTo="/residents" fallbackLabel="Resident Master List" />
      <PageHeader eyebrow={`Resident Number ${res.residentNo}`} title={fullName(res)} subtitle={`${res.houseNo} ${res.street}, Gagalangin, Tondo, Manila`} actions={
          <div className="rounded-[var(--radius-control)] border border-line bg-surface px-3.5 py-2">
            <p className="text-[length:calc(13px*var(--fs))] font-semibold tracking-[0.06em] text-ink-muted uppercase">Portal account</p>
            <div className="mt-1 [&>span]:h-7 [&>span]:px-2.5 [&>span]:text-[length:calc(14.5px*var(--fs))]"><RegistrationBadge status={res.registrationStatus} /></div>
          </div>
        } />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Panel title="Personal information">
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field k="Birthdate" v={formatDate(res.birthDate)} />
              <Field k="Age" v={age(res)} />
              <Field k="Sex" v={res.sex === 'male' ? 'Male' : 'Female'} />
              <Field k="Civil status" v={CIVIL_LABEL[res.civilStatus]} />
              <Field k="Contact number" v={res.contactNo} />
              <Field k="Registered voter" v={res.voter ? 'Yes' : 'No'} />
            </dl>
          </Panel>
          <Panel title="Residency, employment and education">
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field k="Resident since" v={res.residentSince} />
              <Field k="Area" v={res.street} />
              <Field k="OSCA ID no." v={res.oscaId} />
              <Field k="Employment" v={res.employment} />
              <Field k="Educational attainment" v={res.education} />
            </dl>
          </Panel>
          <Panel title="Sectors">{Object.values(res.sectors).some(Boolean) ? <SectorBadges r={res} /> : <p className="text-[length:calc(15px*var(--fs))] text-ink-muted">No sector recorded for this resident (senior citizen, PWD, solo parent, 4Ps or program beneficiary).</p>}</Panel>
          {(requests.length > 0 || cases.length > 0) && (
            <Panel title="Transactions" bodyClassName="px-0 py-0">
              <ul>
                {requests.map((d) => (
                  <li key={d.id} className="border-b border-line-soft last:border-0">
                    <Link to={`/documents/${d.id}`} className="flex min-h-11 items-center justify-between px-5 py-2.5 hover:bg-sky-50">
                      <span className="text-[length:calc(15px*var(--fs))] text-navy-900">{getDocumentType(d.typeId).name} · {d.referenceNo}</span>
                      <StatusBadge status={d.status} typeId={d.typeId} />
                    </Link>
                  </li>
                ))}
                {cases.map((c) => (
                  <li key={c.id} className="border-b border-line-soft last:border-0">
                    <Link to={`/cases/${c.id}`} className="flex min-h-11 items-center justify-between px-5 py-2.5 hover:bg-sky-50">
                      <span className="text-[length:calc(15px*var(--fs))] text-navy-900">{c.caseNo} · {c.title}</span>
                      <span className="text-[length:calc(14px*var(--fs))] text-ink-muted">{c.complainants.some((p) => p.residentId === res.id) ? 'Complainant' : 'Respondent'}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
        <Panel title="Household and family" actions={hh.data && <Link to={`/residents/households/${hh.data.household.id}`} className="inline-flex min-h-11 items-center gap-1 text-[length:calc(14.5px*var(--fs))] font-semibold text-info hover:underline"><Home className="size-3.5" /> {hh.data.household.householdNo}</Link>}>
          {hh.data && (
            <>
              <p className="text-[length:calc(14.5px*var(--fs))] text-ink-muted">
                {hh.data.household.families.length} famil{hh.data.household.families.length > 1 ? 'ies' : 'y'} and {hh.data.members.length} residents at this address.
              </p>
              <dl className="mt-3 grid grid-cols-1 gap-2 text-[length:calc(15.5px*var(--fs))] sm:grid-cols-2">
                <div><dt className="text-ink-nav">Household Number</dt><dd className="font-mono font-semibold text-navy-900">{hh.data.household.householdNo}</dd></div>
                <div><dt className="text-ink-nav">Family Number</dt><dd className="font-mono font-semibold text-navy-900">{family?.familyNo}</dd></div>
                {res.legacyNo && <div className="sm:col-span-2"><dt className="text-ink-nav">Earlier number</dt><dd className="text-navy-900">{res.legacyNo}</dd></div>}
              </dl>
              <p className="label-caps mt-4 mb-2">{family?.name} · relationship: {res.relationship}</p>
              <ul className="space-y-1.5">
                {familyMembers.map((m) => (
                  <li key={m.id}>
                    <Link to={`/residents/${m.id}`} className={`flex min-h-11 items-center justify-between rounded-md px-2 py-1.5 text-[length:calc(15px*var(--fs))] hover:bg-sky-50 ${m.id === res.id ? 'bg-sky-100 font-semibold' : ''}`}>
                      <span className="text-navy-900">{fullName(m)}</span>
                      <span className="text-[length:calc(14px*var(--fs))] text-ink-muted">{m.relationship} · {age(m)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          {hh.data && family && family.headResidentId !== res.id && age(res) >= 18 && can('residents.update') && user && (
            <MakeHead familyId={family.id} res={res} user={user} onDone={() => setTick((t) => t + 1)} />
          )}
          {res.moves && res.moves.length > 0 && (
            <>
              <p className="label-caps mt-4 mb-2">Household history</p>
              <ul className="space-y-2 text-[length:calc(15px*var(--fs))]">
                {[...res.moves].reverse().map((m) => (
                  <li key={m.at} className="rounded-md bg-surface-muted px-3 py-2">
                    <p className="text-navy-900">{m.from} → {m.to}</p>
                    <p className="text-ink-muted">{formatDate(m.at)} · {m.reason}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>
      </div>
      {can('residents.update') && user && <ChangeHousehold res={res} user={user} onDone={() => setTick((t) => t + 1)} />}
    </>
  )
}

const RELATIONSHIPS: Relationship[] = ['Head', 'Spouse', 'Partner', 'Son', 'Daughter', 'Mother', 'Father', 'Grandchild', 'Sibling', 'Relative']

function MakeHead({ familyId, res, user, onDone }: { familyId: string; res: Resident; user: User; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return (
    <div className="mt-3">
      <Button size="sm" variant="secondary" loading={busy} onClick={async () => {
        setBusy(true); setError('')
        try { await setFamilyHead(familyId, res.id, user); onDone() }
        catch (e) { setError(e instanceof ServiceError ? e.message : 'Could not change the head.') }
        finally { setBusy(false) }
      }}>Make {res.firstName} the family head</Button>
      {error && <p role="alert" className="mt-1 text-[length:calc(15px*var(--fs))] text-danger-ink">{error}</p>}
    </div>
  )
}

/** Move a resident to another household or family. The Resident Number stays the same; the move is recorded. */
function ChangeHousehold({ res, user, onDone }: { res: Resident; user: User; onDone: () => void }) {
  const households = useAsync(listHouseholds).data ?? []
  const [open, setOpen] = useState(false)
  const [hhId, setHhId] = useState('')
  const [famId, setFamId] = useState('')
  const [rel, setRel] = useState<Relationship>('Relative')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const target = households.find((h) => h.id === hhId)
  if (!open) return <div className="mt-4"><Button variant="secondary" onClick={() => setOpen(true)}>Change household</Button></div>
  return (
    <Panel className="mt-4" title="Change household" subtitle="The Resident Number does not change. The move is kept in the household history.">
      <form
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true); setError('')
          try { await moveResident(res.id, famId, rel, reason, user); setOpen(false); setReason(''); onDone() }
          catch (err) { setError(err instanceof ServiceError ? err.message : 'Could not move the resident.') }
          finally { setBusy(false) }
        }}
      >
        <FieldLabel label="Household" required>
          <Select value={hhId} onChange={(e) => { setHhId(e.target.value); setFamId('') }}>
            <option value="">Choose household</option>
            {households.map((h) => <option key={h.id} value={h.id}>{h.householdNo} · {h.houseNo} {h.street}</option>)}
          </Select>
        </FieldLabel>
        <FieldLabel label="Family" required>
          <Select value={famId} onChange={(e) => setFamId(e.target.value)} disabled={!target}>
            <option value="">{target ? 'Choose family' : 'Choose a household first'}</option>
            {target?.families.map((f) => <option key={f.id} value={f.id}>{f.familyNo} · {f.name}</option>)}
          </Select>
        </FieldLabel>
        <FieldLabel label="Relationship to the family head" required>
          <Select value={rel} onChange={(e) => setRel(e.target.value as Relationship)}>
            {RELATIONSHIPS.map((x) => <option key={x}>{x}</option>)}
          </Select>
        </FieldLabel>
        <FieldLabel label="Reason for the move" required>
          <TextArea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Moved in with spouse after marriage" />
        </FieldLabel>
        {error && <p role="alert" className="text-[length:calc(15px*var(--fs))] text-danger-ink sm:col-span-2">{error}</p>}
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" loading={busy} disabled={!famId}>Move resident</Button>
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
        </div>
      </form>
    </Panel>
  )
}
