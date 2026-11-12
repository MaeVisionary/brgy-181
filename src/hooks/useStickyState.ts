import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * useState that survives leaving a page and coming back in the same visit
 * (filters, search, tab, page number). Kept per page in sessionStorage, so a
 * new browser session starts clean and nothing personal stays on the device.
 */
export function useStickyState<T>(name: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const { pathname } = useLocation()
  const key = `bmis.sticky:${pathname}:${name}`
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(key)
      return raw === null ? initial : (JSON.parse(raw) as T)
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try { sessionStorage.setItem(key, JSON.stringify(value)) } catch { /* ignore */ }
  }, [key, value])
  return [value, setValue]
}
