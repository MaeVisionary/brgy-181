import { SealWatermark } from '@/components/layout/SealWatermark'
import { ArrowLeft, CheckCircle2, KeyRound } from '@/icons'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { accountTypeBySlug } from '@/config/accountTypes'
import { cn } from '@/lib/cn'
import { useSmoothNavigate } from '@/lib/transition'
import { ServiceError } from '@/services/mockApi'
import { RESET_MINUTES, requestResetByEmail } from '@/services/passwordResetService'
import { PublicLayout } from './PublicLayout'

/** Shared frame for the password and recovery pages (same width and spacing on every step). */
export function AuthFrame({ back, backLabel, title, children }: { back: () => void; backLabel: string; title: string; children: ReactNode }) {
  return (
    <PublicLayout minimal>
      <div className="relative overflow-hidden">
        <SealWatermark size={480} className="hidden 2xl:block" />
        <div className="relative mx-auto max-w-[560px] px-3 py-6 sm:px-4 sm:py-14">
          <section className="bmis-rise rounded-lg border border-line bg-surface p-5 sm:p-8">
            <button type="button" onClick={back} className="bmis-press -ml-1 inline-flex min-h-11 items-center gap-1.5 rounded-full px-1 text-[length:calc(15px*var(--fs))] font-semibold text-ink-muted hover:text-navy-900">
              <ArrowLeft className="size-4" /> {backLabel}
            </button>
            <span className="mt-5 grid size-12 place-items-center rounded-lg bg-sky-100 text-navy-900"><KeyRound className="size-6" /></span>
            <h1 className="mt-4 font-display text-[length:calc(26px*var(--fs))] font-extrabold text-navy-900">{title}</h1>
            {children}
          </section>
        </div>
      </div>
    </PublicLayout>
  )
}
export const authField = (bad?: boolean) => cn('h-12 w-full rounded-lg border bg-surface px-4 text-[length:calc(17px*var(--fs))] text-navy-900 focus:border-navy-600 focus:shadow-[0_0_0_4px_rgba(44,88,113,0.12)] focus:outline-none', bad ? 'border-danger' : 'border-line')

/** Forgot password: e-mail → the same confirmation whether or not an account exists. */
export function ForgotPasswordPage() {
  const { role: slug } = useParams()
  const type = accountTypeBySlug(slug)
  const go = useSmoothNavigate()
  const [email, setEmail] = useState('')
  const [touched, setTouched] = useState(false)
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  if (!type) return <Navigate to="/portal" replace />
  const bad = touched && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setTouched(true); setErr(null)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return
    setBusy(true)
    try { await requestResetByEmail(email); setSent(true) } catch (x) { setErr(x instanceof ServiceError ? x.message : 'Please try again.') } finally { setBusy(false) }
  }

  return (
    <AuthFrame back={() => go(`/login/${type.slug}`, 'back')} backLabel={`Back to ${type.loginTitle}`} title="Reset your password">
      {sent ? (
        <div className="bmis-rise mt-4 space-y-3 text-[length:calc(16.5px*var(--fs))] text-navy-900">
          <p className="flex items-start gap-2"><CheckCircle2 className="icon-line w-5 text-success" /> Check your e-mail.</p>
          <p>If an account uses <strong className="break-all">{email.trim()}</strong>, {type.slug === 'system-administrator' ? 'we sent the steps to recover it.' : <>we sent a link to reset your password. The link works once and expires in {RESET_MINUTES} minutes.</>}</p>
          <p className="text-ink-nav">No e-mail after a few minutes? Check your spam folder, or ask for a new link.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="secondary" onClick={() => { setSent(false); setTouched(false) }}>Send another link</Button>
            <Button onClick={() => go(`/login/${type.slug}`, 'back')}>Back to sign in</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="mt-2 space-y-4">
          <p className="text-[length:calc(16.5px*var(--fs))] text-ink-nav">Enter the e-mail address of your {type.title} account. {type.slug === 'system-administrator' ? 'For security, administrator passwords are not reset by link alone: we e-mail you the steps, and the Punong Barangay must approve the recovery.' : 'We will send you a link to choose a new password.'}</p>
          <label className="block">
            <span className="mb-1.5 block text-[length:calc(16px*var(--fs))] font-semibold text-navy-900">Registered e-mail</span>
            <input type="email" className={authField(bad)} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" aria-invalid={bad || undefined} />
            {bad && <span className="mt-1.5 block text-[length:calc(15px*var(--fs))] text-danger-ink">Please enter a valid email address, for example name@example.com.</span>}
          </label>
          {err && <p role="alert" className="text-[length:calc(15.5px*var(--fs))] text-danger-ink">{err}</p>}
          <Button type="submit" loading={busy} size="lg" className="w-full">Send reset link</Button>
          <button type="button" onClick={() => go(`/account-recovery/new?type=${type.slug === 'resident' ? 'resident' : 'personnel'}`, 'forward')} className="block min-h-11 w-full text-center text-[length:calc(16px*var(--fs))] font-semibold text-info hover:underline">
            I can't access my registered e-mail
          </button>
        </form>
      )}
    </AuthFrame>
  )
}
