import { Download, FileText, RotateCcw, Trash2, Upload } from '@/icons'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/ui/Button'
import { formatDateTime } from '@/lib/format'
import { ServiceError } from '@/services/mockApi'
import {
  deleteUpload,
  downloadBlankPdf,
  downloadBlob,
  listRemovedTemplates,
  listUploads,
  removeTemplate,
  restoreTemplate,
  uploadTemplate,
  type TemplateUpload,
} from '@/services/templateService'
import { DocumentPages, ScaledPages } from '@/components/documents/DocumentPages'
import { WorkflowSteps } from '@/components/documents/DocParts'
import { Badge } from '@/components/ui/Badge'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, Panel } from '@/components/ui/Panel'
import { DOCUMENT_TYPES, getDocumentType } from '@/documents/catalog'
import { cn } from '@/lib/cn'
import { RequirementsEditor } from './RequirementsEditor'
import type { DocumentTypeId } from '@/types/document'

/** Catalog of the official templates, with blank pages and every fill-in spot outlined. */
export function TemplatesPage() {
  const [params, setParams] = useSearchParams()
  const selected = getDocumentType((params.get('t') as DocumentTypeId) ?? DOCUMENT_TYPES[0].id) ?? DOCUMENT_TYPES[0]
  const { user, can } = useAuth()
  // The Secretary (processes documents) and the System Administrator manage templates.
  const canManage = can('documents.process') || can('system.settings')
  const [removed, setRemoved] = useState(listRemovedTemplates)
  const [uploads, setUploads] = useState<TemplateUpload[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const isRemoved = removed.some((r) => r.id === selected.id)
  const removedInfo = removed.find((r) => r.id === selected.id)

  useEffect(() => {
    let alive = true
    listUploads(selected.id).then((u) => alive && setUploads(u))
    return () => {
      alive = false
    }
  }, [selected.id])

  const select = (id: DocumentTypeId) => {
    setParams({ t: id })
    setNotice(null)
    setConfirmRemove(false)
  }

  const run = async (key: string, fn: () => Promise<void> | void, ok?: string) => {
    setBusy(key)
    setNotice(null)
    try {
      await fn()
      if (ok) setNotice({ tone: 'ok', text: ok })
    } catch (e) {
      setNotice({ tone: 'err', text: e instanceof ServiceError ? e.message : 'Something went wrong. Please try again.' })
    } finally {
      setBusy(null)
    }
  }

  const onUpload = (file: File | undefined) => {
    if (!file) return
    void run(
      'upload',
      async () => {
        await uploadTemplate(selected.id, file, user!)
        setUploads(await listUploads(selected.id))
      },
      `"${file.name}" uploaded. The fill-in spots will be set up for the new layout before the system uses it; until then the current version stays in use.`,
    )
  }
  const ordered = [...DOCUMENT_TYPES.filter((d) => !removed.some((r) => r.id === d.id)), ...DOCUMENT_TYPES.filter((d) => removed.some((r) => r.id === d.id))]

  return (
    <>
      <PageHeader
        title="Document Templates"
        subtitle="The barangay's official documents, used exactly as supplied. Outlined areas are where the system fills in details."
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="h-fit overflow-hidden xl:sticky xl:top-0">
          <ul>
            {ordered.map((d) => (
              <li key={d.id} className={cn('border-b border-line-soft last:border-0', removed.some((r) => r.id === d.id) && 'opacity-55')}>
                <button
                  type="button"
                  onClick={() => select(d.id)}
                  className={cn('flex w-full items-start gap-2.5 px-4 py-3 text-left transition-colors', d.id === selected.id ? 'bg-sky-100' : 'hover:bg-sky-50')}
                >
                  <FileText className="mt-0.5 size-4 shrink-0 text-navy-900" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[length:calc(15px*var(--fs))] font-semibold text-navy-900">{d.name}</span>
                    <span className="block text-[length:calc(13.5px*var(--fs))] text-ink-muted">
                      {d.template.pageSize.name} · {d.template.pages.length} page{d.template.pages.length > 1 ? 's' : ''}
                      {removed.some((r) => r.id === d.id) && ' · Removed'}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <div className="min-w-0 space-y-4">
          <Panel
            title={selected.name}
            subtitle={`Printed title: ${selected.printedTitle}`}
            actions={
              isRemoved ? <Badge tone="danger">Removed</Badge> : <Badge dot={false} tone={selected.online ? 'info' : 'neutral'}>{selected.online ? 'Online request' : 'Barangay Hall only'}</Badge>
            }
          >
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Button size="sm" icon={<Download className="size-3.5" />} loading={busy === 'blank'} onClick={() => void run('blank', () => downloadBlankPdf(selected))}>
                Download blank form (PDF)
              </Button>
              {canManage && !isRemoved && (
                <>
                  <input
                    ref={fileInput}
                    type="file"
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                    className="sr-only"
                    onChange={(e) => {
                      onUpload(e.target.files?.[0])
                      e.target.value = ''
                    }}
                  />
                  <Button size="sm" variant="secondary" icon={<Upload className="size-3.5" />} loading={busy === 'upload'} onClick={() => fileInput.current?.click()}>
                    Upload new version
                  </Button>
                  {confirmRemove ? (
                    <span className="inline-flex flex-wrap items-center gap-2 rounded-full bg-danger-tint px-3 py-1 text-[length:calc(14.5px*var(--fs))] text-navy-900">
                      Remove this template? Residents will no longer be able to request it.
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          removeTemplate(selected.id, user!)
                          setRemoved(listRemovedTemplates())
                          setConfirmRemove(false)
                        }}
                      >
                        Yes, remove
                      </Button>
                      <button type="button" className="font-semibold text-ink-muted hover:text-navy-900" onClick={() => setConfirmRemove(false)}>
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <Button size="sm" variant="danger" icon={<Trash2 className="size-3.5" />} onClick={() => setConfirmRemove(true)}>
                      Remove template
                    </Button>
                  )}
                </>
              )}
              {canManage && isRemoved && (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<RotateCcw className="size-3.5" />}
                  onClick={() => {
                    restoreTemplate(selected.id, user!)
                    setRemoved(listRemovedTemplates())
                  }}
                >
                  Restore template
                </Button>
              )}
            </div>
            {removedInfo && (
              <p className="mb-4 rounded-[var(--radius-control)] bg-danger-tint px-4 py-2.5 text-[length:calc(14.5px*var(--fs))] text-navy-900">
                Removed by {removedInfo.by} on {formatDateTime(removedInfo.at)}. It is hidden from request forms. Existing requests keep their documents.
              </p>
            )}
            {notice && (
              <p role="status" className={cn('mb-4 rounded-[var(--radius-control)] px-4 py-2.5 text-[length:calc(14.5px*var(--fs))] text-navy-900', notice.tone === 'ok' ? 'bg-success-tint' : 'bg-danger-tint')}>
                {notice.text}
              </p>
            )}
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-[length:calc(15px*var(--fs))] sm:grid-cols-2">
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
              {selected.onlineNote && (
                <div className="sm:col-span-2">
                  <dt className="label-caps">How it is requested</dt>
                  <dd className="mt-0.5 text-navy-900">{selected.onlineNote}</dd>
                </div>
              )}
            </dl>
            <div className="mt-4 border-t border-line pt-3">
              <p className="label-caps mb-3">Workflow</p>
              <WorkflowSteps workflow={selected.workflow} />
            </div>
            <RequirementsEditor key={selected.id} typeId={selected.id} onSaved={() => setNotice({ tone: 'ok', text: 'Requirements saved. New requests use the updated list.' })} />
            {selected.process && (
              <div className="mt-4 rounded-[var(--radius-control)] bg-surface-muted px-4 py-3">
                <p className="label-caps mb-1.5">How it is processed</p>
                <ol className="list-decimal space-y-1 pl-5 text-[length:calc(14.5px*var(--fs))] text-navy-900">
                  {selected.process.map((step) => <li key={step}>{step}</li>)}
                </ol>
              </div>
            )}
            {uploads.length > 0 && (
              <div className="mt-4 rounded-[var(--radius-control)] border border-line px-4 py-3">
                <p className="label-caps mb-2">Uploaded versions (waiting for layout setup)</p>
                <ul className="divide-y divide-line-soft">
                  {uploads.map((u) => (
                    <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[length:calc(14.5px*var(--fs))]">
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-navy-900">{u.fileName}</span>
                        <span className="text-ink-muted">
                          {(u.size / 1024).toFixed(0)} KB · {u.uploadedBy} · {formatDateTime(u.uploadedAt)}
                        </span>
                      </span>
                      <span className="flex gap-2">
                        <Button size="sm" variant="secondary" icon={<Download className="size-3.5" />} onClick={() => downloadBlob(u.blob, u.fileName)}>
                          Download
                        </Button>
                        {canManage && (
                          <Button
                            size="sm"
                            variant="danger"
                            icon={<Trash2 className="size-3.5" />}
                            onClick={() =>
                              void run('del', async () => {
                                await deleteUpload(u.id, user!)
                                setUploads(await listUploads(selected.id))
                              })
                            }
                          >
                            Delete
                          </Button>
                        )}
                      </span>
                    </li>
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
