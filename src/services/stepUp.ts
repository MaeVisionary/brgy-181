import type { User } from '@/types/auth'
import { audit } from './auditService'
import { verifyOwnPassword } from './authService'
import { ServiceError } from './mockApi'

/**
 * STEP-UP CONFIRMATION for critical security changes (roles, permissions).
 *
 * The acting user re-enters their password. The confirmation is bound to the
 * exact change (actor, action and a fingerprint of the payload), expires
 * after 5 minutes, allows 5 attempts and can be used once. Changing the
 * requested change after confirming needs a new confirmation.
 *
 * A one-time code (OTP by authenticator app or email) needs the backend: the
 * code must be generated and checked on the server (e.g. Supabase Auth MFA),
 * never in the browser. Until then, password re-entry is the step-up used.
 */
interface Challenge {
  id: string
  actorId: string
  action: string
  fingerprint: string
  expiresAt: number
  attempts: number
  verified: boolean
  used: boolean
}

const TTL_MS = 5 * 60_000
const MAX_ATTEMPTS = 5
const challenges = new Map<string, Challenge>()

/** Canonical form of the change: every key at every level, in sorted order. */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(',')}}`
  return JSON.stringify(v) ?? 'null'
}
const fingerprint = (payload: unknown) => canonical(payload)

function randomId() {
  const b = new Uint8Array(16)
  crypto.getRandomValues(b)
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
}

export function startChallenge(by: User, action: string, payload: object): string {
  // A new challenge replaces any earlier open one for the same person and action.
  for (const [k, c] of challenges) if (c.actorId === by.id && c.action === action && !c.used) challenges.delete(k)
  const id = randomId()
  challenges.set(id, { id, actorId: by.id, action, fingerprint: fingerprint(payload), expiresAt: Date.now() + TTL_MS, attempts: 0, verified: false, used: false })
  audit(by, `Confirmation requested: ${action}`, 'Security')
  return id
}

export async function verifyChallenge(id: string, password: string, by: User): Promise<void> {
  const c = challenges.get(id)
  if (!c || c.actorId !== by.id || c.used) throw new ServiceError('invalid', 'Start again.')
  if (Date.now() > c.expiresAt) throw new ServiceError('expired', 'This confirmation expired. Start again.')
  if (c.attempts >= MAX_ATTEMPTS) throw new ServiceError('locked', 'Too many attempts. Start again in a few minutes.')
  c.attempts++
  if (!(await verifyOwnPassword(by, password))) {
    audit(by, `Confirmation failed: ${c.action}`, 'Security', undefined, 'failure')
    throw new ServiceError('wrong', `That password is not correct. ${MAX_ATTEMPTS - c.attempts} attempt${MAX_ATTEMPTS - c.attempts === 1 ? '' : 's'} left.`)
  }
  c.verified = true
  audit(by, `Confirmation verified: ${c.action}`, 'Security')
}

/** Called by the service that makes the change: the confirmation must match this exact change. */
export function consumeChallenge(id: string | undefined, by: User, action: string, payload: object): void {
  const c = id ? challenges.get(id) : undefined
  if (!c || !c.verified || c.used || c.actorId !== by.id || c.action !== action || Date.now() > c.expiresAt || c.fingerprint !== fingerprint(payload)) {
    audit(by, `Blocked unconfirmed change: ${action}`, 'Security', undefined, 'failure')
    throw new ServiceError('step_up', 'Confirm this change with your password first.')
  }
  c.used = true
}
