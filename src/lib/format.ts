const LOCALE = 'en-PH'
const TZ = 'Asia/Manila'

export const formatNumber = (n: number) => n.toLocaleString(LOCALE)

export const formatDate = (iso: string | Date) =>
  new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', timeZone: TZ })

export const formatDateTime = (iso: string | Date) =>
  `${formatDate(iso)}, ${new Date(iso).toLocaleTimeString(LOCALE, { hour: 'numeric', minute: '2-digit', timeZone: TZ })}`

export const formatWeekday = (iso: string | Date) =>
  new Date(iso).toLocaleDateString('en-GB', { weekday: 'long', timeZone: TZ })

export function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diff / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} hr ago`
  const days = Math.round(hrs / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  return formatDate(iso)
}

/** Filipino greeting by time of day in Manila. */
export function greeting(now = new Date()): string {
  const hour = Number(now.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: TZ }))
  if (hour < 12) return 'Magandang umaga'
  if (hour < 18) return 'Magandang hapon'
  return 'Magandang gabi'
}

export const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
