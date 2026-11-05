import { useAuth } from '@/auth/useAuth'
import { ChairmanDashboard } from './ChairmanDashboard'
import { CustodianDashboard } from './CustodianDashboard'
import { AdminDashboard, KagawadDashboard, ResidentDashboard, StaffDashboard } from './OtherDashboards'
import { SecretaryDashboard } from './SecretaryDashboard'

/** Each role gets its own dashboard; none share the same layout. */
export function DashboardPage() {
  const { user } = useAuth()
  if (!user) return null
  switch (user.roleId) {
    case 'chairman':
      return <ChairmanDashboard />
    case 'secretary':
      return <SecretaryDashboard />
    case 'property_custodian':
      return <CustodianDashboard />
    case 'kagawad':
      return <KagawadDashboard />
    case 'system_admin':
      return <AdminDashboard />
    case 'resident':
      return <ResidentDashboard />
    default:
      return <StaffDashboard />
  }
}
