import { Search, UserRound, X } from '@/icons'
import { BackLink } from '@/components/ui/BackLink'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { FieldInput, groupFields } from '@/components/documents/DocParts'
import { Button } from '@/components/ui/Button'
import { FieldLabel, Select, TextInput } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { getDocumentType } from '@/documents/catalog'
import { activeDocumentTypes } from '@/services/templateService'
import { ageOn, prefillFromResident, residentFullName } from '@/documents/fill'
import { useDocActor } from '@/hooks/useDocActor'
import { createRequest } from '@/services/documentService'
import { ServiceError } from '@/services/mockApi'
import { searchResidents } from '@/services/residentService'
import type { DocumentTypeId, FieldValue } from '@/types/document'
import type { Resident } from '@/types/resident'
import { ActionStack } from '@/components/ui/ActionStack'

/** Documents encoded for people who are not a resident on record. */
const NON_RESIDENT_TYPES: DocumentTypeId[] = ['non-residency', 'notice-of-hearing']

/** Assisted service: staff encode a request for a resident at the Barangay Hall. */
export function NewAssistedRequestPage() {
  const actor = useDocActor()
  const { can } = useAuth()
  const navigate = useNavigate()
  const [typeId, setTypeId] = useState<DocumentTypeId>('residency')
  const [resident, setResident] = useState<Resident | null>(null)
  const [requesterName, setRequesterName] = useState('')
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Resident[]>([])
  const [values, setValues] = useState<Record<string, FieldValue>>({})
  const [presented, setPresented] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const type = getDocumentType(typeId)
  const forNonResident = NON_RESIDENT_TYPES.includes(typeId)
  const canSearch = can('residents.search')

  useEffect(() => {
    let active = true
    if (q.trim().length < 2) {
      setResults([])
      return
    }
    searchResidents(q).then((r) => active && setResults(r))
    return () => {
      active = false
    }
  }, [q])

  const fields = useMemo(() => type.fields.filter((f) => f.by !== 'system'), [type])

  const pickType = (id: DocumentTypeId) => {
    setTypeId(id)
    setValues(resident ? prefillFromResident(id, resident) : {})
    setPresented({})
  }

  const pickResident = (r: Resident) => {
    setResident(r)
    setValues(prefillFromResident(typeId, r))
    setQ('')
    setResults([])
  }

  const submit = async () => {
    if (!actor) return
    setBusy(true)
    setError(null)
    try {
      const req = await createRequest(
        {
          typeId,
          residentId: forNonResident ? undefined : resident?.id,
          requesterName: forNonResident ? requesterName.trim() : resident ? residentFullName(resident) : '',
          values,
          requirements: Object.fromEntries(type.requirements.map((r) => [r.label, { provided: !!presented[r.label], note: presented[r.label] ? 'Presented at the Barangay Hall' : undefined }])),
          assisted: true,
        },
        actor,
      )
      navigate(`/documents/${req.id}`)
    } catch (e) {
      setError(e instanceof ServiceError ? e.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  const ready = forNonResident ? requesterName.trim().length > 0 : !!resident

  return (
    <>
      <BackLink fallbackTo="/documents" fallbackLabel="Document Requests" />
      <PageHeader title="Encode walk-in request" subtitle="For residents who request at the Barangay Hall. They get the same tracking as online requests." />

      <div className="max-w-3xl space-y-4">
        <Panel title="1. Document">
          <FieldLabel label="Document type" hint={type.onlineNote}>
            <Select value={typeId} onChange={(e) => pickType(e.target.value as DocumentTypeId)}>
              {activeDocumentTypes().map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </FieldLabel>
        </Panel>

        <Panel title={forNonResident ? '2. Requested by' : '2. Resident'}>
          {forNonResident ? (
            <FieldLabel label={typeId === 'notice-of-hearing' ? 'Case reference' : 'Requesting office or person'} required>
              <TextInput value={requesterName} onChange={(e) => setRequesterName(e.target.value)} placeholder={typeId === 'notice-of-hearing' ? 'e.g. KP case no. and parties' : 'e.g. 4Ps (DSWD)'} />
            </FieldLabel>
          ) : resident ? (
            <div className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-line px-3 py-2.5">
              <span className="flex items-center gap-3">
                <UserRound className="size-5 text-navy-900" />
                <span>
                  <span className="block text-[length:calc(15.5px*var(--fs))] font-semibold text-navy-900">{residentFullName(resident)}</span>
                  <span className="block text-[length:calc(14px*var(--fs))] text-ink-muted">
                    {resident.residentNo} · {ageOn(resident.birthDate)} yrs · {resident.houseNo} {resident.street}
                  </span>
                </span>
              </span>
              <Button variant="ghost" size="sm" onClick={() => setResident(null)} icon={<X className="size-3.5" />}>
                Change
              </Button>
            </div>
          ) : canSearch ? (
            <div>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle" />
                <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or resident no." className="pl-9" aria-label="Search residents" autoFocus />
              </div>
              {results.length > 0 && (
                <ul className="mt-2 overflow-hidden rounded-[var(--radius-control)] border border-line">
                  {results.map((r) => (
                    <li key={r.id} className="border-b border-line-soft last:border-0">
                      <button type="button" onClick={() => pickResident(r)} className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-sky-50">
                        <span className="text-[length:calc(15px*var(--fs))] font-semibold text-navy-900">{residentFullName(r)}</span>
                        <span className="text-[length:calc(14px*var(--fs))] text-ink-muted">
                          {r.residentNo} · {ageOn(r.birthDate)} yrs · {r.street}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {q.trim().length >= 2 && results.length === 0 && (
                <p className="mt-2 text-[length:calc(14.5px*var(--fs))] text-ink-muted">No resident found.</p>
              )}
            </div>
          ) : (
            <p className="text-[length:calc(14.5px*var(--fs))] text-ink-muted">Resident search is not available for your account.</p>
          )}
        </Panel>

        {ready && (
          <>
            <Panel title="3. Details printed on the document" subtitle="Prefilled from the resident record where available. Check them with the person.">
              <div className="space-y-5">
                {groupFields(fields).map(([group, fs]) => (
                  <section key={group || 'main'}>
                    {group && <p className="label-caps mb-2">{group}</p>}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {fs.map((f) => (
                        <FieldInput key={f.key} field={f} value={values[f.key]} onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </Panel>

            {type.requirements.length > 0 && (
              <Panel title="4. Requirements presented">
                {type.requirements.map((r) => (
                  <label key={r.label} className="flex items-center gap-2 py-1 text-[length:calc(15px*var(--fs))] text-navy-900">
                    <input type="checkbox" className="size-4 accent-[#002132]" checked={!!presented[r.label]} onChange={(e) => setPresented((p) => ({ ...p, [r.label]: e.target.checked }))} />
                    {r.label}
                  </label>
                ))}
              </Panel>
            )}

            {error && <p className="rounded-md bg-danger-tint px-3 py-2 text-[length:calc(14.5px*var(--fs))] text-danger-ink">{error}</p>}
            <ActionStack>
              <Button onClick={submit} loading={busy}>
                Create request
              </Button>
              <Button variant="ghost" onClick={() => navigate('/documents')}>
                Cancel
              </Button>
            </ActionStack>
          </>
        )}
      </div>
    </>
  )
}
