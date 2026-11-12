/**
 * EMAIL (integration boundary).
 *
 * No email provider is connected in this frontend prototype, so nothing is
 * actually sent: every message is recorded with status 'not_configured' and
 * the screen says so. When the backend is ready, `send` calls a server
 * function (e.g. a Supabase Edge Function using an email provider's API key
 * kept on the server, never in the browser) and records 'sent' or 'failed'
 * from the provider's real response.
 */
export type EmailStatus = 'sent' | 'failed' | 'not_configured'

export interface EmailRecord {
  id: string
  to: string
  subject: string
  body: string
  status: EmailStatus
  at: string
  /** Provider message id or error, when a provider is connected. */
  detail?: string
  /** What the email is about (e.g. a registration reference). */
  ref: string
}

const KEY = 'bmis.emailLog'
const read = (): EmailRecord[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as EmailRecord[]
  } catch {
    return []
  }
}

/** True only when a real provider is wired in (never in this prototype). */
export const EMAIL_CONFIGURED = false

export async function sendEmail(msg: { to: string; subject: string; body: string; ref: string }): Promise<EmailRecord> {
  const rec: EmailRecord = {
    id: `eml-${Date.now().toString(36)}`,
    ...msg,
    status: EMAIL_CONFIGURED ? 'failed' : 'not_configured',
    at: new Date().toISOString(),
    detail: EMAIL_CONFIGURED ? 'Provider call not implemented.' : 'No email service is configured.',
  }
  try {
    localStorage.setItem(KEY, JSON.stringify([...read(), rec]))
  } catch {
    /* ignore */
  }
  return rec
}

export const emailsFor = (ref: string) => read().filter((e) => e.ref === ref)

export const EMAIL_STATUS_LABEL: Record<EmailStatus, string> = {
  sent: 'Email sent',
  failed: 'Email failed',
  not_configured: 'Email not sent (no email service configured)',
}
