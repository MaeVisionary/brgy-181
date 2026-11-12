import { useEffect, useState } from 'react'
import { EMAIL_CONFIGURED } from './emailService'

/**
 * System status from REAL checks run in the browser when asked. Nothing here
 * says "working" without having checked it; items with no service behind
 * them yet (database, backups, e-mail) say so plainly.
 */
export type HealthState = 'ok' | 'problem' | 'not_set_up'
export interface HealthItem { key: string; label: string; state: HealthState; detail: string }
export interface HealthReport { checkedAt: string; items: HealthItem[] }

async function checkServer(): Promise<HealthItem> {
  // The web server that hosts the app: fetch the app's own page, bypassing the cache.
  const started = performance.now()
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}index.html?health=${Date.now()}`, { cache: 'no-store' })
    const ms = Math.round(performance.now() - started)
    return r.ok
      ? { key: 'app', label: 'Application', state: 'ok', detail: `Running · server answered in ${ms} ms` }
      : { key: 'app', label: 'Application', state: 'problem', detail: `Server answered with an error (${r.status})` }
  } catch {
    return { key: 'app', label: 'Application', state: 'problem', detail: navigator.onLine ? 'Server did not answer' : 'This device is offline' }
  }
}

function checkStorage(): HealthItem {
  const k = 'bmis.health.probe'
  try {
    localStorage.setItem(k, '1')
    const ok = localStorage.getItem(k) === '1'
    localStorage.removeItem(k)
    let bytes = 0
    for (let i = 0; i < localStorage.length; i++) { const key = localStorage.key(i)!; bytes += key.length + (localStorage.getItem(key)?.length ?? 0) }
    return ok
      ? { key: 'storage', label: 'Records on this device', state: 'ok', detail: `Saving works · about ${Math.max(1, Math.round((bytes * 2) / 1024))} KB used` }
      : { key: 'storage', label: 'Records on this device', state: 'problem', detail: 'Saved data could not be read back' }
  } catch {
    return { key: 'storage', label: 'Records on this device', state: 'problem', detail: 'This browser blocks saving (private mode or storage full)' }
  }
}

export async function runHealthChecks(): Promise<HealthReport> {
  const items: HealthItem[] = [
    await checkServer(),
    { key: 'online', label: 'Internet connection', state: navigator.onLine ? 'ok' : 'problem', detail: navigator.onLine ? 'Online' : 'Offline' },
    checkStorage(),
    { key: 'https', label: 'Secure connection (HTTPS)', state: location.protocol === 'https:' ? 'ok' : location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? 'not_set_up' : 'problem', detail: location.protocol === 'https:' ? 'Active' : location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? 'Not used (local development)' : 'Not secure: the page is not using HTTPS' },
    { key: 'db', label: 'Database', state: 'not_set_up', detail: 'Not connected yet (records are kept on this device)' },
    { key: 'backup', label: 'Regular backups', state: 'not_set_up', detail: 'Not set up yet (needs the database)' },
    { key: 'email', label: 'E-mail notifications', state: EMAIL_CONFIGURED ? 'ok' : 'not_set_up', detail: EMAIL_CONFIGURED ? 'Configured' : 'Not configured (messages are recorded, not sent)' },
  ]
  return { checkedAt: new Date().toISOString(), items }
}

/** Runs the checks on open and when asked again. */
export function useHealth() {
  const [report, setReport] = useState<HealthReport | null>(null)
  const [busy, setBusy] = useState(false)
  const run = () => { setBusy(true); runHealthChecks().then(setReport).finally(() => setBusy(false)) }
  useEffect(run, [])
  return { report, busy, run }
}
