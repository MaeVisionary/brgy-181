/** Apple-style icon tiles: soft tint background + rich foreground. One colour per function. */
export const TONE = {
  blue: 'bg-[#e6f0fd] text-[#0a66d8]',
  indigo: 'bg-[#ecebfd] text-[#4f46c8]',
  purple: 'bg-[#f3eafc] text-[#8a3fc7]',
  green: 'bg-[#e5f6ea] text-[#1f8a43]',
  teal: 'bg-[#e1f5f4] text-[#0f8a84]',
  orange: 'bg-[#fff0e1] text-[#d06a0a]',
  red: 'bg-[#fde9e8] text-[#d6342c]',
  gray: 'bg-[#eef0f2] text-[#5b6670]',
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
