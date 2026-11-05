import { useEffect, useState } from 'react'

/** Loads data from a service function and tracks loading and error state. */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    load()
      .then((d) => active && (setData(d), setError(null)))
      .catch((e: unknown) => active && setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, error, loading }
}
