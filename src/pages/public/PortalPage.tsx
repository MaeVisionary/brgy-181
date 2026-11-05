import { ArrowLeft, ChevronRight } from 'lucide-react'
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

  const choose = (slug: string) => {
    if (picked) return
    setPicked(slug)
    // Let the card's selected state register before the screen changes.
    window.setTimeout(() => go(`/login/${slug}`, 'forward'), prefersReducedMotion() ? 0 : 200)
  }

  return (
    <PublicLayout minimal>
      <div className="mx-auto max-w-[980px] px-4 py-10 sm:px-6 sm:py-14">
        <button type="button" onClick={() => go('/', 'back')} className="bmis-press mb-6 inline-flex items-center gap-1.5 rounded-full px-1 text-[13px] font-semibold text-ink-muted hover:text-navy-900">
          <ArrowLeft className="size-4" /> Back to home
        </button>
        <div className="bmis-rise flex flex-col items-center text-center">
          <BarangaySeal className="size-16" />
          <h1 className="mt-4 font-display text-[28px] font-extrabold tracking-tight text-navy-900 sm:text-[32px]">Welcome to Barangay 181</h1>
          <p className="mt-2 text-[15px] text-ink-nav">How would you like to access the portal?</p>
          <p className="text-[13.5px] text-ink-muted">Select your account type to continue.</p>
        </div>

        <ul className="bmis-rise bmis-rise-2 mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="list">
          {ACCOUNT_TYPES.map((a) => {
            const Icon = a.icon
            const isPicked = picked === a.slug
            return (
              <li key={a.slug}>
                <button
                  type="button"
                  onClick={() => choose(a.slug)}
                  aria-pressed={isPicked}
                  className={cn(
                    'bmis-press group flex h-full w-full items-start gap-3.5 rounded-[18px] border bg-surface p-5 text-left',
                    'hover:-translate-y-0.5 hover:border-navy-600/40 hover:shadow-[0_10px_28px_-12px_rgba(0,33,50,0.25)]',
                    isPicked ? 'scale-[0.985] border-navy-900 shadow-[0_0_0_3px_rgba(0,33,50,0.12)]' : 'border-line',
                    picked && !isPicked && 'opacity-60',
                  )}
                >
                  <span className={cn('grid size-11 shrink-0 place-items-center rounded-xl transition-colors', isPicked ? 'bg-navy-900 text-white' : 'bg-sky-100 text-navy-900 group-hover:bg-navy-900 group-hover:text-white')}>
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-display text-[15.5px] font-extrabold text-navy-900">{a.title}</span>
                      <ChevronRight className={cn('size-4 shrink-0 text-ink-subtle transition-transform', isPicked ? 'translate-x-0.5 text-navy-900' : 'group-hover:translate-x-0.5')} />
                    </span>
                    <span className="mt-1 block text-[13px] leading-snug text-ink-muted">{a.description}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </PublicLayout>
  )
}
