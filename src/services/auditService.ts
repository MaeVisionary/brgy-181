import type { AuditLogEntry, AuditOutcome } from '@/types/activity'
import type { User } from '@/types/auth'

/**
 * FRONTEND AUDIT TRAIL (in memory, this tab only). Records report generation,
 * exports and access to identifiable records. The backend must keep the real,
 * tamper-protected log. Never pass personal data into `recordRef`.
 */
const entries: AuditLogEntry[] = []

export function audit(user: User, action: string, module: string, recordRef?: string, outcome: AuditOutcome = 'success') {
  entries.unshift({
    id: `aud-${Date.now().toString(36)}-${entries.length}`,
    userId: user.id,
    roleAtTime: user.roleId,
    action,
    module,
    recordRef,
    outcome,
    timestamp: new Date().toISOString(),
  })
}

export const listAudit = (): AuditLogEntry[] => entries.slice()
