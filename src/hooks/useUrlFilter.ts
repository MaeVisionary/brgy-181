import { useCallback, useEffect } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'

/**
 * A list filter kept in the address (?status=inactive). Dashboard cards link
 * straight to a filtered list, and refresh, Back/Forward and copying the link
 * keep the same view. Opening the page from the menu (no filters in the
 * address) restores the last filters used on it in this visit.
 *
 * `allowed` limits the value to the options the page supports; anything else
 * falls back to `initial`, so a wrong link never shows a misleading list.
 */
export function useUrlFilter<T extends string>(name: string, initial: T, allowed?: readonly T[]): [T, (v: T) => void] {
  const [params, setParams] = useSearchParams()
  const { pathname } = useLocation()
  const key = `bmis.filter:${pathname}`
  const raw = params.get(name)
  const value = (raw !== null && (!allowed || allowed.includes(raw as T)) ? raw : initial) as T

  // Menu visit without filters: bring back this page's last filters (once per arrival).
  useEffect(() => {
    if ([...params.keys()].length) return
    try {
      const saved = sessionStorage.getItem(key)
      if (saved) setParams(new URLSearchParams(saved), { replace: true })
    } catch { /* storage unavailable */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  const set = useCallback((v: T) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (v === initial || v === '') next.delete(name); else next.set(name, v)
      next.delete('page')
      try { sessionStorage.setItem(key, next.toString()) } catch { /* storage unavailable */ }
      return next
    }, { replace: true })
  }, [initial, name, key, setParams])
  return [value, set]
}

/** Builds a link with filters, leaving out empty values. */
export function withFilters(path: string, f: Record<string, string | undefined>): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(f)) if (v) p.set(k, v)
  const s = p.toString()
  return s ? `${path}?${s}` : path
}

/** Clears every filter in the address at once (and the remembered ones for this page). */
export function useClearFilters(): () => void {
  const [, setParams] = useSearchParams()
  const { pathname } = useLocation()
  return useCallback(() => {
    try { sessionStorage.removeItem(`bmis.filter:${pathname}`) } catch { /* storage unavailable */ }
    setParams(new URLSearchParams(), { replace: true })
  }, [pathname, setParams])
}
