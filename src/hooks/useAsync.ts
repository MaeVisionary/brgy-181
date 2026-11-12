import { useEffect, useState } from 'react'

/**
 * Loads data from a service function and tracks loading and error state.
 * `loading` is true only until the first data arrives: a reload (dependencies
 * changed) keeps showing the current data until the new data replaces it, so
 * lists never blank out and jump while refreshing. `refreshing` tells when a
 * reload is under way.
 */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [pending, setPending] = useState(true)

  useEffect(() => {
    let active = true
    setPending(true)
    load()
      .then((d) => active && (setData(d), setError(null)))
      .catch((e: unknown) => active && setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => active && setPending(false))
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, error, loading: pending && data === null, refreshing: pending && data !== null }
}
