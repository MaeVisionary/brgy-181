import { FilePlus2, Search, Inbox } from '@/icons'
import { useEffect, useMemo } from 'react'
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
import { STATUS_META } from '@/documents/workflows'
import { DOC_KINDS, DOC_TABS, DOC_VIEWS, KIND_LABEL, STAGES, VIEW_LABEL, awaitingDecision, filterRequests, isOpen, needsActionBy, type DocKind, type DocStage, type DocTab, type DocView } from '@/documents/listFilters'
import { useAsync } from '@/hooks/useAsync'
import { useDocActor } from '@/hooks/useDocActor'
import { cn } from '@/lib/cn'
import { listRequests } from '@/services/documentService'
import { claimFor, formatTime } from '@/services/appointmentService'
import { readyEstimate } from '@/services/processingService'
import { runPickupChecks } from '@/services/pickupService'
import type { DocumentRequest, DocumentStatus } from '@/types/document'
import { useClearFilters, useUrlFilter } from '@/hooks/useUrlFilter'

const short = (d: Date) => d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' })
const pickupOf = (r: DocumentRequest) => { const c = claimFor(r.id); return c?.date ? `${shortDate(c.date)}, ${formatTime(c.time)}` : '' }
const shortDate = (d: string) => new Date(`${d}T12:00:00+08:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' })
/** "Ready by" for the queue: the current estimate, flagged when delayed or past the charter time. */
function ReadyBy({ r }: { r: DocumentRequest }) {
  const e = readyEstimate(r)
  if (!e || e.state === 'closed') return <span className="text-ink-nav">—</span>
  if (e.state === 'ready') return <span className="text-navy-900">Ready</span>
  if (e.state === 'paused') return <span className="text-ink-nav">On hold (waiting for reply)</span>
  return (
    <span className={e.state === 'delayed' || e.beyondCharter ? 'font-semibold text-danger-ink' : 'text-navy-900'}>
      {short(e.readyAt!)}{e.state === 'delayed' ? ' · delayed' : e.beyondCharter ? ' · past charter time' : ''}
    </span>
  )
}

export function DocumentRequestsPage({ approvalsOnly = false }: { approvalsOnly?: boolean }) {
  const actor = useDocActor()
  const { can } = useAuth()
  const navigate = useNavigate()
  const { data, loading } = useAsync(() => listRequests(actor!), [actor])
  // Filters live in the address, so dashboard cards open this list already filtered and refresh keeps it.
  const [tab, setTab] = useUrlFilter<DocTab>('tab', 'action', DOC_TABS)
  const [q, setQ] = useUrlFilter<string>('q', '')
  const [type, setType] = useUrlFilter<string>('type', '')
  const [status, setStatus] = useUrlFilter<DocumentStatus | ''>('status', '', ['', ...(Object.keys(STATUS_META) as DocumentStatus[])])
  const [stage, setStage] = useUrlFilter<DocStage | ''>('stage', '', ['', ...STAGES.map(([k]) => k)])
  const [kind, setKind] = useUrlFilter<DocKind | ''>('kind', '', ['', ...DOC_KINDS])
  const [view, setView] = useUrlFilter<DocView | ''>('view', '', ['', ...DOC_VIEWS])
  const clearFilters = useClearFilters()
  // Releases pickups that can no longer be met. A side effect, so it runs after drawing, not during it.
  useEffect(() => { if (data) runPickupChecks() }, [data])

  const needsMe = (r: DocumentRequest) => !!actor && needsActionBy(actor)(r)

  const rows = useMemo(() => {
    let list = data ?? []
    if (approvalsOnly) list = filterRequests(list.filter(awaitingDecision), { type }, needsMe)
    else list = filterRequests(list, { tab, type, status, stage, kind, view }, needsMe)
    const term = q.trim().toLowerCase()
    if (term) list = list.filter((r) => r.referenceNo.toLowerCase().includes(term) || r.requesterName.toLowerCase().includes(term))
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, tab, q, type, status, stage, kind, view, approvalsOnly, actor])

  const paged = usePaged(rows)
  const counts = useMemo(
    () => ({
      action: (data ?? []).filter(needsMe).length,
      open: (data ?? []).filter(isOpen).length,
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
              ] as [DocTab, string][]
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
        {!approvalsOnly && (
          <div role="group" aria-label="Filter by stage" className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:flex xl:flex-wrap">
            {STAGES.map(([k, label]) => {
              const n = filterRequests(data ?? [], { tab, type, status, kind, view, stage: k }, needsMe).length
              return (
                <button key={k} type="button" aria-pressed={stage === k} onClick={() => { setStage(stage === k ? '' : k); paged.setPage(0) }}
                  className={cn('inline-flex min-h-11 items-center justify-between gap-2 rounded-[var(--radius-control)] border px-3 text-left text-[length:calc(14.5px*var(--fs))] leading-tight font-semibold xl:justify-start', stage === k ? 'border-navy-900 bg-navy-900 text-white' : 'border-line bg-surface text-navy-900 hover:bg-surface-muted')}>
                  {label} <span className={stage === k ? 'text-white/80' : 'text-ink-nav'}>{n}</span>
                </button>
              )
            })}
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
          <Select value={kind} onChange={(e) => setKind(e.target.value as DocKind | '')} className={cn('h-11', kind && 'border-navy-900 font-semibold')} aria-label="Filter by kind of request">
            <option value="">All kinds of requests</option>
            {DOC_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </Select>
        )}
        {!approvalsOnly && (
          <Select value={status} onChange={(e) => setStatus(e.target.value as DocumentStatus | '')} className={cn('h-11', status && 'border-navy-900 font-semibold')} aria-label="Filter by status">
            <option value="">All statuses</option>
            {(Object.keys(STATUS_META) as DocumentStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </Select>
        )}

        {!approvalsOnly && (stage || status || kind || view || type || q) && (
          <p role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[length:calc(15.5px*var(--fs))] text-navy-900">
            <span>Showing <strong>{rows.length}</strong>{tab === 'action' ? ' that need your action' : tab === 'open' ? ' open' : ''}{view ? ` · ${VIEW_LABEL[view]}` : ''}</span>
            {view && <button type="button" onClick={() => setView('')} className="inline-flex min-h-11 items-center font-semibold text-info hover:underline">Remove "{VIEW_LABEL[view]}"</button>}
            <button type="button" onClick={clearFilters} className="inline-flex min-h-11 items-center font-semibold text-info hover:underline">Clear filters</button>
          </p>
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
                    {!approvalsOnly && <th className="px-4 py-3">Ready by</th>}
                    {!approvalsOnly && <th className="px-4 py-3">Pickup</th>}
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
                        <td className="px-4 py-3.5 text-navy-900">{r.requesterName}<span className="block text-[length:calc(14px*var(--fs))] text-ink-nav">{r.referenceNo}</span></td>
                        {!approvalsOnly && <td className="px-4 py-3.5 text-[length:calc(15px*var(--fs))]"><ReadyBy r={r} /></td>}
                        {!approvalsOnly && <td className="px-4 py-3.5 text-[length:calc(15px*var(--fs))] text-navy-900">{pickupOf(r) || <span className="text-ink-nav">—</span>}</td>}
                        <td className="px-5 py-3.5 text-right">{st && <Badge tone={st.tone}>{st.label}</Badge>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <RowList rows={paged.slice.map((r) => { const st = actor ? listStatus(r, actor) : null; return { key: r.id, to: `/documents/${r.id}`, title: getDocumentType(r.typeId).name, subtitle: <>{r.requesterName}{!approvalsOnly && <span className="block"><ReadyBy r={r} />{pickupOf(r) ? ` · Pickup ${pickupOf(r)}` : ''}</span>}</>, trailing: st ? <Badge tone={st.tone}>{st.label}</Badge> : undefined } })} />
              <Pagination page={paged.page} pages={paged.pages} total={paged.total} size={paged.size} onPage={paged.setPage} noun="requests" />
            </>
          )}
        </div>
      </Card>
    </>
  )
}
