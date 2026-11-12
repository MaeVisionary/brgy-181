import { Check, ChevronRight, LifeBuoy } from '@/icons'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BackLink as SmartBack } from '@/components/ui/BackLink'
import { Card } from '@/components/ui/Panel'
import { BARANGAY_CONTACT } from '@/config/barangay'
import { StatusLabel } from '@/components/ui/StatusLabel'
import { cn } from '@/lib/cn'
import { formatDate, formatDateTime } from '@/lib/format'
import type { ResidentStatus } from '@/lib/residentStatus'
import type { Transaction } from '@/services/transactionService'

/**
 * Building blocks of the Resident Portal (Figma Revision v2), shared by Home,
 * My Transactions and every transaction details page.
 */

/** Back to the page the resident came from; falls back to `to`. */
export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return <SmartBack fallbackTo={to} fallbackLabel={String(children).replace(/^Back to /, '')} />
}

/** Title block of a details page: kind label, title, then reference / status / date strip. */
export function DetailHeader({ kind, title, referenceNo, status, statusTone, date, dateLabel = 'Date submitted' }: { kind: string; title: string; referenceNo: string; status: ResidentStatus | string; statusTone?: Parameters<typeof StatusLabel>[0]['tone']; date: string; dateLabel?: string }) {
  return (
    <>
      <p className="text-[12.5px] font-semibold tracking-[0.08em] text-ink-muted uppercase">{kind}</p>
      <h1 className="mt-1 font-display text-[24px] leading-tight font-extrabold text-navy-900 sm:text-[28px]">{title}</h1>
      <Card className="mt-4 grid gap-4 px-5 py-4 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-line-soft">
        <div className="sm:pr-5">
          <p className="text-[13.5px] text-ink-muted">Reference number</p>
          <p className="mt-1 text-[17px] font-bold text-navy-900">{referenceNo}</p>
        </div>
        <div className="sm:px-5">
          <p className="text-[13.5px] text-ink-muted">Current status</p>
          <p className="mt-1"><StatusLabel status={status} tone={statusTone} /></p>
        </div>
        <div className="sm:pl-5">
          <p className="text-[13.5px] text-ink-muted">{dateLabel}</p>
          <p className="mt-1 text-[16px] font-semibold text-navy-900">{formatDateTime(date)}</p>
        </div>
      </Card>
    </>
  )
}

/** Two-column body: main content and a narrow side column (progress, help). */
export function DetailBody({ main, side }: { main: ReactNode; side: ReactNode }) {
  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-4">{main}</div>
      <div className="space-y-4">{side}</div>
    </div>
  )
}

const BANNER = {
  success: 'border-l-success bg-success-tint',
  warning: 'border-l-warning bg-warning-tint',
  info: 'border-l-info bg-info-tint',
  danger: 'border-l-danger bg-danger-tint',
}

/** Coloured message at the top of a details page ("Your document is ready for pickup"). */
export function Banner({ tone, icon, title, children }: { tone: keyof typeof BANNER; icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className={cn('flex gap-3 rounded-[var(--radius-card)] border border-l-4 border-line px-5 py-4', BANNER[tone])}>
      <span className="mt-0.5 shrink-0 text-navy-900 [&>svg]:size-[18px]">{icon}</span>
      <div className="min-w-0">
        <p className="text-[16px] font-semibold text-navy-900">{title}</p>
        {children && <div className="mt-0.5 text-[15px] text-navy-900">{children}</div>}
      </div>
    </div>
  )
}

/** White card with a bold title. */
export function Section({ title, subtitle, children, className }: { title: string; subtitle?: string; children: ReactNode; className?: string }) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <div className="bg-bar border-b border-sky-300 text-navy-900 px-5 py-3.5">
        <h2 className="font-display text-[17.5px] font-bold text-navy-900">{title}</h2>
        {subtitle && <p className="text-[14px] text-ink-nav">{subtitle}</p>}
      </div>
      <div className="px-5 py-4">{children}</div>
    </Card>
  )
}

/** Navy title bar used by side cards (Progress, Need help, What these words mean). */
export function TitleBar({ children }: { children: ReactNode }) {
  return <h2 className="-mx-5 -mt-4 mb-3 flex items-center gap-2 bg-bar border-b border-sky-300 text-navy-900 px-5 py-3.5 font-display text-[17.5px] font-bold">{children}</h2>
}

/** Label / value rows separated by lines. */
export function InfoRows({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="divide-y divide-line-soft">
      {rows.map(([k, v]) => (
        <div key={k} className="grid gap-1 py-2.5 text-[15px] sm:grid-cols-[170px_minmax(0,1fr)] sm:gap-4">
          <dt className="text-ink-muted">{k}</dt>
          <dd className="font-semibold break-words whitespace-pre-wrap text-navy-900">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Numbered steps ("How to claim your document"). */
export function NumberedSteps({ steps }: { steps: ReactNode[] }) {
  return (
    <ol className="space-y-2.5">
      {steps.map((s, i) => (
        <li key={i} className="flex items-start gap-3 text-[15.5px] text-navy-900">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-navy-900 text-[13.5px] font-semibold text-white">{i + 1}</span>
          <span className="pt-0.5">{s}</span>
        </li>
      ))}
    </ol>
  )
}

export interface ProgressStep {
  label: string
  /** Shown under the label: a date, or what happens next. */
  note?: string
  state: 'done' | 'current' | 'todo'
}

/** Vertical progress list in the side column. */
export function Progress({ steps, ended }: { steps: ProgressStep[]; ended?: string }) {
  return (
    <Card className="overflow-hidden px-5 py-4">
      <TitleBar>Progress</TitleBar>
      <ol>
        {steps.map((s, i) => (
          <li key={s.label} className="relative flex gap-3 pb-4 last:pb-0">
            {i < steps.length - 1 && <span aria-hidden className={cn('absolute top-6 bottom-0 left-[11px] w-0.5', s.state === 'done' ? 'bg-success' : 'bg-line')} />}
            <span
              className={cn(
                'relative z-10 grid size-6 shrink-0 place-items-center rounded-full border-2',
                s.state === 'done' && 'border-success bg-success text-white',
                s.state === 'current' && 'border-navy-900 bg-surface',
                s.state === 'todo' && 'border-line bg-surface',
              )}
            >
              {s.state === 'done' && <Check className="size-3.5" strokeWidth={3} />}
              {s.state === 'current' && <span className="size-2.5 rounded-full bg-navy-900" />}
            </span>
            <span className="min-w-0 pt-0.5">
              <span className={cn('block text-[15px] font-semibold', s.state === 'todo' ? 'text-ink-muted' : 'text-navy-900')}>{s.label}</span>
              {s.note && <span className="block text-[14px] text-ink-muted">{s.note}</span>}
            </span>
          </li>
        ))}
      </ol>
      {ended && <p className="mt-3 rounded-md bg-danger-tint px-3 py-2 text-[14.5px] font-semibold text-danger-ink">{ended}</p>}
    </Card>
  )
}

/** Turns an ordered path + current index into progress steps. */
export function stepsFrom(labels: string[], currentIndex: number, notes: Record<number, string | undefined> = {}, finished = false): ProgressStep[] {
  return labels.map((label, i) => ({
    label,
    note: notes[i],
    state: finished || i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'todo',
  }))
}

/** "Need help?" card. Contact details stay placeholders until the barangay provides them. */
export function NeedHelp() {
  return (
    <Card className="overflow-hidden px-5 py-4">
      <TitleBar><LifeBuoy className="size-4" /> Need help?</TitleBar>
      <p className="text-[15px] text-navy-900">Visit the Barangay 181 Hall, Gagalangin, Tondo, Manila. Personnel can help you with your request.</p>
      <p className="mt-2 text-[14.5px] text-navy-900">{BARANGAY_CONTACT.phone} · {BARANGAY_CONTACT.officeHours}</p>
      <Link to="/my/contact" className="mt-2 inline-flex min-h-9 items-center gap-1 text-[15px] font-semibold text-info hover:underline">
        View contact information <ChevronRight className="size-4" />
      </Link>
    </Card>
  )
}

/** Updates list, newest first. */
export function Updates({ items }: { items: { title: string; at: string; by?: string; note?: string }[] }) {
  return (
    <Section title="Updates">
      <ul className="divide-y divide-line-soft">
        {items.map((u, i) => (
          <li key={i} className="py-2.5">
            <p className="text-[15px] font-semibold text-navy-900">{u.title}</p>
            <p className="text-[14px] text-ink-muted">
              {formatDateTime(u.at)}
              {u.by && ` · ${u.by}`}
            </p>
            {u.note && <p className="mt-1 text-[14.5px] text-navy-900">{u.note}</p>}
          </li>
        ))}
      </ul>
    </Section>
  )
}

/**
 * Transactions as a table on wide screens and as cards on phones
 * (Figma "My Transactions" desktop / mobile).
 */
export function TransactionList({ items, showType = true }: { items: Transaction[]; showType?: boolean }) {
  const navigate = useNavigate()
  return (
    <>
      <table className="hidden w-full text-[15px] xl:table">
        <thead>
          <tr className="border-b border-line-soft text-left">
            {['Transaction', 'Reference no.', ...(showType ? ['Type'] : []), 'Date submitted', 'Status', ''].map((h, i) => (
              <th key={i} className="label-caps px-4 py-3">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <tr key={`${t.kind}-${t.id}`} onClick={() => navigate(t.to)} className={cn('cursor-pointer border-b border-line-soft last:border-0', needsYou(t) ? 'bg-warning-tint/60 hover:bg-warning-tint' : 'hover:bg-sky-50')}>
              <td className={cn('px-4 py-3.5', needsYou(t) && 'border-l-4 border-l-warning')}>
                <Link to={t.to} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-2 font-semibold text-navy-900 hover:underline">
                  {needsYou(t) && <Pulse />}
                  {t.title}
                </Link>
                {needsYou(t) && <span className="block text-[14px] font-semibold text-warning">Action needed: reply to the barangay</span>}
              </td>
              <td className="px-4 py-3.5 whitespace-nowrap text-ink-nav">{t.referenceNo}</td>
              {showType && <td className="px-4 py-3.5 text-ink-nav">{t.kind === 'document' ? 'Document Request' : t.kind === 'borrowing' ? 'Equipment Borrowing' : 'Complaint or Report'}</td>}
              <td className="px-4 py-3.5 whitespace-nowrap text-ink-nav">{formatDate(t.submittedAt)}</td>
              <td className="px-4 py-3.5"><StatusLabel status={t.status} /></td>
              <td className="px-3 py-3.5 text-ink-subtle"><ChevronRight className="size-4" /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="divide-y divide-line-soft xl:hidden">
        {items.map((t) => (
          <li key={`${t.kind}-${t.id}`}>
            <Link to={t.to} className={cn('flex items-center gap-3 px-4 py-3.5 active:bg-sky-50', needsYou(t) && 'border-l-4 border-l-warning bg-warning-tint/60')}>
              <span className="min-w-0 flex-1">
                {needsYou(t) && <span className="mb-1 flex items-center gap-2 text-[14px] font-semibold text-warning"><Pulse /> Action needed: reply to the barangay</span>}
                <span className="block text-[12.5px] font-semibold tracking-[0.06em] text-ink-muted uppercase">{t.kindLabel}</span>
                <span className="block text-[16px] font-semibold text-navy-900">{t.title}</span>
                <span className="block text-[14px] text-ink-muted">Ref. no. {t.referenceNo} · Submitted {formatDate(t.submittedAt)}</span>
                <span className="mt-1.5 block"><StatusLabel status={t.status} /></span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-ink-subtle" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}

/** The barangay is waiting for the resident (Needs Additional Information). */
export const needsYou = (t: Transaction) => t.status === 'Action Needed'

/** Pulsing dot: stops once the resident replies (the status changes). */
export function Pulse() {
  return null
}
