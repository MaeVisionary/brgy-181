import type { AuditLogEntry, AuditOutcome } from '@/types/activity'
import type { User } from '@/types/auth'

/**
 * FRONTEND AUDIT TRAIL. Records report generation, exports, account and
 * security events and access to identifiable records. Real actions are kept
 * on this device (shared by its tabs, newest 2,000); sample entries made while
 * the demo data loads stay in memory, because the demo is rebuilt every start.
 * The backend must keep the real, tamper-protected log. Never pass personal
 * data into `recordRef`.
 */
const KEY = 'bmis.auditLog'
const MAX = 2000
const entries: AuditLogEntry[] = []
let keep = true
/** Demo loading only: entries made while paused are not saved on the device. */
export function pauseAuditSaving(paused: boolean) { keep = !paused }
const saved = (): AuditLogEntry[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] } }

export function audit(user: User, action: string, module: string, recordRef?: string, outcome: AuditOutcome = 'success', at?: string) {
  const entry = {
    id: `aud-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
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
  if (keep) { try { localStorage.setItem(KEY, JSON.stringify([entry, ...saved()].slice(0, MAX))) } catch { /* storage full or blocked */ } }
}

/** Newest first: this device's saved entries (all tabs) plus this tab's sample entries. */
export const listAudit = (): AuditLogEntry[] => {
  const byId = new Map<string, AuditLogEntry>()
  for (const e of [...entries, ...saved()]) byId.set(e.id, e)
  return [...byId.values()].sort((x, y) => y.timestamp.localeCompare(x.timestamp))
}
