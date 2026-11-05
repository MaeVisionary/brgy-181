import type { RoleId } from './auth'

export type NotificationCategory =
  | 'registration'
  | 'resident_change'
  | 'document'
  | 'complaint'
  | 'hearing'
  | 'borrowing'
  | 'system'

export interface AppNotification {
  id: string
  /** Recipient account. Users only ever see their own notifications. */
  userId: string
  category: NotificationCategory
  title: string
  body: string
  createdAt: string
  read: boolean
  /** In-app route to the related record. */
  link?: string
}

export type AuditOutcome = 'success' | 'failure'

export interface AuditLogEntry {
  id: string
  userId: string
  /** Role at the time of the action, not the current role. */
  roleAtTime: RoleId
  action: string
  module: string
  recordRef?: string
  changes?: { field: string; from: string; to: string }[]
  outcome: AuditOutcome
  timestamp: string
}
