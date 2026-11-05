import { ArrowLeft, Building2, Paperclip } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { FieldInput, groupFields } from '@/components/documents/DocParts'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, Panel } from '@/components/ui/Panel'
import { getDocumentType } from '@/documents/catalog'
import { activeDocumentTypes } from '@/services/templateService'
import { isFilled, prefillFromResident, residentFullName } from '@/documents/fill'
import { useDocActor } from '@/hooks/useDocActor'
import { cn } from '@/lib/cn'
import { createRequest } from '@/services/documentService'
import { ServiceError } from '@/services/mockApi'
import { getResident } from '@/services/residentService'
import type { DocumentTypeId, FieldValue } from '@/types/document'
import type { Resident } from '@/types/resident'

const CATEGORY_LABEL = { certificate: 'Certificates', clearance: 'Clearances', case: 'Reports and complaints' } as const

export function NewRequestPage() {
  const actor = useDocActor()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [resident, setResident] = useState<Resident | null>(null)
  const [typeId, setTypeId] = useState<DocumentTypeId | null>(null)
  const [values, setValues] = useState<Record<string, FieldValue>>({})
  const [files, setFiles] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (user?.residentId) getResident(user.residentId).then((r) => setResident(r ?? null))
  }, [user?.residentId])

  const type = typeId ? getDocumentType(typeId) : null
  const fields = useMemo(() => (type ? type.fields.filter((f) => f.by !== 'system' && !f.staffOnly) : []), [type])
  const missing = fields.filter((f) => f.required && !isFilled(values[f.key]))

  const choose = (id: DocumentTypeId) => {
    setTypeId(id)
    setValues(resident ? prefillFromResident(id, resident) : {})
    setFiles({})
    setTouched(false)
  }

  const submit = async () => {
    setTouched(true)
    if (!actor || !type || !resident || missing.length) return
    setBusy(true)
    setError(null)
    try {
      const req = await createRequest(
        {
          typeId: type.id,
          residentId: resident.id,
          requesterName: residentFullName(resident),
          values,
          requirements: Object.fromEntries(type.requirements.map((r) => [r.label, { provided: !!files[r.label], note: files[r.label] ? `Selected: ${files[r.label]}` : undefined }])),
          assisted: false,
        },
        actor,
      )
      navigate(`/my/documents/${req.id}`)
    } catch (e) {
      setError(e instanceof ServiceError ? e.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  const groups = (['certificate', 'clearance', 'case'] as const).map((cat) => [cat, activeDocumentTypes().filter((d) => d.category === cat)] as const)

  return (
    <>
      <Link to="/my/documents" className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-muted hover:text-navy-900">
        <ArrowLeft className="size-4" /> My Requests
      </Link>
      <PageHeader title="New request" subtitle="Choose what you need. Documents are claimed at the Barangay Hall once ready." />

      <div className="max-w-3xl space-y-4">
        <Panel title="What do you need?">
          <div className="space-y-4">
            {groups.map(([cat, docs]) => (
              <section key={cat}>
                <p className="label-caps mb-2">{CATEGORY_LABEL[cat]}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {docs
                    .filter((d) => d.id !== 'notice-of-hearing')
                    .map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        disabled={!d.online}
                        onClick={() => choose(d.id)}
                        className={cn(
                          'rounded-[var(--radius-control)] border px-3 py-2.5 text-left transition-colors',
                          typeId === d.id ? 'border-navy-900 bg-sky-100' : 'border-line hover:bg-sky-50',
                          !d.online && 'cursor-not-allowed bg-surface-muted hover:bg-surface-muted',
                        )}
                      >
                        <span className="block text-[13px] font-semibold text-navy-900">{d.name}</span>
                        {!d.online && (
                          <span className="mt-0.5 flex items-center gap-1 text-[11.5px] text-ink-muted">
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
            <Panel title="Your details" subtitle="Filled in from your resident record. If something is wrong, request a correction from your profile instead of changing it here.">
              <div className="space-y-5">
                {groupFields(fields).map(([group, fs]) => (
                  <section key={group || 'main'}>
                    {group && <p className="label-caps mb-2">{group}</p>}
                    <div className="grid gap-3 sm:grid-cols-2">
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

            {type.requirements.length > 0 && (
              <Panel title="Requirements" subtitle="Prototype: the file name is recorded, but the file itself is not uploaded or stored.">
                <ul className="space-y-3">
                  {type.requirements.map((r) => (
                    <li key={r.label}>
                      <label className="block">
                        <span className="mb-1 block text-[12.5px] font-semibold text-navy-900">{r.label}</span>
                        <span className="flex items-center gap-2 rounded-[var(--radius-control)] border border-dashed border-line px-3 py-2.5 text-[12.5px] text-ink-muted">
                          <Paperclip className="size-4" />
                          {files[r.label] ?? 'Choose a photo or PDF'}
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            className="sr-only"
                            onChange={(e) => {
                              const f = e.target.files?.[0]
                              if (f) setFiles((s) => ({ ...s, [r.label]: f.name }))
                            }}
                          />
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}

            <Card className="px-5 py-4 text-[12.5px] text-ink-muted">
              Your information is used only to process this request, in line with the Data Privacy Act of 2012 (RA 10173). The full privacy notice will be added after review by the barangay's Data Protection Officer.
            </Card>

            {touched && missing.length > 0 && (
              <p className="rounded-md bg-danger-tint px-3 py-2 text-[12.5px] text-danger-ink">Please fill in: {missing.map((f) => f.label).join(', ')}.</p>
            )}
            {error && <p className="rounded-md bg-danger-tint px-3 py-2 text-[12.5px] text-danger-ink">{error}</p>}
            <div className="flex gap-2">
              <Button onClick={submit} loading={busy}>
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
