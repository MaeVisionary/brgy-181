import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronRight } from '@/icons'
import { useAuth } from '@/auth/useAuth'
import { BarangaySeal } from '@/components/layout/BarangaySeal'
import { SealWatermark } from '@/components/layout/SealWatermark'
import { BackLink } from '@/components/ui/BackLink'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { FieldLabel, Select, TextArea, TextInput } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, Panel } from '@/components/ui/Panel'
import { Timeline } from '@/components/ui/Timeline'
import { BARANGAY, BARANGAY_CONTACT } from '@/config/barangay'
import { useStickyState } from '@/hooks/useStickyState'
import { mockUsers } from '@/mocks/users'
import {
  ANNOUNCEMENT_CATEGORIES, ANNOUNCEMENT_STATUS_LABEL, AUDIENCES, approveAnnouncement, archiveAnnouncement, cancelAnnouncement, getAnnouncement,
  getPublished, listAnnouncements, listPublished, rejectAnnouncement, requestRevision, saveDraft, submitForApproval,
  type Announcement, type AnnouncementContent, type AnnouncementStatus,
} from '@/services/announcementService'
import { ServiceError } from '@/services/mockApi'
import { formatTime } from '@/services/schedulingService'
import { NotFound } from '@/pages/system/NotFound'
import { ActionStack } from '@/components/ui/ActionStack'

const longDate = (d: string) => new Date(d.length === 10 ? `${d}T12:00:00+08:00` : d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' })
const shortDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'Asia/Manila' })
const weekdayDate = (d: string) => new Date(`${d}T12:00:00+08:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'Asia/Manila' })
const errText = (e: unknown) => (e instanceof ServiceError ? e.message : 'Something went wrong. Please try again.')
const nameOf = (id: string) => (id === 'system' ? 'System' : mockUsers.find((u) => u.id === id)?.fullName ?? '')
const STATUS_TONE: Record<AnnouncementStatus, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  draft: 'neutral', pending: 'warning', returned: 'warning', scheduled: 'info', published: 'success', rejected: 'danger', archived: 'neutral', cancelled: 'neutral',
}

/** What a resident sees. Also used as the exact preview for the Secretary and the Chairman. */
export function AnnouncementView({ a }: { a: AnnouncementContent & { publishedAt?: string; status?: AnnouncementStatus } }) {
  const e = a.event
  const office = a.category === 'Office Schedule'
  const when = e?.date ? `${weekdayDate(e.date)}${e.endDate && e.endDate !== e.date ? ` to ${weekdayDate(e.endDate)}` : ''}` : null
  const hours = e?.start ? `${formatTime(e.start)}${e.end ? ` – ${e.end === '12:00' ? '12:00 NN' : formatTime(e.end)}` : ''}` : null
  const section = (title: string, body: React.ReactNode) => (
    <section className="border-t border-line-soft py-4">
      <h3 className="mb-1 text-[length:calc(16px*var(--fs))] font-semibold text-ink-nav">{title}</h3>
      <div className="text-[length:calc(17.5px*var(--fs))] text-navy-900">{body}</div>
    </section>
  )
  return (
    <Card className="overflow-hidden">
      {/* Seal watermark stays in the heading, away from text below and from all buttons. */}
      <header className="relative overflow-hidden border-b border-line-soft bg-surface-muted px-5 py-5 sm:px-7">
        <SealWatermark size={180} side className="opacity-[0.06]" />
        <div className="relative flex items-center gap-3">
          <BarangaySeal className="size-11 shrink-0" />
          <div>
            <p className="font-display text-[length:calc(16px*var(--fs))] font-extrabold text-navy-900">{BARANGAY.name}</p>
            <p className="text-[length:calc(14.5px*var(--fs))] text-ink-nav">Zone {BARANGAY.zone}, District {BARANGAY.district}, {BARANGAY.city}</p>
          </div>
        </div>
        <p className="relative mt-4 text-[length:calc(15px*var(--fs))] font-semibold text-navy-600">{a.category}{a.urgent ? ' · Important' : ''}</p>
        <h2 className="relative mt-1 font-display text-[length:calc(26px*var(--fs))] leading-tight font-extrabold text-navy-900">{a.title}</h2>
        <p className="relative mt-1 text-[length:calc(16px*var(--fs))] text-ink-nav">{longDate(a.publishedAt ?? a.publishAt)}</p>
      </header>
      <div className="px-5 sm:px-7">
        {a.status === 'cancelled' && <p role="alert" className="mt-4 rounded-[var(--radius-control)] bg-danger-tint px-4 py-3 text-[length:calc(16px*var(--fs))] text-danger-ink">This announcement was cancelled.</p>}
        <p className="py-4 text-[length:calc(17.5px*var(--fs))] whitespace-pre-line text-navy-900">{a.body}</p>
        {(when || hours) && section(office ? 'Effective' : 'When', <>{when && <p>{when}</p>}{hours && <p>{hours}</p>}</>)}
        {e?.location && section('Where', e.location)}
        {!!a.bring?.length && section(office ? 'Please note' : 'What to bring', <ul className="list-disc space-y-1 pl-5">{a.bring.map((b) => <li key={b}>{b}</li>)}</ul>)}
        {a.audience !== 'All residents' && section('For', a.audience)}
        {section('Questions', a.contact || `${BARANGAY_CONTACT.hall} · ${BARANGAY_CONTACT.phone}`)}
      </div>
    </Card>
  )
}

// ── Residents ────────────────────────────────────────────────────────

export function ResidentAnnouncementsPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<(Announcement & { read: boolean })[] | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => { if (user) listPublished(user).then(setItems).catch(() => setFailed(true)) }, [user])
  return (
    <>
      <BackLink fallbackTo="/dashboard" fallbackLabel="Home" />
      <PageHeader title="Barangay Announcements" />
      {failed ? <Card><EmptyState title="Could not load announcements" body="Please check your connection and try again." /></Card>
        : items === null ? <div className="h-40 animate-pulse rounded-[var(--radius-card)] bg-surface" />
        : items.length === 0 ? <Card><EmptyState title="No announcements right now" /></Card> : (
          <Card className="overflow-hidden"><AnnouncementRows items={items} /></Card>
        )}
    </>
  )
}

/** Compact list: title, category · date, and a quiet marker for important or unread items. */
export function AnnouncementRows({ items }: { items: (Announcement & { read?: boolean })[] }) {
  return (
    <ul className="divide-y divide-line-soft">
      {items.map((a) => (
        <li key={a.id}>
          <Link to={`/my/announcements/${a.id}`} className="flex min-h-[72px] items-center gap-3 px-5 py-3.5 hover:bg-sky-50 active:bg-sky-100">
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-[length:calc(17px*var(--fs))] font-semibold break-words text-navy-900">
                {a.read === false && <span aria-label="New" className="size-2.5 shrink-0 rounded-full bg-info" />}
                {a.title}
              </span>
              <span className="block text-[length:calc(15.5px*var(--fs))] text-ink-nav">{a.category} · {shortDate(a.publishedAt ?? a.publishAt)}</span>
            </span>
            {a.urgent && <Badge tone="danger">Important</Badge>}
            <ChevronRight className="size-5 shrink-0 text-ink-subtle" />
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function ResidentAnnouncementPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const [a, setA] = useState<Announcement | null>(null)
  const [missing, setMissing] = useState(false)
  useEffect(() => { if (user) getPublished(id, user).then(setA).catch(() => setMissing(true)) }, [id, user])
  if (missing) return <NotFound />
  if (!a) return <div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />
  return (
    <>
      <BackLink fallbackTo="/my/announcements" fallbackLabel="Announcements" />
      <div className="max-w-3xl"><AnnouncementView a={a} /></div>
    </>
  )
}

// ── Staff: list ──────────────────────────────────────────────────────

type Tab = 'all' | 'drafts' | 'pending' | 'approved' | 'published' | 'archived'
const TAB_STATUSES: Record<Tab, AnnouncementStatus[]> = {
  all: ['draft', 'returned', 'rejected', 'pending', 'scheduled', 'published', 'archived', 'cancelled'],
  drafts: ['draft', 'returned', 'rejected'], pending: ['pending'], approved: ['scheduled'], published: ['published'], archived: ['archived', 'cancelled'],
}

export function AnnouncementsAdminPage() {
  const { user, can } = useAuth()
  const approver = can('announcements.approve')
  const [items, setItems] = useState<Announcement[] | null>(null)
  const [tab, setTab] = useStickyState<Tab>('tab', approver ? 'pending' : 'all')
  useEffect(() => { if (user) listAnnouncements(user).then(setItems).catch(() => setItems([])) }, [user])
  const count = (t: Tab) => (items ?? []).filter((a) => TAB_STATUSES[t].includes(a.status) || (t === 'pending' && !!a.revision)).length
  const shown = (items ?? []).filter((a) => TAB_STATUSES[tab].includes(a.status) || (tab === 'pending' && !!a.revision))
  const tabBtn = (t: Tab, label: string) => (
    <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`h-11 rounded-[var(--radius-control)] px-4 text-[length:calc(15.5px*var(--fs))] font-semibold whitespace-nowrap ${tab === t ? 'bg-navy-900 text-white' : 'border border-line bg-surface text-navy-900'}`}>
      {label}{t !== 'all' && count(t) ? ` (${count(t)})` : ''}
    </button>
  )
  return (
    <>
      <PageHeader title="Announcements" actions={can('announcements.manage') && <ButtonLink to="/announcements/new">New announcement</ButtonLink>} />
      <div role="tablist" className="mb-4 flex flex-wrap gap-1.5">
        {tabBtn('all', 'All')}{tabBtn('drafts', 'Drafts')}{tabBtn('pending', 'Pending approval')}{tabBtn('approved', 'Approved')}{tabBtn('published', 'Published')}{tabBtn('archived', 'Archived')}
      </div>
      {items === null ? <div className="h-32 animate-pulse rounded-[var(--radius-card)] bg-surface" /> : shown.length === 0 ? <Card><EmptyState title="Nothing here" /></Card> : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line-soft">
            {shown.map((a) => (
              <li key={a.id}>
                <Link to={`/announcements/${a.id}`} className="flex min-h-[68px] items-center gap-3 px-5 py-3 hover:bg-sky-50">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[length:calc(16.5px*var(--fs))] font-semibold break-words text-navy-900">{a.title}</span>
                    <span className="block text-[length:calc(15px*var(--fs))] text-ink-nav">{a.category}</span>
                    <span className="mt-1 block sm:hidden"><Badge tone={a.revision ? 'warning' : STATUS_TONE[a.status]}>{a.revision ? 'Change to review' : ANNOUNCEMENT_STATUS_LABEL[a.status]}</Badge></span>
                  </span>
                  <span className="hidden sm:inline-flex"><Badge tone={a.revision ? 'warning' : STATUS_TONE[a.status]}>{a.revision ? 'Change to review' : ANNOUNCEMENT_STATUS_LABEL[a.status]}</Badge></span>
                  <ChevronRight className="size-5 shrink-0 text-ink-subtle" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  )
}

// ── Staff: editor ────────────────────────────────────────────────────

const toLocalInput = (iso: string) => new Date(new Date(iso).getTime() + 8 * 3600_000).toISOString().slice(0, 16)
const fromLocalInput = (v: string) => new Date(`${v}:00+08:00`).toISOString()
const blank = (): AnnouncementContent => ({ title: '', category: 'Public Advisory', summary: '', body: '', publishAt: new Date().toISOString(), audience: 'All residents', urgent: false, bring: [] })

export function AnnouncementEditorPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [c, setC] = useState<AnnouncementContent | null>(id ? null : blank())
  const [when, setWhen] = useState<'now' | 'later'>('now')
  const [preview, setPreview] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [existing, setExisting] = useState<Announcement | null>(null)
  useEffect(() => {
    if (!id || !user) return
    getAnnouncement(id, user).then((a) => { setExisting(a); const src = a.revision ?? a; setC({ title: src.title, category: src.category, summary: src.summary, body: src.body, publishAt: src.publishAt, expiresOn: src.expiresOn, event: src.event, bring: src.bring, contact: src.contact, audience: src.audience, urgent: src.urgent }); setWhen(new Date(src.publishAt).getTime() > Date.now() ? 'later' : 'now') }).catch(() => setErr('Announcement not found.'))
  }, [id, user])
  if (!user) return null
  if (!c) return err ? <NotFound /> : <div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />
  const set = (patch: Partial<AnnouncementContent>) => setC({ ...c, ...patch })
  const ev = (patch: Partial<NonNullable<AnnouncementContent['event']>>) => set({ event: { ...c.event, ...patch } })
  const content = (): AnnouncementContent => ({ ...c, publishAt: when === 'now' ? new Date().toISOString() : c.publishAt })
  const live = existing && ['scheduled', 'published', 'pending'].includes(existing.status)
  const run = async (submit: boolean) => {
    setBusy(true); setErr(null)
    try {
      const a = await saveDraft(content(), user, id)
      if (submit && ['draft', 'returned'].includes(a.status)) await submitForApproval(a.id, user)
      navigate(`/announcements/${a.id}`, { replace: true })
    } catch (e) { setErr(errText(e)) } finally { setBusy(false) }
  }
  const activity = ['Community Activity', 'Health and Safety', 'Government Program', 'Emergency Announcement', 'Community Notice'].includes(c.category)
  const office = c.category === 'Office Schedule'
  return (
    <>
      <BackLink fallbackTo="/announcements" fallbackLabel="Announcements" />
      <PageHeader title={id ? 'Edit announcement' : 'New announcement'} />
      {live && <p className="mb-4 rounded-[var(--radius-control)] bg-warning-tint px-4 py-3 text-[length:calc(16px*var(--fs))] text-navy-900">Already approved. Your changes will be sent to the Punong Barangay; residents keep seeing the current version until then.</p>}
      {preview ? (
        <div className="max-w-3xl space-y-3">
          <AnnouncementView a={{ ...content(), publishedAt: content().publishAt }} />
          <Button variant="secondary" onClick={() => setPreview(false)}>Back to editing</Button>
        </div>
      ) : (
        <Card className="max-w-3xl space-y-4 px-5 py-5">
          <FieldLabel label="Title" required><TextInput value={c.title} onChange={(e) => set({ title: e.target.value })} /></FieldLabel>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldLabel label="Category" required><Select value={c.category} onChange={(e) => set({ category: e.target.value as AnnouncementContent['category'] })}>{ANNOUNCEMENT_CATEGORIES.map((x) => <option key={x}>{x}</option>)}</Select></FieldLabel>
            <FieldLabel label="For"><Select value={c.audience} onChange={(e) => set({ audience: e.target.value as AnnouncementContent['audience'] })}>{AUDIENCES.map((x) => <option key={x}>{x}</option>)}</Select></FieldLabel>
          </div>
          <FieldLabel label="Summary (one sentence)" required><TextInput maxLength={160} value={c.summary} onChange={(e) => set({ summary: e.target.value })} /></FieldLabel>
          <FieldLabel label="Full announcement" required><TextArea className="min-h-[140px]" value={c.body} onChange={(e) => set({ body: e.target.value })} /></FieldLabel>
          {(activity || office) && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FieldLabel label={office ? 'Effective from' : 'Date'} required={activity && c.category !== 'Community Notice'}><TextInput type="date" value={c.event?.date ?? ''} onChange={(e) => ev({ date: e.target.value })} /></FieldLabel>
              <FieldLabel label={office ? 'Until' : 'End date (if more than one day)'}><TextInput type="date" value={c.event?.endDate ?? ''} onChange={(e) => ev({ endDate: e.target.value })} /></FieldLabel>
              <FieldLabel label={office ? 'Office opens' : 'Starts'}><TextInput type="time" value={c.event?.start ?? ''} onChange={(e) => ev({ start: e.target.value })} /></FieldLabel>
              <FieldLabel label={office ? 'Office closes' : 'Ends'}><TextInput type="time" value={c.event?.end ?? ''} onChange={(e) => ev({ end: e.target.value })} /></FieldLabel>
              {activity && <FieldLabel label="Location"><TextInput value={c.event?.location ?? ''} onChange={(e) => ev({ location: e.target.value })} /></FieldLabel>}
            </div>
          )}
          {activity && <FieldLabel label="What to bring (one per line)"><TextArea className="min-h-[80px]" value={(c.bring ?? []).join('\n')} onChange={(e) => set({ bring: e.target.value.split('\n') })} /></FieldLabel>}
          <FieldLabel label="Contact for questions (optional)"><TextInput value={c.contact ?? ''} onChange={(e) => set({ contact: e.target.value })} /></FieldLabel>
          <fieldset>
            <legend className="mb-1.5 text-[length:calc(16px*var(--fs))] font-semibold text-navy-900">Publish</legend>
            <label className="flex min-h-11 items-center gap-2.5 text-[length:calc(16px*var(--fs))] text-navy-900"><input type="radio" className="size-5 accent-[#002132]" checked={when === 'now'} onChange={() => setWhen('now')} /> As soon as it is approved</label>
            <label className="flex min-h-11 items-center gap-2.5 text-[length:calc(16px*var(--fs))] text-navy-900"><input type="radio" className="size-5 accent-[#002132]" checked={when === 'later'} onChange={() => setWhen('later')} /> On a set date and time</label>
            {when === 'later' && <TextInput type="datetime-local" aria-label="Publish on" className="mt-1 w-full sm:w-auto" value={toLocalInput(c.publishAt)} onChange={(e) => e.target.value && set({ publishAt: fromLocalInput(e.target.value) })} />}
          </fieldset>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldLabel label="Stop showing after (optional)"><TextInput type="date" value={c.expiresOn ?? ''} onChange={(e) => set({ expiresOn: e.target.value || undefined })} /></FieldLabel>
            <label className="flex min-h-12 items-end gap-2.5 pb-2 text-[length:calc(16px*var(--fs))] font-semibold text-navy-900"><input type="checkbox" className="size-5 accent-[#002132]" checked={c.urgent} onChange={(e) => set({ urgent: e.target.checked })} /> Mark as important</label>
          </div>
          {err && <p role="alert" className="rounded-[var(--radius-control)] bg-danger-tint px-4 py-3 text-[length:calc(16px*var(--fs))] text-danger-ink">{err}</p>}
          <ActionStack>
            {!live && <Button loading={busy} onClick={() => run(true)}>Submit for Approval</Button>}
            {live && <Button loading={busy} onClick={() => run(false)}>Send changes for approval</Button>}
            <Button variant="secondary" onClick={() => setPreview(true)}>Preview</Button>
            {!live && <Button variant="ghost" loading={busy} onClick={() => run(false)}>Save Draft</Button>}
          </ActionStack>
        </Card>
      )}
    </>
  )
}

// ── Staff: one announcement (review and actions) ─────────────────────

export function AnnouncementAdminPage() {
  const { id = '' } = useParams()
  const { user, can } = useAuth()
  const [a, setA] = useState<Announcement | null>(null)
  const [missing, setMissing] = useState(false)
  const [mode, setMode] = useState<null | 'approve' | 'revise' | 'reject' | 'cancel'>(null)
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const load = () => { if (user) getAnnouncement(id, user).then(setA).catch(() => setMissing(true)) }
  useEffect(load, [id, user])
  if (missing) return <NotFound />
  if (!a || !user) return <div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />
  const run = async (fn: () => Promise<Announcement>, ok: string) => { setMsg(null); try { setA(await fn()); setMode(null); setNote(''); setMsg({ ok: true, text: ok }) } catch (e) { setMsg({ ok: false, text: errText(e) }); setMode(null) } }
  const approver = can('announcements.approve')
  const writer = can('announcements.manage')
  const reviewable = a.status === 'pending' || !!a.revision
  return (
    <>
      <BackLink fallbackTo="/announcements" fallbackLabel="Announcements" />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="font-display text-[length:calc(24px*var(--fs))] font-extrabold text-navy-900">{a.ref}</h1>
        <Badge tone={a.revision ? 'warning' : STATUS_TONE[a.status]}>{a.revision ? 'Change to review' : ANNOUNCEMENT_STATUS_LABEL[a.status]}</Badge>
      </div>
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`mb-3 rounded-[var(--radius-control)] px-4 py-3 text-[length:calc(16px*var(--fs))] ${msg.ok ? 'bg-success-tint text-navy-900' : 'bg-danger-tint text-danger-ink'}`}>{msg.text}</p>}
      {a.reviewNote && ['returned', 'rejected'].includes(a.status) && <p className="mb-3 rounded-[var(--radius-control)] bg-warning-tint px-4 py-3 text-[length:calc(16px*var(--fs))] text-navy-900"><span className="font-semibold">Punong Barangay's note:</span> {a.reviewNote}</p>}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          {a.revision && <p className="text-[length:calc(16px*var(--fs))] font-semibold text-navy-900">Proposed change (residents still see the current version):</p>}
          <AnnouncementView a={a.revision ? { ...a.revision, publishedAt: a.publishedAt } : a} />
          {a.status === 'scheduled' && <p className="text-[length:calc(16px*var(--fs))] text-ink-nav">Publishes {new Date(a.publishAt).toLocaleString('en-US', { timeZone: 'Asia/Manila', dateStyle: 'long', timeStyle: 'short' })}.</p>}
        </div>
        <div className="space-y-4">
          <Panel title="Actions">
            <div className="space-y-3">
              {approver && reviewable && a.createdBy !== user.id && (mode === 'revise' || mode === 'reject' ? (
                <div className="space-y-2">
                  <TextArea aria-label={mode === 'revise' ? 'What should change' : 'Reason'} placeholder={mode === 'revise' ? 'What should change' : 'Reason (the Secretary will see it)'} className="min-h-[80px]" value={note} onChange={(e) => setNote(e.target.value)} />
                  <ActionStack>
                    <Button variant={mode === 'reject' ? 'danger' : 'primary'} onClick={() => run(() => (mode === 'revise' ? requestRevision(a.id, note, user) : rejectAnnouncement(a.id, note, user)), mode === 'revise' ? 'Sent back to the Secretary.' : 'Rejected. The Secretary was told.')}>{mode === 'revise' ? 'Request revision' : 'Reject'}</Button>
                    <Button variant="ghost" onClick={() => setMode(null)}>Back</Button>
                  </ActionStack>
                </div>
              ) : (
                <ActionStack>
                  <Button onClick={() => setMode('approve')}>{a.revision ? 'Approve change' : 'Approve'}</Button>
                  <Button variant="secondary" onClick={() => setMode('revise')}>Request revision</Button>
                  {!a.revision && <Button variant="ghost" onClick={() => setMode('reject')}>Reject</Button>}
                </ActionStack>
              ))}
              {writer && ['draft', 'returned', 'rejected', 'scheduled', 'published', 'pending'].includes(a.status) && <ButtonLink variant="secondary" to={`/announcements/${a.id}/edit`}>Edit</ButtonLink>}
              {writer && ['draft', 'returned'].includes(a.status) && <Button onClick={() => run(() => submitForApproval(a.id, user), 'Sent to the Punong Barangay for approval.')}>Submit for Approval</Button>}
              {writer && a.status === 'published' && <Button variant="ghost" onClick={() => run(() => archiveAnnouncement(a.id, user), 'Archived.')}>Archive</Button>}
              {writer && ['scheduled', 'published', 'pending', 'draft', 'returned'].includes(a.status) && (mode === 'cancel' ? (
                <div className="space-y-2">
                  <TextInput aria-label="Reason" placeholder="Reason" value={note} onChange={(e) => setNote(e.target.value)} />
                  <ActionStack><Button variant="danger" onClick={() => run(() => cancelAnnouncement(a.id, note, user), 'Cancelled.')}>Cancel announcement</Button><Button variant="ghost" onClick={() => setMode(null)}>Back</Button></ActionStack>
                </div>
              ) : <Button variant="ghost" onClick={() => { setNote(''); setMode('cancel') }}>Cancel announcement</Button>)}
              {!approver && !writer && <p className="text-[length:calc(16px*var(--fs))] text-ink-nav">View only.</p>}
            </div>
          </Panel>
          <Panel title="History">
            <Timeline items={a.history.map((h) => ({ at: h.at, title: h.action, by: nameOf(h.byUserId), tone: /reject|cancel|published|approved/i.test(h.action) ? 'important' as const : undefined, details: h.note ? <p>{h.note}</p> : undefined }))} />
          </Panel>
        </div>
      </div>
      {mode === 'approve' && (
        <ConfirmDialog title={a.revision ? 'Approve this change?' : new Date(a.publishAt).getTime() <= Date.now() ? 'Approve and publish now?' : 'Approve for scheduled publishing?'} confirmLabel="Approve" onCancel={() => setMode(null)} onConfirm={() => run(() => approveAnnouncement(a.id, user), 'Approved.')}>
          {a.revision ? 'Residents will see the updated version.' : new Date(a.publishAt).getTime() <= Date.now() ? 'Residents will see it and get a notification.' : 'It will appear on the chosen date and residents will be notified then.'}
        </ConfirmDialog>
      )}
    </>
  )
}
