import { CheckCircle2, Eye, EyeOff, ShieldAlert } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/ui/Button'
import { FieldLabel, TextInput } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, Panel } from '@/components/ui/Panel'
import { TEST_ACCOUNT, isTestUser } from '@/config/testAccount'
import { initials } from '@/lib/format'
import { audit } from '@/services/auditService'
import { getCredential, hashPassword, passwordProblem, setCredential } from '@/services/credentialStore'

/** Account settings for every role: profile summary and password change. */
export function AccountPage() {
  const { user, role, mustChangePassword, passwordChanged } = useAuth()
  const navigate = useNavigate()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!user || !role) return null

  const key = isTestUser(user.id) ? TEST_ACCOUNT.credentialKey : user.id
  const existing = getCredential(key)?.hash ?? (isTestUser(user.id) ? TEST_ACCOUNT.passwordHash : undefined)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setDone(false)
    if (existing && (await hashPassword(key, current)) !== existing) return setError('Your current password is incorrect.')
    const problem = passwordProblem(next)
    if (problem) return setError(problem)
    if (next !== confirm) return setError('The new passwords do not match.')
    if (next === current) return setError('Choose a password different from your current one.')
    setBusy(true)
    setCredential(key, { hash: await hashPassword(key, next), mustChange: false, updatedAt: new Date().toISOString() })
    audit(user, 'Changed own password', 'Account')
    setBusy(false)
    setCurrent('')
    setNext('')
    setConfirm('')
    setDone(true)
    if (mustChangePassword) {
      passwordChanged()
      navigate('/dashboard')
    }
  }

  const pw = (value: string, set: (v: string) => void, auto: string) => (
    <TextInput type={show ? 'text' : 'password'} autoComplete={auto} value={value} onChange={(e) => set(e.target.value)} />
  )

  return (
    <>
      <PageHeader title="Account Settings" subtitle="Your account details and password." />
      {mustChangePassword && (
        <Card className="mb-4 flex items-start gap-3 border-warning/40 bg-warning-tint px-5 py-4 text-[13.5px] text-navy-900">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" />
          Your password was reset by the System Administrator. Choose a new password to continue.
        </Card>
      )}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Panel title="Account">
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-full bg-navy-900 text-[14px] font-semibold text-white">{initials(user.fullName)}</span>
            <span>
              <span className="block font-display text-[16px] font-extrabold text-navy-900">{user.fullName}</span>
              <span className="block text-[12.5px] text-ink-muted">{user.position}</span>
            </span>
          </div>
          <dl className="mt-4 space-y-2 text-[13px]">
            <div className="flex justify-between gap-3"><dt className="text-ink-muted">Username</dt><dd className="text-navy-900">{user.username}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-ink-muted">Email</dt><dd className="text-navy-900">{user.email}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-ink-muted">Role</dt><dd className="text-navy-900">{role.name}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-ink-muted">Status</dt><dd className="text-navy-900">{user.status === 'active' ? 'Active' : user.status}</dd></div>
          </dl>
        </Panel>
        <Panel title="Change password" subtitle="At least 8 characters, with letters and numbers.">
          <form onSubmit={submit} className="space-y-3" noValidate>
            {existing && <FieldLabel label={mustChangePassword ? 'Temporary password' : 'Current password'} required>{pw(current, setCurrent, 'current-password')}</FieldLabel>}
            <FieldLabel label="New password" required>{pw(next, setNext, 'new-password')}</FieldLabel>
            <FieldLabel label="Confirm new password" required>{pw(confirm, setConfirm, 'new-password')}</FieldLabel>
            <button type="button" onClick={() => setShow((s) => !s)} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-info">
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />} {show ? 'Hide' : 'Show'} passwords
            </button>
            {error && <p role="alert" className="rounded-md bg-danger-tint px-3 py-2 text-[12.5px] text-danger-ink">{error}</p>}
            {done && <p className="flex items-center gap-2 rounded-md bg-success-tint px-3 py-2 text-[12.5px] text-navy-900"><CheckCircle2 className="size-4 text-success" /> Password updated.</p>}
            <Button type="submit" loading={busy}>Update password</Button>
            <p className="text-[11.5px] text-ink-subtle">Prototype: the password is stored as a hash on this device only. The backend will store it on the server.</p>
          </form>
        </Panel>
      </div>
    </>
  )
}
