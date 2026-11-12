import { SealWatermark } from '@/components/layout/SealWatermark'
import { ID_TYPES, idHasExpiry } from '@/config/idTypes'
import { sniff } from '@/lib/uploads'
import { AlertCircle, ArrowLeft, Camera, CheckCircle2, CircleHelp, Eye, EyeOff, IdCard, Loader2, ShieldCheck, Upload, UserRound, XCircle } from '@/icons'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useAnalytics } from '@/analytics/AnalyticsContext'
import { BarangaySeal } from '@/components/layout/BarangaySeal'
import { Button } from '@/components/ui/Button'
import { BARANGAY } from '@/config/barangay'
import { cn } from '@/lib/cn'
import { analyseFrame, captureFrame, descriptorFromImage, faceVerdict, fileToJpeg, loadFaceApi, shrink, similarity, type Descriptor } from '@/lib/faceVerify'
import { checkIdText, readIdText } from '@/lib/idOcr'
import { useSmoothNavigate } from '@/lib/transition'
import { AREAS } from '@/mocks/residents'
import { passwordProblem } from '@/services/credentialStore'
import { ServiceError } from '@/services/mockApi'
import { MIN_AGE, ageOn, identifierTaken, matchRecord, submitRegistration } from '@/services/registrationService'
import type { CheckResult, CivilStatus, ResidentRegistration, Sex } from '@/types/resident'
import { PublicLayout } from './PublicLayout'

/**
 * Online resident registration: details → valid ID → live selfie → account.
 * All checks pass → approved automatically; otherwise it goes to the
 * Barangay Secretary's verification queue (Residents → Registrations).
 */

const field =
  'h-12 w-full rounded-lg border border-line bg-surface px-4 text-[length:calc(17px*var(--fs))] text-navy-900 placeholder:text-ink-subtle transition-[border-color,box-shadow] duration-200 focus:border-navy-600 focus:shadow-[0_0_0_4px_rgba(44,88,113,0.12)] focus:outline-none aria-[invalid=true]:border-danger'


const STEPS = ['Privacy', 'Your details', 'Valid ID', 'Face check', 'Account'] as const

interface Details {
  firstName: string
  middleName: string
  lastName: string
  suffix: string
  sex: Sex | ''
  birthDate: string
  civilStatus: CivilStatus | ''
  houseNo: string
  street: string
  otherStreet: string
  contactNo: string
  email: string
  residentSince: string
  voter: '' | 'yes' | 'no'
  oscaId: string
  pwd: boolean
  soloParent: boolean
  fourPs: boolean
}

const EMPTY: Details = {
  firstName: '', middleName: '', lastName: '', suffix: '', sex: '', birthDate: '', civilStatus: '', houseNo: '', street: '', otherStreet: '',
  contactNo: '', email: '', residentSince: '', voter: '', oscaId: '', pwd: false, soloParent: false, fourPs: false,
}

function detailErrors(d: Details): Partial<Record<keyof Details, string>> {
  const e: Partial<Record<keyof Details, string>> = {}
  const year = new Date().getFullYear()
  if (!d.firstName.trim()) e.firstName = 'Enter your first name.'
  if (!d.lastName.trim()) e.lastName = 'Enter your last name.'
  if (!d.sex) e.sex = 'Choose one.'
  if (!d.birthDate) e.birthDate = 'Enter your birthdate.'
  else if (new Date(d.birthDate) > new Date()) e.birthDate = 'Birthdate cannot be in the future.'
  else if (ageOn(d.birthDate) < MIN_AGE) e.birthDate = `Online registration is for residents ${MIN_AGE} and above. Minors are registered by a parent or guardian at the Barangay Hall.`
  if (!d.civilStatus) e.civilStatus = 'Choose one.'
  if (!d.houseNo.trim()) e.houseNo = 'Enter your house or unit number.'
  if (!d.street) e.street = 'Choose your street.'
  else if (d.street === 'other' && !d.otherStreet.trim()) e.otherStreet = 'Enter your street.'
  if (!/^09\d{9}$/.test(d.contactNo.replace(/[\s-]/g, ''))) e.contactNo = 'Use the 11-digit format, e.g. 09171234567.'
  if (!/^\S+@\S+\.\S+$/.test(d.email.trim())) e.email = 'Enter a valid email address.'
  else if (identifierTaken(d.email)) e.email = 'This email already has an account. Sign in or use “Forgot password”.'
  const since = Number(d.residentSince)
  if (!/^\d{4}$/.test(d.residentSince) || since < 1900 || since > year) e.residentSince = `Enter a year from 1900 to ${year}.`
  else if (d.birthDate && since < new Date(d.birthDate).getFullYear()) e.residentSince = 'This year is before your birth year.'
  if (!d.voter) e.voter = 'Choose one.'
  return e
}

export function RegisterPage() {
  const go = useSmoothNavigate()
  const { dataset } = useAnalytics()
  const [step, setStep] = useState(0)
  const [consent, setConsent] = useState(false)
  const [d, setD] = useState<Details>(EMPTY)
  const [touched, setTouched] = useState(false)

  // Valid ID
  const [idType, setIdType] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [idExpiry, setIdExpiry] = useState('')
  const [idFileError, setIdFileError] = useState<string | null>(null)
  const expiryNeeded = idHasExpiry(idType)
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
  const expiryError = !expiryNeeded ? undefined : !idExpiry ? 'Enter the expiry date printed on the ID.' : idExpiry < today ? 'This ID has expired. Please use a valid ID.' : undefined
  const [idImage, setIdImage] = useState<string | null>(null)
  const [idFace, setIdFace] = useState<'checking' | 'found' | 'missing' | 'error' | null>(null)
  const idDescriptor = useRef<Descriptor | null>(null)
  const ocrText = useRef<Promise<string> | null>(null)

  // Selfie
  const [selfie, setSelfie] = useState<{ image: string; live: boolean } | null>(null)
  const selfieDescriptor = useRef<Descriptor | null>(null)

  // Account
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)

  const [result, setResult] = useState<ResidentRegistration | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const topRef = useRef<HTMLDivElement>(null)

  const set = <K extends keyof Details>(k: K, v: Details[K]) => setD((p) => ({ ...p, [k]: v }))
  const errs = detailErrors(d)
  const err = (k: keyof Details) => (touched ? errs[k] : undefined)
  const street = d.street === 'other' ? d.otherStreet.trim() : d.street

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setTouched(false)
  }, [step])

  // Start downloading the face models early, while the person fills in the form.
  useEffect(() => {
    if (step >= 1) loadFaceApi().catch(() => undefined)
  }, [step])

  const onIdFile = async (file: File | undefined) => {
    if (!file) return
    // The real content decides the type (a renamed file is refused); a photo is needed for the face check.
    const kind = await sniff(file)
    if (kind !== 'jpeg' && kind !== 'png') {
      setIdFileError(kind === 'heic' ? 'iPhone HEIC photos are not accepted. Use JPG instead (Settings → Camera → Formats → Most Compatible).' : 'Use a JPG or PNG photo of your ID.')
      return
    }
    setIdFileError(null)
    setIdFace('checking')
    idDescriptor.current = null
    try {
      const img = await fileToJpeg(file)
      setIdImage(img)
      ocrText.current = readIdText(img).catch(() => '')
      const desc = await descriptorFromImage(img)
      idDescriptor.current = desc
      setIdFace(desc ? 'found' : 'missing')
    } catch {
      setIdFace('error')
    }
  }

  const accountError = (() => {
    if (!username.trim()) return 'Choose a username.'
    if (!/^[a-z0-9._@-]{4,}$/i.test(username.trim())) return 'Use at least 4 letters, numbers, dots or dashes.'
    if (username.trim().toLowerCase() !== d.email.trim().toLowerCase() && identifierTaken(username)) return 'That username is taken.'
    return passwordProblem(password) ?? (password !== confirm ? 'The passwords do not match.' : null)
  })()

  const next = () => {
    setTouched(true)
    if (step === 0 && !consent) return
    if (step === 1 && Object.keys(errs).length) return
    if (step === 2 && (!idType || idNumber.trim().length < 4 || expiryError || !idImage || idFace === 'checking')) return
    if (step === 3 && !selfie) return
    if (step === 4) {
      if (accountError) return
      void submit()
      return
    }
    if (step === 1 && !username) setUsername(d.email.trim().toLowerCase())
    setStep((s) => s + 1)
  }

  // ── Processing ─────────────────────────────────────────────────────
  const [progress, setProgress] = useState<{ ocr?: CheckResult; face?: CheckResult; record?: CheckResult; saving?: boolean }>({})
  const submit = async () => {
    setStep(5)
    setSubmitError(null)
    setProgress({})
    try {
      const text = (await ocrText.current) ?? ''
      const ocr = checkIdText(text, { firstName: d.firstName, lastName: d.lastName, idNumber, birthDate: d.birthDate, expiry: expiryNeeded ? idExpiry : undefined })
      setProgress((p) => ({ ...p, ocr: ocr.result }))

      let faceSimilarity: number | undefined
      let faceMatch: CheckResult = 'inconclusive'
      if (idDescriptor.current && selfieDescriptor.current) {
        const s = await similarity(idDescriptor.current, selfieDescriptor.current)
        faceSimilarity = s.score
        faceMatch = faceVerdict(s.distance)
      }
      setProgress((p) => ({ ...p, face: faceMatch }))

      const record = matchRecord({ firstName: d.firstName.trim(), lastName: d.lastName.trim(), birthDate: d.birthDate }, dataset?.records)
      setProgress((p) => ({ ...p, record: record.result, saving: true }))

      const [idSmall, selfieSmall] = await Promise.all([shrink(idImage!, 720), shrink(selfie!.image, 420)])
      const reg = await submitRegistration({
        applicant: {
          firstName: d.firstName.trim(),
          middleName: d.middleName.trim() || undefined,
          lastName: d.lastName.trim(),
          suffix: d.suffix.trim() || undefined,
          sex: d.sex as Sex,
          birthDate: d.birthDate,
          civilStatus: d.civilStatus as CivilStatus,
          houseNo: d.houseNo.trim(),
          street,
          address: `${d.houseNo.trim()} ${street}`,
          contactNo: d.contactNo.replace(/[\s-]/g, ''),
          email: d.email.trim(),
          residentSince: d.residentSince,
          voter: d.voter === 'yes',
          oscaId: d.oscaId.trim() || undefined,
          pwd: d.pwd,
          soloParent: d.soloParent,
          fourPs: d.fourPs,
        },
        username: username.trim(),
        password,
        evidence: { idType, idNumber: idNumber.trim(), idExpiry: expiryNeeded ? idExpiry : undefined, idImage: idSmall, selfieImage: selfieSmall, faceSimilarity, ocrFound: ocr.found },
        checks: { ocr: ocr.result, faceMatch, liveness: selfie!.live ? 'passed' : 'inconclusive' },
        record,
      })
      setResult(reg)
      setStep(6)
    } catch (e) {
      setSubmitError(e instanceof ServiceError ? e.message : 'Something went wrong while submitting. Please try again.')
    }
  }

  return (
    <PublicLayout minimal>
      <div className="relative overflow-hidden">
      <SealWatermark size={560} className="hidden lg:block" />
      <div ref={topRef} className="relative mx-auto max-w-[760px] scroll-mt-20 px-4 py-8 sm:px-6 sm:py-12">
        {step < 5 && (
          <button
            type="button"
            onClick={() => (step === 0 ? go('/login/resident', 'back') : setStep((s) => s - 1))}
            className="bmis-press -ml-1 inline-flex items-center gap-1.5 rounded-full px-1 text-[length:calc(15px*var(--fs))] font-semibold text-ink-muted hover:text-navy-900"
          >
            <ArrowLeft className="size-4" /> {step === 0 ? 'Back to sign in' : 'Back'}
          </button>
        )}

        <div className="mt-4 flex items-center gap-3">
          <BarangaySeal className="size-11" />
          <div>
            <h1 className="font-display text-[length:calc(26px*var(--fs))] leading-tight font-extrabold tracking-tight text-navy-900 sm:text-[length:calc(28px*var(--fs))]">Create a Resident Account</h1>
            <p className="text-[length:calc(15.5px*var(--fs))] text-ink-muted">{BARANGAY.name}, Zone {BARANGAY.zone}, District {BARANGAY.district}, Manila</p>
          </div>
        </div>

        {step < 5 && <Stepper step={step} />}

        <section key={step} className="bmis-rise mt-6 rounded-lg border border-line bg-surface p-6 sm:p-8">
          {step === 0 && (
            <>
              <StepTitle icon={<ShieldCheck />} title="Before you start" sub="It takes about 5 minutes." />
              <ul className="mt-5 space-y-2.5 text-[length:calc(16px*var(--fs))] text-navy-900">
                <Li>One valid government-issued ID (we'll ask for a clear photo of the front).</Li>
                <Li>A phone or computer with a camera for a short live selfie check.</Li>
                <Li>You must be a resident of Barangay 181 and at least {MIN_AGE} years old.</Li>
              </ul>
              <div className="mt-6 rounded-lg bg-surface-muted p-5 text-[length:calc(15px*var(--fs))] leading-relaxed text-navy-900">
                <p className="font-semibold">Privacy notice (Data Privacy Act of 2012, RA 10173)</p>
                <p className="mt-2 text-ink-muted">
                  Barangay 181 collects your personal details, a photo of your ID and a selfie only to confirm that you are a resident and that the ID is yours.
                  Your selfie is compared with the photo on your ID, the text on your ID is read to confirm your name, and your details are checked against the
                  barangay's resident records. If anything cannot be confirmed automatically, the Barangay Secretary reviews it. Your information is not shared
                  outside the barangay except as required by law. You may ask to see, correct or delete your information at the Barangay Hall.
                </p>
              </div>
              <label className="mt-5 flex items-start gap-3 text-[length:calc(16px*var(--fs))] text-navy-900">
                <input type="checkbox" className="mt-0.5 size-4 accent-[#002132]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                I have read the privacy notice and I agree to the collection and use of my information for resident verification.
              </label>
              {touched && !consent && <ErrorText>Please agree to the privacy notice to continue.</ErrorText>}
            </>
          )}

          {step === 1 && (
            <>
              <StepTitle icon={<UserRound />} title="Your details" sub="Enter them exactly as they appear on your valid ID." />
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <F label="First name" error={err('firstName')}><input className={field} value={d.firstName} onChange={(e) => set('firstName', e.target.value)} aria-invalid={!!err('firstName')} autoComplete="given-name" /></F>
                <F label="Middle name" optional><input className={field} value={d.middleName} onChange={(e) => set('middleName', e.target.value)} autoComplete="additional-name" /></F>
                <F label="Last name" error={err('lastName')}><input className={field} value={d.lastName} onChange={(e) => set('lastName', e.target.value)} aria-invalid={!!err('lastName')} autoComplete="family-name" /></F>
                <F label="Suffix" optional><input className={field} placeholder="Jr., Sr., III" value={d.suffix} onChange={(e) => set('suffix', e.target.value)} /></F>
                <F label="Sex" error={err('sex')}>
                  <select className={field} value={d.sex} onChange={(e) => set('sex', e.target.value as Sex)} aria-invalid={!!err('sex')}>
                    <option value="">Select</option><option value="male">Male</option><option value="female">Female</option>
                  </select>
                </F>
                <F label="Birthdate" error={err('birthDate')}><input type="date" className={field} value={d.birthDate} max={new Date().toISOString().slice(0, 10)} onChange={(e) => set('birthDate', e.target.value)} aria-invalid={!!err('birthDate')} /></F>
                <F label="Civil status" error={err('civilStatus')}>
                  <select className={field} value={d.civilStatus} onChange={(e) => set('civilStatus', e.target.value as CivilStatus)} aria-invalid={!!err('civilStatus')}>
                    <option value="">Select</option><option value="single">Single</option><option value="married">Married</option><option value="widowed">Widowed</option><option value="separated">Separated</option><option value="live_in">Live-in</option>
                  </select>
                </F>
                <F label="Mobile number" error={err('contactNo')}><input className={field} inputMode="tel" placeholder="09XXXXXXXXX" value={d.contactNo} onChange={(e) => set('contactNo', e.target.value)} aria-invalid={!!err('contactNo')} autoComplete="tel" /></F>
                <F label="House / unit no." error={err('houseNo')}><input className={field} value={d.houseNo} onChange={(e) => set('houseNo', e.target.value)} aria-invalid={!!err('houseNo')} /></F>
                <F label="Street" error={err('street')}>
                  <select className={field} value={d.street} onChange={(e) => set('street', e.target.value)} aria-invalid={!!err('street')}>
                    <option value="">Select</option>
                    {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
                    <option value="other">Other street in Barangay 181</option>
                  </select>
                </F>
                {d.street === 'other' && (
                  <F label="Street name" error={err('otherStreet')}><input className={field} value={d.otherStreet} onChange={(e) => set('otherStreet', e.target.value)} aria-invalid={!!err('otherStreet')} /></F>
                )}
                <F label="Email" error={err('email')}><input type="email" className={field} value={d.email} onChange={(e) => set('email', e.target.value)} aria-invalid={!!err('email')} autoComplete="email" /></F>
                <F label="Living in Barangay 181 since (year)" error={err('residentSince')}><input className={field} inputMode="numeric" maxLength={4} placeholder="e.g. 2015" value={d.residentSince} onChange={(e) => set('residentSince', e.target.value.replace(/\D/g, ''))} aria-invalid={!!err('residentSince')} /></F>
                <F label="Registered voter in Barangay 181?" error={err('voter')}>
                  <select className={field} value={d.voter} onChange={(e) => set('voter', e.target.value as Details['voter'])} aria-invalid={!!err('voter')}>
                    <option value="">Select</option><option value="yes">Yes</option><option value="no">No</option>
                  </select>
                </F>
                {d.birthDate && ageOn(d.birthDate) >= 60 && (
                  <F label="OSCA ID no." optional><input className={field} placeholder="Senior citizen ID number" value={d.oscaId} onChange={(e) => set('oscaId', e.target.value)} /></F>
                )}
              </div>
              <fieldset className="mt-5">
                <legend className="mb-2 text-[length:calc(15px*var(--fs))] font-semibold text-navy-900">Do any of these apply to you? <span className="font-normal text-ink-muted">(optional)</span></legend>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-[length:calc(16px*var(--fs))] text-navy-900">
                  <Check label="Person with disability (PWD)" checked={d.pwd} onChange={(v) => set('pwd', v)} />
                  <Check label="Solo parent" checked={d.soloParent} onChange={(v) => set('soloParent', v)} />
                  <Check label="4Ps member" checked={d.fourPs} onChange={(v) => set('fourPs', v)} />
                </div>
              </fieldset>
            </>
          )}

          {step === 2 && (
            <>
              <StepTitle icon={<IdCard />} title="Valid ID" sub="Take a clear photo of the front of your ID. Make sure your photo, name and ID number can be read." />
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <F label="Type of ID" error={touched && !idType ? 'Choose your ID type.' : undefined}>
                  <select className={field} value={idType} onChange={(e) => setIdType(e.target.value)} aria-invalid={touched && !idType}>
                    <option value="">Select</option>
                    {ID_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </F>
                <F label="ID number" error={touched && idNumber.trim().length < 4 ? 'Enter the ID number shown on the card.' : undefined}>
                  <input className={field} value={idNumber} onChange={(e) => setIdNumber(e.target.value)} aria-invalid={touched && idNumber.trim().length < 4} />
                </F>
                {expiryNeeded && (
                  <F label="Expiry date" error={touched ? expiryError : undefined}>
                    <input type="date" className={field} value={idExpiry} min={today} onChange={(e) => setIdExpiry(e.target.value)} aria-invalid={touched && !!expiryError} />
                  </F>
                )}
              </div>

              <div className="mt-5">
                {idImage ? (
                  <div className="overflow-hidden rounded-lg border border-line">
                    <img src={idImage} alt="Your ID" className="max-h-[320px] w-full bg-surface-muted object-contain" />
                  </div>
                ) : (
                  <div className="grid place-items-center rounded-lg border-2 border-dashed border-line bg-surface-muted px-6 py-10 text-center">
                    <IdCard className="size-10 text-ink-subtle" />
                    <p className="mt-2 text-[length:calc(16px*var(--fs))] font-semibold text-navy-900">Photo of the front of your ID</p>
                    <p className="text-[length:calc(14.5px*var(--fs))] text-ink-muted">Place it on a plain surface, in good light, with no glare.</p>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <FilePick capture icon={<Camera className="size-4" />} label={idImage ? 'Retake photo' : 'Take a photo'} onFile={onIdFile} />
                  <FilePick icon={<Upload className="size-4" />} label="Upload from files" onFile={onIdFile} />
                </div>
                {idFace === 'checking' && <Status tone="info" icon={<Loader2 className="size-4 animate-spin" />}>Checking the photo… (the first time can take a few seconds)</Status>}
                {idFace === 'found' && <Status tone="success" icon={<CheckCircle2 className="size-4" />}>Face found on the ID.</Status>}
                {idFace === 'missing' && <Status tone="warning" icon={<CircleHelp className="size-4" />}>We couldn't find a face on this photo. Retake it closer and without glare, or continue and the Barangay Secretary will check it.</Status>}
                {idFileError && <Status tone="danger" icon={<XCircle className="size-4" />}>{idFileError}</Status>}
                {idFace === 'error' && <Status tone="danger" icon={<XCircle className="size-4" />}>That file could not be read. Please use a JPG or PNG photo.</Status>}
                {touched && !idImage && <ErrorText>Add a photo of your ID.</ErrorText>}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <StepTitle icon={<Camera />} title="Face check" sub="We'll compare your face with the photo on your ID and make sure you're a real person, not a picture." />
              <LiveSelfie
                value={selfie}
                onDone={async (image, live) => {
                  setSelfie({ image, live })
                  selfieDescriptor.current = await descriptorFromImage(image).catch(() => null)
                }}
                onReset={() => {
                  setSelfie(null)
                  selfieDescriptor.current = null
                }}
              />
              {touched && !selfie && <ErrorText>Complete the face check to continue.</ErrorText>}
            </>
          )}

          {step === 4 && (
            <>
              <StepTitle icon={<ShieldCheck />} title="Your sign-in details" sub="You'll use these to sign in to the resident portal." />
              <div className="mt-6 grid gap-4">
                <F label="Username" hint="You can also sign in with your email."><input className={field} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" /></F>
                <F label="Password">
                  <span className="relative block">
                    <input className={cn(field, 'pr-12')} type={showPw ? 'text' : 'password'} placeholder="At least 8 characters, letters and numbers" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
                    <button type="button" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? 'Hide password' : 'Show password'} className="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-ink-muted hover:text-navy-900">
                      {showPw ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
                    </button>
                  </span>
                </F>
                <F label="Confirm password"><input className={field} type={showPw ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" /></F>
                {touched && accountError && <ErrorText>{accountError}</ErrorText>}
              </div>
              <div className="mt-6 rounded-lg bg-surface-muted p-4 text-[length:calc(15px*var(--fs))] text-navy-900">
                <p className="font-semibold">Review</p>
                <p className="mt-1 text-ink-muted">
                  {[d.firstName, d.middleName, d.lastName, d.suffix].filter(Boolean).join(' ')} · born {d.birthDate} · {d.houseNo} {street} · {idType}
                </p>
              </div>
            </>
          )}

          {step === 5 && (
            <>
              <StepTitle icon={<ShieldCheck />} title="Verifying your registration" sub="Please keep this page open. Reading the ID can take up to a minute." />
              <ul className="mt-6 space-y-3">
                <Progress label="Reading your ID" v={progress.ocr} />
                <Progress label="Comparing your face with your ID" v={progress.face} active={!!progress.ocr} />
                <Progress label="Checking the barangay records" v={progress.record} active={!!progress.face} />
                <Progress label="Saving your registration" v={result ? 'passed' : undefined} active={!!progress.saving} />
              </ul>
              {submitError && (
                <>
                  <Status tone="danger" icon={<AlertCircle className="size-4" />}>{submitError}</Status>
                  <div className="mt-4 flex gap-2">
                    <Button onClick={() => setStep(4)} variant="secondary">Back</Button>
                    <Button onClick={() => void submit()}>Try again</Button>
                  </div>
                </>
              )}
            </>
          )}

          {step === 6 && result && (
            <div className="text-center">
              {result.status === 'auto_approved' ? (
                <>
                  <span className="mx-auto grid size-16 place-items-center rounded-full bg-success-tint text-success"><CheckCircle2 className="size-9" /></span>
                  <h2 className="mt-4 font-display text-[length:calc(24px*var(--fs))] font-extrabold text-navy-900">You're verified!</h2>
                  <p className="mx-auto mt-2 max-w-md text-[length:calc(16px*var(--fs))] text-ink-muted">Your identity and residency were confirmed. Your account is ready.</p>
                </>
              ) : (
                <>
                  <span className="mx-auto grid size-16 place-items-center rounded-full bg-sky-100 text-info"><ShieldCheck className="size-9" /></span>
                  <h2 className="mt-4 font-display text-[length:calc(24px*var(--fs))] font-extrabold text-navy-900">Registration submitted</h2>
                  <p className="mx-auto mt-2 max-w-md text-[length:calc(16px*var(--fs))] text-ink-muted">
                    Some details need to be checked by the Barangay Secretary. This usually takes 1–3 working days. You can sign in once your registration is
                    approved. If needed, you may also visit the Barangay Hall with your valid ID.
                  </p>
                </>
              )}
              <p className="mt-5 inline-block rounded-lg bg-surface-muted px-4 py-2 text-[length:calc(15px*var(--fs))] text-navy-900">
                Reference no. <span className="font-semibold">{result.referenceNo}</span>
              </p>
              <div className="mt-6">
                <Button className="h-12 rounded-lg px-6 text-[length:calc(17px*var(--fs))]" onClick={() => go('/login/resident', 'forward')}>Go to sign in</Button>
              </div>
            </div>
          )}

          {step < 5 && (
            <div className="mt-8 flex justify-end">
              <Button className="h-12 rounded-lg px-7 text-[length:calc(17px*var(--fs))]" onClick={next} disabled={step === 2 && idFace === 'checking'}>
                {step === 4 ? 'Submit registration' : 'Continue'}
              </Button>
            </div>
          )}
        </section>
      </div>
      </div>
    </PublicLayout>
  )
}

// ── Live selfie with a head-turn liveness check ─────────────────────────

type Phase = 'loading' | 'center' | 'turn' | 'back' | 'capturing' | 'error'

function LiveSelfie({ value, onDone, onReset }: { value: { image: string; live: boolean } | null; onDone: (img: string, live: boolean) => Promise<void>; onReset: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [hint, setHint] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [run, setRun] = useState(0)

  useEffect(() => {
    if (value) return
    let stream: MediaStream | null = null
    let stopped = false
    let timer: number | undefined
    const seen = { left: false, right: false }
    let steady = 0
    let current: Phase = 'loading'
    const to = (p: Phase) => {
      current = p
      setPhase(p)
    }

    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('nocam')
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false })
        if (stopped) return
        const v = video.current!
        v.srcObject = stream
        await v.play()
        await loadFaceApi()
        if (stopped) return
        to('center')
        tick()
      } catch (e) {
        if (stopped) return
        const name = (e as { name?: string }).name
        setErrorMsg(
          name === 'NotAllowedError'
            ? 'Camera access was blocked. Allow the camera in your browser settings and try again, or upload a selfie instead.'
            : name === 'NotFoundError' || (e as Error).message === 'nocam'
              ? 'No camera was found on this device. You can upload a selfie instead.'
              : 'The camera or face check could not start. You can try again or upload a selfie instead.',
        )
        to('error')
        setShowUpload(true)
      }
    }

    const tick = async () => {
      if (stopped || !video.current) return
      const f = await analyseFrame(video.current).catch(() => null)
      if (stopped) return
      if (!f || !f.found) {
        setHint('Position your face inside the oval.')
        steady = 0
      } else if (f.size < 0.18) {
        setHint('Move a little closer.')
        steady = 0
      } else if (Math.abs(f.offset.x) > 0.22 || Math.abs(f.offset.y) > 0.25) {
        setHint('Center your face in the oval.')
        steady = 0
      } else {
        const facing = f.yaw > 0.38 && f.yaw < 0.62
        if (current === 'center') {
          setHint('Hold still, looking at the camera…')
          steady = facing ? steady + 1 : 0
          if (steady >= 4) {
            steady = 0
            to('turn')
          }
        } else if (current === 'turn') {
          if (f.yaw < 0.36) seen.left = true
          if (f.yaw > 0.64) seen.right = true
          setHint(seen.left || seen.right ? 'Good! Now turn to the other side.' : 'Slowly turn your head to one side, then the other.')
          if (seen.left && seen.right) to('back')
        } else if (current === 'back') {
          setHint('Now look straight at the camera.')
          steady = facing ? steady + 1 : 0
          if (steady >= 3) {
            to('capturing')
            const img = captureFrame(video.current)
            stream?.getTracks().forEach((t) => t.stop())
            await onDone(img, true)
            return
          }
        }
      }
      timer = window.setTimeout(tick, 120)
    }

    void start()
    const offerUpload = window.setTimeout(() => setShowUpload(true), 25_000)
    return () => {
      stopped = true
      window.clearTimeout(timer)
      window.clearTimeout(offerUpload)
      stream?.getTracks().forEach((t) => t.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, run])

  const upload = async (file: File | undefined) => {
    if (!file) return
    setPhase('capturing')
    try {
      await onDone(await fileToJpeg(file, 720), false)
    } catch {
      setErrorMsg('That file could not be read. Please use a JPG or PNG photo.')
      setPhase('error')
    }
  }

  if (value) {
    return (
      <div className="mt-6 text-center">
        <img src={value.image} alt="Your selfie" className={cn('mx-auto aspect-[3/4] w-56 rounded-lg object-cover', value.live && '-scale-x-100')} />
        <Status tone={value.live ? 'success' : 'warning'} icon={value.live ? <CheckCircle2 className="size-4" /> : <CircleHelp className="size-4" />}>
          {value.live ? 'Live check complete.' : 'Photo uploaded. Without the live check, the Barangay Secretary will review your registration.'}
        </Status>
        <button type="button" onClick={() => { onReset(); setRun((r) => r + 1) }} className="mt-3 text-[length:calc(15px*var(--fs))] font-semibold text-info hover:underline">
          Retake
        </button>
      </div>
    )
  }

  const steps = [
    { k: 'center', label: 'Look at the camera' },
    { k: 'turn', label: 'Turn left and right' },
    { k: 'back', label: 'Look straight' },
  ]
  const order: Phase[] = ['center', 'turn', 'back', 'capturing']
  const idx = order.indexOf(phase)

  return (
    <div className="mt-6">
      <div className="relative mx-auto aspect-[3/4] w-full max-w-[320px] overflow-hidden rounded-lg bg-navy-900">
        <video ref={video} playsInline muted className="absolute inset-0 size-full -scale-x-100 object-cover" />
        {/* Oval guide */}
        <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className={cn('h-[68%] w-[64%] rounded-[50%] border-[3px] transition-colors duration-300', phase === 'capturing' ? 'border-success' : 'border-white/80')} style={{ boxShadow: '0 0 0 999px rgba(0,33,50,0.45)' }} />
        </div>
        {(phase === 'loading' || phase === 'capturing') && (
          <div className="absolute inset-0 grid place-items-center text-white">
            <span className="flex items-center gap-2 rounded-full bg-black/50 px-4 py-2 text-[length:calc(15px*var(--fs))]">
              <Loader2 className="size-4 animate-spin" /> {phase === 'loading' ? 'Starting the camera…' : 'Checking…'}
            </span>
          </div>
        )}
      </div>

      {phase !== 'error' && (
        <>
          <p aria-live="polite" className="mt-4 text-center text-[length:calc(17px*var(--fs))] font-semibold text-navy-900">{phase === 'loading' ? 'Allow camera access when asked.' : hint}</p>
          <ol className="mt-3 flex justify-center gap-2">
            {steps.map((s, i) => (
              <li key={s.k} className={cn('rounded-full px-3 py-1 text-[length:calc(14px*var(--fs))] font-semibold', i < idx ? 'bg-success-tint text-success' : i === idx ? 'bg-navy-900 text-white' : 'bg-surface-muted text-ink-muted')}>
                {s.label}
              </li>
            ))}
          </ol>
        </>
      )}
      {phase === 'error' && (
        <>
          <Status tone="danger" icon={<AlertCircle className="size-4" />}>{errorMsg}</Status>
          <div className="mt-3 text-center">
            <Button variant="secondary" onClick={() => { setPhase('loading'); setRun((r) => r + 1) }}>Try the camera again</Button>
          </div>
        </>
      )}
      {showUpload && (
        <div className="mt-4 text-center text-[length:calc(15px*var(--fs))] text-ink-muted">
          Having trouble? <FilePick inline label="Upload a selfie photo instead" capture="user" onFile={upload} />
          <span className="block text-[length:calc(14px*var(--fs))]">(Your registration will then be reviewed by the Barangay Secretary.)</span>
        </div>
      )}
    </div>
  )
}

// ── Small parts ────────────────────────────────────────────────────────

function Stepper({ step }: { step: number }) {
  return (
    <ol className="mt-6 grid grid-cols-5 gap-1.5" aria-label="Registration steps">
      {STEPS.map((s, i) => (
        <li key={s} aria-current={i === step ? 'step' : undefined}>
          <span className={cn('block h-1.5 rounded-full transition-colors duration-300', i <= step ? 'bg-navy-900' : 'bg-line')} />
          <span className={cn('mt-1.5 hidden text-[length:calc(13.5px*var(--fs))] font-semibold sm:block', i === step ? 'text-navy-900' : 'text-ink-subtle')}>{s}</span>
        </li>
      ))}
    </ol>
  )
}

function StepTitle({ icon, title, sub }: { icon: ReactNode; title: string; sub: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-sky-100 text-navy-900 [&>svg]:size-5">{icon}</span>
      <div>
        <h2 className="font-display text-[length:calc(21px*var(--fs))] font-extrabold text-navy-900">{title}</h2>
        <p className="text-[length:calc(15.5px*var(--fs))] text-ink-muted">{sub}</p>
      </div>
    </div>
  )
}

function F({ label, error, optional, children }: { label: string; error?: string; hint?: string; optional?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[length:calc(15px*var(--fs))] font-semibold text-navy-900">
        {label} {optional && <span className="font-normal text-ink-muted">(optional)</span>}
      </span>
      {children}
      {error ? <span className="mt-1 block text-[length:calc(14.5px*var(--fs))] text-danger-ink">{error}</span> : null}
    </label>
  )
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2">
      <input type="checkbox" className="size-4 accent-[#002132]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

function Li({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
      {children}
    </li>
  )
}

function ErrorText({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-[length:calc(14.5px*var(--fs))] text-danger-ink">{children}</p>
}

function Status({ tone, icon, children }: { tone: 'info' | 'success' | 'warning' | 'danger'; icon: ReactNode; children: ReactNode }) {
  const cls = { info: 'bg-sky-100 text-navy-900', success: 'bg-success-tint text-navy-900', warning: 'bg-warning-tint text-navy-900', danger: 'bg-danger-tint text-navy-900' }[tone]
  return <p role="status" className={cn('mt-3 flex items-start gap-2 rounded-lg px-4 py-3 text-left text-[length:calc(15px*var(--fs))]', cls)}><span className="mt-px shrink-0">{icon}</span>{children}</p>
}

function FilePick({ label, icon, capture, inline, onFile }: { label: string; icon?: ReactNode; capture?: boolean | 'user'; inline?: boolean; onFile: (f: File | undefined) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,.jpg,.jpeg,.png"
        className="hidden"
        {...(capture ? { capture: capture === 'user' ? 'user' : 'environment' } : {})}
        onChange={(e) => {
          onFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      {inline ? (
        <button type="button" onClick={() => ref.current?.click()} className="font-semibold text-info hover:underline">{label}</button>
      ) : (
        <Button type="button" variant="secondary" icon={icon} onClick={() => ref.current?.click()}>{label}</Button>
      )}
    </>
  )
}

function Progress({ label, v, active = true }: { label: string; v?: CheckResult; active?: boolean }) {
  return (
    <li className={cn('flex items-center gap-3 rounded-lg border border-line px-4 py-3 text-[length:calc(16px*var(--fs))] transition-opacity', active ? 'opacity-100' : 'opacity-50')}>
      {v ? <CheckCircle2 className="size-5 text-success" /> : active ? <Loader2 className="size-5 animate-spin text-navy-600" /> : <span className="size-5 rounded-full border-2 border-line" />}
      <span className="text-navy-900">{label}</span>
      {v && <span className="ml-auto text-[length:calc(14px*var(--fs))] text-ink-muted">Done</span>}
    </li>
  )
}
