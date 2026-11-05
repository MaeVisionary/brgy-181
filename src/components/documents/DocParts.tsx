import { Check } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { FieldLabel, Select, TextArea, TextInput } from '@/components/ui/Field'
import { STATUS_META, TERMINAL, WORKFLOWS } from '@/documents/workflows'
import { getDocumentType } from '@/documents/catalog'
import { cn } from '@/lib/cn'
import { formatDateTime } from '@/lib/format'
import { mockUsers } from '@/mocks/users'
import { ROLES } from '@/config/permissions'
import type { DocumentRequest, DocumentStatus, FieldDef, FieldValue, StatusEvent } from '@/types/document'

export function StatusBadge({ status }: { status: DocumentStatus }) {
  const m = STATUS_META[status]
  return <Badge tone={m.tone}>{m.label}</Badge>
}

/** Workflow progress for this document type's own path. */
export function ProgressTracker({ req }: { req: DocumentRequest }) {
  const wf = WORKFLOWS[getDocumentType(req.typeId).workflow]
  const side = !wf.path.includes(req.status)
  // For side states (needs info, rejected, cancelled) show progress up to the last path status reached.
  const reached = [...req.history].reverse().find((h) => wf.path.includes(h.status))?.status
  const currentIdx = wf.path.indexOf(side ? (reached ?? wf.path[0]) : req.status)
  const ended = TERMINAL.includes(req.status) && !wf.path.includes(req.status)
  return (
    <ol className="space-y-0">
      {wf.path.map((s, i) => {
        const done = i < currentIdx || (i === currentIdx && TERMINAL.includes(req.status) && wf.path.includes(req.status))
        const current = i === currentIdx && !done
        return (
          <li key={s} className="relative flex gap-3 pb-3 last:pb-0">
            {i < wf.path.length - 1 && <span className={cn('absolute top-5 left-[9px] h-[calc(100%-12px)] w-px', i < currentIdx ? 'bg-navy-900' : 'bg-line')} />}
            <span
              className={cn(
                'relative z-10 grid size-[19px] shrink-0 place-items-center rounded-full border text-[10px]',
                done ? 'border-navy-900 bg-navy-900 text-white' : current ? (side ? 'border-warning bg-warning-tint' : 'border-navy-900 bg-sky-100') : 'border-line bg-surface',
              )}
            >
              {done && <Check className="size-3" strokeWidth={3} />}
            </span>
            <span className={cn('pt-px text-[12.5px]', current ? 'font-semibold text-navy-900' : done ? 'text-navy-900' : 'text-ink-muted')}>
              {STATUS_META[s].label}
              {current && side && !ended && <span className="block text-[11.5px] font-medium text-warning">Now: {STATUS_META[req.status].label}</span>}
            </span>
          </li>
        )
      })}
      {ended && (
        <li className="mt-2 text-[12.5px] font-semibold text-danger-ink">{STATUS_META[req.status].label}</li>
      )}
    </ol>
  )
}

const userName = (id: string) => mockUsers.find((u) => u.id === id)?.fullName ?? 'Resident'

export function HistoryList({ events, showRemarks = true }: { events: StatusEvent[]; showRemarks?: boolean | ((e: StatusEvent) => boolean) }) {
  return (
    <ol className="space-y-3">
      {[...events].reverse().map((e, i) => {
        const remarksVisible = typeof showRemarks === 'function' ? showRemarks(e) : showRemarks
        return (
          <li key={i} className="border-l-2 border-line-soft pl-3">
            <p className="text-[12.5px] font-semibold text-navy-900">{e.action}</p>
            <p className="text-[11.5px] text-ink-muted">
              {formatDateTime(e.at)} · {userName(e.byUserId)} ({ROLES[e.byRole].name})
            </p>
            {e.remarks && remarksVisible && <p className="mt-1 rounded-md bg-surface-muted px-2.5 py-1.5 text-[12.5px] text-navy-900">{e.remarks}</p>}
          </li>
        )
      })}
    </ol>
  )
}

/** Groups fields in declaration order, keeping ungrouped fields first. */
export function groupFields(fields: FieldDef[]): [string, FieldDef[]][] {
  const out: [string, FieldDef[]][] = []
  for (const f of fields) {
    const g = f.group ?? ''
    const bucket = out.find(([name]) => name === g)
    if (bucket) bucket[1].push(f)
    else out.push([g, [f]])
  }
  return out
}

export function FieldInput({
  field,
  value,
  onChange,
  disabled,
  invalid,
}: {
  field: FieldDef
  value: FieldValue | undefined
  onChange: (v: FieldValue) => void
  disabled?: boolean
  invalid?: boolean
}) {
  const label = field.label
  const invalidCls = invalid ? 'border-danger' : undefined
  if (field.kind === 'multi') {
    const arr = Array.isArray(value) ? value : []
    return (
      <fieldset className="sm:col-span-2">
        <legend className="mb-1.5 text-[12.5px] font-semibold text-navy-900">
          {label}
          {field.required && <span className="text-danger-ink"> *</span>}
        </legend>
        <div className={cn('grid gap-1.5 rounded-[var(--radius-control)] border p-3 sm:grid-cols-2', invalid ? 'border-danger' : 'border-line')}>
          {field.options!.map((o) => (
            <label key={o} className="flex items-center gap-2 text-[13px] text-navy-900">
              <input
                type="checkbox"
                className="size-4 accent-[#002132]"
                checked={arr.includes(o)}
                disabled={disabled}
                onChange={(e) => onChange(e.target.checked ? [...arr, o] : arr.filter((x) => x !== o))}
              />
              {o}
            </label>
          ))}
        </div>
        {field.help && <span className="mt-1 block text-[11.5px] text-ink-muted">{field.help}</span>}
      </fieldset>
    )
  }
  if (field.kind === 'check') {
    return (
      <label className="flex items-center gap-2 text-[13px] font-medium text-navy-900 sm:col-span-2">
        <input type="checkbox" className="size-4 accent-[#002132]" checked={value === true} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        {label}
      </label>
    )
  }
  const str = typeof value === 'string' ? value : ''
  return (
    <div className={field.kind === 'textarea' ? 'sm:col-span-2' : undefined}>
      <FieldLabel label={label} required={field.required} hint={field.help}>
        {field.kind === 'textarea' ? (
          <TextArea value={str} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={invalidCls} />
        ) : field.kind === 'choice' ? (
          <Select value={str} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={invalidCls}>
            <option value="">Select…</option>
            {field.options!.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </Select>
        ) : (
          <TextInput
            value={str}
            disabled={disabled}
            inputMode={field.kind === 'number' ? 'numeric' : undefined}
            onChange={(e) => onChange(field.kind === 'number' ? e.target.value.replace(/[^\d]/g, '') : e.target.value)}
            className={invalidCls}
          />
        )}
      </FieldLabel>
    </div>
  )
}
