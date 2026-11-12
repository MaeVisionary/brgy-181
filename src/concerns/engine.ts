/**
 * COMMUNITY CONCERN ENGINE (pure functions, no storage).
 *
 * Matching is rule-based and explainable: words are mapped to shared
 * "concepts" (so "light post is not working" and "street is dark at night"
 * both mean STREETLIGHT), then reports are compared by concept, category and
 * location. Location is required for automatic grouping: different streets
 * are never grouped, and a missing street means manual review. A semantic AI
 * matcher can be added later behind `similarity()` without changing callers.
 */

export const CONCERN_CATEGORIES = [
  'Roads and sidewalks',
  'Streetlights and electrical',
  'Garbage and sanitation',
  'Drainage and flooding',
  'Water supply',
  'Public safety',
  'Noise',
  'Stray animals',
  'Public facilities',
  'Traffic and access',
  'Environment',
  'Other',
] as const
export type ConcernCategory = (typeof CONCERN_CATEGORIES)[number]

export const FREQUENCIES = ['Once', 'Sometimes', 'Every day', 'All the time'] as const

/** Concept → words and phrases (English and Filipino) that express it. */
const CONCEPTS: Record<string, { category: ConcernCategory; words: string[]; hazard?: boolean }> = {
  STREETLIGHT: { category: 'Streetlights and electrical', words: ['streetlight', 'street light', 'light post', 'lamp post', 'lamppost', 'poste', 'ilaw', 'dark', 'madilim', 'no light', 'walang ilaw', 'bulb', 'light is out', 'lights out', 'not lit'] },
  ELECTRIC_HAZARD: { category: 'Streetlights and electrical', hazard: true, words: ['live wire', 'exposed wire', 'sparking', 'spark', 'nagspark', 'kuryente', 'electrocut', 'fallen wire', 'wire fell', 'short circuit', 'smoke from post'] },
  FIRE: { category: 'Public safety', hazard: true, words: ['fire', 'sunog', 'burning', 'smoke', 'usok'] },
  GAS: { category: 'Public safety', hazard: true, words: ['gas leak', 'smell of gas', 'amoy gas'] },
  COLLAPSE: { category: 'Public safety', hazard: true, words: ['collapse', 'gumuho', 'falling', 'about to fall', 'nakatumba', 'leaning', 'sinkhole'] },
  FLOOD: { category: 'Drainage and flooding', words: ['flood', 'baha', 'binabaha', 'water rises', 'stagnant water', 'standing water'] },
  DRAIN: { category: 'Drainage and flooding', words: ['drain', 'drainage', 'kanal', 'canal', 'clogged', 'barado', 'estero', 'manhole', 'sewer'] },
  GARBAGE: { category: 'Garbage and sanitation', words: ['garbage', 'basura', 'trash', 'rubbish', 'waste', 'not collected', 'collection', 'smell', 'mabaho', 'dumping'] },
  WATER: { category: 'Water supply', words: ['no water', 'walang tubig', 'water supply', 'water pressure', 'tubig', 'pipe leak', 'leaking pipe', 'water leak', 'tagas'] },
  ROAD: { category: 'Roads and sidewalks', words: ['pothole', 'lubak', 'road', 'kalsada', 'sidewalk', 'bangketa', 'crack', 'sira ang daan', 'uneven'] },
  NOISE: { category: 'Noise', words: ['noise', 'ingay', 'maingay', 'karaoke', 'videoke', 'loud', 'music', 'tambay'] },
  ANIMAL: { category: 'Stray animals', words: ['stray', 'dog', 'aso', 'cat', 'pusa', 'askal', 'bite', 'kagat'] },
  FACILITY: { category: 'Public facilities', words: ['court', 'covered court', 'basketball', 'barangay hall', 'health center', 'playground', 'park', 'comfort room', 'cr'] },
  TRAFFIC: { category: 'Traffic and access', words: ['traffic', 'trapik', 'parking', 'parked', 'blocked', 'harang', 'obstruction', 'tricycle'] },
  SAFETY: { category: 'Public safety', words: ['theft', 'nakawan', 'snatch', 'fight', 'away', 'drunk', 'lasing', 'unsafe', 'danger'] },
  ENV: { category: 'Environment', words: ['tree', 'puno', 'smoke belching', 'burning trash', 'pollution', 'polusyon'] },
}

const norm = (s: string) => ` ${s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim()} `

/** Concepts found in a text. */
export function conceptsOf(text: string): Set<string> {
  const t = norm(text)
  const found = new Set<string>()
  for (const [id, c] of Object.entries(CONCEPTS)) if (c.words.some((w) => t.includes(` ${w}`) || t.includes(`${w} `))) found.add(id)
  return found
}

export const isHazard = (concepts: Set<string>) => [...concepts].some((c) => CONCEPTS[c]?.hazard)

/** Suggests a category from the words used (used when the resident chose "Not sure"). */
export function suggestCategory(text: string): ConcernCategory {
  const counts = new Map<ConcernCategory, number>()
  for (const c of conceptsOf(text)) counts.set(CONCEPTS[c].category, (counts.get(CONCEPTS[c].category) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Other'
}

const words = (s: string) => new Set(norm(s).trim().split(' ').filter((w) => w.length > 2))
const jaccard = (a: Set<string>, b: Set<string>) => {
  if (!a.size || !b.size) return 0
  let n = 0
  for (const x of a) if (b.has(x)) n++
  return n / (a.size + b.size - n)
}

export type Confidence = 'high' | 'medium' | 'low'

export interface MatchInput {
  category: ConcernCategory
  street?: string
  landmark?: string
  text: string
}

/**
 * Similarity between a new report and an issue (its first report or summary).
 * Returns a 0..1 score, a confidence level and a plain reason.
 */
export function similarity(a: MatchInput, b: MatchInput): { score: number; confidence: Confidence; reason: string } {
  if (!a.street || !b.street) return { score: 0, confidence: 'low', reason: 'No street given' }
  if (a.street !== b.street) return { score: 0, confidence: 'low', reason: 'Different street' }
  const ca = conceptsOf(a.text)
  const cb = conceptsOf(b.text)
  const sharedConcept = [...ca].some((c) => cb.has(c))
  const sameCategory = a.category === b.category && a.category !== 'Other'
  if (!sharedConcept && !sameCategory) return { score: 0.1, confidence: 'low', reason: 'Different problem' }
  const landmark = a.landmark && b.landmark ? jaccard(words(a.landmark), words(b.landmark)) : 0
  const text = jaccard(words(a.text), words(b.text))
  const score = Math.min(1, (sameCategory ? 0.35 : 0) + (sharedConcept ? 0.4 : 0) + 0.15 * Math.min(1, landmark * 2) + 0.1 * Math.min(1, text * 3))
  const confidence: Confidence = score >= 0.7 ? 'high' : score >= 0.45 ? 'medium' : 'low'
  const reason = [sharedConcept ? 'same problem' : 'same category', 'same street', landmark > 0 ? 'similar landmark' : null].filter(Boolean).join(', ')
  return { score: Math.round(score * 100) / 100, confidence, reason }
}

export type Priority = 'critical' | 'high' | 'normal' | 'low'
export const PRIORITY_LABEL: Record<Priority, string> = { critical: 'Critical', high: 'High', normal: 'Normal', low: 'Low' }
const RANK: Record<Priority, number> = { critical: 3, high: 2, normal: 1, low: 0 }
export const priorityRank = (p: Priority) => RANK[p]

export interface PriorityFacts {
  reports: number
  uniqueResidents: number
  hazard: boolean
  category: ConcernCategory
  daysOpen: number
  /** Reports in the last 7 days vs the 7 days before. */
  recent: number
  previous: number
}

/** Priority with the reason shown to staff. A single hazard report outranks any count. */
export function computePriority(f: PriorityFacts): { priority: Priority; reason: string; trend: 'rising' | 'falling' | 'steady' } {
  const trend = f.recent > f.previous ? 'rising' : f.recent < f.previous ? 'falling' : 'steady'
  const people = `${f.reports} report${f.reports === 1 ? '' : 's'} from ${f.uniqueResidents} resident${f.uniqueResidents === 1 ? '' : 's'}`
  if (f.hazard) return { priority: 'critical', reason: `Critical: a report describes an immediate safety hazard (${people}). Needs urgent review.`, trend }
  const safetyRelated = ['Public safety', 'Streetlights and electrical', 'Drainage and flooding', 'Water supply'].includes(f.category)
  if (f.uniqueResidents >= 5 || (safetyRelated && f.uniqueResidents >= 3)) return { priority: 'high', reason: `High: ${people} describe the same problem in one place.`, trend }
  if (f.daysOpen >= 14 && f.uniqueResidents >= 2) return { priority: 'high', reason: `High: unresolved for ${f.daysOpen} days with ${people}.`, trend }
  if (f.uniqueResidents === 1 && ['Noise', 'Stray animals', 'Other', 'Environment'].includes(f.category)) return { priority: 'low', reason: `Low: ${people}; can be scheduled or monitored.`, trend }
  return { priority: 'normal', reason: `Normal: ${people}.`, trend }
}
