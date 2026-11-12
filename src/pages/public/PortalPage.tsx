import { SealWatermark } from '@/components/layout/SealWatermark'
import { EXPIRED_KEY } from '@/auth/AuthContext'
import { APP_CONFIG } from '@/config/app'
import { ArrowLeft, ChevronRight } from '@/icons'
import { useState } from 'react'
import { BarangaySeal } from '@/components/layout/BarangaySeal'
import { ACCOUNT_TYPES } from '@/config/accountTypes'
import { cn } from '@/lib/cn'
import { prefersReducedMotion, useSmoothNavigate } from '@/lib/transition'
import { PublicLayout } from './PublicLayout'

/** Step 2: choose the account type before signing in. */
export function PortalPage() {
  const go = useSmoothNavigate()
  const [picked, setPicked] = useState<string | null>(null)
  // Shown once after an automatic sign-out for inactivity.
  const [expired] = useState(() => {
    try {
      const v = sessionStorage.getItem(EXPIRED_KEY) === '1'
      sessionStorage.removeItem(EXPIRED_KEY)
      return v
    } catch {
      return false
    }
  })

  const choose = (slug: string) => {
    if (picked) return
    setPicked(slug)
    // Let the card's selected state register before the screen changes.
    window.setTimeout(() => go(`/login/${slug}`, 'forward'), prefersReducedMotion() ? 0 : 200)
  }

  return (
    <PublicLayout minimal>
      <div className="mx-auto max-w-[1040px] px-4 py-8 sm:px-6 sm:py-12">
        <button type="button" onClick={() => go('/', 'back')} className="bmis-press mb-5 inline-flex min-h-9 items-center gap-1.5 rounded-full px-1 text-[length:calc(15px*var(--fs))] font-semibold text-ink-muted hover:text-navy-900">
          <ArrowLeft className="size-4" /> Back to home
        </button>
        {expired && <p role="status" className="mb-4 rounded-[var(--radius-control)] bg-sky-100 px-4 py-3 text-[length:calc(16px*var(--fs))] text-navy-900">You were signed out after {APP_CONFIG.sessionMinutes} minutes without activity. Please sign in again.</p>}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] md:items-stretch">
          <aside className="bmis-rise relative flex flex-col items-center justify-center overflow-hidden rounded-lg bg-gradient-to-b from-navy-900 to-navy-800 px-6 py-10 text-center text-white md:py-14">
            <SealWatermark onDark size={340} />
            <BarangaySeal onDark className="relative size-16" />
            <h1 className="relative mt-4 font-display text-[length:calc(28px*var(--fs))] leading-tight font-extrabold tracking-tight sm:text-[length:calc(30px*var(--fs))]">Welcome to Barangay 181</h1>
            <p className="relative mt-2 text-[length:calc(16.5px*var(--fs))] text-white/85">How would you like to access the portal?</p>
            <p className="relative text-[length:calc(15px*var(--fs))] text-white/65">Select your account type to continue.</p>
          </aside>

          <ul className="bmis-rise bmis-rise-2 flex flex-col gap-2.5" role="list" aria-label="Account types">
            {ACCOUNT_TYPES.map((a) => {
              const Icon = a.icon
              const isPicked = picked === a.slug
              return (
                <li key={a.slug} className="flex-1">
                  <button
                    type="button"
                    onClick={() => choose(a.slug)}
                    aria-pressed={isPicked}
                    className={cn(
                      'bmis-press group flex h-full min-h-[64px] w-full items-center gap-3.5 rounded-lg border bg-surface px-4 py-3 text-left',
                      'hover:border-navy-600/40 hover:bg-sky-50',
                      isPicked ? 'border-navy-900 shadow-[0_0_0_3px_rgba(0,33,50,0.12)]' : 'border-line',
                      picked && !isPicked && 'opacity-60',
                    )}
                  >
                    <span className={cn('grid size-10 shrink-0 place-items-center rounded-lg transition-colors', isPicked ? 'bg-navy-900 text-white' : 'bg-sky-100 text-navy-900 group-hover:bg-navy-900 group-hover:text-white')}>
                      <Icon className="size-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-[length:calc(17px*var(--fs))] font-extrabold text-navy-900">{a.title}</span>
                      <span className="block text-[length:calc(14.5px*var(--fs))] leading-snug text-ink-muted">{a.description}</span>
                    </span>
                    <ChevronRight className={cn('size-4 shrink-0 text-ink-subtle transition-transform', isPicked ? 'translate-x-0.5 text-navy-900' : 'group-hover:translate-x-0.5')} />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </PublicLayout>
  )
}
