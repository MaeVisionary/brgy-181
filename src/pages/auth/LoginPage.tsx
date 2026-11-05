import { AlertCircle, Eye, EyeOff } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { BarangaySeal } from '@/components/layout/BarangaySeal'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Panel'
import { APP_CONFIG } from '@/config/app'
import { ROLES } from '@/config/permissions'
import { listDemoUsers } from '@/services/authService'
import { ServiceError } from '@/services/mockApi'

const inputClass =
  'h-10 w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 text-[14px] text-navy-900 placeholder:text-ink-subtle focus:border-navy-600 focus:outline-none'

export function LoginPage() {
  const { user, login, switchUser } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to={from} replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) {
      setError('Enter your username and password.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await login(username, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex items-center gap-3">
          <BarangaySeal className="size-11 text-[12px]" />
          <div className="leading-tight">
            <p className="font-display text-[18px] font-extrabold text-navy-900">{APP_CONFIG.barangayName}</p>
            <p className="text-[12px] text-ink-muted">{APP_CONFIG.systemName}</p>
          </div>
        </div>

        <Card className="px-6 py-6 sm:px-7">
          <h1 className="font-display text-[22px] font-extrabold text-navy-900">Sign in</h1>
          <p className="mt-1 text-[13px] text-ink-muted">Use the account issued by the barangay.</p>

          <form onSubmit={onSubmit} className="mt-5 space-y-4" noValidate>
            <label className="block">
              <span className="mb-1.5 block text-[12.5px] font-semibold text-navy-900">Username</span>
              <input className={inputClass} autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12.5px] font-semibold text-navy-900">Password</span>
              <span className="relative block">
                <input
                  className={inputClass + ' pr-10'}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-ink-muted hover:text-navy-900"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </span>
            </label>

            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-[var(--radius-control)] bg-danger-tint px-3 py-2.5 text-[12.5px] text-danger-ink">
                <AlertCircle className="mt-px size-4 shrink-0" />
                {error}
              </p>
            )}

            <Button type="submit" loading={submitting} className="w-full">
              Sign in
            </Button>
          </form>
          <p className="mt-4 text-[12px] text-ink-muted">
            Forgot your password? Visit the Barangay Hall or contact the System Administrator.
          </p>
        </Card>

        {APP_CONFIG.demoMode && (
          <Card className="mt-4 px-5 py-4">
            <p className="label-caps">Demo accounts</p>
            <p className="mt-1 text-[12px] text-ink-muted">Simulated sign-in for frontend testing. Pick a role to preview it.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {listDemoUsers().map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    switchUser(u.id)
                    navigate('/dashboard', { replace: true })
                  }}
                  className="rounded-[var(--radius-control)] border border-line px-3 py-2 text-left hover:bg-sky-50"
                >
                  <span className="block text-[12.5px] font-semibold text-navy-900">{ROLES[u.roleId].name}</span>
                  <span className="block text-[11px] text-ink-muted">{u.username}</span>
                </button>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
