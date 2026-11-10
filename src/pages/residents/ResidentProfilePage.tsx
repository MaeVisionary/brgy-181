import { Home } from 'lucide-react'
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
import { getHousehold, getResident } from '@/services/residentService'
import { NotFound } from '@/pages/system/NotFound'
import { CIVIL_LABEL, RegistrationBadge, SectorBadges, age, fullName } from './common'

/** Resident profile (FR12). Viewing an identifiable record is logged (FR24). */
export function ResidentProfilePage() {
  const { id = '' } = useParams()
  const { user, can } = useAuth()
  const r = useAsync(() => getResident(id), [id])
  const hh = useAsync(() => (r.data ? getHousehold(r.data.householdId) : Promise.resolve(undefined)), [r.data?.householdId])
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
      <dt className="text-[11.5px] text-ink-muted">{k}</dt>
      <dd className="text-[13.5px] text-navy-900">{v || <span className="text-ink-subtle">Not recorded</span>}</dd>
    </div>
  )

  return (
    <>
      <BackLink fallbackTo="/residents" fallbackLabel="Resident Master List" />
      <PageHeader eyebrow={`Resident no. ${res.residentNo}`} title={fullName(res)} subtitle={`${res.houseNo} ${res.street}, Gagalangin, Tondo, Manila`} actions={
          <div className="rounded-[var(--radius-control)] border border-line bg-surface px-3.5 py-2">
            <p className="text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">Portal account</p>
            <div className="mt-1 [&>span]:h-7 [&>span]:px-2.5 [&>span]:text-[12.5px]"><RegistrationBadge status={res.registrationStatus} /></div>
          </div>
        } />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Panel title="Personal information">
            <dl className="grid gap-3 sm:grid-cols-3">
              <Field k="Birthdate" v={formatDate(res.birthDate)} />
              <Field k="Age" v={age(res)} />
              <Field k="Sex" v={res.sex === 'male' ? 'Male' : 'Female'} />
              <Field k="Civil status" v={CIVIL_LABEL[res.civilStatus]} />
              <Field k="Contact number" v={res.contactNo} />
              <Field k="Registered voter" v={res.voter ? 'Yes' : 'No'} />
            </dl>
          </Panel>
          <Panel title="Residency, employment and education">
            <dl className="grid gap-3 sm:grid-cols-3">
              <Field k="Resident since" v={res.residentSince} />
              <Field k="Area" v={res.street} />
              <Field k="OSCA ID no." v={res.oscaId} />
              <Field k="Employment" v={res.employment} />
              <Field k="Educational attainment" v={res.education} />
            </dl>
          </Panel>
          <Panel title="Sectors">{Object.values(res.sectors).some(Boolean) ? <SectorBadges r={res} /> : <p className="text-[13px] text-ink-muted">No sector recorded for this resident (senior citizen, PWD, solo parent, 4Ps or program beneficiary).</p>}</Panel>
          {(requests.length > 0 || cases.length > 0) && (
            <Panel title="Transactions" bodyClassName="px-0 py-0">
              <ul>
                {requests.map((d) => (
                  <li key={d.id} className="border-b border-line-soft last:border-0">
                    <Link to={`/documents/${d.id}`} className="flex items-center justify-between px-5 py-2.5 hover:bg-sky-50">
                      <span className="text-[13px] text-navy-900">{getDocumentType(d.typeId).name} · {d.referenceNo}</span>
                      <StatusBadge status={d.status} />
                    </Link>
                  </li>
                ))}
                {cases.map((c) => (
                  <li key={c.id} className="border-b border-line-soft last:border-0">
                    <Link to={`/cases/${c.id}`} className="flex items-center justify-between px-5 py-2.5 hover:bg-sky-50">
                      <span className="text-[13px] text-navy-900">{c.caseNo} · {c.title}</span>
                      <span className="text-[12px] text-ink-muted">{c.complainants.some((p) => p.residentId === res.id) ? 'Complainant' : 'Respondent'}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
        <Panel title="Household and family" actions={hh.data && <Link to={`/residents/households/${hh.data.household.id}`} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-info hover:underline"><Home className="size-3.5" /> {hh.data.household.householdNo}</Link>}>
          {hh.data && (
            <>
              <p className="text-[12.5px] text-ink-muted">
                {hh.data.household.families.length} famil{hh.data.household.families.length > 1 ? 'ies' : 'y'} and {hh.data.members.length} residents at this address.
              </p>
              <p className="label-caps mt-4 mb-2">{family?.name} · relationship: {res.relationship}</p>
              <ul className="space-y-1.5">
                {familyMembers.map((m) => (
                  <li key={m.id}>
                    <Link to={`/residents/${m.id}`} className={`flex items-center justify-between rounded-md px-2 py-1.5 text-[13px] hover:bg-sky-50 ${m.id === res.id ? 'bg-sky-100 font-semibold' : ''}`}>
                      <span className="text-navy-900">{fullName(m)}</span>
                      <span className="text-[12px] text-ink-muted">{m.relationship} · {age(m)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>
      </div>
    </>
  )
}
