import { ArrowRight } from '@/icons'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { formatDateTime, greeting } from '@/lib/format'

/**
 * Dashboard greeting (Figma Resident v2 / Admin v3): eyebrow with the role and
 * the time, "Magandang …, Name", a one-line subtitle and a "View Profile" action.
 */
export function GreetingCard({ profileTo, action }: { subtitle?: string; profileTo?: string; action?: React.ReactNode }) {
  const { user } = useAuth()
  const [now] = useState(() => new Date())
  if (!user) return null
  return (
    <section className="relative mb-4 flex flex-col gap-4 overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="relative min-w-0">
        <p className="text-[length:calc(12.5px*var(--fs))] font-semibold tracking-[0.08em] text-navy-600 uppercase">
          {user.position} · As of {formatDateTime(now)}
        </p>
        <h1 className="mt-1 font-display text-[length:calc(24px*var(--fs))] leading-tight font-extrabold text-navy-900 sm:text-[length:calc(28px*var(--fs))]">
          {greeting(now)}, {user.fullName}
        </h1>
      </div>
      {action ? <div className="relative shrink-0 self-start sm:self-center">{action}</div> : profileTo && (
        <Link
          to={profileTo}
          className="bmis-press relative inline-flex h-11 shrink-0 items-center justify-center gap-2 self-start rounded-[var(--radius-control)] bg-navy-900 px-4 text-[length:calc(15px*var(--fs))] font-semibold text-white hover:bg-navy-800 sm:self-center"
        >
          View Profile <ArrowRight className="size-4" />
        </Link>
      )}
    </section>
  )
}
