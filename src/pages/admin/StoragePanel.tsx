import { useState } from 'react'
import { Panel } from '@/components/ui/Panel'
import { STORAGE_THRESHOLDS } from '@/config/uploads'
import { formatBytes } from '@/lib/uploads'
import { storageStats } from '@/services/fileStore'

const CAP_KEY = 'bmis.storageCapacityMb'
const LABEL = { id: 'IDs', requirement: 'Requirements', proof: 'Proof documents', authorization: 'Authorizations', reply: 'Replies' } as const

/** Uploaded document storage: total, by type, largest files, and a warning against the capacity an administrator enters. */
export function StoragePanel() {
  const s = storageStats()
  const [cap, setCap] = useState(() => localStorage.getItem(CAP_KEY) ?? '')
  const capBytes = Number(cap) > 0 ? Number(cap) * 1024 * 1024 : 0
  const share = capBytes ? s.bytes / capBytes : 0
  const level = !capBytes ? null : share >= STORAGE_THRESHOLDS.critical ? 'critical' : share >= STORAGE_THRESHOLDS.warning ? 'warning' : share >= STORAGE_THRESHOLDS.monitor ? 'monitor' : null
  return (
    <Panel className="mt-4" title="Document storage">
      <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
        <p><span className="font-display text-[length:calc(24px*var(--fs))] font-extrabold text-navy-900">{formatBytes(s.bytes)}</span> <span className="text-[length:calc(14px*var(--fs))] text-ink-muted">{s.files} {s.files === 1 ? "file" : "files"}{capBytes ? ` · ${Math.round(share * 100)}% of ${cap} MB` : ''}</span></p>
        <label className="flex items-center gap-2 text-[length:calc(14px*var(--fs))] text-ink-nav">
          Capacity (MB)
          <input type="number" min={1} value={cap} onChange={(e) => { setCap(e.target.value); try { localStorage.setItem(CAP_KEY, e.target.value) } catch { /* ignore */ } }} className="h-10 w-28 rounded-[var(--radius-control)] border border-line bg-surface px-2.5 text-[length:calc(15px*var(--fs))] text-navy-900" />
        </label>
      </div>
      {level && (
        <p role="alert" className={`mt-3 rounded-md px-3 py-2 text-[length:calc(14.5px*var(--fs))] ${level === 'critical' ? 'bg-danger-tint text-danger-ink' : level === 'warning' ? 'bg-warning-tint text-navy-900' : 'bg-sky-100 text-navy-900'}`}>
          {level === 'critical' ? 'Storage is almost full. New uploads may fail.' : level === 'warning' ? 'Storage is getting full.' : 'Storage use is above 70%.'}
        </p>
      )}
      <dl className="mt-4 grid grid-cols-1 gap-x-8 text-[length:calc(14.5px*var(--fs))] sm:grid-cols-2">
        {s.byCategory.map(([c, n]) => (
          <div key={c} className="flex justify-between border-b border-line-soft py-1.5"><dt className="text-ink-nav">{LABEL[c]}</dt><dd className="tabular-nums text-navy-900">{formatBytes(n)}</dd></div>
        ))}
        <div className="flex justify-between border-b border-line-soft py-1.5"><dt className="text-ink-nav">Not yet submitted</dt><dd className="tabular-nums text-navy-900">{s.temporary}</dd></div>
        <div className="flex justify-between border-b border-line-soft py-1.5"><dt className="text-ink-nav">Rejected uploads</dt><dd className="tabular-nums text-navy-900">{s.failed}</dd></div>
      </dl>
      {s.largest.length > 0 && (
        <details className="mt-3 text-[length:calc(14.5px*var(--fs))]">
          <summary className="cursor-pointer font-semibold text-navy-900">Largest files</summary>
          <ul className="mt-2 space-y-1">{s.largest.map((f) => <li key={f.id} className="flex justify-between gap-3"><span className="min-w-0 truncate text-navy-900">{f.originalName}</span><span className="shrink-0 tabular-nums text-ink-muted">{formatBytes(f.size)}</span></li>)}</ul>
        </details>
      )}
    </Panel>
  )
}
