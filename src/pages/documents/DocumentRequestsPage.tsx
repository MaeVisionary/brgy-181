import { FilePlus2, Search, Inbox } from '@/icons'
import { useMemo } from 'react'
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
import { claimFor, formatTime } from '@/services/appointmentService'
import { readyEstimate } from '@/services/processingService'
import { runPickupChecks } from '@/services/pickupService'
import type { DocumentRequest, DocumentStatus } from '@/types/document'
import { useStickyState } from '@/hooks/useStickyState'

type Tab = 'action' | 'open' | 'all'

/** Where a request is, in the words the Secretary works with. Pickup counts come from the linked pickup booking. */
type Stage = 'new' | 'review' | 'processing' | 'waiting' | 'ready' | 'pickup' | 'done' | 'rejected'
const STAGES: [Stage, string][] = [
  ['new', 'New'], ['review', 'Under review'], ['processing', 'Processing'], ['waiting', 'Awaiting requirements'],
  ['ready', 'Ready for pickup'], ['pickup', 'Pickup scheduled'], ['done', 'Completed'], ['rejected', 'Rejected or cancelled'],
]
function stageOf(r: DocumentRequest): Stage {
  switch (r.status) {
    case 'submitted': return 'new'
    case 'under_review': case 'for_assessment': return 'review'
    case 'needs_info': return 'waiting'
    case 'ready_for_pickup': return claimFor(r.id)?.date ? 'pickup' : 'ready'
    case 'released': case 'served': case 'recorded': case 'forwarded': return 'done'
    case 'rejected': case 'cancelled': return 'rejected'
    default: return 'processing'
  }
}
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
  const [tab, setTab] = useStickyState<Tab>('tab', 'action')
  const [q, setQ] = useStickyState('q', '')
  const [type, setType] = useStickyState('type', '')
  const [status, setStatus] = useStickyState('status', '')
  const [stage, setStage] = useStickyState<Stage | ''>('stage', '')
  useMemo(() => runPickupChecks(), [data]) // eslint-disable-line react-hooks/exhaustive-deps

  const needsMe = (r: DocumentRequest) => !!actor && availableTransitions(r, actor).some((t) => t.by !== 'owner' && !t.label.startsWith('Cancel'))

  const rows = useMemo(() => {
    let list = data ?? []
    if (approvalsOnly) list = list.filter((r) => r.status === 'pending_approval' || r.status === 'for_assessment')
    else if (tab === 'action') list = list.filter(needsMe)
    else if (tab === 'open') list = list.filter((r) => !TERMINAL.includes(r.status))
    if (type) list = list.filter((r) => r.typeId === type)
    if (status) list = list.filter((r) => r.status === status)
    if (stage && !approvalsOnly) list = list.filter((r) => stageOf(r) === stage)
    const term = q.trim().toLowerCase()
    if (term) list = list.filter((r) => r.referenceNo.toLowerCase().includes(term) || r.requesterName.toLowerCase().includes(term))
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, tab, q, type, status, stage, approvalsOnly, actor])

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
        {!approvalsOnly && (
          <div role="group" aria-label="Filter by stage" className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:flex xl:flex-wrap">
            {STAGES.map(([k, label]) => {
              const n = (data ?? []).filter((r) => (tab === 'all' || tab === 'open' ? true : needsMe(r)) && stageOf(r) === k).length
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
