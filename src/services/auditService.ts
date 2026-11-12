import type { AuditLogEntry, AuditOutcome } from '@/types/activity'
import type { User } from '@/types/auth'

/**
 * FRONTEND AUDIT TRAIL (in memory, this tab only). Records report generation,
 * exports and access to identifiable records. The backend must keep the real,
 * tamper-protected log. Never pass personal data into `recordRef`.
 */
const entries: AuditLogEntry[] = []

export function audit(user: User, action: string, module: string, recordRef?: string, outcome: AuditOutcome = 'success', at?: string) {
  const entry = {
    id: `aud-${Date.now().toString(36)}-${entries.length}`,
    userId: user.id,
    roleAtTime: user.roleId,
    action,
    module,
    recordRef,
    outcome,
    timestamp: at ?? new Date().toISOString(),
  }
  // Entries replayed with an earlier time (sample records) keep the newest-first order.
  const i = entries.findIndex((e) => e.timestamp <= entry.timestamp)
  if (i === -1) entries.push(entry); else entries.splice(i, 0, entry)
}

export const listAudit = (): AuditLogEntry[] => entries.slice()
