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

/** A sample timestamp `days` before MOCK_TODAY at `hour` o'clock Philippine time (UTC+8), on any machine. */
export function isoDaysAgo(days: number, hour = 9): string {
  const base = Date.UTC(2026, 10, 5) // 5 November 2026
  return new Date(base - days * 86400000 + (hour - 8) * 3600000).toISOString()
}
