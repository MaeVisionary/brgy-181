/**
 * ONE SUBMISSION PER DRAFT.
 *
 * Every form submission carries its draft id as a one-time key. If the same key
 * comes in again (the person pressed Submit twice, or retried after the
 * connection dropped before the answer arrived), the record already created is
 * returned instead of a second one. Keys are tied to the account that sent them.
 *
 * Prototype: remembered in this browser for 7 days. On Supabase this is a
 * unique client_request_id column on each transaction table
 * (docs/supabase/drafts.sql), so the database itself refuses the duplicate.
 */

const KEY = 'bmis.idempotency'
const TTL = 7 * 24 * 3_600_000
type Map = Record<string, { id: string; at: number }>

const read = (): Map => {
  try {
    const m = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Map
    const now = Date.now()
    for (const k of Object.keys(m)) if (now - m[k].at > TTL) delete m[k]
    return m
  } catch { return {} }
}

/**
 * Runs `make` once per key. A repeat with the same key returns the earlier
 * record (found with `find`) when it still exists.
 */
export function once<T>(key: string | undefined, find: (id: string) => T | undefined, idOf: (t: T) => string, make: () => T): T {
  if (!key) return make()
  const m = read()
  const prior = m[key]
  if (prior) {
    const existing = find(prior.id)
    if (existing) return existing
  }
  const created = make()
  m[key] = { id: idOf(created), at: Date.now() }
  try { localStorage.setItem(KEY, JSON.stringify(m)) } catch { /* the record is still created */ }
  return created
}

/** For async flows: the record already created for this key, if any. */
export function recall<T>(key: string | undefined, find: (id: string) => T | undefined): T | undefined {
  if (!key) return undefined
  const prior = read()[key]
  return prior ? find(prior.id) : undefined
}

/** For async flows: remember which record this key created. */
export function remember(key: string | undefined, id: string) {
  if (!key) return
  const m = read()
  m[key] = { id, at: Date.now() }
  try { localStorage.setItem(KEY, JSON.stringify(m)) } catch { /* ignore */ }
}
