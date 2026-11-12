import { Navigate } from 'react-router-dom'
import { APP_CONFIG } from '@/config/app'
import { devMailbox } from '@/services/passwordResetService'
import { PublicLayout } from './PublicLayout'

/**
 * DEVELOPMENT ONLY: no e-mail provider is connected, so reset and setup links
 * are shown here (memory only, this tab) to test the flow. Not in production builds.
 */
export function DevMailboxPage() {
  if (!APP_CONFIG.devPreview) return <Navigate to="/" replace />
  return (
    <PublicLayout minimal>
      <div className="mx-auto max-w-[760px] px-4 py-8">
        <p className="text-[length:calc(13.5px*var(--fs))] font-semibold tracking-wide text-warning uppercase">Development only</p>
        <h1 className="font-display text-[length:calc(24px*var(--fs))] font-extrabold text-navy-900">Test mailbox</h1>
        <p className="mt-1 text-[length:calc(15.5px*var(--fs))] text-ink-nav">Links "sent" in this browser tab since it was opened. Real e-mail delivery needs the backend.</p>
        <ul className="mt-4 divide-y divide-line-soft rounded-lg border border-line bg-surface">
          {devMailbox.length === 0 ? <li className="px-4 py-4 text-ink-nav">Nothing yet.</li> : devMailbox.map((m) => (
            <li key={m.at + m.link} className="px-4 py-3 text-[length:calc(15.5px*var(--fs))]">
              <p className="font-semibold text-navy-900">{m.subject}</p>
              <p className="text-ink-nav">To {m.to} · {new Date(m.at).toLocaleString()}</p>
              <a className="mt-1 inline-flex min-h-11 items-center font-semibold break-all text-info hover:underline" href={m.link}>Open link</a>
            </li>
          ))}
        </ul>
      </div>
    </PublicLayout>
  )
}
