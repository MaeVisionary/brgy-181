import { ArrowLeft, Building2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { HistoryList, ProgressTracker, StatusBadge } from '@/components/documents/DocParts'
import { TransitionPanel } from '@/components/documents/TransitionPanel'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, Panel } from '@/components/ui/Panel'
import { getDocumentType } from '@/documents/catalog'
import { isFilled } from '@/documents/fill'
import { useDocActor } from '@/hooks/useDocActor'
import { formatDateTime } from '@/lib/format'
import { getRequest } from '@/services/documentService'
import type { DocumentRequest, StatusEvent } from '@/types/document'
import { NotFound } from '@/pages/system/NotFound'

/** Notes the requester is meant to read; other staff notes stay internal. */
const PUBLIC_REMARKS = new Set<StatusEvent['status']>(['needs_info', 'rejected', 'cancelled', 'under_review'])

export function MyRequestDetailPage() {
  const { id = '' } = useParams()
  const actor = useDocActor()
  const [req, setReq] = useState<DocumentRequest | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (actor) getRequest(id, actor).then(setReq).catch(() => setNotFound(true))
  }, [id, actor])

  if (notFound) return <NotFound />
  if (!req || !actor) return <div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />

  const type = getDocumentType(req.typeId)
  const shown = type.fields.filter((f) => f.by !== 'system' && !f.staffOnly && isFilled(req.values[f.key]))
  const needInfo = [...req.history].reverse().find((h) => h.status === 'needs_info')

  return (
    <>
      <Link to="/my/documents" className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-muted hover:text-navy-900">
        <ArrowLeft className="size-4" /> My Requests
      </Link>
      <PageHeader eyebrow={req.referenceNo} title={type.name} subtitle={`Submitted ${formatDateTime(req.submittedAt)}`} actions={<StatusBadge status={req.status} />} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          {req.status === 'needs_info' && needInfo?.remarks && (
            <Card className="border-warning/40 bg-warning-tint px-5 py-4">
              <p className="label-caps text-warning">The barangay needs more information</p>
              <p className="mt-1 text-[13.5px] text-navy-900">{needInfo.remarks}</p>
            </Card>
          )}
          {req.status === 'ready_for_pickup' && (
            <Card className="border-success/40 bg-success-tint px-5 py-4">
              <p className="flex items-center gap-2 text-[13.5px] font-semibold text-success">
                <Building2 className="size-4" /> Ready for pickup at the Barangay Hall
              </p>
              <p className="mt-1 text-[13px] text-navy-900">Bring a valid ID and mention reference no. {req.referenceNo}.</p>
            </Card>
          )}
          <Panel title="What you submitted">
            <dl className="grid gap-3 text-[13px] sm:grid-cols-2">
              {shown.map((f) => (
                <div key={f.key} className={f.kind === 'textarea' ? 'sm:col-span-2' : undefined}>
                  <dt className="text-[11.5px] text-ink-muted">
                    {f.group ? `${f.group}: ` : ''}
                    {f.label}
                  </dt>
                  <dd className="whitespace-pre-wrap text-navy-900">
                    {Array.isArray(req.values[f.key]) ? (req.values[f.key] as string[]).join(', ') : req.values[f.key] === true ? 'Yes' : String(req.values[f.key])}
                  </dd>
                </div>
              ))}
            </dl>
          </Panel>
          <Panel title="Updates">
            <HistoryList events={req.history} showRemarks={(e) => PUBLIC_REMARKS.has(e.status)} />
          </Panel>
        </div>
        <div className="space-y-4">
          <TransitionPanel req={req} actor={actor} ownerView onChange={(r) => setReq({ ...r })} />
          <Panel title="Progress">
            <ProgressTracker req={req} />
          </Panel>
        </div>
      </div>
    </>
  )
}
