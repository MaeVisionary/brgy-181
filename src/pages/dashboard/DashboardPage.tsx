import { useAuth } from '@/auth/useAuth'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Panel'
import { EmptyState } from '@/components/ui/EmptyState'
import { greeting } from '@/lib/format'
import { LayoutDashboard } from 'lucide-react'
import { SecretaryDashboard } from './SecretaryDashboard'

/** Sends each role to its own dashboard. */
export function DashboardPage() {
  const { user, role } = useAuth()
  if (!user || !role) return null

  if (user.roleId === 'secretary') return <SecretaryDashboard />

  return (
    <>
      <PageHeader eyebrow={role.name} title={`${greeting()}, ${user.fullName.split(' ')[0]}`} subtitle={role.description} />
      <Card>
        <EmptyState
          icon={<LayoutDashboard className="size-5" />}
          title={`${role.name} dashboard is scheduled for Phase 3`}
          body="The sidebar already shows only the modules this role can open. The dashboard content comes next, after you review the permission matrix."
        />
      </Card>
    </>
  )
}
