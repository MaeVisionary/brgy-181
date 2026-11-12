import { SealWatermark } from '@/components/layout/SealWatermark'
import { ID_TYPES, idHasExpiry } from '@/config/idTypes'
import { sniff } from '@/lib/uploads'
import { AlertCircle, ArrowLeft, Camera, Check as Tick, CheckCircle2, RotateCcw, CircleHelp, Eye, EyeOff, IdCard, Loader2, ShieldCheck, Upload, UserRound, XCircle } from '@/icons'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { DraftIndicator, DraftRecoveryCard, useDraft } from '@/hooks/useDraft'
import { DRAFT_TTL, hasContent } from '@/lib/drafts'
import { useAnalytics } from '@/analytics/AnalyticsContext'
import { BarangaySeal } from '@/components/layout/BarangaySeal'
import { Button } from '@/components/ui/Button'
import { BARANGAY } from '@/config/barangay'
import { MSG, focusFirstInvalid, isEmail, isMobile, yearProblem } from '@/lib/validation'
import { cn } from '@/lib/cn'
import { analyseFrame, captureFrame, descriptorFromImage, faceVerdict, fileToJpeg, loadFaceApi, shrink, similarity, type Descriptor } from '@/lib/faceVerify'
import { checkIdText, readIdText } from '@/lib/idOcr'
import { useSmoothNavigate } from '@/lib/transition'
import { AREAS } from '@/mocks/residents'
import { passwordProblem } from '@/services/credentialStore'
import { ServiceError } from '@/services/mockApi'
import { ALT_STATUS_LABEL, MIN_AGE, ageOn, altErrors, identifierTaken, matchRecord, submitRegistration } from '@/services/registrationService'
import { useSteps } from '@/hooks/useSteps'
import { AltVerificationStep, EMPTY_ALT, type AltForm } from './AltVerificationStep'
import type { CheckResult, CivilStatus, ResidentRegistration, Sex } from '@/types/resident'
import { PublicLayout } from './PublicLayout'

/**
 * Online resident registration: details → valid ID → live selfie → account.
 * All checks pass → approved automatically; otherwise it goes to the
 * Barangay Secretary's verification queue (Residents → Registrations).
 */

const field =
  'h-12 w-full rounded-lg border border-line bg-surface px-4 text-[length:calc(17px*var(--fs))] text-navy-900 placeholder:text-ink-subtle transition-[border-color,box-shadow] duration-200 focus:border-navy-600 focus:shadow-[0_0_0_4px_rgba(44,88,113,0.12)] focus:outline-none aria-[invalid=true]:border-danger'


type StepKey = 'privacy' | 'details' | 'identity' | 'face' | 'account'
const STEP_LABEL: Record<StepKey, string> = { privacy: 'Privacy', details: 'Your details', identity: 'Identity', face: 'Face check', account: 'Account' }
const STEP_NO: Record<StepKey, number> = { privacy: 0, details: 1, identity: 2, face: 3, account: 4 }
const WITH_ID: StepKey[] = ['privacy', 'details', 'identity', 'face', 'account']
// Without a valid ID there is no ID photo to compare a selfie with, so the face check is left out on purpose.
const WITHOUT_ID: StepKey[] = ['privacy', 'details', 'identity', 'account']

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
  if (!d.firstName.trim()) e.firstName = MSG.required('your first name')
  if (!d.lastName.trim()) e.lastName = MSG.required('your last name')
  if (!d.sex) e.sex = MSG.choose('Male or Female')
  if (!d.birthDate) e.birthDate = 'Please enter your birthdate. Example: 03/14/1991'
  else if (new Date(d.birthDate) > new Date()) e.birthDate = 'Your birthdate cannot be a future date. Please check the year.'
  else if (ageOn(d.birthDate) < MIN_AGE) e.birthDate = `Online registration is for residents ${MIN_AGE} and above. Minors are registered by a parent or guardian at the Barangay Hall.`
  if (!d.civilStatus) e.civilStatus = MSG.choose('your civil status')
  if (!d.houseNo.trim()) e.houseNo = MSG.required('your house or unit number')
  if (!d.street) e.street = MSG.choose('your street')
  else if (d.street === 'other' && !d.otherStreet.trim()) e.otherStreet = MSG.required('the name of your street')
  if (!d.contactNo.trim()) e.contactNo = MSG.required('your mobile number') + ' Example: 09171234567'
  else if (!isMobile(d.contactNo)) e.contactNo = MSG.mobile
  if (!d.email.trim()) e.email = MSG.required('your email address') + ' Example: name@gmail.com'
  else if (!isEmail(d.email)) e.email = MSG.email
  else if (identifierTaken(d.email)) e.email = 'This email already has an account. Please sign in, or use “Forgot password” if you cannot remember it.'
  const birthYear = d.birthDate ? new Date(d.birthDate).getFullYear() : 1900
  const yp = yearProblem(d.residentSince, 1900, year)
  if (yp) e.residentSince = yp
  else if (d.birthDate && Number(d.residentSince) < birthYear) e.residentSince = `This year is before your birth year (${birthYear}). Please enter the year you started living in Barangay 181.`
  if (!d.voter) e.voter = MSG.yesNo
  return e
}

export function RegisterPage() {
  const go = useSmoothNavigate()
  const { dataset } = useAnalytics()
  // One step controller (src/hooks/useSteps): an ordered list of steps; Next/Back move exactly one.
  const [idPath, setIdPath] = useState<'' | 'id' | 'alt'>('')
  const seq = idPath === 'alt' ? WITHOUT_ID : WITH_ID
  const steps = useSteps(seq)
  const [phase, setPhase] = useState<'form' | 'processing' | 'done'>('form')
  const step = phase === 'processing' ? 5 : phase === 'done' ? 6 : STEP_NO[steps.current]
  const [alt, setAlt] = useState<AltForm>(EMPTY_ALT)
  const altErrs = altErrors(alt)
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

  // Auto-saved progress on this device (24 hours). Only the details typed in the form:
  // never the ID number, ID photo, selfie, face data or password.
  // Supporting documents (files) are not saved either; the choices are.
  const draftValue = useMemo(() => ({ step: Math.min(step, 4), consent, d, idType, idExpiry, username, idPath, alt: { ...alt, documents: [] as AltForm['documents'], endorsement: { ...alt.endorsement, document: undefined } } }), [step, consent, d, idType, idExpiry, username, idPath, alt])
  const draft = useDraft('registration', draftValue, { owner: 'guest', ttlHours: DRAFT_TTL.registration, enabled: step < 5, isEmpty: (v) => !hasContent(v.d) })
  const [resumeNote, setResumeNote] = useState('')
  const resumeDraft = () => {
    const v = draft.resume()
    if (!v) return
    setConsent(v.consent); setD({ ...EMPTY, ...v.d }); setIdType(v.idType ?? ''); setIdExpiry(v.idExpiry ?? ''); setUsername(v.username ?? '')
    setIdPath(v.idPath ?? ''); if (v.alt) setAlt({ ...EMPTY_ALT, ...v.alt })
    // The ID photo, documents and face check are never saved, so the identity step starts again.
    const to = Math.min(v.step ?? 0, 2)
    if ((v.step ?? 0) >= 2) setResumeNote(v.idPath === 'alt' ? 'For your privacy, documents you attached were not saved. Please add them again.' : 'For your security, your ID number, ID photo and face check were not saved. Please add them again.')
    steps.goTo((['privacy', 'details', 'identity'] as StepKey[])[to])
  }
  const discardDraftAndReset = () => {
    draft.startOver()
    setConsent(false); setD(EMPTY); setIdType(''); setIdNumber(''); setIdExpiry(''); setUsername(''); setResumeNote(''); setIdPath(''); setAlt(EMPTY_ALT); steps.goTo('privacy')
  }

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

  const accountErrs = (() => {
    const e: { username?: string; password?: string; confirm?: string } = {}
    if (!username.trim()) e.username = MSG.required('a username') + ' You can use your email.'
    else if (!/^[a-z0-9._@-]{4,}$/i.test(username.trim())) e.username = 'Please use at least 4 characters: letters, numbers, dots (.), dashes (-) or @. Example: juan.delacruz'
    else if (username.trim().toLowerCase() !== d.email.trim().toLowerCase() && identifierTaken(username)) e.username = 'This username is already taken. Please choose another one.'
    if (!password) e.password = MSG.required('a password')
    else { const pw = passwordProblem(password); if (pw) e.password = `${pw} Example: barangay2026` }
    if (!confirm) e.confirm = 'Please type your password again to confirm it.'
    else if (password !== confirm) e.confirm = 'The two passwords do not match. Please type the same password in both boxes.'
    return e
  })()
  const sectionRef = useRef<HTMLElement>(null)
  const [busy, setBusy] = useState(false)

  // Number of problems on the current step (0 = ready to continue).
  const stepProblems =
    step === 0 ? (consent ? 0 : 1)
    : step === 1 ? Object.keys(errs).length
    : step === 2 ? (!idPath ? 1 : idPath === 'alt' ? Object.keys(altErrs).length : [!idType, idNumber.trim().length < 4, !!expiryError, !idImage].filter(Boolean).length + (idFace === 'checking' ? 1 : 0))
    : step === 3 ? (selfie ? 0 : 1)
    : step === 4 ? Object.keys(accountErrs).length
    : 0

  const next = () => {
    if (busy || steps.locked()) return
    setTouched(true)
    // Only the current step is checked; with a problem the page stays here and points at it.
    if (stepProblems > 0) {
      focusFirstInvalid(sectionRef.current)
      return
    }
    if (steps.isLast) {
      setBusy(true)
      void submit().finally(() => setBusy(false))
      return
    }
    if (steps.current === 'details' && !username) setUsername(d.email.trim().toLowerCase())
    steps.next()
  }

  // ── Processing ─────────────────────────────────────────────────────
  const [progress, setProgress] = useState<{ ocr?: CheckResult; face?: CheckResult; record?: CheckResult; saving?: boolean }>({})
  const submit = async () => {
    setPhase('processing')
    setSubmitError(null)
    setProgress({})
    try {
      if (idPath === 'alt') {
        const record = matchRecord({ firstName: d.firstName.trim(), lastName: d.lastName.trim(), birthDate: d.birthDate }, dataset?.records)
        setProgress({ record: record.result, saving: true })
        const en = alt.endorsement
        const reg = await submitRegistration({
          applicant: applicantOf(),
          username: username.trim(),
          password,
          alt: { documents: alt.documents, noDocuments: alt.noDocuments, inPersonRequested: alt.inPersonRequested, endorsement: en.name.trim() ? { ...en, contactNo: en.contactNo?.replace(/[\s-]/g, '') || undefined } : undefined },
          checks: { ocr: 'inconclusive', faceMatch: 'inconclusive', liveness: 'inconclusive' },
          record,
          clientRequestId: draft.draftId,
        })
        setResult(reg)
        draft.clear()
        setPhase('done')
        return
      }
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
        applicant: applicantOf(),
        username: username.trim(),
        password,
        evidence: { idType, idNumber: idNumber.trim(), idExpiry: expiryNeeded ? idExpiry : undefined, idImage: idSmall, selfieImage: selfieSmall, faceSimilarity, ocrFound: ocr.found },
        checks: { ocr: ocr.result, faceMatch, liveness: selfie!.live ? 'passed' : 'inconclusive' },
        record,
        clientRequestId: draft.draftId,
      })
      setResult(reg)
      draft.clear()
      setPhase('done')
    } catch (e) {
      setSubmitError(e instanceof ServiceError ? e.message : 'Your registration could not be saved because of a problem on our side. Your details are kept. Please press Try again. If it keeps happening, register at the Barangay Hall.')
    }
  }
  const applicantOf = () => ({
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
  })

  return (
    <PublicLayout minimal>
      <div className="relative overflow-hidden">
      <SealWatermark size={480} className="hidden 2xl:block" />
      <div ref={topRef} className="relative mx-auto max-w-[760px] scroll-mt-20 px-3 pt-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-12">
        {step < 5 && (
          <button
            type="button"
            onClick={() => (steps.isFirst ? go('/login/resident', 'back') : steps.back())}
            className="bmis-press -ml-1 inline-flex min-h-11 items-center gap-1.5 rounded-full px-1 text-[length:calc(15px*var(--fs))] font-semibold text-ink-muted hover:text-navy-900"
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

        {draft.recovered && step < 5 && (
          <div className="mt-4"><DraftRecoveryCard savedAt={draft.recovered.savedAt} onContinue={resumeDraft} onStartOver={discardDraftAndReset} note="Saved on this device. Your ID photo and face check are never saved and will be asked again." /></div>
        )}
        {step < 5 && <Stepper labels={seq.map((k) => STEP_LABEL[k])} index={steps.index} />}
        {resumeNote && step === 2 && <Status tone="info" icon={<CircleHelp className="size-4" />}>{resumeNote}</Status>}

        <section key={steps.current} ref={sectionRef} className="bmis-rise mt-4 rounded-md border border-line bg-surface p-4 sm:mt-6 sm:rounded-lg sm:p-8">
          {step === 0 && (
            <>
              <StepTitle icon={<ShieldCheck />} title="Before you start" sub="It takes about 5 minutes." />
              <ul className="mt-5 space-y-2.5 text-[length:calc(16px*var(--fs))] text-navy-900">
                <Li>A valid government-issued ID. No valid ID? You can still register with other documents, someone who can vouch for you, or an in-person visit.</Li>
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
                <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-[#002132]" checked={consent} onChange={(e) => setConsent(e.target.checked)} aria-invalid={touched && !consent} />
                I have read the privacy notice and I agree to the collection and use of my information for resident verification.
              </label>
              {touched && !consent && <ErrorText>Please tick the box to agree to the privacy notice. You cannot register without agreeing.</ErrorText>}
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
              <StepTitle icon={<IdCard />} title="Your identity" sub="Do you have a valid government-issued ID?" />
              <div role="radiogroup" aria-label="Valid ID" className="mt-5 grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2">
                {([['id', 'I have a valid government-issued ID', 'Upload a photo of it and take a live selfie.'], ['alt', "I don't have a valid government-issued ID", 'Register with other documents, someone who can vouch for you, or an in-person visit.']] as const).map(([k, t, sub]) => (
                  <button key={k} type="button" role="radio" aria-checked={idPath === k} onClick={() => setIdPath(k)} data-invalid={touched && !idPath ? 'true' : undefined}
                    className={cn('flex h-full min-h-[88px] flex-col items-start justify-center rounded-lg border-2 px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-600', idPath === k ? 'border-navy-900 bg-sky-50' : 'border-line bg-surface hover:border-navy-600')}>
                    <span className="text-[length:calc(17px*var(--fs))] font-bold text-navy-900">{t}</span>
                    <span className="mt-0.5 text-[length:calc(15px*var(--fs))] text-ink-nav">{sub}</span>
                  </button>
                ))}
              </div>
              {touched && !idPath && <p data-invalid="true" tabIndex={-1} className="mt-2 text-[length:calc(15px*var(--fs))] text-danger-ink">Please choose one.</p>}
              {idPath === 'alt' && <AltVerificationStep value={alt} onChange={setAlt} errors={altErrs} touched={touched} />}
              {idPath === 'id' && (<>
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <F label="Type of ID" error={touched && !idType ? MSG.choose('the type of ID you will use') : undefined}>
                  <select className={field} value={idType} onChange={(e) => setIdType(e.target.value)} aria-invalid={touched && !idType}>
                    <option value="">Select</option>
                    {ID_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </F>
                <F label="ID number" error={touched && idNumber.trim().length < 4 ? (idNumber.trim() ? 'This ID number looks too short. Please type it exactly as printed on the card.' : MSG.required('the ID number printed on your card')) : undefined}>
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
                {touched && !idImage && <p data-invalid="true" tabIndex={-1} className="mt-2 text-[length:calc(14.5px*var(--fs))] text-danger-ink">Please add a photo of the front of your ID. Tap “Take a photo” or “Upload from files”.</p>}
                {touched && idImage && idFace === 'checking' && <ErrorText>Please wait a moment. We are still checking your ID photo.</ErrorText>}
              </div>
              </>)}
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
              {touched && !selfie && <p data-invalid="true" tabIndex={-1} className="mt-2 text-[length:calc(14.5px*var(--fs))] text-danger-ink">Please complete the face check above before continuing.</p>}
            </>
          )}

          {step === 4 && (
            <>
              <StepTitle icon={<ShieldCheck />} title="Your sign-in details" sub="You'll use these to sign in to the resident portal." />
              <div className="mt-6 grid gap-4">
                <F label="Username" hint="You can also sign in with your email." error={touched ? accountErrs.username : undefined}><input className={field} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" aria-invalid={touched && !!accountErrs.username} /></F>
                <F label="Password" error={touched ? accountErrs.password : undefined}>
                  <span className="relative block">
                    <input className={cn(field, 'pr-12')} type={showPw ? 'text' : 'password'} placeholder="At least 8 characters, letters and numbers" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" aria-invalid={touched && !!accountErrs.password} />
                    <button type="button" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? 'Hide password' : 'Show password'} className="absolute top-1/2 right-2 grid size-11 -translate-y-1/2 place-items-center rounded-lg text-ink-muted hover:text-navy-900">
                      {showPw ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
                    </button>
                  </span>
                </F>
                <F label="Confirm password" error={touched ? accountErrs.confirm : undefined}><input className={field} type={showPw ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" aria-invalid={touched && !!accountErrs.confirm} /></F>
              </div>
              <div className="mt-6 rounded-lg bg-surface-muted p-4 text-[length:calc(15px*var(--fs))] text-navy-900">
                <p className="font-semibold">Review</p>
                <p className="mt-1 text-ink-muted">
                  {[d.firstName, d.middleName, d.lastName, d.suffix].filter(Boolean).join(' ')} · born {d.birthDate} · {d.houseNo} {street} · {idPath === 'alt' ? `No valid ID: ${[alt.documents.length ? `${alt.documents.length} document(s)` : 'no documents', alt.endorsement.name.trim() && `endorsed by ${alt.endorsement.name.trim()}`, alt.inPersonRequested && 'in-person verification requested'].filter(Boolean).join(', ')}` : idType}
                </p>
              </div>
            </>
          )}

          {step === 5 && (
            <>
              <StepTitle icon={<ShieldCheck />} title="Verifying your registration" sub="Please keep this page open. Reading the ID can take up to a minute." />
              <ul className="mt-6 space-y-3">
                {idPath !== 'alt' && <Progress label="Reading your ID" v={progress.ocr} />}
                {idPath !== 'alt' && <Progress label="Comparing your face with your ID" v={progress.face} active={!!progress.ocr} />}
                <Progress label="Checking the barangay records" v={progress.record} active={idPath === 'alt' || !!progress.face} />
                <Progress label="Saving your registration" v={result ? 'passed' : undefined} active={!!progress.saving} />
              </ul>
              {submitError && (
                <>
                  <Status tone="danger" icon={<AlertCircle className="size-4" />}>{submitError}</Status>
                  <div className="mt-4 flex gap-2">
                    <Button onClick={() => setPhase('form')} variant="secondary">Back</Button>
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
              ) : result.alt ? (
                <>
                  <span className="mx-auto grid size-16 place-items-center rounded-full bg-sky-100 text-info"><ShieldCheck className="size-9" /></span>
                  <h2 className="mt-4 font-display text-[length:calc(24px*var(--fs))] font-extrabold text-navy-900">Registration submitted</h2>
                  <p className="mx-auto mt-2 max-w-md text-[length:calc(16px*var(--fs))] text-ink-nav">Status: <strong className="text-navy-900">{ALT_STATUS_LABEL[result.alt.status]}</strong>. The Barangay Secretary will check your identity and residency{result.alt.inPersonRequested ? ' and contact you to set a visit to the Barangay Hall' : ''}. Keep your reference number. You can check your status and answer any request on the registration status page.</p>
                  <div className="mt-4"><Button variant="secondary" onClick={() => go('/register/status', 'forward')}>Check registration status</Button></div>
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
            <div className="mt-6 flex flex-col items-stretch gap-3 sm:mt-8 sm:flex-row sm:items-center sm:justify-end">
              {touched && stepProblems > 0 && (
                <p role="alert" className="text-center text-[length:calc(15px*var(--fs))] font-semibold text-danger-ink sm:mr-auto sm:text-left">
                  {step === 2 && idFace === 'checking' && stepProblems === 1
                    ? 'Still checking your ID photo. Please wait a moment.'
                    : stepProblems === 1 ? 'Please correct the item marked in red.' : `Please correct the ${stepProblems} items marked in red.`}
                </p>
              )}
              {!draft.recovered && draft.status !== 'idle' && (
                <div className="order-last flex flex-wrap items-center justify-center gap-x-3 sm:order-first sm:mr-auto sm:justify-start">
                  <DraftIndicator status={draft.status} />
                  {draft.status === 'saved' && <button type="button" onClick={discardDraftAndReset} className="text-[length:calc(14px*var(--fs))] font-semibold text-info hover:underline">Clear saved entries</button>}
                </div>
              )}
              <Button className="order-first h-12 w-full rounded-lg px-7 text-[length:calc(17px*var(--fs))] sm:order-last sm:w-auto" onClick={next} loading={busy} disabled={busy}>
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

type Phase = 'intro' | 'loading' | 'center' | 'turn' | 'back' | 'capturing' | 'error'

function LiveSelfie({ value, onDone, onReset }: { value: { image: string; live: boolean } | null; onDone: (img: string, live: boolean) => Promise<void>; onReset: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  // First visit: explain the camera and start it on a tap (no blank preview, and
  // phones allow the camera more reliably after a tap). Retakes start straight away.
  const [phase, setPhase] = useState<Phase>('intro')
  const [hint, setHint] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [run, setRun] = useState(0)

  useEffect(() => {
    if (value || run === 0) return
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

    // If the camera has not started after 15 seconds, say so and offer Retry.
    const watchdog = window.setTimeout(() => {
      if (!stopped && current === 'loading') {
        setErrorMsg('The camera is taking too long to start. Please press Try again. If it still does not start, close other apps that use the camera, or upload a selfie instead.')
        to('error')
        setShowUpload(true)
      }
    }, 15_000)

    const start = async () => {
      to('loading')
      setErrorMsg('')
      try {
        if (!window.isSecureContext) throw new Error('insecure')
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('nocam')
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false })
        if (stopped) return
        const v = video.current!
        v.srcObject = stream
        await v.play()
        // The camera was unplugged, taken by another app, or the phone locked.
        stream.getVideoTracks()[0]?.addEventListener('ended', () => {
          if (stopped || current === 'capturing') return
          setErrorMsg('The camera stopped. Please press Try again to restart the face check.')
          to('error')
        })
        await loadFaceApi()
        if (stopped) return
        window.clearTimeout(watchdog)
        to('center')
        tick()
      } catch (e) {
        if (stopped) return
        window.clearTimeout(watchdog)
        const name = (e as { name?: string }).name
        const msg = (e as Error).message
        setErrorMsg(
          name === 'NotAllowedError' || name === 'SecurityError'
            ? 'Camera permission was not allowed. To continue, tap the lock or camera icon beside the web address, choose Allow for Camera, then press Try again. You can also upload a selfie instead.'
            : name === 'NotReadableError' || name === 'AbortError'
              ? 'Another app is using the camera. Please close it, then press Try again.'
              : name === 'NotFoundError' || name === 'OverconstrainedError' || msg === 'nocam'
                ? 'No front camera was found on this device. You can upload a selfie instead.'
                : msg === 'insecure'
                  ? 'The camera only works on a secure (https) page. Please open the registration page from the official link.'
                  : 'The camera or face check could not start. Please press Try again, or upload a selfie instead.',
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
            stopped = true
            stream?.getTracks().forEach((t) => t.stop())
            await onDone(img, true)
            return
          }
        }
      }
      timer = window.setTimeout(tick, 120)
    }

    // Leaving the app or tab mid-check turns the camera off; on return the person taps Start camera and begins again from step 1.
    const onHidden = () => {
      if (document.visibilityState === 'hidden' && !stopped && current !== 'capturing') {
        stopped = true
        window.clearTimeout(timer)
        window.clearTimeout(watchdog)
        stream?.getTracks().forEach((t) => t.stop())
        setHint('')
        setPhase('intro')
      }
    }
    document.addEventListener('visibilitychange', onHidden)

    void start()
    const offerUpload = window.setTimeout(() => setShowUpload(true), 25_000)
    return () => {
      stopped = true
      window.clearTimeout(timer)
      window.clearTimeout(offerUpload)
      window.clearTimeout(watchdog)
      document.removeEventListener('visibilitychange', onHidden)
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
  const startCamera = () => { setShowUpload(false); setRun((r) => r + 1) }

  if (phase === 'intro') {
    return (
      <div className="mt-5">
        <div className="rounded-md bg-surface-muted p-4 text-[length:calc(16px*var(--fs))] text-navy-900">
          <p className="font-semibold">This step uses your camera</p>
          <p className="mt-1 text-ink-muted">Your browser will ask to use the camera. Please choose <span className="font-semibold text-navy-900">Allow</span>. The video stays on your device; only one photo is saved for checking.</p>
        </div>
        <StepList steps={steps} idx={-1} />
        <Button className="mt-5 h-12 w-full rounded-lg text-[length:calc(17px*var(--fs))]" icon={<Camera className="size-5" />} onClick={startCamera}>Start camera</Button>
        <div className="mt-4 text-center text-[length:calc(15px*var(--fs))] text-ink-muted">
          No camera? <FilePick inline label="Upload a selfie photo instead" capture="user" onFile={upload} />
        </div>
      </div>
    )
  }

  return (
    <div className="mt-4">
      <p aria-live="polite" className="mb-3 min-h-[2.6em] text-center text-[length:calc(17px*var(--fs))] leading-snug font-semibold text-navy-900">
        {phase === 'loading' ? 'Starting the camera… Choose Allow if your browser asks.' : phase === 'error' ? 'The face check is paused' : phase === 'capturing' ? 'Done. Saving your photo…' : hint || 'Position your face inside the oval.'}
      </p>
      {/* Width follows the screen height too, so the whole oval and the buttons fit without scrolling. */}
      <div className="relative mx-auto aspect-[3/4] w-[min(100%,340px,calc(52svh*0.75))] overflow-hidden rounded-md bg-navy-900">
        <video ref={video} playsInline muted autoPlay className="absolute inset-0 size-full -scale-x-100 object-cover" />
        <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className={cn('aspect-[3/4] w-[62%] rounded-[50%] border-[3px] transition-colors duration-300', phase === 'capturing' ? 'border-success' : 'border-white/85')} style={{ boxShadow: '0 0 0 999px rgba(0,33,50,0.45)' }} />
        </div>
        {(phase === 'loading' || phase === 'capturing') && (
          <div className="absolute inset-0 grid place-items-center px-4 text-center text-white">
            <span className="flex items-center gap-2 rounded-full bg-black/55 px-4 py-2 text-[length:calc(15px*var(--fs))]">
              <Loader2 className="size-4 animate-spin" /> {phase === 'loading' ? 'Starting the camera…' : 'Checking…'}
            </span>
          </div>
        )}
        {phase === 'error' && (
          <div className="absolute inset-0 grid place-items-center px-6 text-center text-white">
            <span className="flex flex-col items-center gap-2 text-[length:calc(15px*var(--fs))]"><AlertCircle className="size-7" /> Camera is off</span>
          </div>
        )}
      </div>

      {phase === 'error' ? (
        <>
          <Status tone="danger" icon={<AlertCircle className="size-4" />}>{errorMsg}</Status>
          <Button className="mt-3 h-12 w-full rounded-lg" variant="secondary" icon={<RotateCcw className="size-4" />} onClick={startCamera}>Try again</Button>
        </>
      ) : (
        <StepList steps={steps} idx={idx} />
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

/** The three face-check steps: stacked on phones, side by side on wider screens. Done steps are ticked; the current one is highlighted. */
function StepList({ steps, idx }: { steps: { k: string; label: string }[]; idx: number }) {
  return (
    <ol className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
      {steps.map((st, i) => {
        const done = idx > i
        const now = idx === i
        return (
          <li key={st.k} aria-current={now ? 'step' : undefined} className={cn('flex min-h-12 items-center gap-3 rounded-md border px-3 py-2 text-[length:calc(16px*var(--fs))]', done ? 'border-success/40 bg-success-tint text-navy-900' : now ? 'border-navy-900 bg-navy-900 text-white' : 'border-line bg-surface text-ink-muted')}>
            <span className={cn('grid size-7 shrink-0 place-items-center rounded-full text-[length:calc(14px*var(--fs))] font-bold', done ? 'bg-success text-white' : now ? 'bg-white text-navy-900' : 'bg-surface-muted text-ink-muted')}>
              {done ? <Tick className="size-4" /> : i + 1}
            </span>
            <span className="font-semibold">{st.label}</span>
            {done && <span className="sr-only">(done)</span>}
          </li>
        )
      })}
    </ol>
  )
}

// ── Small parts ────────────────────────────────────────────────────────

/** Progress bar driven by the same step list as Next/Back, so it always matches the step shown. */
function Stepper({ labels, index }: { labels: string[]; index: number }) {
  return (
    <div className="mt-6">
      <p className="text-[length:calc(15px*var(--fs))] font-semibold text-navy-900 sm:hidden">Step {index + 1} of {labels.length}: {labels[index]}</p>
      <ol className="mt-1.5 grid gap-1.5 sm:mt-0" style={{ gridTemplateColumns: `repeat(${labels.length}, minmax(0, 1fr))` }} aria-label="Registration steps">
        {labels.map((s, i) => (
          <li key={s} aria-current={i === index ? 'step' : undefined}>
            <span className={cn('block h-1.5 rounded-full transition-colors duration-300', i <= index ? 'bg-navy-900' : 'bg-line')} />
            <span className={cn('mt-1.5 hidden text-[length:calc(14px*var(--fs))] font-semibold sm:block', i === index ? 'text-navy-900' : 'text-ink-nav')}>{s}</span>
          </li>
        ))}
      </ol>
    </div>
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
      {error ? <span className="mt-1.5 block text-[length:calc(15px*var(--fs))] leading-snug text-danger-ink">{error}</span> : null}
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
      <CheckCircle2 className="icon-line w-4 text-success" />
      {children}
    </li>
  )
}

function ErrorText({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-[length:calc(14.5px*var(--fs))] text-danger-ink">{children}</p>
}

function Status({ tone, icon, children }: { tone: 'info' | 'success' | 'warning' | 'danger'; icon: ReactNode; children: ReactNode }) {
  const cls = { info: 'bg-sky-100 text-navy-900', success: 'bg-success-tint text-navy-900', warning: 'bg-warning-tint text-navy-900', danger: 'bg-danger-tint text-navy-900' }[tone]
  return <p role="status" className={cn('mt-3 flex items-start gap-2 rounded-lg px-4 py-3 text-left text-[length:calc(15px*var(--fs))]', cls)}><span className="icon-line flex items-center">{icon}</span>{children}</p>
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
