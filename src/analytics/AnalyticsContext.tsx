import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { readSheet } from 'read-excel-file/browser'
import { parseMasterlist } from './parseMasterlist'
import { loadSnapshot } from './snapshot'
import type { Filters } from './compute'
import type { SeniorDataset } from './seniorTypes'

/**
 * Senior citizen masterlist for the analytics.
 *  - On start it loads the built-in DE-IDENTIFIED snapshot (no names) automatically,
 *    so figures are available without uploading anything.
 *  - Staff may load the full Excel file to see names; that copy stays IN MEMORY in
 *    this browser tab only (reloading returns to the built-in snapshot).
 * The backend phase replaces both with a protected server-side dataset.
 */

interface Ctx {
  dataset: SeniorDataset | null
  /** Where the current data came from. */
  source: 'snapshot' | 'file' | null
  loading: boolean
  error: string | null
  loadFile: (file: File) => Promise<SeniorDataset | null>
  clear: () => void
  reportingDate: Date
  setReportingDate: (d: Date) => void
  filters: Filters
  setFilters: (f: Filters | ((prev: Filters) => Filters)) => void
}

const AnalyticsContext = createContext<Ctx | null>(null)

const todayUtc = () => {
  const n = new Date()
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()))
}

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const [dataset, setDataset] = useState<SeniorDataset | null>(null)
  const [source, setSource] = useState<'snapshot' | 'file' | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    loadSnapshot().then((ds) => {
      if (!alive) return
      if (ds) {
        setDataset((cur) => cur ?? ds)
        setSource((cur) => cur ?? 'snapshot')
      }
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [])
  const [error, setError] = useState<string | null>(null)
  const [reportingDate, setReportingDate] = useState<Date>(todayUtc)
  const [filters, setFilters] = useState<Filters>({})

  const loadFile = useCallback(async (file: File) => {
    setLoading(true)
    setError(null)
    try {
      if (!/\.xlsx$/i.test(file.name)) throw new Error('Please choose an Excel .xlsx file.')
      const rows = (await readSheet(file)) as (string | number | boolean | Date | null)[][]
      const ds = parseMasterlist(rows, file.name, 'Sheet 1')
      setDataset(ds)
      setSource('file')
      setFilters({})
      return ds
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The file could not be read.')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const value = useMemo<Ctx>(
    () => ({ dataset, source, loading, error, loadFile, clear: () => setDataset(null), reportingDate, setReportingDate, filters, setFilters }),
    [dataset, source, loading, error, loadFile, reportingDate, filters],
  )
  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>
}

export function useAnalytics(): Ctx {
  const c = useContext(AnalyticsContext)
  if (!c) throw new Error('useAnalytics must be used inside <AnalyticsProvider>')
  return c
}
