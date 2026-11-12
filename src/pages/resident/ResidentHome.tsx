import { CalendarClock, ChevronRight, FileText, MessageSquareWarning, Package } from '@/icons'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { Badge as SmallBadge, type BadgeTone } from '@/components/ui/Badge'
import { buttonClass } from '@/components/ui/Button'
import { ROLES } from '@/config/permissions'
import { mockUsers } from '@/mocks/users'
import { BARANGAY_CONTACT } from '@/config/barangay'
import { cn } from '@/lib/cn'
import { greeting } from '@/lib/format'
import { APPOINTMENT_STATUS_LABEL, APPOINTMENT_TYPES, hearingsFor, isOpen, listMyAppointments, runAppointmentJobs, type Appointment } from '@/services/appointmentService'
import { listPublished, type Announcement } from '@/services/announcementService'
import { claimFor } from '@/services/appointmentService'
import { listRequests } from '@/services/documentService'
import { readyEstimate, readyText } from '@/services/processingService'
import { runPickupChecks } from '@/services/pickupService'
import { getDocumentType } from '@/documents/catalog'
import { useDocActor } from '@/hooks/useDocActor'
import { documentStatusForResident } from '@/lib/residentStatus'
import type { DocumentRequest, DocumentStatus } from '@/types/document'
import { calendarEntries, type CalendarEntry } from '@/services/calendarService'
import { formatTime, manilaToday, nextDate } from '@/services/schedulingService'

/**
 * Resident home. One reading order for every screen size:
 *   greeting → three services → my next appointment → barangay calendar → announcements.
 * Phones get full-width rows (icon, label, arrow); tablets and desktops get tiles
 * and, from 1280px, the calendar as the wide main column with the appointment
 * and a compact announcement list beside it. Personal appointments and the
 * public calendar are never mixed.
 */

const ACTIONS = [
  { to: '/my/documents/new', icon: FileText, title: 'Request a Document' },
  { to: '/my/complaints/new', icon: MessageSquareWarning, title: 'Report or Complain' },
  { to: '/my/borrowing/new', icon: Package, title: 'Borrow Equipment' },
] as const

const CAL_DAYS = 60
const CAL_SHOWN = 4
const ANN_SHOWN = 3

/** Status labels at a readable size on the home page. */
function Badge({ tone, children }: { tone?: BadgeTone; children: React.ReactNode }) {
  return <SmallBadge tone={tone} className="h-7 px-2 text-[length:calc(14.5px*var(--fs))]">{children}</SmallBadge>
}

const addDays = (d: string, n: number) => { let x = d; for (let i = 0; i < n; i++) x = nextDate(x); return x }
const at = (d: string) => new Date(`${d}T12:00:00+08:00`)
const fmt = (d: string, o: Intl.DateTimeFormatOptions) => at(d).toLocaleDateString('en-US', { ...o, timeZone: 'Asia/Manila' })
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' })

const heading = 'font-display text-[length:calc(20px*var(--fs))] sm:text-[length:calc(22px*var(--fs))] xl:text-[length:calc(21px*var(--fs))] font-bold leading-tight text-navy-900'
const seeAll = 'bmis-press inline-flex min-h-12 shrink-0 items-center gap-1 rounded-[var(--radius-control)] px-2 -mr-2 text-[length:calc(16px*var(--fs))] font-semibold text-info hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-600'
const rowLink = 'bmis-press flex w-full items-center gap-3 text-left transition-colors hover:bg-sky-50 active:bg-sky-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-navy-600'

export function ResidentHome() {
  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-6 sm:space-y-8">
      <Welcome />
      <QuickActions />
      <UpcomingAppointment />
      <MyDocumentRequests />
      <div className="grid grid-cols-1 gap-6 sm:gap-8 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] xl:items-start xl:gap-6">
        <BarangayCalendar />
        <Announcements />
      </div>
    </div>
  )
}

// ── A. Welcome ──────────────────────────────────────────────────────

function Welcome() {
  const { user } = useAuth()
  const [now] = useState(() => new Date())
  if (!user) return null
  return (
    <header>
      <p className="text-[length:calc(17px*var(--fs))] font-semibold text-ink-nav">{greeting(now)},</p>
      <h1 className="font-display text-[length:calc(25px*var(--fs))] leading-tight font-extrabold break-words text-navy-900 sm:text-[length:calc(30px*var(--fs))]">{user.fullName}</h1>
    </header>
  )
}

// ── B. Quick actions ────────────────────────────────────────────────

function QuickActions() {
  return (
    <section aria-labelledby="qa-h">
      <h2 id="qa-h" className="sr-only">What would you like to do?</h2>
      {/* Phones: full-width rows. Tablet and up: three equal tiles. */}
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        {ACTIONS.map(({ to, icon: Icon, title }) => (
          <li key={to} className="flex">
            <Link
              to={to}
              className="bmis-press group flex min-h-[76px] w-full items-center gap-4 rounded-[var(--radius-card)] border-2 border-line bg-surface px-4 py-3 shadow-sm transition-colors hover:border-navy-600 hover:bg-sky-50 active:bg-sky-100 focus-visible:border-navy-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-600 sm:min-h-[148px] sm:flex-col sm:items-start sm:justify-between sm:gap-3 sm:p-5"
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-[12px] border border-navy-900/10 bg-sky-50 text-navy-900 sm:size-14"><Icon className="size-6 sm:size-7" /></span>
              <span className="flex min-w-0 flex-1 items-center gap-2 sm:w-full sm:flex-none">
                <span className="min-w-0 flex-1 text-[length:calc(18px*var(--fs))] leading-snug font-bold text-navy-900 sm:text-[length:calc(19px*var(--fs))]">{title}</span>
                <ChevronRight className="size-6 shrink-0 text-navy-600 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ── C. Upcoming appointment (mine only) ─────────────────────────────

interface Next {
  key: string; date: string; time: string; type: string; purpose?: string; location: string; status?: string; tone?: 'success' | 'warning' | 'info'; to: string
  /** Who set it up, when it was not the resident (e.g. "Barangay Secretary"). */
  setBy?: string
  /** The resident still has to do something (confirm a time the Barangay set). */
  waiting?: boolean
}

/** Statuses where the next step is the resident's. */
const RESIDENT_TURN = new Set(['pending_confirmation', 'rescheduled'])

function UpcomingAppointment() {
  const { user } = useAuth()
  const [apps, setApps] = useState<Appointment[] | null>(null)
  useEffect(() => {
    if (!user) return
    runAppointmentJobs()
    listMyAppointments(user).then(setApps).catch(() => setApps([]))
  }, [user])
  if (!user) return null
  const today = manilaToday()
  const list = apps ?? []
  const setByOf = (a: Appointment) => {
    const by = mockUsers.find((u) => u.id === a.history[0]?.byUserId)
    return by && by.id !== user.id && by.roleId !== 'resident' ? ROLES[by.roleId]?.name ?? by.position : undefined
  }
  const own: Next[] = ([
    // Document pickups are shown with their request (Document Requests), not here.
    ...list.filter((a) => a.kind !== 'document_claim' && a.date && isOpen(a) && a.date >= today).map((a) => ({
      key: a.id, date: a.date, time: a.time, type: APPOINTMENT_TYPES[a.kind].label, purpose: a.title !== APPOINTMENT_TYPES[a.kind].label ? a.title : undefined, location: BARANGAY_CONTACT.hall,
      status: APPOINTMENT_STATUS_LABEL[a.status], tone: (a.status === 'confirmed' ? 'success' : 'warning') as Next['tone'], to: `/my/appointments/${a.id}`,
      setBy: setByOf(a), waiting: RESIDENT_TURN.has(a.status),
    })),
    // Hearings in the resident's own case are personal appointments too (never other people's cases).
    ...hearingsFor(user).filter((h) => h.date >= today).map((h) => ({ key: h.id, date: h.date, time: h.time, type: h.label, location: h.place, status: 'Scheduled', tone: 'info' as const, to: `/my/complaints/${h.caseId}` })),
  ] as Next[]).sort((a, b) => Number(!!b.waiting) - Number(!!a.waiting) || (a.date + a.time).localeCompare(b.date + b.time))
  const next = own[0]
  const more = own.length - 1
  const needs = list.find((a) => a.status === 'awaiting_schedule' && a.kind !== 'document_claim')

  return (
    <section aria-labelledby="appt-h">
      <div className="mb-3 flex min-h-12 flex-wrap items-center justify-between gap-x-3">
        <h2 id="appt-h" className={heading}>Upcoming Appointment</h2>
        {more > 0 && <Link to="/my/appointments" className={seeAll}>{more} more <ChevronRight className="size-5" /></Link>}
      </div>
      {apps === null ? (
        <div className="h-28 animate-pulse rounded-[var(--radius-card)] bg-surface" />
      ) : next ? (
        <div className={cn('relative overflow-hidden rounded-[var(--radius-card)] border-2 bg-surface p-4 sm:p-5', next.waiting ? 'border-navy-600' : 'border-navy-900/15')}>
          {/* Quiet cue that this one is waiting for the resident: an accent bar and a soft pulse, no extra wording. */}
          {next.waiting && <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-navy-600" />}
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="flex min-w-0 flex-1 items-start gap-4">
              <DateBadge date={next.date} strong />
              <div className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  {next.status && <Badge tone={next.tone}>{next.status}</Badge>}
                  {next.waiting && (
                    <span aria-hidden className="relative flex size-3">
                      <span className="absolute inline-flex size-full rounded-full bg-navy-600 opacity-60 motion-safe:animate-ping" />
                      <span className="relative inline-flex size-3 rounded-full bg-navy-600" />
                    </span>
                  )}
                </span>
                <p className="mt-1.5 text-[length:calc(19px*var(--fs))] leading-snug font-bold break-words text-navy-900">{next.type}</p>
                {next.purpose && <p className="text-[length:calc(16.5px*var(--fs))] break-words text-navy-900">{next.purpose}</p>}
                <p className="mt-1 text-[length:calc(17px*var(--fs))] font-semibold text-navy-900">{fmt(next.date, { weekday: 'long' })}, {formatTime(next.time)}</p>
                <p className="text-[length:calc(16.5px*var(--fs))] break-words text-ink-nav">{next.location}{next.setBy ? ` · Set by the ${next.setBy}` : ''}</p>
              </div>
            </div>
            <Link to={next.to} className={buttonClass(next.waiting ? 'primary' : 'secondary', 'lg', 'w-full md:w-auto md:min-w-[220px]')}>
              {next.waiting ? 'Review and confirm' : 'View appointment'} <ChevronRight />
            </Link>
          </div>
        </div>
      ) : needs ? (
        <Link to={`/my/appointments/${needs.id}`} className={cn(rowLink, 'min-h-16 rounded-[var(--radius-card)] border-2 border-warning/50 bg-warning-tint px-4 py-3')}>
          <CalendarClock className="size-6 shrink-0 text-navy-900" />
          <span className="min-w-0 flex-1 text-[length:calc(17px*var(--fs))] font-semibold text-navy-900">Choose a time for your {APPOINTMENT_TYPES[needs.kind].label.toLowerCase()}</span>
          <ChevronRight className="size-6 shrink-0 text-navy-600" />
        </Link>
      ) : (
        <p className="flex min-h-14 items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3 text-[length:calc(17px*var(--fs))] text-navy-900">
          <CalendarClock className="size-6 shrink-0 text-ink-nav" /> No upcoming appointments.
        </p>
      )}
    </section>
  )
}

// ── D. Barangay calendar (public items only) ────────────────────────

const KIND: Record<CalendarEntry['kind'], { label: string; tone: 'neutral' | 'warning' | 'success' }> = {
  holiday: { label: 'Holiday', tone: 'neutral' },
  closure: { label: 'Hall closure', tone: 'warning' },
  event: { label: 'Barangay event', tone: 'success' },
}

function BarangayCalendar() {
  const items = upcomingCalendar()
  return (
    <section aria-labelledby="cal-h">
      <div className="mb-3 flex min-h-12 flex-wrap items-center justify-between gap-x-3">
        <h2 id="cal-h" className={heading}>Barangay Calendar</h2>
        <Link to="/my/calendar" className={seeAll}>See all <ChevronRight className="size-5" /></Link>
      </div>
      {items.length === 0 ? (
        <p className="flex min-h-14 items-center rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3 text-[length:calc(17px*var(--fs))] text-navy-900">No barangay events in the next two months.</p>
      ) : (
        <ul className="divide-y divide-line-soft overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
          {items.map((e) => {
            const where = e.kind === 'event' ? e.detail.split(' · ').slice(1).join(' · ') : e.kind === 'closure' ? e.detail : ''
            const when = [e.time ? (e.kind === 'event' ? formatTime(e.time) : e.time) : '', e.endDate ? `until ${fmt(e.endDate, { month: 'short', day: 'numeric' })}` : ''].filter(Boolean).join(' · ')
            return (
              <li key={e.id}>
                <Link to={e.link ?? `/my/calendar?item=${encodeURIComponent(e.id)}`} className={cn(rowLink, 'min-h-[84px] px-4 py-3.5 sm:px-5 sm:py-4')}>
                  <DateBadge date={e.date} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[length:calc(18px*var(--fs))] leading-snug font-bold break-words text-navy-900 sm:text-[length:calc(19px*var(--fs))]">{e.title}</span>
                    {when && <span className="mt-0.5 block text-[length:calc(16.5px*var(--fs))] text-navy-900">{when}</span>}
                    {where && <span className="block text-[length:calc(16px*var(--fs))] break-words text-ink-nav">{where}</span>}
                    {e.kind !== 'event' && <span className="mt-1.5 inline-flex"><Badge tone={KIND[e.kind].tone}>{e.hallClosed ? 'Barangay Hall closed' : KIND[e.kind].label}</Badge></span>}
                  </span>
                  <ChevronRight className="size-6 shrink-0 text-ink-subtle" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function upcomingCalendar() {
  const today = manilaToday()
  return calendarEntries(today, addDays(today, CAL_DAYS)).slice(0, CAL_SHOWN)
}

function DateBadge({ date, strong }: { date: string; strong?: boolean }) {
  return (
    <span
      aria-label={fmt(date, { weekday: 'long', month: 'long', day: 'numeric' })}
      className={cn(
        'grid w-[60px] shrink-0 place-items-center rounded-[var(--radius-control)] py-1.5 text-center leading-none sm:w-16',
        strong ? 'bg-navy-900 text-white' : 'border border-navy-900/15 bg-sky-50 text-navy-900',
      )}
    >
      <span aria-hidden className="text-[length:calc(15px*var(--fs))] font-bold tracking-wide uppercase">{fmt(date, { month: 'short' })}</span>
      <span aria-hidden className="mt-1 font-display text-[length:calc(26px*var(--fs))] font-extrabold">{Number(date.slice(8))}</span>
      <span aria-hidden className={cn('mt-1 text-[length:calc(14.5px*var(--fs))] font-semibold', strong ? 'text-white/85' : 'text-ink-nav')}>{fmt(date, { weekday: 'short' })}</span>
    </span>
  )
}

// ── E. Announcements (approved and published only) ─────────────────

function Announcements() {
  const { user } = useAuth()
  const [items, setItems] = useState<Announcement[] | null>(null)
  useEffect(() => { if (user) listPublished(user).then(setItems).catch(() => setItems([])) }, [user])
  // An announcement that is also a calendar event shows only its title and "On the calendar"; details are not repeated.
  const onCalendar = useMemo(() => new Set(upcomingCalendar().filter((e) => e.kind === 'event').map((e) => e.id)), [])
  const shown = (items ?? []).slice(0, ANN_SHOWN)
  return (
    <section aria-labelledby="ann-h">
      <div className="mb-3 flex min-h-12 flex-wrap items-center justify-between gap-x-3">
        <h2 id="ann-h" className={heading}>Barangay Announcements</h2>
        <Link to="/my/announcements" className={seeAll}>View all <ChevronRight className="size-5" /></Link>
      </div>
      {items === null ? (
        <div className="h-24 animate-pulse rounded-[var(--radius-card)] bg-surface" />
      ) : shown.length === 0 ? (
        <p className="flex min-h-14 items-center rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3 text-[length:calc(17px*var(--fs))] text-navy-900">No announcements right now.</p>
      ) : (
        <ul className="divide-y divide-line-soft overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
          {shown.map((a) => (
            <li key={a.id}>
              <Link to={`/my/announcements/${a.id}`} className={cn(rowLink, 'min-h-16 px-4 py-3 sm:px-5')}>
                <span className="min-w-0 flex-1">
                  <span className="block text-[length:calc(17px*var(--fs))] leading-snug font-semibold break-words text-navy-900">{a.title}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[length:calc(15.5px*var(--fs))] text-ink-nav">
                    {onCalendar.has(a.id) && a.event?.date ? `On the calendar · ${fmt(a.event.date, { month: 'short', day: 'numeric' })}` : `Posted ${shortDate(a.publishedAt ?? a.publishAt)}`}
                    {a.urgent && <Badge tone="danger">Important</Badge>}
                  </span>
                </span>
                <ChevronRight className="size-6 shrink-0 text-ink-subtle" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// ── Document requests (active ones, with ready time and pickup) ─────

const ACTIVE_DOC: DocumentStatus[] = ['submitted', 'under_review', 'needs_info', 'for_assessment', 'processing', 'pending_approval', 'approved', 'for_signature', 'ready_for_pickup']

function MyDocumentRequests() {
  const actor = useDocActor()
  const [reqs, setReqs] = useState<DocumentRequest[] | null>(null)
  useEffect(() => { if (actor) { runPickupChecks(); listRequests(actor).then(setReqs).catch(() => setReqs([])) } }, [actor])
  const active = (reqs ?? []).filter((r) => ACTIVE_DOC.includes(r.status) && getDocumentType(r.typeId).category !== 'case')
  const shown = active.slice(0, 3)
  const whenText = (d: Date) => d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' })
  return (
    <section aria-labelledby="docs-h">
      <div className="mb-3 flex min-h-12 flex-wrap items-center justify-between gap-x-3">
        <h2 id="docs-h" className={heading}>Document Requests</h2>
        <Link to="/my/documents" className={seeAll}>{active.length > shown.length ? `All ${active.length}` : 'View all'} <ChevronRight className="size-5" /></Link>
      </div>
      {reqs === null ? <div className="h-20 animate-pulse rounded-[var(--radius-card)] bg-surface" /> : shown.length === 0 ? (
        <p className="flex min-h-14 items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3 text-[length:calc(17px*var(--fs))] text-navy-900">
          <FileText className="size-6 shrink-0 text-ink-nav" /> No active document requests.
        </p>
      ) : (
        <ul className="divide-y divide-line-soft overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
          {shown.map((r) => {
            const st = documentStatusForResident(r.status)
            const e = readyEstimate(r)
            const claim = claimFor(r.id)
            const line = readyText(e, whenText)
            return (
              <li key={r.id}>
                <Link to={`/my/documents/${r.id}`} className={cn(rowLink, 'min-h-[76px] px-4 py-3.5 sm:px-5')}>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[length:calc(18px*var(--fs))] leading-snug font-bold break-words text-navy-900">{getDocumentType(r.typeId).name}</span>
                      <Badge tone={st === 'Ready' ? 'success' : st === 'Action Needed' ? 'warning' : 'info'}>{st}</Badge>
                    </span>
                    {line && <span className={cn('mt-0.5 block text-[length:calc(16px*var(--fs))]', e?.state === 'delayed' ? 'text-warning' : 'text-navy-900')}>{line}</span>}
                    <span className="block text-[length:calc(16px*var(--fs))] text-ink-nav">
                      {claim?.date ? `Pickup: ${fmt(claim.date, { weekday: 'short', month: 'short', day: 'numeric' })}, ${formatTime(claim.time)}` : st === 'Action Needed' ? 'Please open it to see what is needed' : 'Pickup: choose a time'}
                    </span>
                  </span>
                  <ChevronRight className="size-6 shrink-0 text-ink-subtle" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
