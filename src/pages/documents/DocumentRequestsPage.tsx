import { FilePlus2, Search, Inbox } from '@/icons'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { Badge } from '@/components/ui/Badge'
import { RowList } from '@/components/ui/RowList'
import { listStatus } from '@/documents/listStatus'
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
                <span className={cn('block text-[length:calc(14px*var(--fs))] sm:text-[length:calc(14.5px*var(--fs))]', tab === id ? 'text-white/80' : 'text-ink-nav')}>{label}</span>
                <span className="font-display text-[length:calc(22px*var(--fs))] leading-tight font-extrabold">{counts[id]}</span>
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
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
              <table className="hidden w-full text-[length:calc(16px*var(--fs))] md:table">
                <thead>
                  <tr className="border-b border-line text-left text-[length:calc(14px*var(--fs))] font-semibold text-ink-nav">
                    <th className="px-5 py-3">Request</th>
                    <th className="px-4 py-3">Applicant</th>
                    <th className="w-[180px] px-5 py-3"><span className="sr-only">Status</span></th>
                  </tr>
                </thead>
                <tbody>
                  {paged.slice.map((r) => {
                    const st = actor ? listStatus(r, actor) : null
                    return (
                      <tr key={r.id} onClick={() => navigate(`/documents/${r.id}`)} className="cursor-pointer border-t border-line-soft first:border-t-0 hover:bg-sky-50">
                        <td className="px-5 py-3.5">
                          <Link to={`/documents/${r.id}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-navy-900 hover:underline">{getDocumentType(r.typeId).name}</Link>
                        </td>
                        <td className="px-4 py-3.5 text-navy-900">{r.requesterName}</td>
                        <td className="px-5 py-3.5 text-right">{st && <Badge tone={st.tone}>{st.label}</Badge>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <RowList rows={paged.slice.map((r) => { const st = actor ? listStatus(r, actor) : null; return { key: r.id, to: `/documents/${r.id}`, title: getDocumentType(r.typeId).name, subtitle: r.requesterName, trailing: st ? <Badge tone={st.tone}>{st.label}</Badge> : undefined } })} />
              <Pagination page={paged.page} pages={paged.pages} total={paged.total} size={paged.size} onPage={paged.setPage} noun="requests" />
            </>
          )}
        </div>
      </Card>
    </>
  )
}
