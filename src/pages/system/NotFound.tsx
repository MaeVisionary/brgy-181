import { SearchX } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Card } from '@/components/ui/Panel'

export function NotFound() {
  return (
    <Card>
      <EmptyState
        icon={<SearchX className="size-5" />}
        title="Page not found"
        body="The address may be mistyped, or the page has moved."
        action={<ButtonLink to="/dashboard" variant="secondary">Back to dashboard</ButtonLink>}
      />
    </Card>
  )
}
