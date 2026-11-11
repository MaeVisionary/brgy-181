import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/ui/Button'
import { FieldLabel, TextInput } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, Panel } from '@/components/ui/Panel'
import { BORROWING } from '@/config/barangay'
import { useAsync } from '@/hooks/useAsync'
import { useDocActor } from '@/hooks/useDocActor'
import { formatDateTime } from '@/lib/format'
import { addEquipment, availableQty, borrowedQty, listEquipment, updateEquipment } from '@/services/equipmentService'
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
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-[13px]">
            <thead>
              <tr className="bg-surface-muted text-left">{['Ref. no.', 'Equipment', 'Category', 'Total', 'Available', 'Borrowed', 'Damaged', 'Missing', ''].map((h, i) => <th key={i} className="label-caps px-4 py-2.5">{h}</th>)}</tr>
            </thead>
            <tbody>
              {(items ?? []).map((e) => (
                editing === e.id ? (
                  <EditRow key={e.id} e={e} categories={categories} actor={actor} onDone={() => { setEditing(null); setTick((t) => t + 1) }} />
                ) : (
                  <tr key={e.id} className="border-t border-line-soft">
                    <td className="px-4 py-3 font-semibold whitespace-nowrap text-navy-900">{e.refNo}</td>
                    <td className="px-4 py-3"><span className="block font-semibold text-navy-900">{e.name}</span><span className="block text-[12px] text-ink-muted">{e.description}</span></td>
                    <td className="px-4 py-3">{e.category}</td>
                    <td className="px-4 py-3 tabular-nums">{e.totalQty}</td>
                    <td className="px-4 py-3 font-semibold tabular-nums text-navy-900">{availableQty(e)}</td>
                    <td className="px-4 py-3 tabular-nums">{borrowedQty(e.id)}</td>
                    <td className="px-4 py-3 tabular-nums">{e.damagedQty}</td>
                    <td className="px-4 py-3 tabular-nums">{e.missingQty}</td>
                    <td className="px-4 py-3 text-right">{manage && <Button size="sm" variant="secondary" disabled={!!editing} onClick={() => setEditing(e.id)}>Edit Record</Button>}</td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Panel className="mt-4" title="Inventory history">
        <ul className="space-y-1.5 text-[12.5px]">
          {(items ?? []).flatMap((e) => e.history.map((h) => ({ e, h }))).sort((a, b) => b.h.at.localeCompare(a.h.at)).slice(0, 12).map(({ e, h }, i) => (
            <li key={i} className="text-navy-900">{formatDateTime(h.at)} · <strong>{e.name}</strong>: {h.action}{h.detail ? ` (${h.detail})` : ''}</li>
          ))}
          {(items ?? []).every((e) => e.history.length === 0) && <li className="text-ink-muted">No changes recorded in this session.</li>}
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
  const [err, setErr] = useState<string | null>(null)
  return (
    <Panel className="mb-4" keepSubtitle title="Add equipment" subtitle="Type a new category to add a kind of equipment residents can borrow.">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FieldLabel label="Name" required><TextInput value={name} onChange={(e) => setName(e.target.value)} /></FieldLabel>
        <FieldLabel label="Category" required hint="Choose one or type a new category.">
          <TextInput list="equipment-categories" value={category} onChange={(e) => setCategory(e.target.value)} />
        </FieldLabel>
        <FieldLabel label="Description"><TextInput value={description} onChange={(e) => setDescription(e.target.value)} /></FieldLabel>
        <FieldLabel label="Quantity" required><TextInput inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))} /></FieldLabel>
      </div>
      <CategoryList categories={categories} />
      {err && <p className="mt-2 text-[12.5px] text-danger-ink">{err}</p>}
      <div className="mt-3 flex gap-2">
        <Button onClick={async () => { try { if (!category.trim()) throw new ServiceError('category', 'Enter a category.'); await addEquipment({ name, category: category.trim(), description, totalQty: Number(qty) }, actor); onDone() } catch (e) { setErr(e instanceof ServiceError ? e.message : 'Failed.') } }}>Save</Button>
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

/** Inline edit: every field from "Add equipment" can be changed here. */
function EditRow({ e, actor, onDone, categories }: { e: Equipment; actor: NonNullable<ReturnType<typeof useDocActor>>; onDone: () => void; categories: string[] }) {
  const [v, setV] = useState({ name: e.name, category: e.category, description: e.description, totalQty: String(e.totalQty), damagedQty: String(e.damagedQty), missingQty: String(e.missingQty) })
  const [err, setErr] = useState<string | null>(null)
  const set = (k: keyof typeof v, val: string) => setV((s) => ({ ...s, [k]: val }))
  const num = (k: 'totalQty' | 'damagedQty' | 'missingQty', label: string) => (
    <TextInput className="h-9 w-20" inputMode="numeric" value={v[k]} onChange={(ev) => set(k, ev.target.value.replace(/\D/g, ''))} aria-label={label} />
  )
  const save = async () => {
    setErr(null)
    try {
      await updateEquipment(e.id, { name: v.name.trim(), category: v.category.trim(), description: v.description.trim(), totalQty: Number(v.totalQty), damagedQty: Number(v.damagedQty), missingQty: Number(v.missingQty) }, actor)
      onDone()
    } catch (ex) {
      setErr(ex instanceof ServiceError ? ex.message : 'The record could not be saved.')
    }
  }
  return (
    <>
      <tr className="border-t border-line-soft bg-sky-50 align-top">
        <td className="px-4 py-2.5 font-semibold whitespace-nowrap text-navy-900">{e.refNo}</td>
        <td className="space-y-1.5 px-4 py-2.5">
          <TextInput className="h-9" value={v.name} onChange={(ev) => set('name', ev.target.value)} aria-label="Equipment name" />
          <TextInput className="h-9" value={v.description} onChange={(ev) => set('description', ev.target.value)} placeholder="Description" aria-label="Description" />
        </td>
        <td className="px-4 py-2.5"><TextInput className="h-9 w-32" list="equipment-categories" value={v.category} onChange={(ev) => set('category', ev.target.value)} aria-label="Category" /><CategoryList categories={categories} /></td>
        <td className="px-4 py-2.5">{num('totalQty', 'Total')}</td>
        <td className="px-4 py-2.5 pt-4 text-ink-muted">–</td>
        <td className="px-4 py-2.5 pt-4 text-ink-muted">–</td>
        <td className="px-4 py-2.5">{num('damagedQty', 'Damaged')}</td>
        <td className="px-4 py-2.5">{num('missingQty', 'Missing')}</td>
        <td className="px-4 py-2.5 text-right">
          <span className="flex justify-end gap-2">
            <Button size="sm" onClick={save}>Save</Button>
            <Button size="sm" variant="secondary" onClick={onDone}>Cancel</Button>
          </span>
        </td>
      </tr>
      {err && (
        <tr className="bg-sky-50">
          <td colSpan={9} className="px-4 pb-2.5 text-[12.5px] text-danger-ink">{err}</td>
        </tr>
      )}
    </>
  )
}
