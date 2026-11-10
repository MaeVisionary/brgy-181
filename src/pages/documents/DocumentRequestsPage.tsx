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
import { Pagination, usePaged } from '@/components/ui/Pagination'
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

  const paged = usePaged(rows)
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
              Encode Walk-in Request
            </ButtonLink>
          )
        }
      />

      <Card className="space-y-3 p-4">
        {/* Queue tiles (new UI): click one to switch the list */}
        {!approvalsOnly && (
          <div role="tablist" aria-label="Request queue" className="grid grid-cols-3 gap-2 sm:gap-3">
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
                type="button"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn(
                  'rounded-[var(--radius-control)] border px-3 py-2.5 text-left transition-colors sm:px-4',
                  tab === id ? 'border-navy-900 bg-navy-900 text-white' : 'border-line bg-surface text-navy-900 hover:bg-surface-muted',
                )}
              >
                <span className={cn('block text-[12px] sm:text-[12.5px]', tab === id ? 'text-white/80' : 'text-ink-nav')}>{label}</span>
                <span className="font-display text-[20px] leading-tight font-extrabold">{counts[id]}</span>
              </button>
            ))}
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle" />
            <TextInput value={q} onChange={(e) => { setQ(e.target.value); paged.setPage(0) }} placeholder="Search reference no. or name" className="h-11 pl-9" aria-label="Search requests" />
          </div>
          <Select value={type} onChange={(e) => setType(e.target.value)} className="h-11" aria-label="Filter by document">
            <option value="">All documents</option>
            {DOCUMENT_TYPES.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </div>
        {!approvalsOnly && (
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="h-11" aria-label="Filter by status">
            <option value="">All statuses</option>
            {(Object.keys(STATUS_META) as DocumentStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </Select>
        )}

        <div className="overflow-hidden rounded-[var(--radius-control)] border border-line">
          {loading ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-11 animate-pulse rounded bg-surface-muted" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState icon={<Inbox className="size-5" />} title="No requests here" body={tab === 'action' && !approvalsOnly ? 'Nothing is waiting on you right now.' : approvalsOnly ? 'Nothing is waiting for your decision.' : 'Try another filter.'} />
          ) : (
            <>
              <table className="hidden w-full text-[13px] md:table">
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
                  {paged.slice.map((r) => (
                    <tr key={r.id} onClick={() => navigate(`/documents/${r.id}`)} className="cursor-pointer border-t border-line-soft hover:bg-sky-50">
                      <td className="px-4 py-2.5">
                        <Link
                          to={`/documents/${r.id}`}
                          className="inline-flex h-9 items-center rounded-[var(--radius-control)] border border-line bg-surface px-3 font-semibold whitespace-nowrap text-navy-900 hover:border-navy-600"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {r.referenceNo}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-navy-900">{getDocumentType(r.typeId).name}</td>
                      <td className="px-3 py-2.5">
                        <span className="block text-navy-900">{r.requesterName}</span>
                        {r.assisted && <span className="block text-[11.5px] text-ink-muted">Walk-in</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-4 py-2.5 text-ink-nav">{formatDateTime(r.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ul className="divide-y divide-line-soft md:hidden">
                {paged.slice.map((r) => (
                  <li key={r.id}>
                    <Link to={`/documents/${r.id}`} className="block px-4 py-3 active:bg-sky-50">
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-navy-900">{r.referenceNo}</span>
                        <StatusBadge status={r.status} />
                      </span>
                      <span className="block text-[13px] text-navy-900">{getDocumentType(r.typeId).name}</span>
                      <span className="block text-[12px] text-ink-muted">{r.requesterName}{r.assisted ? ' · Walk-in' : ''} · {formatDateTime(r.updatedAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Pagination page={paged.page} pages={paged.pages} total={paged.total} size={paged.size} onPage={paged.setPage} noun="requests" />
            </>
          )}
        </div>
      </Card>
    </>
  )
}
