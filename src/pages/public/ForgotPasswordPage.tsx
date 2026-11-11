import { ArrowLeft, CheckCircle2, KeyRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { accountTypeBySlug } from '@/config/accountTypes'
import { cn } from '@/lib/cn'
import { useSmoothNavigate } from '@/lib/transition'
import { requestPasswordReset } from '@/services/authService'
import { PublicLayout } from './PublicLayout'

/** Password reset request. The System Administrator issues a temporary password. */
export function ForgotPasswordPage() {
  const { role: slug } = useParams()
  const type = accountTypeBySlug(slug)
  const go = useSmoothNavigate()
  const [identifier, setIdentifier] = useState('')
  const [touched, setTouched] = useState(false)
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!type) return <Navigate to="/portal" replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (!identifier.trim()) return
    setBusy(true)
    await requestPasswordReset(identifier, type.slug)
    setBusy(false)
    setSent(true)
  }

  return (
    <PublicLayout minimal>
      <div className="mx-auto max-w-[520px] px-4 py-12 sm:py-16">
        <section className="bmis-rise rounded-[24px] border border-line bg-surface p-7 md:p-9">
          <button type="button" onClick={() => go(`/login/${type.slug}`, 'back')} className="bmis-press -ml-1 inline-flex items-center gap-1.5 rounded-full px-1 text-[15px] font-semibold text-ink-muted hover:text-navy-900">
            <ArrowLeft className="size-4" /> Back to {type.loginTitle}
          </button>
          <span className="mt-6 grid size-12 place-items-center rounded-2xl bg-sky-100 text-navy-900"><KeyRound className="size-6" /></span>
          <h1 className="mt-4 font-display text-[26px] font-extrabold text-navy-900">Reset your password</h1>
          {sent ? (
            <div className="bmis-rise mt-4 space-y-3 text-[16px] text-navy-900">
              <p className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" /> Your request was sent to the System Administrator.</p>
              <p className="text-ink-muted">
                If an account matches, the administrator will set a temporary password and give it to you
                {type.slug === 'resident' ? ' after confirming your identity. You can also go to the Barangay 181 Hall with a valid ID.' : '.'} You will be asked to choose a new password when you sign in.
              </p>
              <Button variant="secondary" onClick={() => go(`/login/${type.slug}`, 'back')}>Back to sign in</Button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="mt-2 space-y-4">
              <p className="text-[16px] text-ink-muted">Enter the username or email of your {type.title} account.</p>
              <label className="block">
                <span className="mb-1.5 block text-[15px] font-semibold text-navy-900">Username or Email</span>
                <input
                  className={cn('h-12 w-full rounded-xl border bg-surface px-4 text-[17px] text-navy-900 focus:border-navy-600 focus:shadow-[0_0_0_4px_rgba(44,88,113,0.12)] focus:outline-none', touched && !identifier.trim() ? 'border-danger' : 'border-line')}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoComplete="username"
                />
                {touched && !identifier.trim() && <span className="mt-1 block text-[14.5px] text-danger-ink">Enter your username or email.</span>}
              </label>
              <Button type="submit" loading={busy} className="bmis-press h-12 w-full rounded-xl text-[17px]">Send reset request</Button>
            </form>
          )}
        </section>
      </div>
    </PublicLayout>
  )
}
