/**
 * Deterministic pseudo-random generator so mock data is identical on every load.
 * MOCK DATA ONLY: replace with backend responses in the integration phase.
 */
export function createRng(seed: number) {
  let s = seed >>> 0
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T,>(items: readonly T[]): T => items[Math.floor(next() * items.length)],
    chance: (p: number) => next() < p,
  }
}

/** Fixed "today" for mock data so ages and dates stay stable. */
export const MOCK_TODAY = new Date('2026-11-05T09:00:00+08:00')

export function isoDaysAgo(days: number, hour = 9): string {
  const d = new Date(MOCK_TODAY)
  d.setDate(d.getDate() - days)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}
