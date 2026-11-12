/**
 * BARANGAY 181 IDENTIFIERS.
 *
 * Permanent people and places:
 *   Resident        RES-181-YYYY-NNNNNN  (year the record was first created)
 *   Household       HH-181-NNNNNN
 *   Family          FAM-181-NNNNNN       (a household can hold several families)
 *   Portal account  ACC-181-NNNNNN       (a login, linked to one resident record)
 *   Personnel       EMP-181-NNNNNN       (never the same as a resident number)
 * Transactions keep their own references (e.g. CLR-2026-0306, APT-2026-0001,
 * BRW-2026-042, ANN-2026-0004, KP-2026-031) and are never used as a person's ID.
 *
 * Rules: numbers never change when details change, are never reused (the
 * counter only goes up, even if a record is archived), and carry no personal
 * information. The internal id (database primary key, a UUID on Supabase) is
 * separate from this human-readable number. On Supabase each series is a
 * database sequence with a unique constraint, so two registrations at the same
 * moment cannot get the same number (docs/supabase/identifiers.sql).
 */

export const BARANGAY_CODE = '181'
export type Series = 'RES' | 'HH' | 'FAM' | 'ACC' | 'EMP'

const pad = (n: number) => String(n).padStart(6, '0')
export const residentNumber = (year: number | string, n: number) => `RES-${BARANGAY_CODE}-${year}-${pad(n)}`
export const householdNumber = (n: number) => `HH-${BARANGAY_CODE}-${pad(n)}`
export const familyNumber = (n: number) => `FAM-${BARANGAY_CODE}-${pad(n)}`
export const accountNumber = (n: number) => `ACC-${BARANGAY_CODE}-${pad(n)}`
export const personnelNumber = (n: number) => `EMP-${BARANGAY_CODE}-${pad(n)}`

const PATTERN: Record<Series, RegExp> = {
  RES: /^RES-181-\d{4}-\d{6}$/,
  HH: /^HH-181-\d{6}$/,
  FAM: /^FAM-181-\d{6}$/,
  ACC: /^ACC-181-\d{6}$/,
  EMP: /^EMP-181-\d{6}$/,
}
export const isValidId = (series: Series, id: string) => PATTERN[series].test(id)
const seqOf = (id: string) => Number(id.split('-').pop()) || 0

const KEY = 'bmis.idSequences'
/**
 * Next number in a series. Takes the highest of the saved counter and the
 * numbers already in use, then saves the new value before returning it, so a
 * number is handed out once and never again. (Prototype: one browser. On
 * Supabase this is nextval() on a sequence.)
 */
export function nextNumber(series: Series, inUse: string[]): number {
  let saved: Partial<Record<Series, number>> = {}
  try { saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') } catch { /* first use */ }
  const n = Math.max(saved[series] ?? 0, ...inUse.filter((x) => PATTERN[series].test(x)).map(seqOf), 0) + 1
  try { localStorage.setItem(KEY, JSON.stringify({ ...saved, [series]: n })) } catch { /* ignore */ }
  return n
}
