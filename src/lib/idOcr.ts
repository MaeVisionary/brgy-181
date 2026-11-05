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
  found: { firstName: boolean; lastName: boolean; idNumber: boolean }
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

export function checkIdText(text: string, applicant: { firstName: string; lastName: string; idNumber: string }): OcrResult {
  const all = squash(text)
  const words = new Set(clean(text).split(/[^A-Z0-9]+/).filter(Boolean))
  const firstToken = clean(applicant.firstName).split(/\s+/).filter(Boolean)[0] ?? ''
  const lastName = squash(applicant.lastName)
  const idNo = squash(applicant.idNumber)
  const found = {
    firstName: firstToken.length > 1 && (words.has(firstToken) || all.includes(squash(firstToken))),
    lastName: lastName.length > 1 && all.includes(lastName),
    idNumber: idNo.length >= 4 && all.includes(idNo),
  }
  return { result: found.firstName && found.lastName ? 'passed' : 'inconclusive', found }
}
