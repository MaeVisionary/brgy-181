import { AlertTriangle, FileSpreadsheet, Info, Upload, XCircle } from 'lucide-react'
import { useRef } from 'react'
import { useAuth } from '@/auth/useAuth'
import { useAnalytics } from '@/analytics/AnalyticsContext'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Panel'
import { formatDateTime } from '@/lib/format'
import { audit } from '@/services/auditService'

const iso = (d: Date) => d.toISOString().slice(0, 10)
const long = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

/** Dataset loader + reporting date. Data stays in this browser tab only. */
export function DataSource() {
  const { user, can } = useAuth()
  const { dataset, loading, error, loadFile, reportingDate, setReportingDate } = useAnalytics()
  const input = useRef<HTMLInputElement>(null)
  const canImport = can('residents.import')

  const onFile = async (f: File | undefined) => {
    if (!f || !user) return
    const ds = await loadFile(f)
    audit(user, ds ? 'Loaded senior citizen masterlist' : 'Masterlist load failed', 'Analytics', ds ? `${ds.records.length} records` : undefined, ds ? 'success' : 'failure')
  }

  return (
    <Card className="mb-4 px-5 py-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-sky-100 text-navy-900">
            <FileSpreadsheet className="size-5" />
          </span>
          <div className="min-w-0">
            {dataset ? (
              <>
                <p className="truncate text-[13.5px] font-semibold text-navy-900" title={dataset.fileName}>{dataset.fileName}</p>
                <p className="text-[12px] text-ink-muted">
                  {dataset.records.length} records · {dataset.skippedRows} rows without a name skipped · loaded {formatDateTime(dataset.loadedAt)} · kept in this browser tab only
                </p>
              </>
            ) : (
              <>
                <p className="text-[13.5px] font-semibold text-navy-900">No masterlist loaded</p>
                <p className="text-[12px] text-ink-muted">
                  {canImport ? 'Load the senior citizen (OSCA) masterlist Excel file to see the analytics.' : 'Ask the Barangay Secretary to load the senior citizen masterlist in this browser.'}
                </p>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-semibold text-navy-900">Reporting date (ages are computed as of)</span>
            <input
              type="date"
              value={iso(reportingDate)}
              onChange={(e) => e.target.value && setReportingDate(new Date(`${e.target.value}T00:00:00Z`))}
              className="h-9 rounded-[var(--radius-control)] border border-line px-2 text-[13px] text-navy-900"
            />
          </label>
          {dataset?.fileDate && iso(dataset.fileDate) !== iso(reportingDate) && (
            <Button variant="secondary" size="sm" onClick={() => setReportingDate(dataset.fileDate!)}>
              Use masterlist date ({long(dataset.fileDate)})
            </Button>
          )}
          {canImport && (
            <>
              <input ref={input} type="file" accept=".xlsx" className="sr-only" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} />
              <Button size="sm" icon={<Upload className="size-3.5" />} loading={loading} onClick={() => input.current?.click()}>
                {dataset ? 'Load updated masterlist' : 'Load masterlist (.xlsx)'}
              </Button>
            </>
          )}
        </div>
      </div>
      {error && (
        <p className="mt-3 flex items-center gap-2 rounded-md bg-danger-tint px-3 py-2 text-[12.5px] text-danger-ink">
          <XCircle className="size-4" /> {error}
        </p>
      )}
      {dataset && dataset.messages.length > 0 && (
        <ul className="mt-3 space-y-1">
          {dataset.messages.map((m, i) => (
            <li key={i} className="flex items-start gap-2 text-[12.5px] text-navy-900">
              {m.level === 'info' ? <Info className="mt-px size-4 shrink-0 text-info" /> : m.level === 'warning' ? <AlertTriangle className="mt-px size-4 shrink-0 text-warning" /> : <XCircle className="mt-px size-4 shrink-0 text-danger" />}
              {m.text}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11.5px] text-ink-subtle">
        This is the senior citizen masterlist, not the complete resident database. The file is read in your browser and is not uploaded or saved; reloading the
        page clears it.
      </p>
    </Card>
  )
}
