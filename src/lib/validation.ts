/**
 * Shared form rules and messages. The same functions run in the form (to show
 * the message under the field) and in the service layer (so a request that
 * skips the form is still refused). Messages say what to fix, with an example.
 */

export const MSG = {
  required: (what: string) => `Please enter ${what}. This field is required.`,
  choose: (what: string) => `Please select ${what}.`,
  yesNo: 'Please select Yes or No.',
  email: 'Please enter a valid email address. Example: name@gmail.com',
  mobile: 'Please enter an 11-digit mobile number that starts with 09. Example: 09171234567',
  year: (min: number, max: number) => `Please enter a valid year from ${min} to ${max}. Example: 2020`,
  date: 'Please choose a date.',
  reason: (min = 10) => `Please explain in a few words (at least ${min} characters).`,
}

export const isEmail = (v: string) => /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[A-Za-z]{2,}$/.test(v.trim())
export const normalizeMobile = (v: string) => v.replace(/[\s()-]/g, '').replace(/^\+63/, '0')
export const isMobile = (v: string) => /^09\d{9}$/.test(normalizeMobile(v))
export const filled = (v: unknown) => (typeof v === 'string' ? v.trim().length > 0 : v !== undefined && v !== null && v !== false)

/** Year check: four digits, within range. */
export function yearProblem(v: string, min: number, max: number): string | null {
  if (!v.trim()) return MSG.year(min, max)
  if (!/^\d{4}$/.test(v.trim())) return MSG.year(min, max)
  const n = Number(v)
  return n < min || n > max ? MSG.year(min, max) : null
}

export type Errors<K extends string = string> = Partial<Record<K, string>>
export const hasErrors = (e: Errors) => Object.values(e).some(Boolean)

/** Joins field errors into one sentence for a service-layer refusal. */
export const errorSummary = (e: Errors) => Object.values(e).filter(Boolean).join(' ')

/**
 * Brings the first field marked aria-invalid into view and puts the cursor in
 * it, after React has drawn the error messages. Call right after a failed
 * submit so the button never looks unresponsive.
 */
export function focusFirstInvalid(root: ParentNode | null = typeof document !== 'undefined' ? document : null) {
  if (!root) return
  requestAnimationFrame(() => {
    const el = root.querySelector<HTMLElement>('[aria-invalid="true"]') ?? root.querySelector<HTMLElement>('[data-invalid="true"]')
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (typeof el.focus === 'function') el.focus({ preventScroll: true })
  })
}
