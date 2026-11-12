import { useState } from 'react'
import { useAuth } from '@/auth/useAuth'
import { ActionStack } from '@/components/ui/ActionStack'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { FieldLabel, Select, TextArea } from '@/components/ui/Field'
import { Card } from '@/components/ui/Panel'
import { formatDateTime } from '@/lib/format'
import { userById } from '@/mocks/users'
import { ServiceError } from '@/services/mockApi'
import { IN_PERSON_WHEN_LABEL, canSetPolicy, saveVerificationPolicy, verificationPolicy, type VerificationPolicy } from '@/services/verificationPolicy'

/** Barangay 181's rules for registrations without a valid ID. Everyone who reviews can read them; only the Punong Barangay changes them (with a reason, logged). */
export function VerificationPolicyPanel() {
  const { user } = useAuth()
  const [pol, setPol] = useState(verificationPolicy())
  const [edit, setEdit] = useState(false)
  const [draft, setDraft] = useState({ docs: pol.documentCategories.join('\n'), sources: pol.endorsementSources.join('\n'), when: pol.inPersonWhen, reason: '', approve: false })
  const [err, setErr] = useState<string | null>(null)
  if (!user) return null
  const save = async () => {
    setErr(null)
    try {
      const next = await saveVerificationPolicy({ documentCategories: draft.docs.split('\n'), endorsementSources: draft.sources.split('\n'), inPersonWhen: draft.when }, draft.approve, draft.reason, user)
      setPol(next); setEdit(false)
    } catch (e) { setErr(e instanceof ServiceError ? e.message : 'Not saved.') }
  }
  return (
    <Card className="mt-4 px-4 py-4 sm:px-5">
      <details>
        <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center justify-between gap-2">
          <span className="font-display text-[length:calc(18px*var(--fs))] font-bold text-navy-900">Verification rules for registrations without a valid ID</span>
          <Badge tone={pol.status === 'approved' ? 'success' : 'warning'}>{pol.status === 'approved' ? `Approved (version ${pol.version})` : 'Proposed, awaiting approval'}</Badge>
        </summary>
        {!edit ? (
          <div className="mt-3 space-y-2 text-[length:calc(15.5px*var(--fs))] text-navy-900">
            <p><strong>Supporting documents accepted for review:</strong> {pol.documentCategories.join('; ')}.</p>
            <p><strong>Who may endorse:</strong> {pol.endorsementSources.join('; ')}.</p>
            <p><strong>In-person verification:</strong> {IN_PERSON_WHEN_LABEL[pol.inPersonWhen]}.</p>
            <p><strong>Verified by:</strong> {pol.verifiedBy}. <strong>Approved by:</strong> {pol.approvedBy}.</p>
            <p><strong>Evidence required:</strong> {pol.requiredEvidence}</p>
            <p><strong>Escalation:</strong> {pol.escalation}</p>
            {pol.updatedAt && <p className="text-ink-nav">Last changed {formatDateTime(pol.updatedAt)} by {userById(pol.updatedBy!)?.fullName}: {pol.reason}</p>}
            <p className="text-ink-nav">These are barangay rules, to be confirmed against applicable laws and barangay resolutions. No document or endorsement is sufficient by itself.</p>
            {canSetPolicy(user) && <Button size="sm" variant="secondary" onClick={() => setEdit(true)}>Change the rules</Button>}
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <FieldLabel label="Supporting document types (one per line)"><TextArea className="min-h-[120px]" value={draft.docs} onChange={(e) => setDraft({ ...draft, docs: e.target.value })} /></FieldLabel>
            <FieldLabel label="Who may endorse (one per line)"><TextArea className="min-h-[100px]" value={draft.sources} onChange={(e) => setDraft({ ...draft, sources: e.target.value })} /></FieldLabel>
            <FieldLabel label="In-person verification">
              <Select value={draft.when} onChange={(e) => setDraft({ ...draft, when: e.target.value as VerificationPolicy['inPersonWhen'] })}>
                {Object.entries(IN_PERSON_WHEN_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </FieldLabel>
            <FieldLabel label="Reason or barangay resolution" required><TextArea className="min-h-[64px]" value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} /></FieldLabel>
            <label className="flex min-h-11 items-center gap-2 text-[length:calc(15.5px*var(--fs))] text-navy-900"><input type="checkbox" className="size-5 accent-[#002132]" checked={draft.approve} onChange={(e) => setDraft({ ...draft, approve: e.target.checked })} /> These rules were reviewed and approved for Barangay 181</label>
            {err && <p role="alert" className="text-[length:calc(15px*var(--fs))] text-danger-ink">{err}</p>}
            <ActionStack><Button size="sm" onClick={save}>Save rules</Button><Button size="sm" variant="secondary" onClick={() => setEdit(false)}>Cancel</Button></ActionStack>
          </div>
        )}
      </details>
    </Card>
  )
}
