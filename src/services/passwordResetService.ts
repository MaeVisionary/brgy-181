import { mockNotifications } from '@/mocks/notifications'
import { mockUsers } from '@/mocks/users'
import { TEST_ACCOUNTS } from '@/config/testAccount'
import type { User } from '@/types/auth'
import { audit } from './auditService'
import { clearFailures, endSessionsFor, hashPassword, passwordProblem, setCredential } from './credentialStore'
import { sendEmail } from './emailService'
import { ServiceError, mockRequest } from './mockApi'

/**
 * PASSWORD RESET BY E-MAIL LINK.
 *
 * - The link carries a 256-bit random token (crypto.getRandomValues). Only its
 *   SHA-256 hash is stored; the token itself is never written to the activity
 *   log or the e-mail log (the log keeps "[reset link]").
 * - Valid for 15 minutes, single use; a new link or a successful reset cancels
 *   every other link for the account.
 * - Requests are limited (3 per address per 15 minutes) and wrong links are
 *   limited (5 per device per 15 minutes). Answers never reveal whether an
 *   account exists.
 * - After a reset every signed-in session of the account ends.
 * - System Administrator accounts cannot be reset by e-mail link: they use the
 *   controlled recovery (second-person approval). Barangay Personnel confirm
 *   their account number on the reset page as an extra check.
 *
 * PROTOTYPE LIMIT: no e-mail provider is connected, so links are not delivered.
 * In development the link appears in the development mailbox (memory only).
 * With Supabase this becomes Supabase Auth's password recovery (redirect URL
 * on HTTPS), and these records live server-side under row-level security.
 */

export const RESET_MINUTES = 15
type Purpose = 'reset' | 'setup' | 'recovery'
interface TokenRecord { hash: string; credentialKey: string; userId: string; purpose: Purpose; createdAt: string; expiresAt: string; usedAt?: string; cancelledAt?: string; recoveryId?: string; extraCheck?: 'account_no' }

const TOK_KEY = 'bmis.resetTokens'
const RATE_KEY = 'bmis.resetRate'
const read = <T,>(k: string, f: T): T => { try { return (JSON.parse(localStorage.getItem(k) ?? 'null') as T) ?? f } catch { return f } }
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* storage unavailable */ } }

const sha = async (s: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('')
const newToken = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

function limited(bucket: string, max: number, minutes: number): boolean {
  const all = read<Record<string, number[]>>(RATE_KEY, {})
  const now = Date.now()
  const recent = (all[bucket] ?? []).filter((t) => now - t < minutes * 60_000)
  if (recent.length >= max) return true
  all[bucket] = [...recent, now]
  write(RATE_KEY, all)
  return false
}
/** Is the bucket at its limit? (Does not count this call.) */
function atLimit(bucket: string, max: number, minutes: number): boolean {
  const now = Date.now()
  return (read<Record<string, number[]>>(RATE_KEY, {})[bucket] ?? []).filter((t) => now - t < minutes * 60_000).length >= max
}

/** Development only: delivered reset links, kept in memory (never stored). */
export const devMailbox: { at: string; to: string; subject: string; link: string }[] = []
const resetUrl = (token: string) => `${location.origin}${import.meta.env.BASE_URL}reset-password?token=${encodeURIComponent(token)}`

/** Which account an address belongs to (test accounts included). */
function accountFor(email: string): { user?: User; credentialKey: string; userId: string; email: string; isAdmin: boolean; personnel: boolean } | null {
  const e = email.trim().toLowerCase()
  const test = TEST_ACCOUNTS.find((a) => a.email === e)
  if (test) return { credentialKey: test.credentialKey, userId: `${test.idPrefix}system_admin`, email: test.email, isAdmin: true, personnel: true }
  const u = mockUsers.find((x) => x.email.toLowerCase() === e && x.status === 'active')
  if (!u) return null
  return { user: u, credentialKey: u.id, userId: u.id, email: u.email, isAdmin: u.roleId === 'system_admin', personnel: u.roleId !== 'resident' }
}

/** Creates a reset link for an account and "sends" it. Cancels the account's other links. */
export async function issueResetLink(a: { credentialKey: string; userId: string; email: string; personnel: boolean; name?: string }, purpose: Purpose, opts: { recoveryId?: string; to?: string } = {}): Promise<void> {
  const token = newToken()
  const now = new Date()
  const list = read<TokenRecord[]>(TOK_KEY, []).map((t) => (t.credentialKey === a.credentialKey && !t.usedAt && !t.cancelledAt ? { ...t, cancelledAt: now.toISOString() } : t))
  list.push({ hash: await sha(token), credentialKey: a.credentialKey, userId: a.userId, purpose, createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + RESET_MINUTES * 60_000).toISOString(), recoveryId: opts.recoveryId, extraCheck: a.personnel ? 'account_no' : undefined })
  write(TOK_KEY, list.slice(-200))
  const to = opts.to ?? a.email
  const subject = purpose === 'setup' ? 'Set up your Barangay 181 account password' : 'Reset your Barangay 181 password'
  const intro = purpose === 'setup' ? 'An account was created for you. Use this link to choose your password.' : 'We received a request to reset your password. Use this link to choose a new one.'
  // The e-mail log keeps the message without the link; the token is never stored in plain form.
  await sendEmail({ to, subject, body: `${intro}\n\n[reset link]\n\nThe link works once and expires in ${RESET_MINUTES} minutes. If you did not ask for this, you can ignore this e-mail; your password stays the same.\n\nBarangay 181`, ref: `reset:${a.userId}` })
  if (import.meta.env.DEV) devMailbox.unshift({ at: now.toISOString(), to, subject, link: resetUrl(token) })
}

/** Step 1 of "Forgot password": always the same answer, whether or not the address has an account. */
export function requestResetByEmail(email: string): Promise<void> {
  return mockRequest(() => email).then(async (raw) => {
    const e = raw.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new ServiceError('email', 'Please enter a valid email address, for example name@example.com.')
    if (limited(`req:${e}`, 3, 15) || limited('req:device', 10, 60)) throw new ServiceError('limit', 'Too many requests. Please wait 15 minutes before asking again.')
    const acc = accountFor(e)
    if (!acc) return
    const owner = acc.user ?? ({ id: acc.userId, roleId: 'system_admin', fullName: 'Test account' } as User)
    audit(owner, acc.isAdmin ? 'Password reset by e-mail refused (administrator account)' : 'Password reset link requested', 'Security', acc.email, acc.isAdmin ? 'failure' : 'success')
    if (acc.isAdmin) {
      // No e-mail reset for administrator accounts; the owner is told how to recover (nothing is revealed to anyone else).
      await sendEmail({ to: acc.email, subject: 'Password reset request for an administrator account', body: 'Administrator passwords cannot be reset by e-mail link. Use "I can\'t access my account" to start the controlled recovery, which needs another official\'s approval.\n\nBarangay 181', ref: `reset:${acc.userId}` })
      return
    }
    await issueResetLink(acc, 'reset')
  })
}

export interface TokenCheck { ok: true; name: string; needsAccountNo: boolean; purpose: Purpose }
const INVALID_LINK = 'This link is not valid any more. It may have expired (links work for 15 minutes), been used already, or been replaced by a newer one. Please ask for a new link.'

async function findToken(token: string): Promise<TokenRecord> {
  // Only invalid attempts count toward the limit; a valid link keeps working.
  if (atLimit('tok:device', 5, 15) && !(await isKnown(token))) throw new ServiceError('limit', 'Too many invalid links were tried. Please wait 15 minutes.')
  const h = await sha(token)
  const t = read<TokenRecord[]>(TOK_KEY, []).find((x) => x.hash === h)
  if (!t || t.usedAt || t.cancelledAt || new Date(t.expiresAt).getTime() < Date.now()) { limited('tok:device', 1_000, 15); throw new ServiceError('invalid', INVALID_LINK) }
  return t
}
const isKnown = async (token: string) => { const h = await sha(token); return read<TokenRecord[]>(TOK_KEY, []).some((x) => x.hash === h) }

/** Opens the Create New Password page. */
export async function checkResetToken(token: string): Promise<TokenCheck> {
  const t = await findToken(token)
  const u = mockUsers.find((x) => x.id === t.userId)
  return { ok: true, name: u?.fullName.split(' ')[0] ?? 'there', needsAccountNo: t.extraCheck === 'account_no' && !!u?.accountNo, purpose: t.purpose }
}

/** Saves the new password, uses up the link, cancels other links and ends every session of the account. */
export async function completeReset(token: string, password: string, confirm: string, accountNo?: string): Promise<void> {
  const t = await findToken(token)
  const u = mockUsers.find((x) => x.id === t.userId)
  if (t.extraCheck === 'account_no' && u?.accountNo && (accountNo ?? '').trim().toUpperCase() !== u.accountNo) {
    limited('tok:device', 1_000, 15)
    if (u) audit(u, 'Password reset failed: account number did not match', 'Security', undefined, 'failure')
    throw new ServiceError('account_no', 'That account number does not match. It is shown on your Account Settings page and starts with EMP-181.')
  }
  const problem = passwordProblem(password, { email: u?.email, username: u?.username })
  if (problem) throw new ServiceError('password', problem)
  if (password !== confirm) throw new ServiceError('confirm', 'The two passwords do not match. Please type the same password in both boxes.')
  const now = new Date().toISOString()
  setCredential(t.credentialKey, { hash: await hashPassword(t.credentialKey, password), mustChange: false, updatedAt: now })
  write(TOK_KEY, read<TokenRecord[]>(TOK_KEY, []).map((x) => (x.hash === t.hash ? { ...x, usedAt: now } : x.credentialKey === t.credentialKey && !x.usedAt && !x.cancelledAt ? { ...x, cancelledAt: now } : x)))
  endSessionsFor(t.credentialKey)
  if (u) { clearFailures(`login:${u.username.toLowerCase()}`); clearFailures(`login:${u.email.toLowerCase()}`) }
  const who = u ?? ({ id: t.userId, roleId: 'system_admin', fullName: 'Test account' } as User)
  audit(who, t.purpose === 'setup' ? 'Password set (account setup link)' : 'Password reset by e-mail link', 'Security', t.recoveryId ? `recovery ${t.recoveryId}` : undefined)
  const email = u?.email ?? TEST_ACCOUNTS.find((a) => a.credentialKey === t.credentialKey)?.email
  if (email) await sendEmail({ to: email, subject: 'Your Barangay 181 password was changed', body: `Your password was changed on ${new Date(now).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}. You were signed out everywhere.\n\nIf this was not you, contact the Barangay Hall right away.\n\nBarangay 181`, ref: `reset:${t.userId}` })
  if (u) mockNotifications.push({ id: `ntf-${Math.random().toString(36).slice(2, 9)}`, userId: u.id, category: 'system', title: 'Your password was changed', body: 'If this was not you, contact the Barangay Hall right away.', createdAt: now, read: false, link: '/account' })
  if (t.recoveryId) window.dispatchEvent(new CustomEvent('bmis:recovery-completed', { detail: t.recoveryId }))
}

/** System Administrator: e-mail a reset (or account setup) link. Personnel never see or set the password. */
export function sendResetLinkFor(userId: string, by: User, purpose: Purpose = 'reset'): Promise<void> {
  return mockRequest(() => {
    if (by.roleId !== 'system_admin') throw new ServiceError('forbidden', 'Only the System Administrator can send reset links.')
    if (userId === by.id) throw new ServiceError('self', 'Use "Forgot password" for your own account.')
    const u = mockUsers.find((x) => x.id === userId)
    const test = TEST_ACCOUNTS.find((a) => a.credentialKey === userId)
    if (!u && !test) throw new ServiceError('not_found', 'Account not found.')
    if (purpose === 'reset' && (test || u?.roleId === 'system_admin')) throw new ServiceError('admin', 'Administrator passwords are not reset from here. The owner uses Account Recovery, which needs the Punong Barangay\'s approval.')
    return u ? { credentialKey: u.id, userId: u.id, email: u.email, personnel: u.roleId !== 'resident', name: u.fullName } : { credentialKey: test!.credentialKey, userId: `${test!.idPrefix}system_admin`, email: test!.email, personnel: true, name: test!.name }
  }).then(async (a) => {
    await issueResetLink(a, purpose)
    audit(by, purpose === 'setup' ? 'Sent an account setup link' : 'Sent a password reset link', 'User accounts', a.name)
  })
}
