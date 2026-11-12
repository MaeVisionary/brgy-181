import { ArrowLeft, Building2 } from '@/icons'
import { IdStatusLine, IdUploadForm } from '@/components/identity/IdOnFile'
import { maskIdNumber } from '@/config/idTypes'
import { getIdOnFile, needsUpload, stateOf, submitReplacementId, type IdDocument } from '@/services/identityService'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { FieldInput, groupFields } from '@/components/documents/DocParts'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { RESIDENT_SERVICES, getDocumentType } from '@/documents/catalog'
import { activeDocumentTypes } from '@/services/templateService'
import { ageOn, isFilled, prefillFromResident, residentFullName } from '@/documents/fill'
import { useDocActor } from '@/hooks/useDocActor'
import { cn } from '@/lib/cn'
import { FileField } from '@/components/ui/FileField'
import { MAX_TRANSACTION_BYTES } from '@/config/uploads'
import { attachUploads, totalSize, type StoredFile } from '@/services/fileStore'
import { createRequest } from '@/services/documentService'
import { ServiceError } from '@/services/mockApi'
import { getResident } from '@/services/residentService'
import type { DocumentTypeId, FieldValue } from '@/types/document'
import type { Resident } from '@/types/resident'

/** Requirements satisfied by the requester's own ID on file. */
const isOwnIdRequirement = (label: string) => /^valid id( of the (person requesting|applicant|owner))?$/i.test(label.trim())

const CATEGORY_LABEL = { certificate: 'Certificates', clearance: 'Clearances' } as const

export function NewRequestPage() {
  const actor = useDocActor()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [resident, setResident] = useState<Resident | null>(null)
  const [typeId, setTypeId] = useState<DocumentTypeId | null>(null)
  const [values, setValues] = useState<Record<string, FieldValue>>({})
  const [files, setFiles] = useState<Record<string, StoredFile | null>>({})
  const [touched, setTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [idDoc, setIdDoc] = useState<IdDocument | undefined | null>(null)
  const loadId = () => { if (user?.residentId) getIdOnFile(user.residentId, user).then(setIdDoc).catch(() => setIdDoc(undefined)) }
  useEffect(() => {
    if (user?.residentId) getResident(user.residentId).then((r) => setResident(r ?? null))
    loadId()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.residentId])
  const idState = stateOf(idDoc ?? undefined)

  const type = typeId ? getDocumentType(typeId) : null
  const fields = useMemo(() => (type ? type.fields.filter((f) => f.by !== 'system' && !f.staffOnly) : []), [type])
  // Details already in the resident record are shown, not asked again.
  const profileKeys = useMemo(() => new Set(type && resident ? Object.entries(prefillFromResident(type.id, resident)).filter(([, v]) => isFilled(v)).map(([k]) => k) : []), [type, resident])
  const askFields = fields.filter((f) => !profileKeys.has(f.key))
  const missing = fields.filter((f) => f.required && !isFilled(values[f.key]))
  const needsId = !!type?.requirements.some((r) => isOwnIdRequirement(r.label))
  const idBlocked = needsId && needsUpload(idState)
  const otherReqs = type ? type.requirements.filter((r) => !isOwnIdRequirement(r.label)) : []

  const choose = (id: DocumentTypeId) => {
    setTypeId(id)
    setValues(resident ? prefillFromResident(id, resident) : {})
    setFiles({})
    setTouched(false)
  }

  const submit = async () => {
    setTouched(true)
    if (!actor || !type || !resident || missing.length || idBlocked || busy) return
    setBusy(true)
    setError(null)
    try {
      const fileIds = Object.values(files).filter((f): f is StoredFile => !!f).map((f) => f.id)
      if (totalSize(fileIds) > MAX_TRANSACTION_BYTES) throw new ServiceError('too_large', 'Attachments total more than 10 MB. Remove a file or use a smaller one.')
      const req = await createRequest(
        {
          typeId: type.id,
          residentId: resident.id,
          requesterName: residentFullName(resident),
          values,
          requirements: Object.fromEntries(type.requirements.map((r) => [r.label, isOwnIdRequirement(r.label) && idDoc
            ? { provided: true, note: `${idState === 'pending' ? 'ID on file, verification pending' : 'Verified ID on file'}: ${idDoc.idType} ${maskIdNumber(idDoc.idNumber)}` }
            : { provided: !!files[r.label], note: files[r.label] ? `Attached: ${files[r.label]!.originalName}` : undefined, fileId: files[r.label]?.id }])),
          assisted: false,
        },
        actor,
      )
      attachUploads(fileIds, req.referenceNo)
      navigate(`/my/documents/${req.id}`)
    } catch (e) {
      setError(e instanceof ServiceError ? e.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  const groups = (['certificate', 'clearance'] as const).map((cat) => [cat, activeDocumentTypes().filter((d) => d.category === cat && RESIDENT_SERVICES.has(d.id))] as const)

  return (
    <>
      <Link to="/my/documents" className="mb-3 inline-flex items-center gap-1.5 text-[length:calc(14.5px*var(--fs))] font-semibold text-ink-muted hover:text-navy-900">
        <ArrowLeft className="size-4" /> Document Requests
      </Link>
      <PageHeader title="New request" />

      <div className="space-y-4">
        <Panel title="What do you need?">
          <div className="space-y-4">
            {groups.map(([cat, docs]) => (
              <section key={cat}>
                <p className="label-caps mb-2">{CATEGORY_LABEL[cat]}</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {docs
                    .map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        disabled={!d.online}
                        onClick={() => choose(d.id)}
                        className={cn(
                          'min-h-12 cursor-pointer rounded-[var(--radius-control)] border px-3.5 py-2.5 text-left transition-colors',
                          typeId === d.id ? 'border-navy-900 bg-sky-100' : 'border-line hover:bg-sky-50',
                          !d.online && 'cursor-not-allowed bg-surface-muted hover:bg-surface-muted',
                        )}
                      >
                        <span className="block text-[length:calc(15px*var(--fs))] font-semibold text-navy-900">{d.name}</span>
                        {!d.online && (
                          <span className="mt-0.5 flex items-center gap-1 text-[length:calc(13.5px*var(--fs))] text-ink-muted">
                            <Building2 className="size-3.5" /> At the Barangay Hall only
                          </span>
                        )}
                      </button>
                    ))}
                </div>
              </section>
            ))}
          </div>
        </Panel>

        {type && (
          <>
            {resident && (
              <Panel title="Your information">
                <p className="text-[length:calc(17px*var(--fs))] font-semibold text-navy-900">{residentFullName(resident)}</p>
                <p className="text-[length:calc(15px*var(--fs))] text-ink-nav">{ageOn(resident.birthDate)} years old · {resident.houseNo} {resident.street}</p>
                {needsId && idDoc !== null && <IdStatusLine className="mt-3" doc={idDoc} state={idState} />}
                <Link to="/my/profile" className="mt-3 inline-block text-[length:calc(14px*var(--fs))] font-semibold text-info hover:underline">Something wrong? Request a correction</Link>
                {idBlocked && (
                  <div className="mt-4 border-t border-line-soft pt-4">
                    <p className="mb-3 text-[length:calc(15px*var(--fs))] font-semibold text-navy-900">{idState === 'missing' ? 'Add a valid ID' : 'Upload a valid ID to continue'}</p>
                    <IdUploadForm name={resident} onSubmit={async (u) => { await submitReplacementId(resident.id, u, user!); loadId() }} />
                  </div>
                )}
              </Panel>
            )}

            {askFields.length > 0 && (
              <Panel title="Request details">
                <div className="space-y-5">
                  {groupFields(askFields).map(([group, fs]) => (
                    <section key={group || 'main'}>
                      {group && <p className="label-caps mb-2">{group}</p>}
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {fs.map((f) => (
                          <FieldInput
                            key={f.key}
                            field={f}
                            value={values[f.key]}
                            invalid={touched && f.required && !isFilled(values[f.key])}
                            onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </Panel>
            )}

            {otherReqs.length > 0 && (
              <Panel title="Requirements">
                <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {otherReqs.map((r) => (
                    <li key={r.label}>
                      <FileField label={r.label} category="requirement" ownerResidentId={resident?.id} value={files[r.label] ?? null} onChange={(f) => setFiles((s) => ({ ...s, [r.label]: f }))} />
                    </li>
                  ))}
                </ul>
              </Panel>
            )}

            <p className="text-[length:calc(13.5px*var(--fs))] text-ink-muted">Used only to process this request (Data Privacy Act of 2012).</p>

            {touched && missing.length > 0 && (
              <p className="rounded-md bg-danger-tint px-3 py-2 text-[length:calc(14.5px*var(--fs))] text-danger-ink">Please fill in: {missing.map((f) => f.label).join(', ')}.</p>
            )}
            {error && <p className="rounded-md bg-danger-tint px-3 py-2 text-[length:calc(14.5px*var(--fs))] text-danger-ink">{error}</p>}
            <div className="flex gap-2">
              <Button onClick={submit} loading={busy} disabled={idBlocked}>
                Submit request
              </Button>
              <Button variant="ghost" onClick={() => navigate('/my/documents')}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
