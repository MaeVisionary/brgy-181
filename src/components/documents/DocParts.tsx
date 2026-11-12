import { Check } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { FieldLabel, Select, TextArea, TextInput } from '@/components/ui/Field'
import { STATUS_META, TERMINAL, WORKFLOWS, statusLabel } from '@/documents/workflows'
import { getDocumentType } from '@/documents/catalog'
import { cn } from '@/lib/cn'
import { formatDateTime } from '@/lib/format'
import { mockUsers } from '@/mocks/users'
import { ROLES } from '@/config/permissions'
import type { DocumentRequest, DocumentStatus, DocumentTypeId, FieldDef, FieldValue, StatusEvent, WorkflowId } from '@/types/document'

export function StatusBadge({ status, typeId }: { status: DocumentStatus; typeId?: DocumentTypeId }) {
  const m = STATUS_META[status]
  return <Badge tone={m.tone}>{statusLabel(status, typeId && getDocumentType(typeId).workflow)}</Badge>
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
                'relative z-10 grid size-[19px] shrink-0 place-items-center rounded-full border text-[12px]',
                done ? 'border-navy-900 bg-navy-900 text-white' : current ? (side ? 'border-warning bg-warning-tint' : 'border-navy-900 bg-sky-100') : 'border-line bg-surface',
              )}
            >
              {done && <Check className="size-3" strokeWidth={3} />}
            </span>
            <span className={cn('pt-px text-[14.5px]', current ? 'font-semibold text-navy-900' : done ? 'text-navy-900' : 'text-ink-muted')}>
              {statusLabel(s, wf.id)}
              {current && side && !ended && <span className="block text-[13.5px] font-medium text-warning">Now: {statusLabel(req.status, wf.id)}</span>}
            </span>
          </li>
        )
      })}
      {ended && (
        <li className="mt-2 text-[14.5px] font-semibold text-danger-ink">{statusLabel(req.status, wf.id)}</li>
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
            <p className="text-[14.5px] font-semibold text-navy-900">{e.action}</p>
            <p className="text-[13.5px] text-ink-muted">
              {formatDateTime(e.at)} · {userName(e.byUserId)} ({ROLES[e.byRole].name})
            </p>
            {e.remarks && remarksVisible && <p className="mt-1 rounded-md bg-surface-muted px-2.5 py-1.5 text-[14.5px] text-navy-900">{e.remarks}</p>}
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
        <legend className="mb-1.5 text-[14.5px] font-semibold text-navy-900">
          {label}
          {field.required && <span className="text-danger-ink"> *</span>}
        </legend>
        <div className={cn('grid gap-1.5 rounded-[var(--radius-control)] border p-3 sm:grid-cols-2', invalid ? 'border-danger' : 'border-line')}>
          {field.options!.map((o) => (
            <label key={o} className="flex items-center gap-2 text-[15px] text-navy-900">
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
      </fieldset>
    )
  }
  if (field.kind === 'check') {
    return (
      <label className="flex items-center gap-2 text-[15px] font-medium text-navy-900 sm:col-span-2">
        <input type="checkbox" className="size-4 accent-[#002132]" checked={value === true} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        {label}
      </label>
    )
  }
  const str = typeof value === 'string' ? value : ''
  return (
    <div className={field.kind === 'textarea' ? 'sm:col-span-2' : undefined}>
      <FieldLabel label={label} required={field.required}>
        {field.kind === 'textarea' ? (
          <TextArea value={str} disabled={disabled} placeholder={field.help} onChange={(e) => onChange(e.target.value)} className={invalidCls} />
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
            placeholder={field.help}
            onChange={(e) => onChange(field.kind === 'number' ? e.target.value.replace(/[^\d]/g, '') : e.target.value)}
            className={invalidCls}
          />
        )}
      </FieldLabel>
    </div>
  )
}

/**
 * Connected step-progress for a workflow. Without a request it shows the
 * sequence of stages; with one it marks done, current and upcoming stages.
 */
export function WorkflowSteps({ workflow, req }: { workflow: WorkflowId; req?: DocumentRequest }) {
  const wf = WORKFLOWS[workflow]
  const side = !!req && !wf.path.includes(req.status)
  const reached = req ? [...req.history].reverse().find((h) => wf.path.includes(h.status))?.status : undefined
  const idx = req ? wf.path.indexOf(side ? (reached ?? wf.path[0]) : req.status) : -1
  const finished = !!req && !side && TERMINAL.includes(req.status)
  const stopped = !!req && side && TERMINAL.includes(req.status)
  return (
    <div className="overflow-x-auto pb-1">
      <ol className="flex min-w-[680px]" aria-label="Workflow stages">
        {wf.path.map((s, i) => {
          const state = !req ? 'step' : i < idx || (i === idx && finished) ? 'done' : i === idx ? 'current' : 'upcoming'
          const lineOn = state === 'step' || state === 'done' || state === 'current'
          return (
            <li key={s} className="relative flex-1 text-center" aria-current={state === 'current' ? 'step' : undefined}>
              {i > 0 && <span aria-hidden className={cn('absolute top-4 right-1/2 h-0.5 w-full -translate-y-1/2', lineOn ? 'bg-navy-900' : 'bg-line')} />}
              <span
                className={cn(
                  'relative z-10 mx-auto grid size-8 place-items-center rounded-full border-2 text-[14px] font-bold',
                  state === 'done' && 'border-navy-900 bg-navy-900 text-white',
                  state === 'current' && (side ? 'border-warning bg-surface text-warning' : 'border-navy-900 bg-sky-100 text-navy-900'),
                  state === 'step' && 'border-navy-900 bg-surface text-navy-900',
                  state === 'upcoming' && 'border-line bg-surface text-ink-subtle',
                )}
              >
                {state === 'done' ? <Check className="size-4" strokeWidth={3} /> : i + 1}
              </span>
              <span className={cn('mt-2 block px-1 text-[13.5px] leading-snug', state === 'current' ? 'font-bold text-navy-900' : state === 'upcoming' ? 'text-ink-muted' : 'font-semibold text-navy-900')}>
                {statusLabel(s, wf.id)}
              </span>
              {state === 'current' && (
                <span className={cn('block text-[12.5px] font-semibold', side ? 'text-warning' : 'text-info')}>{side && !stopped ? `Now: ${statusLabel(req!.status, wf.id)}` : 'In progress'}</span>
              )}
            </li>
          )
        })}
      </ol>
      {stopped && <p className="mt-2 text-[14.5px] font-semibold text-danger-ink">Stopped: {statusLabel(req!.status, wf.id)}</p>}
    </div>
  )
}
