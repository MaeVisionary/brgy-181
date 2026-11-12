/**
 * Reads the text on an uploaded ID (tesseract.js, loaded only when needed) and
 * checks that the name and ID number typed by the applicant appear on it.
 * This ties the ID to the typed details: without it, someone could use their
 * own ID (their own face) with another resident's name and birthdate.
 *
 * Phone photos of IDs are often hard to read, so "not found" is treated as
 * inconclusive (manual review), never as an automatic denial.
 */

export interface OcrResult {
  result: 'passed' | 'inconclusive'
  found: { firstName: boolean; lastName: boolean; idNumber: boolean; birthDate?: boolean; expiry?: boolean }
}

const clean = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()

/** Letters/digits only, so "DELA CRUZ" matches "DELACRUZ" and "1234-5678" matches "12345678". */
const squash = (s: string) => clean(s).replace(/[^A-Z0-9]/g, '')

export async function readIdText(image: string, timeoutMs = 60_000): Promise<string> {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng')
  try {
    const job = worker.recognize(image).then((r) => r.data.text)
    const timeout = new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs))
    return await Promise.race([job, timeout])
  } finally {
    worker.terminate().catch(() => undefined)
  }
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

/** Whether an ISO date (YYYY-MM-DD) appears on the ID in a common printed format. */
export function textHasDate(text: string, iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return false
  const [, y, mo, d] = m
  const all = squash(text)
  const mon = MONTHS[Number(mo) - 1]
  const forms = [`${y}${mo}${d}`, `${mo}${d}${y}`, `${d}${mo}${y}`, `${mon}${d}${y}`, `${d}${mon}${y}`, `${mon}${Number(d)}${y}`, `${Number(d)}${mon}${y}`]
  return forms.some((f) => all.includes(f))
}

export function checkIdText(text: string, applicant: { firstName: string; lastName: string; idNumber: string; birthDate?: string; expiry?: string }): OcrResult {
  const all = squash(text)
  const words = new Set(clean(text).split(/[^A-Z0-9]+/).filter(Boolean))
  const firstToken = clean(applicant.firstName).split(/\s+/).filter(Boolean)[0] ?? ''
  const lastName = squash(applicant.lastName)
  const idNo = squash(applicant.idNumber)
  const found = {
    firstName: firstToken.length > 1 && (words.has(firstToken) || all.includes(squash(firstToken))),
    lastName: lastName.length > 1 && all.includes(lastName),
    idNumber: idNo.length >= 4 && all.includes(idNo),
    birthDate: applicant.birthDate ? textHasDate(text, applicant.birthDate) : undefined,
    expiry: applicant.expiry ? textHasDate(text, applicant.expiry) : undefined,
  }
  return { result: found.firstName && found.lastName ? 'passed' : 'inconclusive', found }
}
