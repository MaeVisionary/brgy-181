import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronRight } from '@/icons'
import { useAuth } from '@/auth/useAuth'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FieldLabel, Select, TextArea, TextInput } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, Panel } from '@/components/ui/Panel'
import { StatCard } from '@/components/ui/StatCard'
import { CONCERN_CATEGORIES, PRIORITY_LABEL, type Priority } from '@/concerns/engine'
import { formatDate, formatDateTime } from '@/lib/format'
import { AREAS } from '@/mocks/residents'
import { mockUsers } from '@/mocks/users'
import {
  ISSUE_STATUS_LABEL,
  addIssueNote,
  assignIssue,
  concernInsights,
  getIssue,
  getMyConcern,
  listIssues,
  listReviewQueue,
  mergeIssues,
  moveSubmission,
  setIssueStatus,
  setPriority,
  type ConcernSubmission,
  type IssueDetail,
  type IssueStatus,
  type IssueView,
  type MyConcern,
} from '@/services/concernService'
import { ServiceError } from '@/services/mockApi'
import { NotFound } from '@/pages/system/NotFound'
import { BackLink } from '@/pages/resident/parts'

const PRIORITY_TONE: Record<Priority, BadgeTone> = { critical: 'danger', high: 'warning', normal: 'neutral', low: 'neutral' }
const nameOf = (id?: string) => (id === 'system' ? 'System' : mockUsers.find((u) => u.id === id)?.fullName ?? '—')

// ── Resident: one concern ────────────────────────────────────────────

export function MyConcernPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const [c, setC] = useState<(MyConcern & { resolution?: string }) | null>(null)
  const [missing, setMissing] = useState(false)
  useEffect(() => { if (user) getMyConcern(id, user).then(setC).catch(() => setMissing(true)) }, [id, user])
  if (missing) return <NotFound />
  if (!c) return <div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />
  const s = c.submission
  const next = c.status === 'Submitted' ? 'We received your concern. The barangay will review it.' : c.status === 'Processing' ? 'The barangay is working on this concern.' : 'This concern has been resolved.'
  return (
    <>
      <BackLink to="/my/complaints">My Complaints and Reports</BackLink>
      <PageHeader title={s.title} />
      <Card className="px-5 py-4">
        <p className="text-[length:calc(17px*var(--fs))] font-semibold text-navy-900">{next}</p>
        {c.linkedToOthers && c.status !== 'Completed' && <p className="mt-1 text-[length:calc(15.5px*var(--fs))] text-ink-nav">Other residents reported the same problem. The barangay is handling the reports together.</p>}
        {c.resolution && <p className="mt-2 text-[length:calc(15.5px*var(--fs))] text-navy-900">{c.resolution}</p>}
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 text-[length:calc(15.5px*var(--fs))]">
          <dt className="text-ink-muted">Reference</dt><dd className="text-navy-900">{s.ref}</dd>
          <dt className="text-ink-muted">Sent</dt><dd className="text-navy-900">{formatDateTime(s.submittedAt)}</dd>
          <dt className="text-ink-muted">Where</dt><dd className="text-navy-900">{[s.street, s.landmark].filter(Boolean).join(' · ') || '—'}</dd>
          <dt className="text-ink-muted">Status</dt><dd className="font-semibold text-navy-900">{c.status}</dd>
        </dl>
        <p className="mt-4 text-[length:calc(16px*var(--fs))] whitespace-pre-wrap text-navy-900">{s.details}</p>
      </Card>
    </>
  )
}

// ── Staff: overview ──────────────────────────────────────────────────

export function ConcernsPage() {
  const { user, can } = useAuth()
  const [issues, setIssues] = useState<IssueView[] | null>(null)
  const [queue, setQueue] = useState<ConcernSubmission[]>([])
  const [f, setF] = useState({ priority: '', status: 'active', category: '', street: '', assigned: '' })
  const manage = can('concerns.manage')
  const reload = () => {
    if (!user) return
    listIssues(user).then(setIssues).catch(() => setIssues([]))
    if (manage) listReviewQueue(user).then(setQueue).catch(() => setQueue([]))
  }
  useEffect(reload, [user, manage])
  const shown = useMemo(() => (issues ?? []).filter((i) =>
    (!f.priority || i.priority === f.priority) &&
    (f.status === 'all' || (f.status === 'active' ? !['resolved', 'closed'].includes(i.status) : i.status === f.status)) &&
    (!f.category || i.category === f.category) && (!f.street || i.street === f.street) && (!f.assigned || i.assignedTo === f.assigned)), [issues, f])
  if (!user) return null
  const count = (fn: (i: IssueView) => boolean) => (issues ? issues.filter(fn).length : null)
  const open = (i: IssueView) => !['resolved', 'closed'].includes(i.status)
  const insights = issues ? concernInsights(user) : null
  const staffList = mockUsers.filter((u) => u.status === 'active' && u.roleId !== 'resident' && u.roleId !== 'system_admin')

  return (
    <>
      <PageHeader title="Community Concerns" />
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Critical" value={count((i) => open(i) && i.priority === 'critical')} attention />
        <StatCard label="High priority" value={count((i) => open(i) && i.priority === 'high')} />
        <StatCard label="Open" value={count(open)} />
        <StatCard label="Resolved" value={count((i) => i.status === 'resolved' || i.status === 'closed')} />
      </section>

      {manage && queue.length > 0 && (
        <Panel className="mt-4" title="Needs a decision" bodyClassName="px-0 py-0">
          <ul className="divide-y divide-line-soft">
            {queue.map((s) => <ReviewRow key={s.id} s={s} issues={issues ?? []} onDone={reload} />)}
          </ul>
        </Panel>
      )}

      <Panel className="mt-4" title="Issues" bodyClassName="px-0 py-0">
        <div className="grid grid-cols-2 gap-2 border-b border-line-soft px-4 py-3 sm:grid-cols-3 lg:grid-cols-5">
          <Select aria-label="Priority" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}><option value="">All priorities</option>{(['critical', 'high', 'normal', 'low'] as Priority[]).map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}</Select>
          <Select aria-label="Status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="active">Not resolved</option><option value="all">All statuses</option>{(Object.keys(ISSUE_STATUS_LABEL) as IssueStatus[]).map((s) => <option key={s} value={s}>{ISSUE_STATUS_LABEL[s]}</option>)}</Select>
          <Select aria-label="Type" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}><option value="">All types</option>{CONCERN_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select>
          <Select aria-label="Street" value={f.street} onChange={(e) => setF({ ...f, street: e.target.value })}><option value="">All streets</option>{AREAS.map((a) => <option key={a}>{a}</option>)}</Select>
          <Select aria-label="Assigned to" value={f.assigned} onChange={(e) => setF({ ...f, assigned: e.target.value })}><option value="">Anyone</option>{staffList.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}</Select>
        </div>
        {issues === null ? <div className="h-32 animate-pulse" /> : shown.length === 0 ? <p className="px-5 py-6 text-[length:calc(16px*var(--fs))] text-ink-muted">{issues.length ? 'No issues match these filters.' : 'No community concerns yet.'}</p> : (
          <ul className="divide-y divide-line-soft">
            {shown.map((i) => (
              <li key={i.id}>
                <Link to={`/concerns/${i.id}`} className="flex min-h-[64px] items-center gap-3 px-5 py-3 hover:bg-sky-50 active:bg-sky-100">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[length:calc(16.5px*var(--fs))] font-semibold text-navy-900">{i.title}</span>
                    <span className="block truncate text-[length:calc(14.5px*var(--fs))] text-ink-muted">{i.street ?? 'Street not given'} · {i.reports} report{i.reports === 1 ? '' : 's'} · {i.uniqueResidents} resident{i.uniqueResidents === 1 ? '' : 's'}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    {(i.priority === 'critical' || i.priority === 'high') && <Badge tone={PRIORITY_TONE[i.priority]}>{PRIORITY_LABEL[i.priority]}</Badge>}
                    <span className="text-[length:calc(13.5px*var(--fs))] text-ink-muted">{ISSUE_STATUS_LABEL[i.status]}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-ink-subtle" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {insights && insights.totalIssues > 0 && (
        <Panel className="mt-4" title="Insights">
          <dl className="grid grid-cols-1 gap-x-8 gap-y-1.5 text-[length:calc(15.5px*var(--fs))] sm:grid-cols-2">
            <div className="flex justify-between gap-3 border-b border-line-soft py-1.5"><dt className="text-ink-nav">Resolved</dt><dd className="text-navy-900">{insights.resolvedShare}%</dd></div>
            <div className="flex justify-between gap-3 border-b border-line-soft py-1.5"><dt className="text-ink-nav">Average days to first action</dt><dd className="text-navy-900">{insights.avgDaysToAction ?? 'No data yet'}</dd></div>
            <div className="flex justify-between gap-3 border-b border-line-soft py-1.5"><dt className="text-ink-nav">Average days to resolve</dt><dd className="text-navy-900">{insights.avgDaysToResolve ?? 'No data yet'}</dd></div>
            <div className="flex justify-between gap-3 border-b border-line-soft py-1.5"><dt className="text-ink-nav">Most reports</dt><dd className="text-right text-navy-900">{insights.topStreets.map(([s, n]) => `${s} (${n})`).join(', ') || '—'}</dd></div>
          </dl>
          {insights.rising.length > 0 && <p className="mt-3 text-[length:calc(15.5px*var(--fs))] text-navy-900">More reports this week than last: {insights.rising.join(', ')}.</p>}
          {insights.comparisons.map((c) => <p key={c.category} className="mt-1 text-[length:calc(15.5px*var(--fs))] text-navy-900">{c.category}: {c.previous} report{c.previous === 1 ? '' : 's'} last month, {c.current} this month.</p>)}
        </Panel>
      )}
    </>
  )
}

function ReviewRow({ s, issues, onDone }: { s: ConcernSubmission; issues: IssueView[]; onDone: () => void }) {
  const { user } = useAuth()
  const [target, setTarget] = useState(s.suggestedIssueId ?? '')
  const [err, setErr] = useState<string | null>(null)
  const suggested = issues.find((i) => i.id === s.suggestedIssueId)
  const run = async (t: string | 'new') => { try { await moveSubmission(s.id, t, user!); onDone() } catch (e) { setErr(e instanceof ServiceError ? e.message : 'Not saved.') } }
  return (
    <li className="px-5 py-3.5">
      <p className="font-semibold text-navy-900">{s.title} <span className="font-normal text-ink-muted">· {s.ref}</span></p>
      <p className="text-[length:calc(14.5px*var(--fs))] text-ink-muted">{s.needsReview === 'location' ? 'No street given' : `Possible match: ${suggested?.title ?? '—'} (${s.match?.reason})`}</p>
      <p className="mt-1 line-clamp-2 text-[length:calc(15px*var(--fs))] text-navy-900">{s.details}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Select aria-label="Add to issue" className="max-w-[260px]" value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="">Choose an issue</option>
          {issues.filter((i) => !['resolved', 'closed'].includes(i.status)).map((i) => <option key={i.id} value={i.id}>{i.title} · {i.street ?? '—'}</option>)}
        </Select>
        <Button size="sm" disabled={!target} onClick={() => run(target)}>Add to issue</Button>
        <Button size="sm" variant="secondary" onClick={() => run('new')}>Keep separate</Button>
      </div>
      {err && <p className="mt-1 text-[length:calc(14px*var(--fs))] text-danger-ink">{err}</p>}
    </li>
  )
}

// ── Staff: one issue ─────────────────────────────────────────────────

export function ConcernIssuePage() {
  const { id = '' } = useParams()
  const { user, can } = useAuth()
  const [d, setD] = useState<IssueDetail | null>(null)
  const [all, setAll] = useState<IssueView[]>([])
  const [missing, setMissing] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [dialog, setDialog] = useState<null | 'resolve' | 'priority' | 'merge'>(null)
  const [form, setForm] = useState({ description: '', actionTaken: '', note: '', assignee: '', expected: '', priority: 'high' as Priority, reason: '', mergeFrom: '' })
  const manage = can('concerns.manage')
  const reload = () => {
    if (!user) return
    getIssue(id, user).then(setD).catch(() => setMissing(true))
    listIssues(user).then(setAll).catch(() => undefined)
  }
  useEffect(reload, [id, user])
  if (missing) return <NotFound />
  if (!d || !user) return <div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />
  const i = d.issue
  const act = async (fn: () => Promise<unknown>, ok: string) => { setMsg(null); try { await fn(); setMsg({ ok: true, text: ok }); setDialog(null); reload() } catch (e) { setMsg({ ok: false, text: e instanceof ServiceError ? e.message : 'Not saved.' }) } }
  const staffList = mockUsers.filter((u) => u.status === 'active' && u.roleId !== 'resident' && u.roleId !== 'system_admin')
  const nextSteps: [IssueStatus, string][] = i.status === 'open' ? [['under_review', 'Start review']] : i.status === 'under_review' ? [['in_progress', 'Start work']] : i.status === 'assigned' ? [['in_progress', 'Start work']] : i.status === 'resolved' ? [['closed', 'Close'], ['open', 'Reopen']] : i.status === 'closed' ? [['open', 'Reopen']] : []

  return (
    <>
      <BackLink to="/concerns">Community Concerns</BackLink>
      <PageHeader title={i.title} />
      {msg && <p role="status" className={`mb-3 rounded-[var(--radius-control)] px-4 py-2.5 text-[length:calc(15px*var(--fs))] ${msg.ok ? 'bg-success-tint text-navy-900' : 'bg-danger-tint text-danger-ink'}`}>{msg.text}</p>}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card className="px-5 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={PRIORITY_TONE[i.priority]}>{PRIORITY_LABEL[i.priority]}</Badge>
              <span className="text-[length:calc(15px*var(--fs))] font-semibold text-navy-900">{ISSUE_STATUS_LABEL[i.status]}</span>
            </div>
            <p className="mt-2 text-[length:calc(15.5px*var(--fs))] text-navy-900">{i.priorityReason}</p>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 text-[length:calc(15.5px*var(--fs))]">
              <dt className="text-ink-muted">Where</dt><dd className="text-navy-900">{[i.street, i.landmark].filter(Boolean).join(' · ') || '—'}</dd>
              <dt className="text-ink-muted">Type</dt><dd className="text-navy-900">{i.category}</dd>
              <dt className="text-ink-muted">Reports</dt><dd className="text-navy-900">{i.reports} from {i.uniqueResidents} resident{i.uniqueResidents === 1 ? '' : 's'}</dd>
              <dt className="text-ink-muted">First / latest</dt><dd className="text-navy-900">{formatDate(i.firstReportedAt)} · {formatDate(i.latestReportAt)}</dd>
              <dt className="text-ink-muted">Trend</dt><dd className="text-navy-900">{i.trend === 'rising' ? 'More reports this week' : i.trend === 'falling' ? 'Fewer reports this week' : 'Steady'}</dd>
              <dt className="text-ink-muted">Assigned</dt><dd className="text-navy-900">{i.assignedTo ? `${nameOf(i.assignedTo)}${i.expectedBy ? ` · by ${formatDate(i.expectedBy)}` : ''}` : 'Unassigned'}</dd>
              <dt className="text-ink-muted">Reference</dt><dd className="text-navy-900">{i.ref}</dd>
            </dl>
            {i.resolution && <p className="mt-3 rounded-md bg-success-tint px-3 py-2 text-[length:calc(15px*var(--fs))] text-navy-900"><strong>Resolved:</strong> {i.resolution.description} · {i.resolution.actionTaken}</p>}
          </Card>

          <Panel title={`Reports (${d.submissions.length})`} bodyClassName="px-0 py-0">
            <ul className="divide-y divide-line-soft">
              {d.submissions.map((s) => (
                <li key={s.id} className="px-5 py-3.5">
                  <p className="text-[length:calc(14.5px*var(--fs))] text-ink-muted">{s.ref} · {formatDateTime(s.submittedAt)}{s.residentName ? ` · ${s.residentName}` : ''}{s.match ? ` · ${s.match.by === 'system' ? `matched (${s.match.confidence})` : 'confirmed by staff'}` : ''}</p>
                  <p className="font-semibold text-navy-900">{s.title}</p>
                  <p className="text-[length:calc(15.5px*var(--fs))] text-navy-900">{s.details}</p>
                  <p className="text-[length:calc(14px*var(--fs))] text-ink-muted">{[s.street, s.landmark, s.frequency].filter(Boolean).join(' · ')}</p>
                  {manage && d.submissions.length > 1 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Select aria-label="Move to issue" className="max-w-[240px]" defaultValue="" onChange={(e) => e.target.value && act(() => moveSubmission(s.id, e.target.value, user), `${s.ref} moved.`)}>
                        <option value="">Move to another issue…</option>
                        {all.filter((x) => x.id !== i.id && !['resolved', 'closed'].includes(x.status)).map((x) => <option key={x.id} value={x.id}>{x.title} · {x.street ?? '—'}</option>)}
                      </Select>
                      <Button size="sm" variant="secondary" onClick={() => act(() => moveSubmission(s.id, 'new', user), `${s.ref} is now its own issue.`)}>Separate</Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="space-y-4">
          {manage && (
            <Panel title="Actions">
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {nextSteps.map(([s, label]) => <Button key={s} size="sm" variant={s === 'open' ? 'secondary' : 'primary'} onClick={() => act(() => setIssueStatus(i.id, s, user), `${label}: done.`)}>{label}</Button>)}
                  {['assigned', 'in_progress', 'under_review'].includes(i.status) && <Button size="sm" onClick={() => setDialog('resolve')}>Resolve</Button>}
                </div>
                {!['resolved', 'closed'].includes(i.status) && (
                  <div className="space-y-2 border-t border-line-soft pt-3">
                    <FieldLabel label="Assign to">
                      <Select value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })}><option value="">Choose</option>{staffList.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}</Select>
                    </FieldLabel>
                    <FieldLabel label="Expected by (optional)"><TextInput type="date" value={form.expected} onChange={(e) => setForm({ ...form, expected: e.target.value })} /></FieldLabel>
                    <Button size="sm" variant="secondary" disabled={!form.assignee} onClick={() => act(() => assignIssue(i.id, form.assignee, form.expected, user), 'Assigned.')}>Assign</Button>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 border-t border-line-soft pt-3">
                  <Button size="sm" variant="secondary" onClick={() => setDialog('priority')}>Change priority</Button>
                  <Button size="sm" variant="secondary" onClick={() => setDialog('merge')}>Merge another issue</Button>
                </div>
                <div className="space-y-2 border-t border-line-soft pt-3">
                  <TextArea aria-label="Note" placeholder="Add a note or action taken" className="min-h-[64px]" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
                  <Button size="sm" variant="secondary" disabled={!form.note.trim()} onClick={() => act(() => addIssueNote(i.id, form.note, user), 'Note added.').then(() => setForm((f) => ({ ...f, note: '' })))}>Add note</Button>
                </div>
              </div>
            </Panel>
          )}
          <Panel title="History">
            <ol className="space-y-2.5">
              {[...i.history].reverse().map((h, n) => (
                <li key={n} className="border-l-2 border-line-soft pl-3">
                  <p className="text-[length:calc(15px*var(--fs))] text-navy-900">{h.action}</p>
                  <p className="text-[length:calc(13.5px*var(--fs))] text-ink-muted">{formatDateTime(h.at)} · {nameOf(h.byUserId)}{h.detail ? ` · ${h.detail}` : ''}</p>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>

      {dialog === 'resolve' && (
        <ConfirmDialog title="Resolve this issue?" confirmLabel="Resolve" onCancel={() => setDialog(null)} onConfirm={() => act(() => setIssueStatus(i.id, 'resolved', user, { description: form.description, actionTaken: form.actionTaken }), 'Resolved. Residents who reported it were told.')}>
          <div className="space-y-2 text-left">
            <TextArea aria-label="What was fixed" placeholder="What was fixed" className="min-h-[64px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <TextArea aria-label="Action taken" placeholder="Action taken (who, what)" className="min-h-[64px]" value={form.actionTaken} onChange={(e) => setForm({ ...form, actionTaken: e.target.value })} />
          </div>
        </ConfirmDialog>
      )}
      {dialog === 'priority' && (
        <ConfirmDialog title="Change priority" confirmLabel="Save" onCancel={() => setDialog(null)} onConfirm={() => act(() => setPriority(i.id, form.priority, form.reason, user), 'Priority saved.')}>
          <div className="space-y-2 text-left">
            <Select aria-label="Priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}>{(['critical', 'high', 'normal', 'low'] as Priority[]).map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}</Select>
            <TextArea aria-label="Reason" placeholder="Reason" className="min-h-[64px]" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            {i.priorityOverride && <button type="button" className="text-[length:calc(14.5px*var(--fs))] font-semibold text-info hover:underline" onClick={() => act(() => setPriority(i.id, null, '', user), 'Priority back to the suggested level.')}>Use the suggested priority instead</button>}
          </div>
        </ConfirmDialog>
      )}
      {dialog === 'merge' && (
        <ConfirmDialog title="Merge another issue into this one?" confirmLabel="Merge" onCancel={() => setDialog(null)} onConfirm={() => act(() => mergeIssues(i.id, form.mergeFrom, user), 'Merged. The other issue is kept as closed.')}>
          <Select aria-label="Issue to merge" value={form.mergeFrom} onChange={(e) => setForm({ ...form, mergeFrom: e.target.value })}>
            <option value="">Choose an issue</option>
            {all.filter((x) => x.id !== i.id && !['closed'].includes(x.status)).map((x) => <option key={x.id} value={x.id}>{x.title} · {x.street ?? '—'}</option>)}
          </Select>
        </ConfirmDialog>
      )}
    </>
  )
}
