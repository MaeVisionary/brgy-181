import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { formatDateTime, greeting } from '@/lib/format'

/**
 * Dashboard greeting (Figma Resident v2 / Admin v3): eyebrow with the role and
 * the time, "Magandang …, Name", a one-line subtitle and a "View Profile" action.
 */
export function GreetingCard({ subtitle, profileTo, action }: { subtitle: string; profileTo?: string; action?: React.ReactNode }) {
  const { user } = useAuth()
  const [now] = useState(() => new Date())
  if (!user) return null
  return (
    <section className="mb-5 flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-gradient-to-r from-surface via-surface to-surface-muted px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="min-w-0">
        <p className="text-[10.5px] font-semibold tracking-[0.08em] text-navy-600 uppercase">
          {user.position} · As of {formatDateTime(now)}
        </p>
        <h1 className="mt-1 font-display text-[22px] leading-tight font-extrabold text-navy-900 sm:text-[26px]">
          {greeting(now)}, {user.fullName}
        </h1>
        <p className="mt-1 text-[13px] text-ink-muted">{subtitle}</p>
      </div>
      {action ? <div className="shrink-0 self-start sm:self-center">{action}</div> : profileTo && (
        <Link
          to={profileTo}
          className="bmis-press inline-flex h-11 shrink-0 items-center justify-center gap-2 self-start rounded-[var(--radius-control)] bg-navy-900 px-4 text-[13px] font-semibold text-white hover:bg-navy-800 sm:self-center"
        >
          View Profile <ArrowRight className="size-4" />
        </Link>
      )}
    </section>
  )
}
