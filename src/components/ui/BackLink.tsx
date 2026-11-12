import { ArrowLeft } from '@/icons'
import { useEffect } from 'react'
import { Link, useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { NAVIGATION } from '@/config/navigation'

/**
 * "Back" that returns to the page the user actually came from (e.g. a case
 * opened from Hearings and Mediation goes back there, not to the case list).
 * Falls back to the page's parent list when there is no earlier page in this
 * visit (a link opened directly or after a reload).
 */

const TRAIL_KEY = 'bmis.trail'

interface Crumb {
  path: string
  search: string
}

function readTrail(): Crumb[] {
  try {
    return JSON.parse(sessionStorage.getItem(TRAIL_KEY) ?? '[]') as Crumb[]
  } catch {
    return []
  }
}

/** Records each page visit (mounted once in the app shell). */
export function useTrail() {
  const { pathname, search } = useLocation()
  const navType = useNavigationType()
  useEffect(() => {
    const trail = readTrail()
    const last = trail[trail.length - 1]
    if (last?.path === pathname && last.search === search) return
    // Only a real "Back" (browser or app) drops the page we left. Opening the
    // same page again from somewhere else is a new step forward.
    const prev = trail[trail.length - 2]
    const next = navType === 'POP' && prev && prev.path === pathname ? trail.slice(0, -1) : [...trail, { path: pathname, search }]
    try {
      sessionStorage.setItem(TRAIL_KEY, JSON.stringify(next.slice(-30)))
    } catch {
      /* ignore */
    }
  }, [pathname, search, navType])
}

const DETAIL_LABELS: [RegExp, string][] = [
  [/^\/documents\/approvals$/, 'Approvals'],
  [/^\/documents\/[^/]+\/preview$/, 'Document preview'],
  [/^\/appointments\/[^/]+$/, 'Appointment'],
  [/^\/concerns\/[^/]+$/, 'Concern'],
  [/^\/my\/documents\/new$/, 'Choose a document'],
  [/^\/my\/documents\/new\/.+$/, 'Request form'],
  [/^\/my\/complaints\/new$/, 'Report types'],
  [/^\/my\/borrowing\/new$/, 'Borrowing form'],
  [/^\/my\/documents\/[^/]+$/, 'Request'],
  [/^\/my\/complaints\/[^/]+$/, 'Report'],
  [/^\/my\/borrowing\/[^/]+$/, 'Borrowing'],
  [/^\/my\/appointments\/[^/]+$/, 'Appointment'],
  [/^\/my\/concerns\/[^/]+$/, 'Concern'],
  [/^\/residents\/households\/[^/]+$/, 'Household'],
  [/^\/residents\/[^/]+$/, 'Resident profile'],
  [/^\/cases\/[^/]+$/, 'Case'],
  [/^\/documents\/[^/]+$/, 'Request'],
  [/^\/borrowing\/[^/]+$/, 'Borrowing record'],
  [/^\/my\/transactions$/, 'My Transactions'],
]

function labelFor(path: string): string | null {
  for (const groups of Object.values(NAVIGATION)) {
    for (const g of groups) {
      if (g.path === path) return g.label === 'Dashboard' || g.label === 'Home' ? 'Dashboard' : g.label
      for (const c of g.children ?? []) if (c.path === path) return c.label
    }
  }
  return DETAIL_LABELS.find(([re]) => re.test(path))?.[1] ?? null
}

export function BackLink({ fallbackTo, fallbackLabel }: { fallbackTo: string; fallbackLabel: string }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const trail = readTrail()
  const current = trail[trail.length - 1]
  const prev = current?.path === pathname ? trail[trail.length - 2] : trail[trail.length - 1]
  const hasPrev = !!prev && prev.path !== pathname
  const prevLabel = hasPrev ? labelFor(prev.path) : null
  const cls = 'mb-3 inline-flex min-h-11 items-center gap-1.5 text-[length:calc(15.5px*var(--fs))] font-semibold text-info hover:underline'

  // Always return to the page the user came from when there is one; the label is a courtesy.
  if (hasPrev) {
    return (
      <button type="button" onClick={() => navigate(-1)} className={cls}>
        <ArrowLeft className="size-4" /> {prevLabel ? `Back to ${prevLabel}` : 'Back'}
      </button>
    )
  }
  return (
    <Link to={fallbackTo} className={cls}>
      <ArrowLeft className="size-4" /> Back to {fallbackLabel}
    </Link>
  )
}
