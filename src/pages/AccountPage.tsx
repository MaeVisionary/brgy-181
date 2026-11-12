import { CheckCircle2, Eye, EyeOff, ShieldAlert } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/ui/Button'
import { TextInput } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, Panel } from '@/components/ui/Panel'
import { testAccountOf } from '@/config/testAccount'
import { initials } from '@/lib/format'
import { audit } from '@/services/auditService'
import { PASSWORD_CHANGE_LIMIT, PASSWORD_CHANGE_WINDOW_DAYS, getCredential, hashPassword, nextPasswordChangeAt, passwordChangesLeft, passwordProblem, recordPasswordChange, setCredential } from '@/services/credentialStore'
import { formatDate } from '@/lib/format'

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

  const test = testAccountOf(user.id)
  const key = test ? test.credentialKey : user.id
  const existing = getCredential(key)?.hash ?? test?.passwordHash
  // A change required after an administrator reset is not limited.
  const left = mustChangePassword ? PASSWORD_CHANGE_LIMIT : passwordChangesLeft(key)
  const nextAt = nextPasswordChangeAt(key)
  const limited = !mustChangePassword && left === 0

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setDone(false)
    if (limited) return setError(`You have changed your password ${PASSWORD_CHANGE_LIMIT} times in the last ${PASSWORD_CHANGE_WINDOW_DAYS} days. You can change it again on ${nextAt ? formatDate(nextAt.toISOString()) : 'a later date'}.`)
    if (existing && !current) return setError('Enter your current password.')
    if (existing && (await hashPassword(key, current)) !== existing) return setError('Your current password is incorrect.')
    const problem = passwordProblem(next)
    if (problem) return setError(problem)
    if (next !== confirm) return setError('The new passwords do not match.')
    if (next === current) return setError('Choose a password different from your current one.')
    setBusy(true)
    setCredential(key, { hash: await hashPassword(key, next), mustChange: false, updatedAt: new Date().toISOString() })
    if (!mustChangePassword) recordPasswordChange(key)
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
        <Card className="mb-4 flex items-start gap-3 border-warning/40 bg-warning-tint px-5 py-4 text-[15.5px] text-navy-900">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" />
          Your password was reset by the System Administrator. Choose a new password to continue.
        </Card>
      )}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Panel title="Account">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-full bg-navy-900 text-[15px] font-semibold text-white">{initials(user.fullName)}</span>
            <span>
              <span className="block font-display text-[17.5px] font-extrabold text-navy-900">{user.fullName}</span>
              <span className="block text-[14.5px] text-ink-muted">{user.position}</span>
            </span>
          </div>
          <dl className="mt-4 divide-y divide-line-soft text-[15px]">
            {[
              ['Username', user.username],
              ['Email', user.email],
              ['Role', role.name],
              ['Status', user.status === 'active' ? 'Active' : user.status === 'locked' ? 'Locked' : 'Inactive'],
            ].map(([k, v]) => (
              <div key={k} className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 py-2.5">
                <dt className="text-ink-muted">{k}</dt>
                <dd className="font-semibold break-all text-navy-900">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>
        <Panel keepSubtitle title="Change password" subtitle="At least 8 characters, with letters and numbers.">
          <form onSubmit={submit} className="space-y-3.5" noValidate>
            {existing && (
              <Req label={mustChangePassword ? 'Temporary password' : 'Current password'}>{pw(current, setCurrent, 'current-password')}</Req>
            )}
            <Req label="New password">{pw(next, setNext, 'new-password')}</Req>
            <Req label="Confirm new password">{pw(confirm, setConfirm, 'new-password')}</Req>
            {!mustChangePassword && (
              <p className={`rounded-md px-3 py-2 text-[14.5px] ${limited ? 'bg-danger-tint text-danger-ink' : 'bg-surface-muted text-ink-nav'}`}>
                {limited
                  ? `Limit reached: ${PASSWORD_CHANGE_LIMIT} changes in ${PASSWORD_CHANGE_WINDOW_DAYS} days. You can change it again on ${nextAt ? formatDate(nextAt.toISOString()) : 'a later date'}.`
                  : `You can change your password ${left} more time${left === 1 ? '' : 's'} in the next ${PASSWORD_CHANGE_WINDOW_DAYS} days.`}
              </p>
            )}
            {error && <p role="alert" className="rounded-md bg-danger-tint px-3 py-2 text-[14.5px] text-danger-ink">{error}</p>}
            {done && <p className="flex items-center gap-2 rounded-md bg-success-tint px-3 py-2 text-[14.5px] text-navy-900"><CheckCircle2 className="size-4 text-success" /> Password updated.</p>}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button type="button" variant="secondary" icon={show ? <EyeOff className="size-4" /> : <Eye className="size-4" />} onClick={() => setShow((s) => !s)}>
                {show ? 'Hide password' : 'Show password'}
              </Button>
              <Button type="submit" loading={busy} disabled={limited}>Update Password</Button>
            </div>
          </form>
        </Panel>
      </div>
    </>
  )
}

/** Label with a red asterisk and "(required)" (new UI). */
function Req({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[14.5px] font-semibold text-navy-900">
        {label} <span className="text-danger-ink">*</span> <span className="font-normal text-ink-muted">(required)</span>
      </span>
      {children}
    </label>
  )
}
