import { Plus, RotateCcw, Trash2 } from '@/icons'
import { useState } from 'react'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/ui/Button'
import { TextInput } from '@/components/ui/Field'
import { getDocumentType, requirementOverrides } from '@/documents/catalog'
import { ServiceError } from '@/services/mockApi'
import { canEditRequirements, resetRequirements, saveRequirements } from '@/services/requirementService'
import type { DocumentTypeId } from '@/types/document'

/** Requirements are configured by the barangay (no legal list is assumed by the system). */
export function RequirementsEditor({ typeId, onSaved }: { typeId: DocumentTypeId; onSaved: () => void }) {
  const { user } = useAuth()
  const [items, setItems] = useState(() => getDocumentType(typeId).requirements.map((r) => r.label))
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const custom = !!requirementOverrides()[typeId]
  const editable = canEditRequirements(user)

  const save = async () => {
    setError(null)
    try {
      await saveRequirements(typeId, items, user!)
      setItems(getDocumentType(typeId).requirements.map((r) => r.label))
      setEditing(false)
      onSaved()
    } catch (e) {
      setError(e instanceof ServiceError ? e.message : 'Could not save.')
    }
  }

  return (
    <div className="mt-4 rounded-[var(--radius-control)] border border-line px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="label-caps">Requirements {custom && <span className="normal-case tracking-normal text-info">(set by the barangay)</span>}</p>
        {editable && !editing && (
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>Edit requirements</Button>
        )}
      </div>
      {!editing ? (
        items.length ? (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] text-navy-900">{items.map((l) => <li key={l}>{l}</li>)}</ul>
        ) : (
          <p className="mt-2 text-[15px] text-ink-muted">Not specified yet.</p>
        )
      ) : (
        <div className="mt-3 space-y-2">
          {items.map((l, i) => (
            <div key={i} className="flex gap-2">
              <TextInput aria-label={`Requirement ${i + 1}`} value={l} onChange={(e) => setItems((a) => a.map((x, j) => (j === i ? e.target.value : x)))} />
              <Button size="sm" variant="secondary" aria-label="Remove requirement" icon={<Trash2 className="size-3.5" />} onClick={() => setItems((a) => a.filter((_, j) => j !== i))}>
                Remove
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" variant="secondary" icon={<Plus className="size-3.5" />} onClick={() => setItems((a) => [...a, ''])}>Add requirement</Button>
            <Button size="sm" onClick={save}>Save requirements</Button>
            <Button size="sm" variant="secondary" onClick={() => { setItems(getDocumentType(typeId).requirements.map((r) => r.label)); setEditing(false); setError(null) }}>Cancel</Button>
            {custom && (
              <Button size="sm" variant="secondary" icon={<RotateCcw className="size-3.5" />} onClick={async () => { await resetRequirements(typeId, user!); setItems(getDocumentType(typeId).requirements.map((r) => r.label)); setEditing(false) }}>
                Reset to default
              </Button>
            )}
          </div>
          {error && <p role="alert" className="text-[14.5px] text-danger-ink">{error}</p>}
        </div>
      )}
    </div>
  )
}
