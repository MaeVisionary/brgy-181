import { ChevronRight, Pencil, Plus, X } from '@/icons'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { DraftIndicator, DraftRecoveryCard, useDraft } from '@/hooks/useDraft'
import { focusFirstInvalid } from '@/lib/validation'
import { cn } from '@/lib/cn'
import { useAuth } from '@/auth/useAuth'
import { Button, ButtonLink } from '@/components/ui/Button'
import { FieldLabel, TextInput } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, Panel } from '@/components/ui/Panel'
import { BORROWING } from '@/config/barangay'
import { useAsync } from '@/hooks/useAsync'
import { useDocActor } from '@/hooks/useDocActor'
import { formatShortDate } from '@/lib/format'
import { addEquipment, equipmentStatus, listEquipment, updateEquipment } from '@/services/equipmentService'
import { ServiceError } from '@/services/mockApi'
import type { Equipment, EquipmentCategory } from '@/types/equipment'
import { ActionStack } from '@/components/ui/ActionStack'

/** Property and equipment records. */
export function InventoryPage() {
  const { can } = useAuth()
  const actor = useDocActor()!
  const [tick, setTick] = useState(0)
  const items = useAsync(listEquipment, [tick]).data
  const [adding, setAdding] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const manage = can('inventory.manage')
  const canBorrowing = can('borrowing.approve') || can('borrowing.release')
  const categories = [...new Set([...BORROWING.documentedEquipment, ...(items ?? []).map((e) => e.category)])]
  const selected = items?.find((e) => e.id === openId)
  const close = () => { setOpenId(null); setEditing(false) }

  return (
    <>
      <PageHeader
        title="Property and Equipment"
        actions={manage && <Button icon={<Plus className="size-4" />} onClick={() => setAdding((a) => !a)}>Add</Button>}
      />
      {adding && <AddForm categories={categories} onDone={() => { setAdding(false); setTick((t) => t + 1) }} actor={actor} />}
      <Card className="overflow-hidden">
        {/* Desktop and tablet */}
        <table className="hidden w-full text-[length:calc(15px*var(--fs))] md:table">
          <thead>
            <tr className="border-b border-line text-left text-[length:calc(13px*var(--fs))] font-semibold text-ink-nav">
              <th className="px-5 py-2.5">Equipment</th>
              <th className="px-3 py-2.5 text-right">Total</th>
              <th className="px-3 py-2.5 text-right">Available</th>
              <th className="px-3 py-2.5 text-right">Borrowed</th>
              <th className="px-3 py-2.5">Attention</th>
              <th className="w-10 px-3 py-2.5"><span className="sr-only">Open</span></th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map((e) => {
              const st = equipmentStatus(e)
              return (
                <tr key={e.id} onClick={() => setOpenId(e.id)} className="cursor-pointer border-t border-line-soft first:border-t-0 hover:bg-sky-50/60">
                  <td className="px-5 py-3">
                    <button type="button" onClick={() => setOpenId(e.id)} className="text-left font-semibold text-navy-900 hover:underline">{e.name}</button>
                    {e.location && <span className="block text-[length:calc(13.5px*var(--fs))] text-ink-muted">{e.location}</span>}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-navy-900">{e.totalQty}</td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums text-navy-900">{st.available}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-navy-900">{st.borrowed}</td>
                  <td className="px-3 py-3 text-[length:calc(14px*var(--fs))]"><Attention e={e} overdue={st.overdue} /></td>
                  <td className="px-3 py-3 text-ink-subtle"><ChevronRight className="size-4" /></td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Phones: settings-style list */}
        <ul className="divide-y divide-line-soft md:hidden">
          {(items ?? []).map((e) => {
            const st = equipmentStatus(e)
            const flag = st.overdue > 0 || e.missingQty > 0
            return (
              <li key={e.id}>
                <button type="button" onClick={() => setOpenId(e.id)} className="flex min-h-[60px] w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-muted">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-navy-900">{e.name}</span>
                    <span className="block text-[length:calc(14px*var(--fs))] text-ink-muted">{e.totalQty} total · {st.available} available</span>
                  </span>
                  {flag && <span aria-label="Needs attention" className="size-2 shrink-0 rounded-full bg-danger" />}
                  <ChevronRight className="size-4 shrink-0 text-ink-subtle" />
                </button>
              </li>
            )
          })}
        </ul>
      </Card>
      {(items ?? []).some((e) => e.history.length > 0) && <Panel className="mt-4" title="Inventory history">
        <ul className="space-y-1.5 text-[length:calc(14.5px*var(--fs))]">
          {(items ?? []).flatMap((e) => e.history.map((h) => ({ e, h }))).sort((a, b) => b.h.at.localeCompare(a.h.at)).slice(0, 12).map(({ e, h }, i) => (
            <li key={i} className="text-navy-900"><span className="text-ink-muted">{formatShortDate(h.at)}</span> · <strong>{e.name}</strong>: {h.action}{h.detail ? ` (${h.detail})` : ''}</li>
          ))}
        </ul>
      </Panel>}

      {selected && (
        <Sheet title={selected.name} onClose={close}>
          {editing ? (
            <EditForm e={selected} categories={categories} actor={actor} onDone={() => { setEditing(false); setTick((t) => t + 1) }} />
          ) : (
            <Detail e={selected} manage={manage} canBorrowing={canBorrowing} onEdit={() => setEditing(true)} />
          )}
        </Sheet>
      )}
    </>
  )
}

/** Only real problems: overdue, damaged, missing. */
function Attention({ e, overdue }: { e: Equipment; overdue: number }) {
  const parts = [
    overdue > 0 && <span key="o" className="font-semibold text-danger-ink">{overdue} overdue</span>,
    e.missingQty > 0 && <span key="m" className="font-semibold text-danger-ink">{e.missingQty} missing</span>,
    e.damagedQty > 0 && <span key="d" className="text-warning">{e.damagedQty} damaged</span>,
  ].filter(Boolean)
  if (!parts.length) return <span className="text-ink-subtle">–</span>
  return <span className="flex flex-wrap gap-x-2">{parts}</span>
}

function Detail({ e, manage, canBorrowing, onEdit }: { e: Equipment; manage: boolean; canBorrowing: boolean; onEdit: () => void }) {
  const st = equipmentStatus(e)
  // Units on hand minus units out or set aside; below zero means the records disagree.
  const balance = e.totalQty - e.damagedQty - e.missingQty - st.maintenance - st.reserved - st.borrowed
  const rows: [string, number, string?][] = [
    ['Borrowed', st.borrowed],
    ['Overdue', st.overdue, st.overdue ? 'text-danger-ink font-semibold' : undefined],
    ['Reserved', st.reserved],
    ['Pending requests', st.pending],
    ['Under maintenance', st.maintenance],
    ['Damaged', e.damagedQty, e.damagedQty ? 'text-warning font-semibold' : undefined],
    ['Missing', e.missingQty, e.missingQty ? 'text-danger-ink font-semibold' : undefined],
  ]
  return (
    <div>
      <div className="flex items-baseline gap-6">
        <p><span className="block font-display text-[length:calc(34px*var(--fs))] leading-none font-extrabold text-navy-900 tabular-nums">{st.available}</span><span className="text-[length:calc(14px*var(--fs))] text-ink-muted">Available</span></p>
        <p><span className="block font-display text-[length:calc(34px*var(--fs))] leading-none font-extrabold text-ink-nav tabular-nums">{e.totalQty}</span><span className="text-[length:calc(14px*var(--fs))] text-ink-muted">Total</span></p>
      </div>
      {balance < 0 && (
        <p role="alert" className="mt-3 rounded-md bg-danger-tint px-3 py-2 text-[length:calc(14.5px*var(--fs))] text-danger-ink">Counts don't add up: {-balance} more {-balance === 1 ? 'unit is' : 'units are'} out or set aside than on hand.</p>
      )}
      <dl className="mt-4 divide-y divide-line-soft border-y border-line-soft">
        {rows.map(([label, n, cls]) => (
          <div key={label} className="flex items-center justify-between py-2.5 text-[length:calc(15px*var(--fs))]">
            <dt className="text-navy-900">{label}</dt>
            <dd className={cn('tabular-nums', cls ?? (n ? 'text-navy-900' : 'text-ink-subtle'))}>{n}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[length:calc(14px*var(--fs))] text-ink-muted">{[e.refNo, e.category, e.location].filter(Boolean).join(' · ')}</p>
      {e.description && <p className="text-[length:calc(14px*var(--fs))] text-ink-muted">{e.description}</p>}
      {e.history.length > 0 && (
        <details className="mt-3 text-[length:calc(14.5px*var(--fs))]">
          <summary className="cursor-pointer font-semibold text-navy-900">History</summary>
          <ul className="mt-2 space-y-1">
            {[...e.history].sort((a, b) => b.at.localeCompare(a.at)).map((h, i) => (
              <li key={i} className="text-navy-900"><span className="text-ink-muted">{formatShortDate(h.at)}</span> · {h.action}{h.detail ? ` (${h.detail})` : ''}</li>
            ))}
          </ul>
        </details>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        {manage && <Button icon={<Pencil className="size-4" />} onClick={onEdit}>Edit equipment</Button>}
        {canBorrowing && <ButtonLink to="/borrowing" variant="secondary">Borrowing records</ButtonLink>}
      </div>
    </div>
  )
}

/** Bottom sheet on phones, centred dialog on larger screens. */
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-navy-900/35" />
      <div className="relative max-h-[88dvh] w-full overflow-y-auto rounded-t-2xl bg-surface px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl md:max-w-[480px] md:rounded-2xl md:pt-5">
        <span aria-hidden className="mx-auto mb-3 block h-1.5 w-10 rounded-full bg-line md:hidden" />
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="font-display text-[length:calc(20px*var(--fs))] font-bold text-navy-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="-mt-1 -mr-2 grid size-10 place-items-center rounded-full text-ink-nav hover:bg-surface-muted"><X className="size-5" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function AddForm({ onDone, actor, categories }: { onDone: () => void; actor: NonNullable<ReturnType<typeof useDocActor>>; categories: string[] }) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<EquipmentCategory>(categories[0] ?? '')
  const [description, setDescription] = useState('')
  const [qty, setQty] = useState('')
  const [location, setLocation] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)
  const draftValue = useMemo(() => ({ name, category, description, qty, location }), [name, category, description, qty, location])
  const draft = useDraft('add-equipment', draftValue, { isEmpty: (v) => !v.name.trim() && !v.qty && !v.description.trim() })
  const load = (d: typeof draftValue | null) => { if (d) { setName(d.name); setCategory(d.category); setDescription(d.description); setQty(d.qty); setLocation(d.location) } }
  const errors = {
    name: !name.trim() ? 'Please enter the name of the equipment. Example: Monobloc chair' : '',
    category: !category.trim() ? 'Please choose a category or type a new one.' : '',
    qty: !qty || Number(qty) < 1 ? 'Please enter how many there are (1 or more).' : '',
  }
  const show = (k: keyof typeof errors) => (touched ? errors[k] : '')
  const save = async () => {
    setTouched(true)
    if (Object.values(errors).some(Boolean)) { focusFirstInvalid(); return }
    try {
      await addEquipment({ name: name.trim(), category: category.trim(), description, totalQty: Number(qty), location: location.trim() || undefined }, actor)
      draft.clear()
      onDone()
    } catch (e) { setErr(e instanceof ServiceError ? e.message : 'The equipment could not be saved because of a problem on our side. What you typed is kept. Please press Save again.') }
  }
  return (
    <Panel className="mb-4" title="Add equipment" subtitle="Type a new category to add a kind of equipment residents can borrow.">
      {draft.recovered && <DraftRecoveryCard savedAt={draft.recovered.savedAt} onContinue={() => load(draft.resume())} onStartOver={draft.startOver} />}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <FieldLabel label="Name" required error={show('name')}><TextInput value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!show('name') || undefined} /></FieldLabel>
        <FieldLabel label="Category" required hint="Choose one or type a new category." error={show('category')}>
          <TextInput list="equipment-categories" value={category} onChange={(e) => setCategory(e.target.value)} aria-invalid={!!show('category') || undefined} />
        </FieldLabel>
        <FieldLabel label="Description"><TextInput value={description} onChange={(e) => setDescription(e.target.value)} /></FieldLabel>
        <FieldLabel label="Quantity" required error={show('qty')}><TextInput inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))} aria-invalid={!!show('qty') || undefined} /></FieldLabel>
        <FieldLabel label="Where it is kept"><TextInput value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Barangay Hall storage" /></FieldLabel>
      </div>
      <CategoryList categories={categories} />
      {err && <p role="alert" className="mt-2 text-[length:calc(15px*var(--fs))] text-danger-ink">{err}</p>}
      <DraftIndicator status={draft.status} className="mt-2" />
      <ActionStack className="mt-3">
        <Button onClick={save}>Save</Button>
        <Button variant="secondary" onClick={() => { draft.clear(); onDone() }}>Cancel</Button>
      </ActionStack>
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
      {err && <p role="alert" className="mt-2 text-[length:calc(14.5px*var(--fs))] text-danger-ink">{err}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={onDone}>Cancel</Button>
        <Button size="sm" onClick={save}>Save</Button>
      </div>
    </div>
  )
}

