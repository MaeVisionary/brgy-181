import { useCallback } from 'react'
import { flushSync } from 'react-dom'
import { useNavigate } from 'react-router-dom'

/**
 * Smooth page changes for the public portal using the browser's View Transitions
 * API (no extra library). Direction controls which way screens slide.
 * Browsers without the API, and users who prefer reduced motion, get an instant
 * change plus a short CSS fade on the incoming page.
 */

export type NavDirection = 'forward' | 'back'

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const supportsViewTransitions = () =>
  typeof document !== 'undefined' && 'startViewTransition' in document

export function useSmoothNavigate() {
  const navigate = useNavigate()
  return useCallback(
    (to: string, direction: NavDirection = 'forward', state?: unknown) => {
      document.documentElement.dataset.navDir = direction
      const go = () => navigate(to, { state })
      if (!supportsViewTransitions() || prefersReducedMotion()) {
        go()
        return
      }
      ;(document as Document & { startViewTransition: (cb: () => void) => unknown }).startViewTransition(() => {
        flushSync(go)
        window.scrollTo({ top: 0 })
      })
    },
    [navigate],
  )
}
