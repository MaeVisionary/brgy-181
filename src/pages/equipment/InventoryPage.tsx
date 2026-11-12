import { Pencil, Plus } from '@/icons'
import { Fragment, useState } from 'react'
import { cn } from '@/lib/cn'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/ui/Button'
import { FieldLabel, TextInput } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, Panel } from '@/components/ui/Panel'
import { BORROWING } from '@/config/barangay'
import { useAsync } from '@/hooks/useAsync'
import { useDocActor } from '@/hooks/useDocActor'
import { formatDateTime } from '@/lib/format'
import { addEquipment, equipmentStatus, listEquipment, updateEquipment } from '@/services/equipmentService'
import { ServiceError } from '@/services/mockApi'
import type { Equipment, EquipmentCategory } from '@/types/equipment'

/** Property and equipment records. */
export function InventoryPage() {
  const { can } = useAuth()
  const actor = useDocActor()!
  const [tick, setTick] = useState(0)
  const items = useAsync(listEquipment, [tick]).data
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const manage = can('inventory.manage')
  const categories = [...new Set([...BORROWING.documentedEquipment, ...(items ?? []).map((e) => e.category)])]

  return (
    <>
      <PageHeader
        title="Property and Equipment Records"
        subtitle={`Barangay equipment lent to residents: ${BORROWING.documentedEquipment.join(', ').toLowerCase()}.`}
        actions={manage && <Button icon={<Plus className="size-4" />} onClick={() => setAdding((a) => !a)}>Add equipment</Button>}
      />
      {adding && <AddForm categories={categories} onDone={() => { setAdding(false); setTick((t) => t + 1) }} actor={actor} />}
      <Card className="overflow-hidden">
        {/* Desktop and tablet: compact table */}
        <table className="hidden w-full text-[15px] md:table">
          <thead>
            <tr className="border-b border-line bg-surface-muted/70 text-left text-[13px] font-semibold text-ink-nav">
              <th className="px-4 py-2">Equipment</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Damaged</th>
              <th className="px-3 py-2 text-right">Missing</th>
              {manage && <th className="w-16 px-4 py-2 text-right"><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map((e) => (
              <Fragment key={e.id}>
                <tr className={cn('border-t border-line-soft align-middle transition-colors first:border-t-0 hover:bg-sky-50/60', editing === e.id && 'bg-sky-50')}>
                  <td className="px-4 py-2.5">
                    <span className="block font-semibold text-navy-900">{e.name}</span>
                    <span className="block text-[13.5px] leading-snug text-ink-muted"><span className="whitespace-nowrap text-ink-nav">{e.refNo}</span> · {e.description}{e.location ? ` · ${e.location}` : ''}</span>
                  </td>
                  <td className="px-3 py-2.5 text-[14.5px] text-ink-nav">{e.category}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-navy-900">{e.totalQty}</td>
                  <td className="px-3 py-2.5"><StatusBadges e={e} /></td>
                  <td className={cn('px-3 py-2.5 text-right tabular-nums', e.damagedQty ? 'font-semibold text-warning' : 'text-ink-subtle')}>{e.damagedQty}</td>
                  <td className={cn('px-3 py-2.5 text-right tabular-nums', e.missingQty ? 'font-semibold text-danger-ink' : 'text-ink-subtle')}>{e.missingQty}</td>
                  {manage && (
                    <td className="px-4 py-2.5 text-right">
                      <EditButton name={e.name} disabled={!!editing && editing !== e.id} onClick={() => setEditing(editing === e.id ? null : e.id)} />
                    </td>
                  )}
                </tr>
                {editing === e.id && (
                  <tr className="bg-sky-50">
                    <td colSpan={manage ? 7 : 6} className="px-4 pb-3">
                      <EditForm e={e} categories={categories} actor={actor} onDone={() => { setEditing(null); setTick((t) => t + 1) }} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>

        {/* Phones: one card per item */}
        <ul className="divide-y divide-line-soft md:hidden">
          {(items ?? []).map((e) => (
            <li key={e.id} className={cn('px-4 py-3', editing === e.id && 'bg-sky-50')}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-navy-900">{e.name}</p>
                  <p className="text-[13px] text-ink-muted">{e.refNo} · {e.category}{e.location ? ` · ${e.location}` : ''}</p>
                </div>
                {manage && <EditButton name={e.name} disabled={!!editing && editing !== e.id} onClick={() => setEditing(editing === e.id ? null : e.id)} />}
              </div>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-[13.5px]">
                <div><dt className="text-ink-muted">Total</dt><dd className="font-semibold tabular-nums text-navy-900">{e.totalQty}</dd></div>
                <div><dt className="text-ink-muted">Damaged</dt><dd className={cn('tabular-nums', e.damagedQty ? 'font-semibold text-warning' : 'text-ink-subtle')}>{e.damagedQty}</dd></div>
                <div><dt className="text-ink-muted">Missing</dt><dd className={cn('tabular-nums', e.missingQty ? 'font-semibold text-danger-ink' : 'text-ink-subtle')}>{e.missingQty}</dd></div>
              </dl>
              <div className="mt-2"><StatusBadges e={e} /></div>
              {editing === e.id && <div className="mt-3"><EditForm e={e} categories={categories} actor={actor} onDone={() => { setEditing(null); setTick((t) => t + 1) }} /></div>}
            </li>
          ))}
        </ul>
      </Card>
      <Panel className="mt-4" title="Inventory history">
        <ul className="space-y-1.5 text-[14.5px]">
          {(items ?? []).flatMap((e) => e.history.map((h) => ({ e, h }))).sort((a, b) => b.h.at.localeCompare(a.h.at)).slice(0, 12).map(({ e, h }, i) => (
            <li key={i} className="text-navy-900">{formatDateTime(h.at)} · <strong>{e.name}</strong>: {h.action}{h.detail ? ` (${h.detail})` : ''}</li>
          ))}
          {(items ?? []).every((e) => e.history.length === 0) && <li className="text-ink-muted">No changes recorded yet.</li>}
        </ul>
      </Panel>
    </>
  )
}

function AddForm({ onDone, actor, categories }: { onDone: () => void; actor: NonNullable<ReturnType<typeof useDocActor>>; categories: string[] }) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<EquipmentCategory>(categories[0] ?? '')
  const [description, setDescription] = useState('')
  const [qty, setQty] = useState('')
  const [location, setLocation] = useState('')
  const [err, setErr] = useState<string | null>(null)
  return (
    <Panel className="mb-4" title="Add equipment" subtitle="Type a new category to add a kind of equipment residents can borrow.">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <FieldLabel label="Name" required><TextInput value={name} onChange={(e) => setName(e.target.value)} /></FieldLabel>
        <FieldLabel label="Category" required hint="Choose one or type a new category.">
          <TextInput list="equipment-categories" value={category} onChange={(e) => setCategory(e.target.value)} />
        </FieldLabel>
        <FieldLabel label="Description"><TextInput value={description} onChange={(e) => setDescription(e.target.value)} /></FieldLabel>
        <FieldLabel label="Quantity" required><TextInput inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))} /></FieldLabel>
        <FieldLabel label="Where it is kept"><TextInput value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Barangay Hall storage" /></FieldLabel>
      </div>
      <CategoryList categories={categories} />
      {err && <p className="mt-2 text-[14.5px] text-danger-ink">{err}</p>}
      <div className="mt-3 flex gap-2">
        <Button onClick={async () => { try { if (!category.trim()) throw new ServiceError('category', 'Enter a category.'); await addEquipment({ name, category: category.trim(), description, totalQty: Number(qty), location: location.trim() || undefined }, actor); onDone() } catch (e) { setErr(e instanceof ServiceError ? e.message : 'Failed.') } }}>Save</Button>
        <Button variant="secondary" onClick={onDone}>Cancel</Button>
      </div>
    </Panel>
  )
}

function CategoryList({ categories }: { categories: string[] }) {
  return (
    <datalist id="equipment-categories">
      {categories.map((c) => <option key={c} value={c} />)}
    </datalist>
  )
}

function EditButton({ name, disabled, onClick }: { name: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`Edit ${name}`}
      title="Edit record"
      className="inline-grid size-9 place-items-center rounded-[var(--radius-control)] text-ink-nav transition-colors hover:bg-sky-100 hover:text-navy-900 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Pencil className="size-[18px]" />
    </button>
  )
}

/** Edit form: every field from "Add equipment" can be changed here. */
function EditForm({ e, actor, onDone, categories }: { e: Equipment; actor: NonNullable<ReturnType<typeof useDocActor>>; onDone: () => void; categories: string[] }) {
  const [v, setV] = useState({ name: e.name, category: e.category, description: e.description, location: e.location ?? '', totalQty: String(e.totalQty), damagedQty: String(e.damagedQty), missingQty: String(e.missingQty), maintenanceQty: String(e.maintenanceQty ?? 0) })
  const [err, setErr] = useState<string | null>(null)
  const set = (k: keyof typeof v, val: string) => setV((s) => ({ ...s, [k]: val }))
  const num = (k: 'totalQty' | 'damagedQty' | 'missingQty' | 'maintenanceQty') => (ev: { target: { value: string } }) => set(k, ev.target.value.replace(/\D/g, ''))
  const save = async () => {
    setErr(null)
    try {
      await updateEquipment(e.id, { name: v.name.trim(), category: v.category.trim(), description: v.description.trim(), location: v.location.trim() || undefined, totalQty: Number(v.totalQty), damagedQty: Number(v.damagedQty), missingQty: Number(v.missingQty), maintenanceQty: Number(v.maintenanceQty) }, actor)
      onDone()
    } catch (ex) {
      setErr(ex instanceof ServiceError ? ex.message : 'The record could not be saved.')
    }
  }
  return (
    <div className="rounded-[var(--radius-control)] border border-line bg-surface p-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FieldLabel label="Name" required><TextInput value={v.name} onChange={(ev) => set('name', ev.target.value)} /></FieldLabel>
        <FieldLabel label="Category" required><TextInput list="equipment-categories" value={v.category} onChange={(ev) => set('category', ev.target.value)} /></FieldLabel>
        <FieldLabel label="Description"><TextInput value={v.description} onChange={(ev) => set('description', ev.target.value)} /></FieldLabel>
        <FieldLabel label="Where it is kept"><TextInput value={v.location} onChange={(ev) => set('location', ev.target.value)} /></FieldLabel>
        <FieldLabel label="Total" required><TextInput inputMode="numeric" value={v.totalQty} onChange={num('totalQty')} /></FieldLabel>
        <FieldLabel label="Damaged"><TextInput inputMode="numeric" value={v.damagedQty} onChange={num('damagedQty')} /></FieldLabel>
        <FieldLabel label="Missing"><TextInput inputMode="numeric" value={v.missingQty} onChange={num('missingQty')} /></FieldLabel>
        <FieldLabel label="Under maintenance"><TextInput inputMode="numeric" value={v.maintenanceQty} onChange={num('maintenanceQty')} /></FieldLabel>
      </div>
      <CategoryList categories={categories} />
      {err && <p role="alert" className="mt-2 text-[14.5px] text-danger-ink">{err}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={onDone}>Cancel</Button>
        <Button size="sm" onClick={save}>Save</Button>
      </div>
    </div>
  )
}

/**
 * Units by status as small badges on one line. Overdue units are part of
 * Borrowed (not extra); pending requests are asked-for units, not yet set aside.
 */
function StatusBadges({ e }: { e: Equipment }) {
  const st = equipmentStatus(e)
  const items: [string, number, string, string?][] = [
    ['Available', st.available, 'bg-success-tint text-success'],
    ['Pending', st.pending, 'bg-warning-tint text-warning', 'Requested, not yet approved'],
    ['Reserved', st.reserved, 'bg-[#f1ecfb] text-[#6a3fb5]', 'Approved, not yet released'],
    ['Borrowed', st.borrowed, 'bg-info-tint text-info'],
    ['Overdue', st.overdue, 'bg-danger-tint text-danger-ink', 'Included in Borrowed'],
    ['Maintenance', st.maintenance, 'bg-neutral-tint text-ink-nav'],
  ]
  return (
    <span className="flex flex-wrap gap-1">
      {items.filter(([, n], i) => n > 0 || i === 0).map(([label, n, cls, title]) => (
        <span key={label} title={title} className={cn('inline-flex items-center gap-1 rounded px-1.5 text-[12.5px] leading-6 font-semibold whitespace-nowrap', cls)}>
          {label === 'Overdue' ? `${n} overdue` : <>{label} <span className="tabular-nums">{n}</span></>}
        </span>
      ))}
    </span>
  )
}
