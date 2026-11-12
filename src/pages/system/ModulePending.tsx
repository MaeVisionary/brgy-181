import { Hammer } from '@/icons'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Panel'

/**
 * Honest placeholder for modules not built yet. Routing and access checks
 * already apply; only the screen itself is scheduled for a later phase.
 */
export function ModulePending({ title, phase, summary }: { title: string; phase?: number; summary?: string }) {
  return (
    <>
      <PageHeader eyebrow={phase ? `Scheduled · Phase ${phase}` : 'Scheduled'} title={title} subtitle={summary} />
      <Card>
        <EmptyState
          icon={<Hammer className="size-5" />}
          title="This page is not available yet"
          body="Please check back later."
          action={<ButtonLink to="/dashboard" variant="secondary">Back to dashboard</ButtonLink>}
        />
      </Card>
    </>
  )
}
