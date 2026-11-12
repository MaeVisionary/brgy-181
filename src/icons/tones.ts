/** Apple-style icon tiles: soft tint background + rich foreground. One colour per function. */
/**
 * Icon colours. Icons are plain navy line icons with no coloured tile; colour
 * is kept only for real meaning (red = overdue / error). The names are kept so
 * existing call sites stay valid.
 */
const NEUTRAL = 'text-navy-800'
export const TONE = {
  blue: NEUTRAL,
  indigo: NEUTRAL,
  purple: NEUTRAL,
  green: NEUTRAL,
  teal: NEUTRAL,
  orange: NEUTRAL,
  red: 'text-danger',
  gray: NEUTRAL,
} as const
export type ToneName = keyof typeof TONE

/** One colour per function, used by the sidebar, mobile menu and anywhere a page icon appears. */
const PATH_TONE: [string, ToneName][] = [
  ['/dashboard', 'blue'],
  ['/residents/registrations', 'green'],
  ['/residents/change-requests', 'teal'],
  ['/residents/households', 'blue'],
  ['/residents', 'blue'],
  ['/documents/approvals', 'green'],
  ['/documents/templates', 'blue'],
  ['/documents', 'blue'],
  ['/cases', 'orange'],
  ['/hearings', 'indigo'],
  ['/inventory', 'orange'],
  ['/borrowing', 'orange'],
  ['/analytics', 'indigo'],
  ['/reports', 'purple'],
  ['/payments', 'green'],
  ['/notifications', 'red'],
  ['/admin/users', 'purple'],
  ['/admin/roles', 'purple'],
  ['/admin/personnel', 'purple'],
  ['/admin/activity', 'gray'],
  ['/admin/settings', 'gray'],
  ['/admin/health', 'green'],
  ['/my/documents', 'blue'],
  ['/my/complaints', 'orange'],
  ['/my/borrowing', 'orange'],
  ['/my/transactions', 'teal'],
  ['/my/profile', 'blue'],
  ['/account', 'gray'],
]
export function toneForPath(path?: string): string {
  if (!path) return TONE.gray
  const hit = PATH_TONE.find(([p]) => path === p || path.startsWith(p + '/'))
  return TONE[hit?.[1] ?? 'gray']
}
