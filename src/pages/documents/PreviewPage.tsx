import { AlertTriangle, ArrowLeft, CheckCircle2, Printer } from '@/icons'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { StatusBadge } from '@/components/documents/DocParts'
import { DocumentPages, ScaledPages } from '@/components/documents/DocumentPages'
import { PrintPortal } from '@/components/documents/PrintPortal'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Panel'
import { getDocumentType } from '@/documents/catalog'
import { effectiveValues, missingFields } from '@/documents/fill'
import { WORKFLOWS, statusLabel } from '@/documents/workflows'
import { useDocActor } from '@/hooks/useDocActor'
import { getRequest, isPrintable } from '@/services/documentService'
import type { DocumentRequest } from '@/types/document'
import { NotFound } from '@/pages/system/NotFound'

export function PreviewPage() {
  const { id = '' } = useParams()
  const actor = useDocActor()
  const [req, setReq] = useState<DocumentRequest | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (actor) getRequest(id, actor).then(setReq).catch(() => setNotFound(true))
  }, [id, actor])

  if (notFound) return <NotFound />
  if (!req) return <div className="h-96 animate-pulse rounded-[var(--radius-card)] bg-surface" />

  const type = getDocumentType(req.typeId)
  const wf = WORKFLOWS[type.workflow]
  const missing = missingFields(req)
  const values = effectiveValues(req)
  const printable = isPrintable(req)
  const issueLabel = wf.issueOn === 'recorded' ? 'set when recorded' : 'set on approval'

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <Link to={`/documents/${req.id}`} className="mb-1 inline-flex items-center gap-1.5 text-[length:calc(14.5px*var(--fs))] font-semibold text-ink-muted hover:text-navy-900">
            <ArrowLeft className="size-4" /> Back to request
          </Link>
          <h1 className="font-display text-[length:calc(24px*var(--fs))] font-extrabold text-navy-900">
            {type.name} <span className="font-sans text-[length:calc(16px*var(--fs))] font-semibold text-ink-muted">· {req.referenceNo}</span>
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={req.status} typeId={req.typeId} />
          <Button icon={<Printer className="size-4" />} disabled={!printable} onClick={() => window.print()}>
            Print / Save as PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="min-w-0 bg-surface-muted p-3 sm:p-6">
          <ScaledPages pageWidthMm={type.template.pageSize.widthMm}>
            <DocumentPages type={type} values={values} mode="screen" missing={new Set(missing.map((f) => f.key))} pendingSystemLabel={issueLabel} />
          </ScaledPages>
        </Card>

        <div className="space-y-3">
          <Card className="px-5 py-4">
            {printable ? (
              <p className="flex items-start gap-2 text-[length:calc(15px*var(--fs))] text-navy-900">
                <CheckCircle2 className="mt-px size-4 shrink-0 text-success" />
                Ready to print. Only the official page{type.template.pages.length > 1 ? 's are' : ' is'} printed.
              </p>
            ) : (
              <div className="space-y-2 text-[length:calc(15px*var(--fs))] text-navy-900">
                <p className="flex items-start gap-2 font-semibold">
                  <AlertTriangle className="mt-px size-4 shrink-0 text-warning" /> Not ready to print yet
                </p>
                {!wf.printableIn.includes(req.status) && (
                  <p className="text-ink-muted">
                    Printing opens at: {wf.printableIn.map((s) => statusLabel(s, wf.id)).join(' / ')}. Current status: {statusLabel(req.status, wf.id)}.
                  </p>
                )}
                {missing.length > 0 && (
                  <div>
                    <p className="text-ink-muted">Missing details (outlined in red):</p>
                    <ul className="mt-1 list-disc pl-5">
                      {missing.map((f) => (
                        <li key={f.key}>{f.group ? `${f.group}: ${f.label}` : f.label}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </Card>
          <Card className="px-5 py-4 text-[length:calc(14.5px*var(--fs))] text-ink-muted">
            <p className="label-caps mb-1.5">Printing</p>
            In the print dialog choose paper size <strong className="text-navy-900">{type.template.pageSize.name}</strong>, margins{' '}
            <strong className="text-navy-900">None</strong>, scale <strong className="text-navy-900">100%</strong>, and turn on background graphics. To get a PDF, pick{' '}
            <strong className="text-navy-900">Save as PDF</strong> as the printer.
          </Card>
        </div>
      </div>

      {printable && <PrintPortal type={type} values={values} />}
    </>
  )
}
