import { AlertCircle, ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Navigate, useParams } from 'react-router-dom'
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
  'h-12 w-full rounded-xl border bg-surface px-4 text-[15px] text-navy-900 placeholder:text-ink-subtle transition-[border-color,box-shadow] duration-200 focus:border-navy-600 focus:shadow-[0_0_0_4px_rgba(44,88,113,0.12)] focus:outline-none'

/** Step 3: the sign-in form for the selected account type. */
export function RoleLoginPage() {
  const { role: slug } = useParams()
  const type = accountTypeBySlug(slug)
  const go = useSmoothNavigate()
  const { signIn } = useAuth()
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
      go(result.mustChangePassword ? '/account' : '/dashboard', 'forward')
    } catch (err) {
      setNotice(err instanceof ServiceError ? err.message : 'Sign-in failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <PublicLayout minimal>
      <div className="mx-auto grid max-w-[980px] gap-6 px-4 py-10 sm:px-6 sm:py-14 md:grid-cols-[0.9fr_1.1fr]">
        {/* Selected account type */}
        <aside className="bmis-rise relative overflow-hidden rounded-[24px] bg-navy-900 p-7 text-white md:p-8">
          <div aria-hidden className="absolute -right-24 -bottom-24 size-72 rounded-full border border-white/10" />
          <div aria-hidden className="absolute -right-10 -bottom-10 size-44 rounded-full border border-white/10" />
          <div className="relative flex items-center gap-3">
            <BarangaySeal className="size-11" />
            <span className="leading-tight">
              <span className="block font-display text-[15px] font-extrabold">{BARANGAY.name}</span>
              <span className="block text-[12px] text-white/70">Zone {BARANGAY.zone}, District {BARANGAY.district}, Manila</span>
            </span>
          </div>
          <span className="relative mt-10 grid size-14 place-items-center rounded-2xl bg-white/10">
            <Icon className="size-7" />
          </span>
          <p className="relative mt-4 text-[12px] font-semibold tracking-[0.08em] text-white/60 uppercase">Account type</p>
          <p className="relative font-display text-[22px] font-extrabold">{type.title}</p>
          <p className="relative mt-2 text-[14px] leading-relaxed text-white/80">{type.description}</p>
        </aside>

        {/* Form */}
        <section className="bmis-rise bmis-rise-2 rounded-[24px] border border-line bg-surface p-7 md:p-9">
          <button type="button" onClick={() => go('/portal', 'back')} className="bmis-press -ml-1 inline-flex items-center gap-1.5 rounded-full px-1 text-[13px] font-semibold text-ink-muted hover:text-navy-900">
            <ArrowLeft className="size-4" /> Back to account selection
          </button>
          <h1 className="mt-5 font-display text-[26px] leading-tight font-extrabold tracking-tight text-navy-900">{type.loginTitle}</h1>
          <p className="mt-1.5 text-[14px] text-ink-muted">
            {type.slug === 'resident' ? 'Welcome! Sign in to request documents and follow your transactions.' : 'Welcome back. Sign in to access your Barangay 181 account.'}
          </p>

          <form onSubmit={submit} noValidate className="mt-7 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold text-navy-900">Username or Email</span>
              <input
                className={cn(field, idError ? 'border-danger' : 'border-line')}
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                aria-invalid={!!idError}
                aria-describedby={idError ? 'id-err' : undefined}
              />
              {idError && <span id="id-err" className="mt-1 block text-[12.5px] text-danger-ink">{idError}</span>}
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold text-navy-900">Password</span>
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
              {pwError && <span id="pw-err" className="mt-1 block text-[12.5px] text-danger-ink">{pwError}</span>}
            </label>

            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-[13px] text-navy-900">
                <input type="checkbox" className="size-4 accent-[#002132]" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                Remember me
              </label>
              <button type="button" onClick={() => go(`/forgot-password/${type.slug}`, 'forward')} className="text-[13px] font-semibold text-info hover:underline">
                Forgot password?
              </button>
            </div>

            {notice && (
              <p role="alert" className="bmis-rise flex items-start gap-2.5 rounded-xl border border-danger/25 bg-danger-tint px-4 py-3 text-[13px] text-navy-900">
                <AlertCircle className="mt-px size-4 shrink-0 text-danger" />
                {notice}
              </p>
            )}

            <Button type="submit" loading={busy} className="bmis-press h-12 w-full rounded-xl text-[15px]">
              Sign In
            </Button>
          </form>
          <p className="mt-5 text-[12px] leading-relaxed text-ink-subtle">
            Your account and role are verified by the barangay's system before you can continue. Personal information is handled under the Data Privacy Act of
            2012 (RA 10173).
          </p>
        </section>
      </div>
    </PublicLayout>
  )
}
