import { TEST_ACCOUNTS, testUserFor } from '@/config/testAccount'
import type { RoleId, User } from '@/types/auth'
import type { ResidentRegistration } from '@/types/resident'

/**
 * ONE set of rules for account lists and account counts. The System
 * Administrator's dashboard cards and the User Accounts page both use these,
 * so a card's number is always the number of rows its link shows.
 */
export type AccountRow = User & { test?: boolean }
export type AccountGroup = 'all' | 'personnel' | 'residents'
export type AccountStatus = 'active' | 'inactive' | 'pending'
export const ACCOUNT_GROUPS: readonly AccountGroup[] = ['all', 'personnel', 'residents']
export const ACCOUNT_STATUSES: readonly AccountStatus[] = ['active', 'inactive', 'pending']
export const ACCOUNT_STATUS_LABEL: Record<AccountStatus, string> = { active: 'Active', inactive: 'Inactive', pending: 'Pending verification' }

/** Every account the administrator manages: the project's test accounts and all user accounts. */
export function accountRows(users: User[]): AccountRow[] {
  return [
    ...TEST_ACCOUNTS.map((a) => ({ ...testUserFor('system_admin', a), id: a.credentialKey, position: 'Test account (all levels)', test: true })),
    ...users,
  ]
}

/** The newest registration behind a resident account. */
export const registrationFor = (u: User, regs: ResidentRegistration[]) =>
  regs.filter((r) => r.accountUserId === u.id).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0]

/**
 * Status shown for an account:
 * - Inactive: the account is switched off (deactivated, suspended or not yet approved).
 * - Pending verification: a resident account that can sign in while its registration still waits for review.
 * - Active: everything else that can sign in.
 * Each account has exactly one status, so the three counts add up to the total.
 */
export function accountStatus(u: User, regs: ResidentRegistration[]): AccountStatus {
  if (u.status !== 'active') return 'inactive'
  if (u.roleId === 'resident' && registrationFor(u, regs)?.status === 'manual_review') return 'pending'
  return 'active'
}

export const inGroup = (u: User, g: AccountGroup) => g === 'all' || (g === 'residents' ? u.roleId === 'resident' : u.roleId !== 'resident')

export interface AccountFilter { group: AccountGroup; status: AccountStatus | 'all'; role: RoleId | '' }

/** The rows a filter shows (search is applied by the page on top of this). */
export function filterAccounts(rows: AccountRow[], f: AccountFilter, regs: ResidentRegistration[]): AccountRow[] {
  return rows.filter((u) => inGroup(u, f.group) && (f.status === 'all' || accountStatus(u, regs) === f.status) && (!f.role || (!u.test && u.roleId === f.role)))
}
