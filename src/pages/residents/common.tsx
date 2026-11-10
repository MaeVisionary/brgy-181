import { Badge } from '@/components/ui/Badge'
import type { Resident } from '@/types/resident'
import { ageOn } from '@/documents/fill'

export const fullName = (r: Resident) => [r.firstName, r.middleName, r.lastName, r.suffix].filter(Boolean).join(' ')
export const age = (r: Resident) => ageOn(r.birthDate)

export const CIVIL_LABEL: Record<Resident['civilStatus'], string> = {
  single: 'Single',
  married: 'Married',
  widowed: 'Widowed',
  separated: 'Separated',
  live_in: 'Live-in',
}

export function SectorBadges({ r }: { r: Resident }) {
  const s = r.sectors
  return (
    <span className="flex flex-wrap gap-1">
      {s.seniorCitizen && <Badge dot={false} tone="info">Senior citizen</Badge>}
      {s.pwd && <Badge dot={false} tone="info">PWD</Badge>}
      {s.soloParent && <Badge dot={false} tone="info">Solo parent</Badge>}
      {s.fourPs && <Badge dot={false} tone="info">4Ps</Badge>}
      {s.programBeneficiary && <Badge dot={false} tone="neutral">Beneficiary</Badge>}
    </span>
  )
}

export function RegistrationBadge({ status }: { status: Resident['registrationStatus'] }) {
  const map = {
    verified: ['Verified account', 'success'],
    not_registered: ['No portal account', 'warning'],
    pending_verification: ['Pending verification', 'warning'],
    manual_review: ['Manual review', 'warning'],
    rejected: ['Registration denied', 'danger'],
  } as const
  const [label, tone] = map[status]
  return <Badge tone={tone}>{label}</Badge>
}
