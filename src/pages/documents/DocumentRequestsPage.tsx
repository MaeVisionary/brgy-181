import { FilePlus2, Search, Inbox } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { StatusBadge } from '@/components/documents/DocParts'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Select, TextInput } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Panel'
import { DOCUMENT_TYPES, getDocumentType } from '@/documents/catalog'
import { STATUS_META, TERMINAL } from '@/documents/workflows'
import { useAsync } from '@/hooks/useAsync'
import { useDocActor } from '@/hooks/useDocActor'
import { cn } from '@/lib/cn'
import { formatDateTime } from '@/lib/format'
import { availableTransitions, listRequests } from '@/services/documentService'
import type { DocumentRequest, DocumentStatus } from '@/types/document'

type Tab = 'action' | 'open' | 'all'

export function DocumentRequestsPage({ approvalsOnly = false }: { approvalsOnly?: boolean }) {
  const actor = useDocActor()
  const { can } = useAuth()
  const navigate = useNavigate()
  const { data, loading } = useAsync(() => listRequests(actor!), [actor])
  const [tab, setTab] = useState<Tab>('action')
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')

  const needsMe = (r: DocumentRequest) => !!actor && availableTransitions(r, actor).some((t) => t.by !== 'owner' && !t.label.startsWith('Cancel'))

  const rows = useMemo(() => {
    let list = data ?? []
    if (approvalsOnly) list = list.filter((r) => r.status === 'pending_approval' || r.status === 'for_assessment')
    else if (tab === 'action') list = list.filter(needsMe)
    else if (tab === 'open') list = list.filter((r) => !TERMINAL.includes(r.status))
    if (type) list = list.filter((r) => r.typeId === type)
    if (status) list = list.filter((r) => r.status === status)
    const term = q.trim().toLowerCase()
    if (term) list = list.filter((r) => r.referenceNo.toLowerCase().includes(term) || r.requesterName.toLowerCase().includes(term))
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, tab, q, type, status, approvalsOnly, actor])

  const counts = useMemo(
    () => ({
      action: (data ?? []).filter(needsMe).length,
      open: (data ?? []).filter((r) => !TERMINAL.includes(r.status)).length,
      all: (data ?? []).length,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, actor],
  )

  return (
    <>
      <PageHeader
        title={approvalsOnly ? 'Approvals' : 'Document Requests'}
        subtitle={
          approvalsOnly
            ? 'Documents verified by the Secretary and summons requests that need your decision.'
            : 'Online and walk-in requests, from submission to release.'
        }
        actions={
          !approvalsOnly &&
          can('documents.create') && (
            <ButtonLink to="/documents/new" icon={<FilePlus2 className="size-4" />}>
              Encode walk-in request
            </ButtonLink>
          )
        }
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-line-soft p-4 lg:flex-row lg:items-center">
          {!approvalsOnly && (
            <div role="tablist" className="flex gap-1 rounded-[var(--radius-control)] bg-surface-muted p-1">
              {(
                [
                  ['action', 'Needs my action'],
                  ['open', 'Open'],
                  ['all', 'All'],
                ] as [Tab, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={cn('rounded-md px-3 py-1.5 text-[12.5px] font-semibold whitespace-nowrap', tab === id ? 'bg-surface text-navy-900 shadow-sm' : 'text-ink-muted hover:text-navy-900')}
                >
                  {label} <span className="ml-1 text-ink-muted">{counts[id]}</span>
                </button>
              ))}
            </div>
          )}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle" />
            <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search reference no. or name" className="pl-9" aria-label="Search requests" />
          </div>
          <Select value={type} onChange={(e) => setType(e.target.value)} className="lg:w-56" aria-label="Filter by document">
            <option value="">All documents</option>
            {DOCUMENT_TYPES.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
          {!approvalsOnly && (
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="lg:w-48" aria-label="Filter by status">
              <option value="">All statuses</option>
              {(Object.keys(STATUS_META) as DocumentStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </Select>
          )}
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-11 animate-pulse rounded bg-surface-muted" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={<Inbox className="size-5" />} title="No requests here" body={tab === 'action' && !approvalsOnly ? 'Nothing is waiting on you right now.' : 'Try another filter.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[13px]">
              <thead>
                <tr className="bg-surface-muted text-left">
                  <th className="label-caps px-4 py-2.5">Reference</th>
                  <th className="label-caps px-3 py-2.5">Document</th>
                  <th className="label-caps px-3 py-2.5">Requester</th>
                  <th className="label-caps px-3 py-2.5">Status</th>
                  <th className="label-caps px-4 py-2.5">Last update</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} onClick={() => navigate(`/documents/${r.id}`)} className="cursor-pointer border-t border-line-soft hover:bg-sky-50">
                    <td className="px-4 py-3">
                      <Link to={`/documents/${r.id}`} className="font-semibold whitespace-nowrap text-navy-900 hover:underline" onClick={(e) => e.stopPropagation()}>
                        {r.referenceNo}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-navy-900">{getDocumentType(r.typeId).name}</td>
                    <td className="px-3 py-3">
                      <span className="text-navy-900">{r.requesterName}</span>
                      {r.assisted && <span className="ml-2 text-[11px] font-semibold text-ink-muted uppercase">Walk-in</span>}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-muted">{formatDateTime(r.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}
