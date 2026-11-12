import { Camera, CheckCircle2, CircleAlert, Clock, IdCard, Users } from '@/icons'
import type { LucideIcon } from '@/icons'
import { cn } from '@/lib/cn'
import type { CheckResult, ResidentRegistration } from '@/types/resident'

/**
 * Identity verification, as Barangay Personnel read it: one overall result,
 * four checks with one plain status each, only the issues that need action,
 * and what to do next. Built from the stored check results (nothing is
 * guessed or upgraded); the system's original messages stay in the activity
 * history.
 */

export type CheckStatus = 'Verified' | 'Needs Checking' | 'Not Completed' | 'Not Applicable'
export type Overall = 'Verified' | 'For Review' | 'Additional Information Needed' | 'Verification Incomplete'
interface Row { key: string; label: string; icon: LucideIcon; status: CheckStatus; detail?: string; issue?: string }

const from = (v: CheckResult | undefined): CheckStatus => (v === 'passed' ? 'Verified' : v === 'failed' || v === 'inconclusive' ? 'Needs Checking' : 'Not Completed')

export function verificationOf(r: ResidentRegistration) {
  const ev = r.evidence
  const v = r.verification
  const online = !!ev
  const expired = !!ev?.idExpiry && new Date(ev.idExpiry + 'T23:59:59+08:00').getTime() < Date.now()

  const record: Row = { key: 'record', label: 'Barangay Record', icon: Users, status: from(v.masterListMatch) }
  if (record.status !== 'Verified') record.issue = 'No matching resident record found. Check the master list; approving creates a new record.'
  if (record.status === 'Verified' && r.matchedResidentId) record.detail = 'Matches an existing resident'

  const id: Row = { key: 'id', label: 'ID Information', icon: IdCard, status: online ? from(v.ocr) : 'Not Applicable' }
  if (online && ev) id.detail = ev.idType
  if (expired) { id.status = 'Needs Checking'; id.issue = 'The ID has expired.' }
  else if (online && id.status !== 'Verified') id.issue = 'The ID name could not be clearly verified against the registered name.'

  // A face comparison that never ran is "Not Completed", never a pass.
  const compared = ev?.faceSimilarity !== undefined
  const photo: Row = { key: 'photo', label: 'Photo Verification', icon: Camera, status: !online ? 'Not Applicable' : !compared && v.faceMatch !== 'passed' ? 'Not Completed' : from(v.faceMatch) }
  if (compared) photo.detail = `${ev!.faceSimilarity}% similar`
  if (photo.status === 'Not Completed') photo.issue = 'The submitted photos could not be used for comparison.'
  else if (photo.status === 'Needs Checking') photo.issue = v.faceMatch === 'failed' ? 'The selfie does not look like the ID photo.' : 'The photo comparison was not certain.'

  const live: Row = { key: 'live', label: 'Live Photo Check', icon: Camera, status: !online ? 'Not Applicable' : v.liveness === 'passed' ? 'Verified' : 'Not Completed' }
  if (live.status === 'Not Completed') live.issue = 'A live photo was not submitted.'

  const rows = [record, id, photo, live]
  const extra: string[] = (ev?.reasons ?? []).filter((x) => /already has an active online account/i.test(x)).map(() => 'This resident already has an online account.')

  // "Verified" only when all four checks were actually verified; no online ID means identity rests on the record match alone.
  if (!online) extra.push('No ID or photos were submitted online; identity rests on the resident record match only.')
  const overall: Overall = rows.some((x) => x.status === 'Not Completed') ? 'Verification Incomplete'
    : expired || v.ocr === 'failed' ? 'Additional Information Needed'
    : rows.every((x) => x.status === 'Verified') && !extra.length ? 'Verified'
    : 'For Review'

  // Next steps that fit the actual results (only while the registration is still open).
  const steps: string[] = []
  if (!online) steps.push('No ID was submitted online: proceed with alternative identity verification, or verify at the Barangay Hall.')
  if (online && id.status === 'Needs Checking') steps.push(expired ? 'Ask for a valid ID; this one has expired.' : 'Review the submitted ID against the registered name, or request a clearer ID photo.')
  if (photo.status !== 'Verified' && online) steps.push('Ask the resident to complete photo verification, or compare the face in person.')
  if (live.status === 'Not Completed') steps.push('Ask for a live photo, or verify the resident in person.')
  if (record.status !== 'Verified') steps.push('Check the resident master list for this person before approving.')
  if (extra.length) steps.push('Check the existing account before approving a second one.')
  if (rows.filter((x) => x.status !== 'Verified' && x.status !== 'Not Applicable').length >= 2) steps.push('Request in-person verification at the Barangay Hall.')

  return { rows, overall, issues: [...rows.map((x) => x.issue).filter(Boolean) as string[], ...extra], steps }
}

const STATUS_STYLE: Record<CheckStatus, { icon: LucideIcon; cls: string }> = {
  Verified: { icon: CheckCircle2, cls: 'text-success' },
  'Needs Checking': { icon: CircleAlert, cls: 'text-warning' },
  'Not Completed': { icon: Clock, cls: 'text-ink-nav' },
  'Not Applicable': { icon: Clock, cls: 'text-ink-subtle' },
}
const OVERALL_STYLE: Record<Overall, string> = {
  Verified: 'text-success',
  'For Review': 'text-warning',
  'Additional Information Needed': 'text-warning',
  'Verification Incomplete': 'text-navy-900',
}

export function VerificationSummary({ r }: { r: ResidentRegistration }) {
  const { rows, overall, issues, steps } = verificationOf(r)
  const open = r.status === 'manual_review'
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-line-soft pb-3">
        <p className="text-[length:calc(15px*var(--fs))] text-ink-nav">Overall result</p>
        <p className={cn('font-display text-[length:calc(19px*var(--fs))] font-bold', OVERALL_STYLE[overall])}>{overall}</p>
      </div>

      <ul className="divide-y divide-line-soft">
        {rows.map((x) => {
          const S = STATUS_STYLE[x.status]
          return (
            <li key={x.key} className="flex min-h-[52px] items-center gap-3 py-2.5">
              <x.icon className="size-5 shrink-0 text-ink-nav" />
              <span className="min-w-0 flex-1">
                <span className="block text-[length:calc(16px*var(--fs))] font-semibold text-navy-900">{x.label}</span>
                {x.detail && <span className="block text-[length:calc(14.5px*var(--fs))] text-ink-nav">{x.detail}</span>}
              </span>
              <span className={cn('inline-flex shrink-0 items-center gap-1.5 text-[length:calc(15px*var(--fs))] font-semibold', S.cls)}>
                <S.icon className="size-[18px]" /> {x.status}
              </span>
            </li>
          )
        })}
      </ul>

      {issues.length > 0 && (
        <div className="mt-3 border-t border-line-soft pt-3">
          <p className="text-[length:calc(16px*var(--fs))] font-semibold text-navy-900">What needs attention?</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[length:calc(15.5px*var(--fs))] text-navy-900">{issues.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      )}

      {open && steps.length > 0 && (
        <div className="mt-3 border-t border-line-soft pt-3">
          <p className="text-[length:calc(16px*var(--fs))] font-semibold text-navy-900">Next step</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[length:calc(15.5px*var(--fs))] text-navy-900">{steps.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      )}
    </div>
  )
}
