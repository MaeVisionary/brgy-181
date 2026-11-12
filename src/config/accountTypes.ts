import { Building2, Gavel, Landmark, Package, Wallet, ShieldCheck, UserRound, type LucideIcon } from '@/icons'
import type { RoleId } from '@/types/auth'

/** Account types offered on the portal's selection screen. */
export interface AccountType {
  slug: string
  title: string
  /** Heading on the login screen. */
  loginTitle: string
  description: string
  icon: LucideIcon
  /** Roles that sign in through this account type (checked by the backend). */
  roles: RoleId[]
  /** Help shown under "Forgot password?". */
  recovery: string
}

export const ACCOUNT_TYPES: AccountType[] = [
  {
    slug: 'system-administrator',
    title: 'System Administrator',
    loginTitle: 'System Administrator Login',
    description: 'Manage system configuration, user accounts and access permissions.',
    icon: ShieldCheck,
    roles: ['system_admin'],
    recovery: 'Administrator access is restored through the barangay\'s approved account recovery process.',
  },
  {
    slug: 'barangay-chairman',
    title: 'Barangay Chairman',
    loginTitle: 'Barangay Chairman Login',
    description: 'Access executive oversight, document approvals and authorized case information.',
    icon: Gavel,
    roles: ['chairman'],
    recovery: 'Ask the System Administrator to reset your password.',
  },
  {
    slug: 'barangay-secretary',
    title: 'Barangay Secretary',
    loginTitle: 'Barangay Secretary Login',
    description: 'Manage resident records, document requests, complaints and barangay administration.',
    icon: Building2,
    roles: ['secretary'],
    recovery: 'Ask the System Administrator to reset your password.',
  },
  {
    slug: 'barangay-kagawad',
    title: 'Barangay Kagawad',
    loginTitle: 'Barangay Kagawad Login',
    description: 'View community summaries, barangay reports and any functions assigned to your account.',
    icon: Landmark,
    roles: ['kagawad'],
    recovery: 'Ask the System Administrator to reset your password.',
  },
  {
    slug: 'barangay-treasurer',
    title: 'Barangay Treasurer',
    loginTitle: 'Barangay Treasurer Login',
    description: 'Record fees paid for barangay documents and view collection reports.',
    icon: Wallet,
    roles: ['treasurer'],
    recovery: 'Ask the System Administrator to reset your password.',
  },
  {
    slug: 'property-custodian',
    title: 'Property Custodian',
    loginTitle: 'Property Custodian Login',
    description: 'Manage barangay equipment, borrowing requests, releases and returns.',
    icon: Package,
    roles: ['property_custodian'],
    recovery: 'Ask the System Administrator to reset your password.',
  },
  {
    slug: 'resident',
    title: 'Resident',
    loginTitle: 'Resident Login',
    description: 'Access your personal records, request barangay documents and follow your submitted transactions.',
    icon: UserRound,
    roles: ['resident'],
    recovery: 'Visit the Barangay 181 Hall with a valid ID and the Barangay Secretary will help you regain access.',
  },
]

export const accountTypeBySlug = (slug: string | undefined) => ACCOUNT_TYPES.find((a) => a.slug === slug)
