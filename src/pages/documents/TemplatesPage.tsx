import { AlertTriangle, FileText } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { DocumentPages, ScaledPages } from '@/components/documents/DocumentPages'
import { Badge } from '@/components/ui/Badge'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, Panel } from '@/components/ui/Panel'
import { DOCUMENT_TYPES, getDocumentType } from '@/documents/catalog'
import { WORKFLOWS } from '@/documents/workflows'
import { cn } from '@/lib/cn'
import type { DocumentTypeId } from '@/types/document'

/** Catalog of the official templates, with blank pages and every fill-in spot outlined. */
export function TemplatesPage() {
  const [params, setParams] = useSearchParams()
  const selected = getDocumentType((params.get('t') as DocumentTypeId) ?? DOCUMENT_TYPES[0].id) ?? DOCUMENT_TYPES[0]

  return (
    <>
      <PageHeader
        title="Document Templates"
        subtitle="The barangay's official documents, used exactly as supplied. Outlined areas are where the system fills in details."
      />
      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="h-fit overflow-hidden">
          <ul>
            {DOCUMENT_TYPES.map((d) => (
              <li key={d.id} className="border-b border-line-soft last:border-0">
                <button
                  type="button"
                  onClick={() => setParams({ t: d.id })}
                  className={cn('flex w-full items-start gap-2.5 px-4 py-3 text-left transition-colors', d.id === selected.id ? 'bg-sky-100' : 'hover:bg-sky-50')}
                >
                  <FileText className="mt-0.5 size-4 shrink-0 text-navy-900" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-navy-900">{d.name}</span>
                    <span className="block text-[11.5px] text-ink-muted">
                      {d.template.pageSize.name} · {d.template.pages.length} page{d.template.pages.length > 1 ? 's' : ''}
                    </span>
                  </span>
                  {d.issues.length > 0 && (
                    <span title={`${d.issues.length} open question(s)`} className="mt-0.5 text-warning">
                      <AlertTriangle className="size-4" />
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <div className="min-w-0 space-y-4">
          <Panel
            title={selected.name}
            subtitle={`Printed title: ${selected.printedTitle}`}
            actions={<Badge tone={selected.online ? 'info' : 'neutral'}>{selected.online ? 'Online request' : 'Barangay Hall only'}</Badge>}
          >
            <dl className="grid gap-x-6 gap-y-3 text-[13px] sm:grid-cols-2">
              <div>
                <dt className="label-caps">Source file</dt>
                <dd className="mt-0.5 text-navy-900">{selected.template.source}</dd>
              </div>
              <div>
                <dt className="label-caps">Paper</dt>
                <dd className="mt-0.5 text-navy-900">
                  {selected.template.pageSize.name} ({selected.template.pageSize.widthMm} × {selected.template.pageSize.heightMm} mm)
                </dd>
              </div>
              <div>
                <dt className="label-caps">Workflow</dt>
                <dd className="mt-0.5 text-navy-900">{WORKFLOWS[selected.workflow].name}</dd>
              </div>
              <div>
                <dt className="label-caps">Requirements</dt>
                <dd className="mt-0.5 text-navy-900">
                  {selected.requirements.length ? selected.requirements.map((r) => r.label).join(', ') : 'Not specified yet'}
                </dd>
              </div>
              {selected.onlineNote && (
                <div className="sm:col-span-2">
                  <dt className="label-caps">How it is requested</dt>
                  <dd className="mt-0.5 text-navy-900">{selected.onlineNote}</dd>
                </div>
              )}
            </dl>
            {selected.issues.length > 0 && (
              <div className="mt-4 rounded-[var(--radius-control)] border border-warning/30 bg-warning-tint px-4 py-3">
                <p className="flex items-center gap-2 text-[12.5px] font-semibold text-warning">
                  <AlertTriangle className="size-4" /> Open questions for the barangay
                </p>
                <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[12.5px] text-navy-900">
                  {selected.issues.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>

          <Card className="bg-surface-muted p-4 sm:p-6">
            <ScaledPages pageWidthMm={selected.template.pageSize.widthMm}>
              <DocumentPages type={selected} values={{}} mode="screen" showSlots />
            </ScaledPages>
          </Card>
        </div>
      </div>
    </>
  )
}
