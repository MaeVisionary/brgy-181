import { ShieldX } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Card } from '@/components/ui/Panel'

export function AccessDenied() {
  return (
    <Card>
      <EmptyState
        icon={<ShieldX className="size-5" />}
        title="You don't have access to this page"
        body="Your account's role does not include this module. If you need it for your work, ask the System Administrator."
        action={<ButtonLink to="/dashboard" variant="secondary">Back to dashboard</ButtonLink>}
      />
    </Card>
  )
}
