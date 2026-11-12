import { IdStatusLine, IdUploadForm } from '@/components/identity/IdOnFile'
import { maskIdNumber } from '@/config/idTypes'
import { getIdOnFile, needsUpload, stateOf, submitReplacementId, type IdDocument } from '@/services/identityService'
import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from '@/icons'
import { useAuth } from '@/auth/useAuth'
import { FieldInput, groupFields } from '@/components/documents/DocParts'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PageHeader } from '@/components/ui/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { FileField } from '@/components/ui/FileField'
import { RESIDENT_SERVICES, getDocumentType } from '@/documents/catalog'
import { ageOn, isFilled, prefillFromResident, residentFullName } from '@/documents/fill'
import { useDocActor } from '@/hooks/useDocActor'
import { MAX_TRANSACTION_BYTES } from '@/config/uploads'
import { attachUploads, totalSize, type StoredFile } from '@/services/fileStore'
import { createRequest } from '@/services/documentService'
import { ServiceError } from '@/services/mockApi'
import { getResident } from '@/services/residentService'
import { activeDocumentTypes } from '@/services/templateService'
import type { DocumentTypeId, FieldValue } from '@/types/document'
import type { Resident } from '@/types/resident'

/** Requirements satisfied by the requester's own ID on file. */
const isOwnIdRequirement = (label: string) => /^valid id( of the (person requesting|applicant|owner))?$/i.test(label.trim())

/** One plain sentence about what each document is for. */
const PURPOSE: Partial<Record<DocumentTypeId, string>> = {
  residency: 'Shows that you live in Barangay 181.',
  indigency: 'Shows that your family needs financial help, for assistance programs.',
  'first-time-job-seeker': 'For first-time job seekers to get some job documents free (RA 11261).',
  'no-partner': 'States that you are single and have no partner.',
  cohabitation: 'States that you and your partner live together.',
  'clearance-person': 'Shows that you have no pending case in the barangay.',
  'business-clearance': 'Needed to open or renew a business in Barangay 181.',
  'barangay-certificate': 'A general certification from the barangay.',
}

const draftKey = (id: string) => `bmis.requestDraft:${id}`

/** One document's request form on its own page (opened from New request). */
export function RequestFormPage() {
  const { typeId = '' } = useParams()
  const actor = useDocActor()
  const { user } = useAuth()
  const navigate = useNavigate()
  const allowed = activeDocumentTypes().find((d) => d.id === typeId && RESIDENT_SERVICES.has(d.id) && d.online)
  const type = allowed ? getDocumentType(allowed.id) : null

  const [resident, setResident] = useState<Resident | null>(null)
  const [values, setValues] = useState<Record<string, FieldValue>>(() => {
    try { return JSON.parse(sessionStorage.getItem(draftKey(typeId)) ?? 'null') ?? {} } catch { return {} }
  })
  const [files, setFiles] = useState<Record<string, StoredFile | null>>({})
  const [touched, setTouched] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [idDoc, setIdDoc] = useState<IdDocument | undefined | null>(null)
  const loadId = () => { if (user?.residentId) getIdOnFile(user.residentId, user).then(setIdDoc).catch(() => setIdDoc(undefined)) }
  useEffect(() => {
    if (!user?.residentId || !type) return
    getResident(user.residentId).then((r) => {
      setResident(r ?? null)
      // Fill from the profile once; a saved draft keeps what the resident typed.
      if (r) setValues((v) => ({ ...prefillFromResident(type.id, r), ...v }))
    })
    loadId()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.residentId, typeId])
  // Keep progress for this visit, so going back by mistake loses nothing.
  useEffect(() => { try { sessionStorage.setItem(draftKey(typeId), JSON.stringify(values)) } catch { /* ignore */ } }, [typeId, values])

  const fields = useMemo(() => (type ? type.fields.filter((f) => f.by !== 'system' && !f.staffOnly) : []), [type])
  const profileKeys = useMemo(() => new Set(type && resident ? Object.entries(prefillFromResident(type.id, resident)).filter(([, v]) => isFilled(v)).map(([k]) => k) : []), [type, resident])
  if (!type) return <Navigate to="/my/documents/new" replace />

  const askFields = fields.filter((f) => !profileKeys.has(f.key))
  const missing = fields.filter((f) => f.required && !isFilled(values[f.key]))
  const idState = stateOf(idDoc ?? undefined)
  const needsId = type.requirements.some((r) => isOwnIdRequirement(r.label))
  const idBlocked = needsId && needsUpload(idState)
  const otherReqs = type.requirements.filter((r) => !isOwnIdRequirement(r.label))
  const typed = askFields.some((f) => isFilled(values[f.key]) && !profileKeys.has(f.key)) || Object.values(files).some(Boolean)

  const discard = () => { try { sessionStorage.removeItem(draftKey(typeId)) } catch { /* ignore */ } navigate('/my/documents/new', { replace: true }) }
  const back = () => (reviewing ? setReviewing(false) : navigate(-1))
  const cancel = () => (typed ? setLeaving(true) : discard())
  const review = () => {
    setTouched(true)
    if (missing.length || idBlocked) { window.scrollTo({ top: 0, behavior: 'smooth' }); return }
    setReviewing(true)
    window.scrollTo({ top: 0 })
  }
  const submit = async () => {
    if (!actor || !resident || busy) return
    setBusy(true)
    setError(null)
    try {
      const fileIds = Object.values(files).filter((f): f is StoredFile => !!f).map((f) => f.id)
      if (totalSize(fileIds) > MAX_TRANSACTION_BYTES) throw new ServiceError('too_large', 'Attachments total more than 10 MB. Remove a file or use a smaller one.')
      const req = await createRequest({
        typeId: type.id,
        residentId: resident.id,
        requesterName: residentFullName(resident),
        values,
        requirements: Object.fromEntries(type.requirements.map((r) => [r.label, isOwnIdRequirement(r.label) && idDoc
          ? { provided: true, note: `${idState === 'pending' ? 'ID on file, verification pending' : 'Verified ID on file'}: ${idDoc.idType} ${maskIdNumber(idDoc.idNumber)}` }
          : { provided: !!files[r.label], note: files[r.label] ? `Attached: ${files[r.label]!.originalName}` : undefined, fileId: files[r.label]?.id }])),
        assisted: false,
      }, actor)
      attachUploads(fileIds, req.referenceNo)
      try { sessionStorage.removeItem(draftKey(typeId)) } catch { /* ignore */ }
      navigate(`/my/documents/${req.id}`, { replace: true, state: { justSubmitted: true } })
    } catch (e) {
      setError(e instanceof ServiceError ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const show = (v: FieldValue | undefined) => (Array.isArray(v) ? v.join(', ') : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : v || '–')

  return (
    <>
      <button type="button" onClick={back} className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-[length:calc(15.5px*var(--fs))] font-semibold text-info hover:underline">
        <ArrowLeft className="size-4" /> {reviewing ? 'Back to the form' : 'Back'}
      </button>
      <PageHeader title={type.name} />
      {(reviewing || PURPOSE[type.id]) && <p className="-mt-2 mb-4 text-[length:calc(16.5px*var(--fs))] text-ink-nav">{reviewing ? 'Please check your request before sending it.' : PURPOSE[type.id]}</p>}

      {reviewing ? (
        <div className="space-y-4">
          <Panel title="Your request">
            <dl className="divide-y divide-line-soft">
              {resident && <div className="flex flex-col gap-0.5 py-3 sm:flex-row sm:justify-between"><dt className="text-[length:calc(16px*var(--fs))] text-ink-nav">Name</dt><dd className="text-[length:calc(17px*var(--fs))] font-semibold text-navy-900">{residentFullName(resident)}</dd></div>}
              {askFields.map((f) => (
                <div key={f.key} className="flex flex-col gap-0.5 py-3 sm:flex-row sm:justify-between sm:gap-4">
                  <dt className="text-[length:calc(16px*var(--fs))] text-ink-nav">{f.label}</dt>
                  <dd className="text-[length:calc(17px*var(--fs))] font-semibold break-words text-navy-900 sm:text-right">{show(values[f.key])}</dd>
                </div>
              ))}
              {otherReqs.map((r) => (
                <div key={r.label} className="flex flex-col gap-0.5 py-3 sm:flex-row sm:justify-between sm:gap-4">
                  <dt className="text-[length:calc(16px*var(--fs))] text-ink-nav">{r.label}</dt>
                  <dd className="text-[length:calc(17px*var(--fs))] font-semibold text-navy-900">{files[r.label] ? files[r.label]!.originalName : 'Not attached'}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          {error && <p role="alert" className="rounded-md bg-danger-tint px-4 py-3 text-[length:calc(16px*var(--fs))] text-danger-ink">{error}</p>}
          <div className="grid grid-cols-1 gap-2 sm:flex">
            <Button onClick={submit} loading={busy}>Submit Request</Button>
            <Button variant="secondary" onClick={() => setReviewing(false)}>Change something</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {touched && (missing.length > 0 || idBlocked) && (
            <p role="alert" className="rounded-md bg-danger-tint px-4 py-3 text-[length:calc(16px*var(--fs))] text-danger-ink">
              {missing.length > 0 ? `Please fill in: ${missing.map((f) => f.label).join(', ')}.` : 'Please add a valid ID to continue.'}
            </p>
          )}
          {resident && (
            <Panel title="Your information">
              <p className="text-[length:calc(17px*var(--fs))] font-semibold text-navy-900">{residentFullName(resident)}</p>
              <p className="text-[length:calc(16px*var(--fs))] text-ink-nav">{ageOn(resident.birthDate)} years old · {resident.houseNo} {resident.street}</p>
              {needsId && idDoc !== null && <IdStatusLine className="mt-3" doc={idDoc} state={idState} />}
              <Link to="/my/profile" className="mt-3 inline-block text-[length:calc(15px*var(--fs))] font-semibold text-info hover:underline">Something wrong? Request a correction</Link>
              {idBlocked && (
                <div className="mt-4 border-t border-line-soft pt-4">
                  <p className="mb-3 text-[length:calc(16px*var(--fs))] font-semibold text-navy-900">{idState === 'missing' ? 'Add a valid ID' : 'Upload a valid ID to continue'}</p>
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
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {fs.map((f) => (
                        <FieldInput key={f.key} field={f} value={values[f.key]} invalid={touched && f.required && !isFilled(values[f.key])} onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))} />
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

          <div className="grid grid-cols-1 gap-2 sm:flex">
            <Button onClick={review}>Review Request</Button>
            <Button variant="ghost" onClick={cancel}>Cancel</Button>
          </div>
        </div>
      )}

      {leaving && (
        <ConfirmDialog title="Discard this request?" confirmLabel="Discard" cancelLabel="Keep filling in" destructive onConfirm={discard} onCancel={() => setLeaving(false)}>
          What you typed will not be saved.
        </ConfirmDialog>
      )}
    </>
  )
}
