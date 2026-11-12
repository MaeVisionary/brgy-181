import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, Eye, EyeOff } from '@/icons'
import { Button } from '@/components/ui/Button'
import { StepProgress } from '@/components/ui/StepProgress'
import { useSteps } from '@/hooks/useSteps'
import { focusFirstInvalid } from '@/lib/validation'
import { useSmoothNavigate } from '@/lib/transition'
import '@/services/accountRecoveryService'
import { recoveryErrors, submitRecovery, type RecoveryInput } from '@/services/accountRecoveryService'
import { PASSWORD_MIN, passwordProblem } from '@/services/credentialStore'
import { ServiceError } from '@/services/mockApi'
import { checkResetToken, completeReset, type TokenCheck } from '@/services/passwordResetService'
import { AuthFrame, authField } from './ForgotPasswordPage'

const label = 'mb-1.5 block text-[length:calc(16px*var(--fs))] font-semibold text-navy-900'
const errText = (t?: string) => (t ? <span data-invalid="true" className="mt-1.5 block text-[length:calc(15px*var(--fs))] text-danger-ink">{t}</span> : null)

/** "I can't access my registered e-mail": a request reviewed by authorized personnel. Four steps, one at a time. */
export function RecoveryRequestPage() {
  const go = useSmoothNavigate()
  const [params] = useSearchParams()
  const [f, setF] = useState<RecoveryInput>({ accountType: params.get('type') === 'personnel' ? 'personnel' : 'resident', fullName: '', identifier: '', accountNo: '', reason: '', newEmail: '', newMobile: '' })
  const steps = useSteps(['account', 'details', 'reason', 'review'] as const)
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ref, setRef] = useState<string | null>(null)
  const errs = recoveryErrors(f)
  const stepKeys: Record<string, (keyof RecoveryInput)[]> = { account: ['accountType'], details: ['fullName', 'identifier'], reason: ['reason', 'newEmail', 'newMobile'], review: [] }
  const e = (k: keyof RecoveryInput) => (touched && stepKeys[steps.current].includes(k) ? errs[k] : undefined)
  const set = (k: keyof RecoveryInput) => (x: { target: { value: string } }) => setF({ ...f, [k]: x.target.value })
  useEffect(() => setTouched(false), [steps.current])
  const next = () => {
    setTouched(true)
    steps.next(() => { if (stepKeys[steps.current].some((k) => errs[k])) { window.setTimeout(() => focusFirstInvalid(), 0); return false } return true })
  }
  const submit = async () => {
    setBusy(true); setErr(null)
    try { setRef((await submitRecovery(f)).ref) } catch (x) { setErr(x instanceof ServiceError ? x.message : 'It could not be sent. Please try again.') } finally { setBusy(false) }
  }
  if (ref) return (
    <AuthFrame back={() => go('/portal', 'back')} backLabel="Back to sign in" title="Request sent">
      <div className="mt-3 space-y-3 text-[length:calc(16.5px*var(--fs))] text-navy-900">
        <p className="flex items-start gap-2"><CheckCircle2 className="icon-line w-5 text-success" /> Your recovery request was received.</p>
        <p>Reference number: <strong>{ref}</strong>. Keep it.</p>
        <p className="text-ink-nav">If the details match an account, the {f.accountType === 'resident' ? 'Barangay Secretary' : 'person responsible for staff accounts'} will check your identity and contact you{f.newEmail ? ` at ${f.newEmail}` : ''}. You may be asked for more information or to visit the Barangay Hall. Your password is never sent or shown to anyone: once approved you get a one-time link to set it yourself.</p>
        <Button onClick={() => go('/portal', 'back')}>Back to sign in</Button>
      </div>
    </AuthFrame>
  )
  return (
    <AuthFrame back={() => (steps.isFirst ? go('/portal', 'back') : steps.back())} backLabel={steps.isFirst ? 'Back to sign in' : 'Back'} title="Recover your account">
      <StepProgress className="mt-3" labels={['Account', 'Your details', 'What happened', 'Check and send']} index={steps.index} />
      {steps.current === 'account' && (
        <div className="space-y-3">
          <p className="text-[length:calc(16.5px*var(--fs))] text-navy-900">Which kind of account is it?</p>
          {(['resident', 'personnel'] as const).map((k) => (
            <label key={k} className="flex min-h-14 items-center gap-3 rounded-lg border border-line px-4 text-[length:calc(16.5px*var(--fs))] text-navy-900">
              <input type="radio" name="t" className="size-5 accent-[#002132]" checked={f.accountType === k} onChange={() => setF({ ...f, accountType: k })} />
              {k === 'resident' ? 'Resident account' : 'Barangay Personnel account (official or staff)'}
            </label>
          ))}
          {errText(e('accountType'))}
        </div>
      )}
      {steps.current === 'details' && (
        <div className="space-y-4">
          <label className="block"><span className={label}>Full name</span><input className={authField(!!e('fullName'))} value={f.fullName} onChange={set('fullName')} aria-invalid={!!e('fullName') || undefined} autoComplete="name" />{errText(e('fullName'))}</label>
          <label className="block"><span className={label}>Username or registered e-mail</span><input className={authField(!!e('identifier'))} value={f.identifier} onChange={set('identifier')} aria-invalid={!!e('identifier') || undefined} />{errText(e('identifier'))}</label>
          <label className="block"><span className={label}>Account number <span className="font-normal text-ink-nav">(if you know it, e.g. ACC-181-000123)</span></span><input className={authField()} value={f.accountNo} onChange={set('accountNo')} /></label>
        </div>
      )}
      {steps.current === 'reason' && (
        <div className="space-y-4">
          <label className="block"><span className={label}>Why can't you use your e-mail?</span>
            <textarea className="min-h-[110px] w-full rounded-lg border border-line px-4 py-3 text-[length:calc(17px*var(--fs))] text-navy-900 focus:border-navy-600 focus:outline-none" value={f.reason} onChange={set('reason')} aria-invalid={!!e('reason') || undefined} placeholder="e.g. I lost my phone and forgot my Gmail password" />
            {errText(e('reason'))}
          </label>
          <p className="text-[length:calc(15.5px*var(--fs))] text-ink-nav">How can we reach you? A new e-mail becomes your account e-mail only after staff verify you and you set your password from the link sent there.</p>
          <label className="block"><span className={label}>New e-mail</span><input type="email" className={authField(!!e('newEmail'))} value={f.newEmail} onChange={set('newEmail')} aria-invalid={!!e('newEmail') || undefined} />{errText(e('newEmail'))}</label>
          <label className="block"><span className={label}>Mobile number</span><input inputMode="numeric" className={authField(!!e('newMobile'))} value={f.newMobile} onChange={set('newMobile')} aria-invalid={!!e('newMobile') || undefined} />{errText(e('newMobile'))}</label>
        </div>
      )}
      {steps.current === 'review' && (
        <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-[length:calc(16px*var(--fs))] sm:grid-cols-[auto_1fr]">
          <dt className="text-ink-nav">Account</dt><dd className="text-navy-900">{f.accountType === 'resident' ? 'Resident' : 'Barangay Personnel'}</dd>
          <dt className="text-ink-nav">Name</dt><dd className="break-words text-navy-900">{f.fullName}</dd>
          <dt className="text-ink-nav">Username or e-mail</dt><dd className="break-all text-navy-900">{f.identifier}</dd>
          {f.accountNo && <><dt className="text-ink-nav">Account number</dt><dd className="text-navy-900">{f.accountNo}</dd></>}
          <dt className="text-ink-nav">What happened</dt><dd className="break-words text-navy-900">{f.reason}</dd>
          <dt className="text-ink-nav">Reach me at</dt><dd className="break-all text-navy-900">{[f.newEmail, f.newMobile].filter(Boolean).join(' · ')}</dd>
        </dl>
      )}
      {err && <p role="alert" className="mt-3 text-[length:calc(15.5px*var(--fs))] text-danger-ink">{err}</p>}
      <div className="mt-6">
        {steps.isLast ? <Button size="lg" className="w-full" loading={busy} onClick={submit}>Send request</Button> : <Button size="lg" className="w-full" onClick={next}>Next</Button>}
      </div>
    </AuthFrame>
  )
}

/** Create New Password (from the e-mailed link). */
export function ResetPasswordPage() {
  const go = useSmoothNavigate()
  const [params] = useSearchParams()
  // Read the token once, then drop it from the address bar so it is not kept in history or shared by copying the URL.
  const [token] = useState(() => params.get('token') ?? '')
  useEffect(() => { if (window.location.search.includes('token=')) window.history.replaceState(window.history.state, '', window.location.pathname) }, [])
  const [check, setCheck] = useState<TokenCheck | null>(null)
  const [bad, setBad] = useState<string | null>(null)
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [acct, setAcct] = useState('')
  const [show, setShow] = useState(false)
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  useEffect(() => { checkResetToken(token).then(setCheck).catch((e) => setBad(e instanceof ServiceError ? e.message : 'This link is not valid.')) }, [token])
  const problem = passwordProblem(pw)
  const mismatch = !!confirm && pw !== confirm
  const save = async () => {
    setTouched(true); setErr(null)
    if (problem || !confirm || mismatch || (check?.needsAccountNo && !acct.trim())) { focusFirstInvalid(); return }
    setBusy(true)
    try { await completeReset(token, pw, confirm, acct); setDone(true) } catch (e) { setErr(e instanceof ServiceError ? e.message : 'It could not be saved. Please try again.') } finally { setBusy(false) }
  }
  const strength = problem && pw.length >= PASSWORD_MIN ? 'Not allowed' : pw.length >= 20 ? 'Strong' : pw.length >= 16 ? 'Good' : pw.length >= PASSWORD_MIN ? 'OK' : 'Too short'
  if (done) return (
    <AuthFrame back={() => go('/portal', 'back')} backLabel="Back to sign in" title="Password changed">
      <div className="mt-3 space-y-3 text-[length:calc(16.5px*var(--fs))] text-navy-900">
        <p className="flex items-start gap-2"><CheckCircle2 className="icon-line w-5 text-success" /> Your new password is saved.</p>
        <p className="text-ink-nav">For your safety you were signed out on all devices. Sign in with your new password.</p>
        <Button size="lg" className="w-full" onClick={() => go('/portal', 'forward')}>Go to sign in</Button>
      </div>
    </AuthFrame>
  )
  return (
    <AuthFrame back={() => go('/portal', 'back')} backLabel="Back to sign in" title={check?.purpose === 'setup' ? 'Choose your password' : 'Create a new password'}>
      {bad ? (
        <div className="mt-3 space-y-3 text-[length:calc(16.5px*var(--fs))] text-navy-900"><p>{bad}</p><Button variant="secondary" onClick={() => go('/portal', 'back')}>Back to sign in</Button></div>
      ) : !check ? <div className="mt-4 h-24 animate-pulse rounded bg-surface-muted" /> : (
        <div className="mt-3 space-y-4">
          <p className="text-[length:calc(16.5px*var(--fs))] text-navy-900">Hi {check.name}. Choose a new password for your account.</p>
          <ul className="list-disc space-y-0.5 pl-5 text-[length:calc(15.5px*var(--fs))] text-ink-nav">
            <li>At least {PASSWORD_MIN} characters. Longer is better.</li>
            <li>A short sentence you can remember works well, e.g. "kape tuwing umaga sa Tondo".</li>
            <li>No need for symbols or capital letters. Avoid common passwords and your name or e-mail.</li>
          </ul>
          <label className="block"><span className={label}>New password</span>
            <span className="relative block">
              <input type={show ? 'text' : 'password'} className={`${authField(touched && !!problem)} pr-12`} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" aria-invalid={(touched && !!problem) || undefined} />
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute top-1/2 right-1 grid size-11 -translate-y-1/2 place-items-center rounded-lg text-ink-muted hover:text-navy-900">{show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}</button>
            </span>
            {pw && <span className="mt-1.5 block text-[length:calc(15px*var(--fs))] text-ink-nav">Length: {pw.length} · {strength}</span>}
            {touched && problem && errText(problem)}
          </label>
          <label className="block"><span className={label}>Confirm new password</span>
            <input type={show ? 'text' : 'password'} className={authField(touched && (!confirm || mismatch))} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" aria-invalid={(touched && (!confirm || mismatch)) || undefined} />
            {touched && (!confirm ? errText('Please type your new password again.') : mismatch ? errText('The two passwords do not match.') : null)}
          </label>
          {check.needsAccountNo && (
            <label className="block"><span className={label}>Your account number (on Account Settings, starts with EMP-181)</span>
              <input className={authField(touched && !acct.trim())} value={acct} onChange={(e) => setAcct(e.target.value)} aria-invalid={(touched && !acct.trim()) || undefined} />
              {touched && !acct.trim() && errText('Please enter your account number.')}
            </label>
          )}
          {err && <p role="alert" className="text-[length:calc(15.5px*var(--fs))] text-danger-ink">{err}</p>}
          <Button size="lg" className="w-full" loading={busy} onClick={save}>Save new password</Button>
        </div>
      )}
    </AuthFrame>
  )
}
