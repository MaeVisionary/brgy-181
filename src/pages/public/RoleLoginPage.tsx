import { AlertCircle, ArrowLeft, Eye, EyeOff } from '@/icons'
import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useParams } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { BarangaySeal } from '@/components/layout/BarangaySeal'
import { Button } from '@/components/ui/Button'
import { accountTypeBySlug } from '@/config/accountTypes'
import { BARANGAY } from '@/config/barangay'
import { cn } from '@/lib/cn'
import { useSmoothNavigate } from '@/lib/transition'
import { ServiceError } from '@/services/mockApi'
import { PublicLayout } from './PublicLayout'

const field =
  'h-12 w-full rounded-lg border bg-surface px-4 text-[length:calc(17px*var(--fs))] text-navy-900 placeholder:text-ink-subtle transition-[border-color,box-shadow] duration-200 focus:border-navy-600 focus:shadow-[0_0_0_4px_rgba(44,88,113,0.12)] focus:outline-none'

/** Step 3: the sign-in form for the selected account type. */
export function RoleLoginPage() {
  const { role: slug } = useParams()
  const type = accountTypeBySlug(slug)
  const go = useSmoothNavigate()
  const { signIn } = useAuth()
  const from = (useLocation().state as { from?: string } | null)?.from
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [show, setShow] = useState(false)
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  if (!type) return <Navigate to="/portal" replace />
  const Icon = type.icon

  const idError = touched && !identifier.trim() ? 'Enter your username or email.' : touched && identifier.includes('@') && !/^\S+@\S+\.\S+$/.test(identifier.trim()) ? 'Enter a valid email address.' : null
  const pwError = touched && !password ? 'Enter your password.' : null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    setNotice(null)
    if (!identifier.trim() || !password || (identifier.includes('@') && !/^\S+@\S+\.\S+$/.test(identifier.trim()))) return
    setBusy(true)
    try {
      const result = await signIn({ roles: type.roles, identifier: identifier.trim(), password, remember })
      go(result.mustChangePassword ? '/account' : from && from.startsWith(type.slug === 'resident' ? '/my/' : '/') ? from : '/dashboard', 'forward')
    } catch (err) {
      setNotice(err instanceof ServiceError ? err.message : 'Sign-in failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <PublicLayout minimal>
      <div className="mx-auto max-w-[1000px] px-4 py-8 sm:px-6 sm:py-12">
        <button type="button" onClick={() => go('/portal', 'back')} className="bmis-press -ml-1 mb-4 inline-flex min-h-9 items-center gap-1.5 rounded-full px-1 text-[length:calc(15px*var(--fs))] font-semibold text-ink-muted hover:text-navy-900">
          <ArrowLeft className="size-4" /> Back to account selection
        </button>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        {/* Selected account type */}
        <aside className="bmis-rise relative flex min-h-[260px] flex-col overflow-hidden rounded-lg bg-gradient-to-b from-navy-900 to-navy-800 p-7 text-white md:min-h-[420px] md:p-8">
          <img aria-hidden alt="" src={`${import.meta.env.BASE_URL}seal.png`} className="pointer-events-none absolute -right-24 -bottom-28 w-[340px] max-w-none opacity-[0.07] grayscale select-none" />
          <div className="relative flex items-center gap-3">
            <BarangaySeal onDark className="size-11" />
            <span className="leading-tight">
              <span className="block font-display text-[length:calc(17px*var(--fs))] font-extrabold">{BARANGAY.name}</span>
              <span className="block text-[length:calc(14px*var(--fs))] text-white/70">Zone {BARANGAY.zone}, District {BARANGAY.district}, Manila</span>
            </span>
          </div>
          <div className="relative my-auto pt-8">
            <span className="grid size-11 place-items-center rounded-lg bg-white/10"><Icon className="size-5" /></span>
            <p className="mt-4 text-[length:calc(15.5px*var(--fs))] text-white/80">{type.slug === 'resident' ? 'Welcome!' : 'Welcome back!'}</p>
            <p className="font-display text-[length:calc(32px*var(--fs))] leading-[1.08] font-extrabold tracking-tight sm:text-[length:calc(38px*var(--fs))]">{type.title}</p>
            <p className="mt-2 text-[length:calc(15.5px*var(--fs))] text-white/80">{type.slug === 'resident' ? 'Sign in to request documents and follow your transactions.' : 'Sign in to access your Barangay 181 account.'}</p>
          </div>
        </aside>

        {/* Form */}
        <section className="bmis-rise bmis-rise-2 rounded-lg border border-line bg-surface p-7 md:p-9">
          <h1 className="font-display text-[length:calc(26px*var(--fs))] leading-tight font-extrabold tracking-tight text-navy-900 sm:text-[length:calc(28px*var(--fs))]">Login as {type.title}</h1>

          <form onSubmit={submit} noValidate className="mt-7 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[length:calc(15px*var(--fs))] font-semibold text-navy-900">Username or Email</span>
              <input
                className={cn(field, idError ? 'border-danger' : 'border-line')}
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                aria-invalid={!!idError}
                aria-describedby={idError ? 'id-err' : undefined}
              />
              {idError && <span id="id-err" className="mt-1 block text-[length:calc(14.5px*var(--fs))] text-danger-ink">{idError}</span>}
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[length:calc(15px*var(--fs))] font-semibold text-navy-900">Password</span>
              <span className="relative block">
                <input
                  className={cn(field, 'pr-12', pwError ? 'border-danger' : 'border-line')}
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={!!pwError}
                  aria-describedby={pwError ? 'pw-err' : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? 'Hide password' : 'Show password'}
                  className="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-ink-muted hover:text-navy-900"
                >
                  {show ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
                </button>
              </span>
              {pwError && <span id="pw-err" className="mt-1 block text-[length:calc(14.5px*var(--fs))] text-danger-ink">{pwError}</span>}
            </label>

            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-[length:calc(15px*var(--fs))] text-navy-900">
                <input type="checkbox" className="size-4 accent-[#002132]" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                Remember me
              </label>
              <button type="button" onClick={() => go(`/forgot-password/${type.slug}`, 'forward')} className="text-[length:calc(15px*var(--fs))] font-semibold text-info hover:underline">
                Forgot password?
              </button>
            </div>

            {notice && (
              <p role="alert" className="bmis-rise flex items-start gap-2.5 rounded-lg border border-danger/25 bg-danger-tint px-4 py-3 text-[length:calc(15px*var(--fs))] text-navy-900">
                <AlertCircle className="mt-px size-4 shrink-0 text-danger" />
                <span>
                  {notice}
                  {notice.startsWith('Status: Rejected') && (
                    <button type="button" onClick={() => go('/register', 'forward')} className="mt-1.5 block font-semibold text-info underline">
                      Register again
                    </button>
                  )}
                </span>
              </p>
            )}

            <Button type="submit" loading={busy} className="bmis-press h-12 w-full rounded-lg text-[length:calc(17px*var(--fs))]">
              Sign In
            </Button>
          </form>
          {type.slug === 'resident' && (
            <p className="mt-5 rounded-lg bg-surface-muted px-4 py-3 text-center text-[length:calc(15.5px*var(--fs))] text-navy-900">
              New resident?{' '}
              <button type="button" onClick={() => go('/register', 'forward')} className="font-semibold text-info hover:underline">
                Create an account
              </button>
            </p>
          )}
          <p className="mt-5 text-[length:calc(14px*var(--fs))] leading-relaxed text-ink-subtle">
            Your account and role are verified by the barangay's system before you can continue. Personal information is handled under the Data Privacy Act of
            2012 (RA 10173).
          </p>
        </section>
        </div>
      </div>
    </PublicLayout>
  )
}
