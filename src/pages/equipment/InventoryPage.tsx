import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/ui/Button'
import { FieldLabel, Select, TextInput } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, Panel } from '@/components/ui/Panel'
import { BORROWING } from '@/config/barangay'
import { useAsync } from '@/hooks/useAsync'
import { useDocActor } from '@/hooks/useDocActor'
import { formatDateTime } from '@/lib/format'
import { addEquipment, availableQty, borrowedQty, listEquipment, updateEquipment } from '@/services/equipmentService'
import { ServiceError } from '@/services/mockApi'
import type { Equipment, EquipmentCategory } from '@/types/equipment'
import { SampleBadge } from '@/pages/dashboard/shared'

/** Property and equipment records (FR21). */
export function InventoryPage() {
  const { can } = useAuth()
  const actor = useDocActor()!
  const [tick, setTick] = useState(0)
  const items = useAsync(listEquipment, [tick]).data
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const manage = can('inventory.manage')

  return (
    <>
      <PageHeader
        title="Property and Equipment Records"
        subtitle={`Barangay equipment lent to residents: ${BORROWING.documentedEquipment.join(', ').toLowerCase()} (study §1.4).`}
        actions={<><SampleBadge />{manage && <Button icon={<Plus className="size-4" />} onClick={() => setAdding((a) => !a)}>Add equipment</Button>}</>}
      />
      {adding && <AddForm onDone={() => { setAdding(false); setTick((t) => t + 1) }} actor={actor} />}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-[13px]">
            <thead>
              <tr className="bg-surface-muted text-left">{['Ref. no.', 'Equipment', 'Category', 'Total', 'Available', 'Borrowed', 'Damaged', 'Missing', ''].map((h) => <th key={h} className="label-caps px-4 py-2.5">{h}</th>)}</tr>
            </thead>
            <tbody>
              {(items ?? []).map((e) => (
                editing === e.id ? (
                  <EditRow key={e.id} e={e} actor={actor} onDone={() => { setEditing(null); setTick((t) => t + 1) }} />
                ) : (
                  <tr key={e.id} className="border-t border-line-soft">
                    <td className="px-4 py-3 text-ink-muted">{e.refNo}</td>
                    <td className="px-4 py-3"><span className="block font-semibold text-navy-900">{e.name}</span><span className="block text-[12px] text-ink-muted">{e.description}</span></td>
                    <td className="px-4 py-3">{e.category}</td>
                    <td className="px-4 py-3 tabular-nums">{e.totalQty}</td>
                    <td className="px-4 py-3 font-semibold tabular-nums text-navy-900">{availableQty(e)}</td>
                    <td className="px-4 py-3 tabular-nums">{borrowedQty(e.id)}</td>
                    <td className="px-4 py-3 tabular-nums">{e.damagedQty}</td>
                    <td className="px-4 py-3 tabular-nums">{e.missingQty}</td>
                    <td className="px-4 py-3 text-right">{manage && <Button size="sm" variant="ghost" onClick={() => setEditing(e.id)}>Edit</Button>}</td>
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

function AddForm({ onDone, actor }: { onDone: () => void; actor: NonNullable<ReturnType<typeof useDocActor>> }) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<EquipmentCategory>('Chairs')
  const [description, setDescription] = useState('')
  const [qty, setQty] = useState('')
  const [err, setErr] = useState<string | null>(null)
  return (
    <Panel className="mb-4" title="Add equipment">
      <div className="grid gap-3 sm:grid-cols-4">
        <FieldLabel label="Name" required><TextInput value={name} onChange={(e) => setName(e.target.value)} /></FieldLabel>
        <FieldLabel label="Category"><Select value={category} onChange={(e) => setCategory(e.target.value as EquipmentCategory)}>{BORROWING.documentedEquipment.map((c) => <option key={c}>{c}</option>)}</Select></FieldLabel>
        <FieldLabel label="Description"><TextInput value={description} onChange={(e) => setDescription(e.target.value)} /></FieldLabel>
        <FieldLabel label="Quantity" required><TextInput inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))} /></FieldLabel>
      </div>
      {err && <p className="mt-2 text-[12.5px] text-danger-ink">{err}</p>}
      <div className="mt-3 flex gap-2">
        <Button onClick={async () => { try { await addEquipment({ name, category, description, totalQty: Number(qty) }, actor); onDone() } catch (e) { setErr(e instanceof ServiceError ? e.message : 'Failed.') } }}>Save</Button>
        <Button variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </Panel>
  )
}

function EditRow({ e, actor, onDone }: { e: Equipment; actor: NonNullable<ReturnType<typeof useDocActor>>; onDone: () => void }) {
  const [v, setV] = useState({ totalQty: String(e.totalQty), damagedQty: String(e.damagedQty), missingQty: String(e.missingQty) })
  const num = (k: keyof typeof v) => (
    <TextInput className="h-8 w-20" inputMode="numeric" value={v[k]} onChange={(ev) => setV((s) => ({ ...s, [k]: ev.target.value.replace(/\D/g, '') }))} aria-label={k} />
  )
  return (
    <tr className="border-t border-line-soft bg-sky-50">
      <td className="px-4 py-2 text-ink-muted">{e.refNo}</td>
      <td className="px-4 py-2 font-semibold text-navy-900">{e.name}</td>
      <td className="px-4 py-2">{e.category}</td>
      <td className="px-4 py-2">{num('totalQty')}</td>
      <td className="px-4 py-2 text-ink-muted">–</td>
      <td className="px-4 py-2 text-ink-muted">–</td>
      <td className="px-4 py-2">{num('damagedQty')}</td>
      <td className="px-4 py-2">{num('missingQty')}</td>
      <td className="px-4 py-2 text-right">
        <span className="flex justify-end gap-1">
          <Button size="sm" onClick={async () => { await updateEquipment(e.id, { totalQty: Number(v.totalQty), damagedQty: Number(v.damagedQty), missingQty: Number(v.missingQty) }, actor); onDone() }}>Save</Button>
          <Button size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
        </span>
      </td>
    </tr>
  )
}
