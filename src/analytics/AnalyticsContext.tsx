import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { readSheet } from 'read-excel-file/browser'
import { parseMasterlist } from './parseMasterlist'
import type { Filters } from './compute'
import type { SeniorDataset } from './seniorTypes'

/**
 * Holds the loaded senior citizen masterlist IN MEMORY for this browser tab only.
 * Nothing is uploaded or saved; reloading the page clears it. The backend phase
 * will replace this with a server-side import shared by all users.
 */

interface Ctx {
  dataset: SeniorDataset | null
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
  const [loading, setLoading] = useState(false)
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
    () => ({ dataset, loading, error, loadFile, clear: () => setDataset(null), reportingDate, setReportingDate, filters, setFilters }),
    [dataset, loading, error, loadFile, reportingDate, filters],
  )
  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>
}

export function useAnalytics(): Ctx {
  const c = useContext(AnalyticsContext)
  if (!c) throw new Error('useAnalytics must be used inside <AnalyticsProvider>')
  return c
}
