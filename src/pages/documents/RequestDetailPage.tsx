import { AlertTriangle, Eye, Save } from '@/icons'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BackLink } from '@/components/ui/BackLink'
import { FieldInput, HistoryList, StatusBadge, WorkflowSteps, groupFields } from '@/components/documents/DocParts'
import { TransitionPanel } from '@/components/documents/TransitionPanel'
import { PaymentPanel, VerificationPanel } from '@/components/documents/RecordPanels'
import { Button, ButtonLink } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { getDocumentType } from '@/documents/catalog'
import { effectiveValues, missingFields } from '@/documents/fill'
import { useDocActor } from '@/hooks/useDocActor'
import { formatDateTime } from '@/lib/format'
import { mockUsers } from '@/mocks/users'
import { canEditValues, extendProcessing, getRequest, saveValues, setRequirement } from '@/services/documentService'
import { estimateFor } from '@/services/serviceStandardService'
import { formatDate } from '@/lib/format'
import { TextArea } from '@/components/ui/Field'
import { ServiceError } from '@/services/mockApi'
import type { DocumentRequest, FieldValue } from '@/types/document'
import { NotFound } from '@/pages/system/NotFound'
import { ActionStack } from '@/components/ui/ActionStack'

export function RequestDetailPage() {
  const { id = '' } = useParams()
  const actor = useDocActor()
  const [req, setReq] = useState<DocumentRequest | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, FieldValue>>({})
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  useEffect(() => {
    if (!actor) return
    getRequest(id, actor)
      .then((r) => {
        setReq(r)
        setDraft(r.values)
      })
      .catch((e) => setError(e instanceof ServiceError ? e.code : 'error'))
  }, [id, actor])

  if (error === 'not_found') return <NotFound />
  if (!req || !actor) return <div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />

  const type = getDocumentType(req.typeId)
  const editable = canEditValues(req, actor)
  const dirty = JSON.stringify(draft) !== JSON.stringify(req.values)
  const missing = missingFields({ ...req, values: draft })
  const missingKeys = new Set(missing.map((f) => f.key))
  const values = effectiveValues({ ...req, values: draft })
  const encodedBy = req.assisted ? mockUsers.find((u) => u.id === req.assisted!.encodedByUserId) : undefined

  const onSave = async () => {
    setSaving(true)
    try {
      const updated = await saveValues(req.id, draft, actor)
      setReq({ ...updated })
      setDraft(updated.values)
      setSavedAt(new Date().toISOString())
    } finally {
      setSaving(false)
    }
  }

  const visibleFields = type.fields.filter((f) => f.by !== 'system')
  const systemFields = type.fields.filter((f) => f.by === 'system')

  return (
    <>
      <BackLink fallbackTo="/documents" fallbackLabel="Document Requests" />
      <PageHeader
        eyebrow={req.referenceNo}
        title={type.name}
        subtitle={`${req.requesterName} · submitted ${formatDateTime(req.submittedAt)}`}
        actions={
          <>
            <StatusBadge status={req.status} typeId={req.typeId} />
            <ButtonLink to={`/documents/${req.id}/preview`} variant="secondary" icon={<Eye className="size-4" />}>
              Preview document
            </ButtonLink>
          </>
        }
      />

      <section className="mb-4 border-t border-line pt-4">
        <WorkflowSteps workflow={type.workflow} req={req} />
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          {req.assisted && (
            <p className="rounded-[var(--radius-control)] border border-line bg-surface px-4 py-2.5 text-[length:calc(14.5px*var(--fs))] text-navy-900">
              <strong>Walk-in (assisted service).</strong> Encoded by {encodedBy?.fullName ?? 'Barangay Personnel'} on {formatDateTime(req.assisted.at)}.
            </p>
          )}

          <Panel
            title="Document details"
            subtitle={editable ? 'These values are printed on the document. Check them against the requirements.' : 'Locked at this stage of the workflow.'}
            actions={
              editable && (
                <Button size="sm" onClick={onSave} disabled={!dirty} loading={saving} icon={<Save className="size-3.5" />}>
                  Save
                </Button>
              )
            }
            footer={
              missing.length > 0 ? (
                <p className="flex items-start gap-2 text-[length:calc(14.5px*var(--fs))] text-danger-ink">
                  <AlertTriangle className="mt-px size-4 shrink-0" />
                  Missing before it can move forward: {missing.map((f) => (f.group ? `${f.group}: ${f.label}` : f.label)).join(', ')}
                </p>
              ) : savedAt && !dirty ? (
                <p className="text-[length:calc(14.5px*var(--fs))] text-success">Saved {formatDateTime(savedAt)}.</p>
              ) : undefined
            }
          >
            <div className="space-y-5">
              {groupFields(visibleFields).map(([group, fields]) => (
                <section key={group || 'main'}>
                  {group && <p className="label-caps mb-2">{group}</p>}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {fields.map((f) => (
                      <FieldInput
                        key={f.key}
                        field={f}
                        value={draft[f.key]}
                        disabled={!editable}
                        invalid={missingKeys.has(f.key)}
                        onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))}
                      />
                    ))}
                  </div>
                </section>
              ))}
              {systemFields.length > 0 && (
                <section>
                  <dl className="grid grid-cols-1 gap-2 text-[length:calc(15px*var(--fs))] sm:grid-cols-2">
                    {systemFields.map((f) => (
                      <div key={f.key} className="rounded-[var(--radius-control)] bg-surface-muted px-3 py-2">
                        <dt className="text-[length:calc(13.5px*var(--fs))] text-ink-muted">{f.label}</dt>
                        <dd className="font-semibold text-navy-900">{(values[f.key] as string) || <span className="font-normal text-ink-muted">–</span>}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}
            </div>
          </Panel>

          {type.requirements.length > 0 && (
            <Panel title="Requirements" subtitle="Tick each one after checking the original.">
              <ul className="space-y-2">
                {type.requirements.map((r) => {
                  const state = req.requirements[r.label]
                  return (
                    <li key={r.label} className="flex items-center justify-between gap-3">
                      <label className="flex items-center gap-2 text-[length:calc(15px*var(--fs))] text-navy-900">
                        <input
                          type="checkbox"
                          className="size-4 accent-[#002132]"
                          checked={!!state?.provided}
                          disabled={!actor.permissions.has('documents.process')}
                          onChange={async (e) => setReq({ ...(await setRequirement(req.id, r.label, e.target.checked, actor)) })}
                        />
                        {r.label}
                      </label>
                      <span className="text-[length:calc(13.5px*var(--fs))] text-ink-muted">{state?.note ?? (req.assisted ? 'Presented at the Hall?' : 'Uploaded online')}</span>
                    </li>
                  )
                })}
              </ul>
            </Panel>
          )}

          {['summon', 'incident-record', 'blotter-report'].includes(req.typeId) && actor.permissions.has('cases.manage') && (
            <Panel title="Blotter and case">
              {req.caseId ? (
                <p className="text-[length:calc(15px*var(--fs))] text-navy-900">Recorded in the blotter. <Link to={`/cases/${req.caseId}`} className="font-semibold text-info hover:underline">Open the case</Link></p>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[length:calc(15px*var(--fs))] text-navy-900">Not yet in the blotter. Record it to open a case and schedule hearings.</p>
                  <ButtonLink to={`/cases/new?from=${req.id}`}>Record in blotter</ButtonLink>
                </div>
              )}
            </Panel>
          )}
          <VerificationPanel req={req} actor={actor} onChange={(r) => setReq(r)} />
          <PaymentPanel req={req} actor={actor} onChange={(r) => setReq(r)} />
        </div>

        <div className="space-y-4">
          <TransitionPanel req={req} actor={actor} dirty={dirty} missingCount={missing.length} onChange={(r) => { setReq({ ...r }); setDraft(r.values) }} />
          <ProcessingTimePanel req={req} actor={actor} onChange={(r) => setReq({ ...r })} />
          {req.messages.length > 0 && (
            <Panel title="Messages from the requester">
              <ul className="space-y-2">
                {req.messages.map((m) => (
                  <li key={m.id} className="rounded-md bg-surface-muted px-3 py-2 text-[length:calc(14.5px*var(--fs))] text-navy-900">
                    {m.text}
                    <span className="mt-0.5 block text-[length:calc(13px*var(--fs))] text-ink-muted">{formatDateTime(m.at)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          {req.approvedBy && (
            <Panel title="Approval">
              <p className="text-[length:calc(15px*var(--fs))] text-navy-900">Approved by <strong>{mockUsers.find((u) => u.id === req.approvedBy)?.fullName}</strong></p>
              <p className="text-[length:calc(14px*var(--fs))] text-ink-muted">{formatDateTime(req.approvedAt!)}</p>
            </Panel>
          )}
          <Panel title="History">
            <HistoryList events={req.history} />
          </Panel>
        </div>
      </div>
    </>
  )
}

/** Expected date for staff, and the one-time RA 11032 extension with the reason the resident reads. */
function ProcessingTimePanel({ req, actor, onChange }: { req: DocumentRequest; actor: NonNullable<ReturnType<typeof useDocActor>>; onChange: (r: DocumentRequest) => void }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const est = estimateFor(req)
  if (!est || ['released', 'rejected', 'cancelled'].includes(req.status)) return null
  const date = req.extension?.newDate ?? est.expectedBy
  const canExtend = !req.extension && actor.permissions.has('documents.process') && req.status !== 'ready_for_pickup'
  return (
    <Panel title="Processing time">
      <p className="text-[length:calc(15px*var(--fs))] text-navy-900">Expected by <strong>{formatDate(date + 'T12:00:00+08:00')}</strong></p>
      <p className="text-[length:calc(14px*var(--fs))] text-ink-muted">{req.extension ? `Extended: ${req.extension.reason}` : `${est.days} working days${est.fromCharter ? '' : ' (RA 11032 maximum)'}`}</p>
      {canExtend && !open && <Button className="mt-3" size="sm" variant="secondary" onClick={() => setOpen(true)}>Extend once</Button>}
      {open && (
        <div className="mt-3 space-y-2">
          <TextArea className="min-h-[64px]" aria-label="Reason for the extension" placeholder="Reason the resident will read" value={reason} onChange={(e) => setReason(e.target.value)} />
          {err && <p className="text-[length:calc(14px*var(--fs))] text-danger-ink">{err}</p>}
          <ActionStack>
            <Button size="sm" onClick={async () => { try { onChange(await extendProcessing(req.id, reason, actor)); setOpen(false) } catch (e) { setErr(e instanceof ServiceError ? e.message : 'Failed.') } }}>Extend and notify</Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          </ActionStack>
        </div>
      )}
    </Panel>
  )
}
