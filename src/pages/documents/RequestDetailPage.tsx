import { AlertTriangle, Eye, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BackLink } from '@/components/ui/BackLink'
import { FieldInput, HistoryList, ProgressTracker, StatusBadge, groupFields } from '@/components/documents/DocParts'
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
import { canEditValues, getRequest, saveValues, setRequirement } from '@/services/documentService'
import { ServiceError } from '@/services/mockApi'
import type { DocumentRequest, FieldValue } from '@/types/document'
import { NotFound } from '@/pages/system/NotFound'

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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          {req.assisted && (
            <p className="rounded-[var(--radius-control)] border border-line bg-surface px-4 py-2.5 text-[14.5px] text-navy-900">
              <strong>Walk-in (assisted service).</strong> Encoded by {encodedBy?.fullName ?? 'staff'} on {formatDateTime(req.assisted.at)}.
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
                <p className="flex items-start gap-2 text-[14.5px] text-danger-ink">
                  <AlertTriangle className="mt-px size-4 shrink-0" />
                  Missing before it can move forward: {missing.map((f) => (f.group ? `${f.group}: ${f.label}` : f.label)).join(', ')}
                </p>
              ) : savedAt && !dirty ? (
                <p className="text-[14.5px] text-success">Saved {formatDateTime(savedAt)} (in this browser session only).</p>
              ) : undefined
            }
          >
            <div className="space-y-5">
              {groupFields(visibleFields).map(([group, fields]) => (
                <section key={group || 'main'}>
                  {group && <p className="label-caps mb-2">{group}</p>}
                  <div className="grid gap-3 sm:grid-cols-2">
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
                  <p className="label-caps mb-2">Set by the system</p>
                  <dl className="grid gap-2 text-[15px] sm:grid-cols-2">
                    {systemFields.map((f) => (
                      <div key={f.key} className="rounded-[var(--radius-control)] bg-surface-muted px-3 py-2">
                        <dt className="text-[13.5px] text-ink-muted">{f.label}</dt>
                        <dd className="font-semibold text-navy-900">{(values[f.key] as string) || <span className="font-normal text-ink-muted">{f.help ?? 'Set automatically'}</span>}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}
            </div>
          </Panel>

          {type.requirements.length > 0 && (
            <Panel keepSubtitle title="Requirements" subtitle="Tick each one after checking the original.">
              <ul className="space-y-2">
                {type.requirements.map((r) => {
                  const state = req.requirements[r.label]
                  return (
                    <li key={r.label} className="flex items-center justify-between gap-3">
                      <label className="flex items-center gap-2 text-[15px] text-navy-900">
                        <input
                          type="checkbox"
                          className="size-4 accent-[#002132]"
                          checked={!!state?.provided}
                          disabled={!actor.permissions.has('documents.process')}
                          onChange={async (e) => setReq({ ...(await setRequirement(req.id, r.label, e.target.checked, actor)) })}
                        />
                        {r.label}
                      </label>
                      <span className="text-[13.5px] text-ink-muted">{state?.note ?? (req.assisted ? 'Presented at the Hall?' : 'Uploaded online')}</span>
                    </li>
                  )
                })}
              </ul>
            </Panel>
          )}

          {['summon', 'incident-record', 'blotter-report'].includes(req.typeId) && actor.permissions.has('cases.manage') && (
            <Panel title="Blotter and case">
              {req.caseId ? (
                <p className="text-[15px] text-navy-900">Recorded in the blotter. <Link to={`/cases/${req.caseId}`} className="font-semibold text-info hover:underline">Open the case</Link></p>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[15px] text-navy-900">Not yet in the blotter. Record it to open a case and schedule hearings.</p>
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
          <Panel title="Progress">
            <ProgressTracker req={req} />
          </Panel>
          {req.messages.length > 0 && (
            <Panel title="Messages from the requester">
              <ul className="space-y-2">
                {req.messages.map((m) => (
                  <li key={m.id} className="rounded-md bg-surface-muted px-3 py-2 text-[14.5px] text-navy-900">
                    {m.text}
                    <span className="mt-0.5 block text-[13px] text-ink-muted">{formatDateTime(m.at)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          {req.approvedBy && (
            <Panel title="Approval">
              <p className="text-[15px] text-navy-900">Approved by <strong>{mockUsers.find((u) => u.id === req.approvedBy)?.fullName}</strong></p>
              <p className="text-[14px] text-ink-muted">{formatDateTime(req.approvedAt!)}</p>
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
