/**
 * PROTOTYPE credential store (browser localStorage, this device only).
 * Stores SHA-256 hashes, never plain passwords. Replaced by server-side
 * password hashing (NFR5) in the backend phase.
 */

const CRED_KEY = 'bmis.credentials'
const FAIL_KEY = 'bmis.failedSignIns'
const RESET_KEY = 'bmis.resetRequests'

export interface Credential {
  hash: string
  mustChange: boolean
  updatedAt: string
}

export interface ResetRequest {
  id: string
  identifier: string
  accountType: string
  requestedAt: string
  status: 'pending' | 'done'
  resolvedAt?: string
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable */
  }
}

export async function hashPassword(credentialKey: string, password: string): Promise<string> {
  const data = new TextEncoder().encode(`${credentialKey}:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const getCredential = (key: string): Credential | undefined => read<Record<string, Credential>>(CRED_KEY, {})[key]

export function setCredential(key: string, c: Credential) {
  const all = read<Record<string, Credential>>(CRED_KEY, {})
  all[key] = c
  write(CRED_KEY, all)
}

export const failedCount = (id: string) => read<Record<string, number>>(FAIL_KEY, {})[id] ?? 0
export function addFailure(id: string) {
  const all = read<Record<string, number>>(FAIL_KEY, {})
  all[id] = (all[id] ?? 0) + 1
  write(FAIL_KEY, all)
  return all[id]
}
export function clearFailures(id: string) {
  const all = read<Record<string, number>>(FAIL_KEY, {})
  delete all[id]
  write(FAIL_KEY, all)
}

export const listResetRequests = (): ResetRequest[] => read<ResetRequest[]>(RESET_KEY, [])

export function addResetRequest(identifier: string, accountType: string) {
  const all = listResetRequests()
  all.unshift({ id: `rst-${Date.now().toString(36)}`, identifier: identifier.trim().toLowerCase(), accountType, requestedAt: new Date().toISOString(), status: 'pending' })
  write(RESET_KEY, all.slice(0, 50))
}

export function resolveResetRequests(identifiers: string[]) {
  const ids = identifiers.map((i) => i.toLowerCase())
  write(
    RESET_KEY,
    listResetRequests().map((r) => (r.status === 'pending' && ids.includes(r.identifier) ? { ...r, status: 'done', resolvedAt: new Date().toISOString() } : r)),
  )
}

/** Readable temporary password (no look-alike characters). */
export function temporaryPassword(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  const body = [...bytes].map((b) => alphabet[b % alphabet.length]).join('')
  return `${body.slice(0, 5)}-${body.slice(5)}`
}

/**
 * Rules for new passwords (NIST SP 800-63B style): at least 12 characters, long
 * passphrases welcome (up to 128), no forced mix of symbols or capitals, and
 * common or easily guessed passwords refused. Existing passwords keep working;
 * the rules apply when a password is set. A breached-password check (e.g. the
 * Have I Been Pwned range API) belongs on the server when the backend exists.
 */
export const PASSWORD_MIN = 12
const COMMON = ['password', 'qwerty', '123456', '12345678', '123456789', '1234567890', 'iloveyou', 'admin', 'welcome', 'letmein', 'monkey', 'dragon', 'sunshine', 'princess', 'football', 'baseball', 'barangay', 'brgy181', 'barangay181', 'manila', 'tondo', 'philippines', 'pilipinas', 'mahalkita', 'iloveyou1', 'abcdefgh', 'aaaaaaaa', 'passw0rd', 'changeme', 'resident', 'kapetuwingumagasatondo']
export function passwordProblem(pw: string, ctx: { email?: string; username?: string } = {}): string | null {
  if (pw.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters. A short sentence you can remember works well, for example "kape tuwing umaga sa Tondo".`
  if (pw.length > 128) return 'Use 128 characters or fewer.'
  const low = pw.toLowerCase().replace(/\s+/g, '')
  if (/^(.)\1+$/.test(low) || /^(0123456789|1234567890|abcdefghijkl)/.test(low)) return 'This password is too easy to guess. Please choose another.'
  if (COMMON.some((c) => low === c || low.replace(/\d+$/, '') === c || low.replace(/[^a-z]/g, '') === c)) return 'This password is commonly used and easy to guess. Please choose another.'
  const local = ctx.email?.split('@')[0]?.toLowerCase()
  if ((local && local.length >= 4 && low.includes(local)) || (ctx.username && ctx.username.length >= 4 && low.includes(ctx.username.toLowerCase()))) return 'Do not use your username or email in your password.'
  return null
}

// ── Ending sessions after a password reset ───────────────────────────
const EPOCH_KEY = 'bmis.sessionEpoch'
/** Sessions of this account started before this moment are no longer valid. */
export const sessionsValidFrom = (credentialKey: string): string | undefined => read<Record<string, string>>(EPOCH_KEY, {})[credentialKey]
export function endSessionsFor(credentialKey: string) {
  const all = read<Record<string, string>>(EPOCH_KEY, {})
  all[credentialKey] = new Date().toISOString()
  write(EPOCH_KEY, all)
}

// ── Password change limit ────────────────────────────────────────────

const CHANGE_KEY = 'bmis.passwordChanges'
/** Own password changes allowed per account within the window (forced changes after a reset are not counted). */
export const PASSWORD_CHANGE_LIMIT = 3
export const PASSWORD_CHANGE_WINDOW_DAYS = 30

function recentChanges(key: string, now = Date.now()): string[] {
  const all = read<Record<string, string[]>>(CHANGE_KEY, {})
  const since = now - PASSWORD_CHANGE_WINDOW_DAYS * 86_400_000
  return (all[key] ?? []).filter((at) => new Date(at).getTime() >= since)
}

/** How many more times this account may change its password in the current window. */
export function passwordChangesLeft(key: string): number {
  return Math.max(0, PASSWORD_CHANGE_LIMIT - recentChanges(key).length)
}

/** Date the next change becomes available when the limit is reached. */
export function nextPasswordChangeAt(key: string): Date | null {
  const recent = recentChanges(key).sort()
  if (recent.length < PASSWORD_CHANGE_LIMIT) return null
  return new Date(new Date(recent[0]).getTime() + PASSWORD_CHANGE_WINDOW_DAYS * 86_400_000)
}

export function recordPasswordChange(key: string) {
  const all = read<Record<string, string[]>>(CHANGE_KEY, {})
  all[key] = [...recentChanges(key), new Date().toISOString()]
  write(CHANGE_KEY, all)
}
