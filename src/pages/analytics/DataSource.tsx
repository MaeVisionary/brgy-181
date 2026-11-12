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
  const { dataset, source, loading, error, loadFile, reportingDate, setReportingDate } = useAnalytics()
  const input = useRef<HTMLInputElement>(null)
  const canImport = can('residents.import')

  const onFile = async (f: File | undefined) => {
    if (!f || !user) return
    const ds = await loadFile(f)
    audit(user, ds ? 'Loaded senior citizen masterlist' : 'Masterlist load failed', 'Analytics', ds ? `${ds.records.length} records` : undefined, ds ? 'success' : 'failure')
  }

  return (
    <Card className="mb-4 px-5 py-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-navy-900 text-white">
            <FileSpreadsheet className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="label-caps">Data source</p>
            {dataset ? (
              <>
                <p className="font-display text-[18px] font-bold text-navy-900" title={dataset.fileName}>{dataset.fileName}</p>
                <dl className="mt-2 flex flex-wrap gap-2">
                  {[
                    ['Records', dataset.records.length.toLocaleString()],
                    ...(source === 'snapshot' ? [] : [['Loaded', formatDateTime(dataset.loadedAt)]]),
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-md border border-line bg-surface-muted px-2.5 py-1 text-[14px]">
                      <dt className="inline text-ink-muted">{k}: </dt>
                      <dd className="inline font-semibold text-navy-900">{v}</dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : (
              <>
                <p className="font-display text-[18px] font-bold text-navy-900">No masterlist loaded</p>
                <p className="text-[14.5px] text-ink-muted">
                  {canImport ? 'Load the senior citizen (OSCA) masterlist Excel file to see the analytics.' : 'Ask the Barangay Secretary to load the senior citizen masterlist.'}
                </p>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end xl:shrink-0">
          <label className="block">
            <span className="mb-1 block text-[14px] font-semibold text-navy-900">Ages computed as of</span>
            <input
              type="date"
              value={iso(reportingDate)}
              onChange={(e) => e.target.value && setReportingDate(new Date(`${e.target.value}T00:00:00Z`))}
              className="h-10 rounded-[var(--radius-control)] border border-line px-3 text-[15px] text-navy-900"
            />
          </label>
          {dataset?.fileDate && iso(dataset.fileDate) !== iso(reportingDate) && (
            <Button variant="secondary" onClick={() => setReportingDate(dataset.fileDate!)}>
              Use masterlist date ({long(dataset.fileDate)})
            </Button>
          )}
          {canImport && (
            <>
              <input ref={input} type="file" accept=".xlsx" className="sr-only" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} />
              <Button icon={<Upload className="size-4" />} loading={loading} onClick={() => input.current?.click()}>
                {source === 'snapshot' ? 'Load full file (with names)' : dataset ? 'Load updated masterlist' : 'Load masterlist (.xlsx)'}
              </Button>
            </>
          )}
        </div>
      </div>
      {error && (
        <p className="mt-3 flex items-center gap-2 rounded-md bg-danger-tint px-3 py-2 text-[14.5px] text-danger-ink">
          <XCircle className="size-4" /> {error}
        </p>
      )}
      {dataset && (
        <details className="mt-3 rounded-md border border-line-soft bg-surface-muted/60 px-3 py-2 text-[14.5px]">
          <summary className="font-semibold text-navy-900">About this data</summary>
          <ul className="mt-2 space-y-1">
            {dataset.messages.map((m, i) => (
              <li key={i} className="flex items-start gap-2 text-navy-900">
                {m.level === 'info' ? <Info className="mt-px size-4 shrink-0 text-info" /> : m.level === 'warning' ? <AlertTriangle className="mt-px size-4 shrink-0 text-warning" /> : <XCircle className="mt-px size-4 shrink-0 text-danger" />}
                {m.text}
              </li>
            ))}
            <li className="flex items-start gap-2 text-ink-nav">
              <Info className="mt-px size-4 shrink-0 text-info" />
              This is the senior citizen masterlist, not the complete resident database. Senior status is decided by age on the date above (60 and above), not by being on the list.
            </li>
          </ul>
        </details>
      )}
    </Card>
  )
}
