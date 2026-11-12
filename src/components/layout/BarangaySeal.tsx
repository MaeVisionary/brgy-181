import { cn } from '@/lib/cn'

/**
 * Official Barangay 181 seal (public/seal.png, supplied by the barangay team).
 * On navy backgrounds use `onDark`: the seal sits on an even white circle
 * (drawn by CSS, not a second image), so its edge is round and the same on every side.
 */
export function BarangaySeal({ className, onDark }: { className?: string; onDark?: boolean }) {
  if (!onDark) {
    return <img src={`${import.meta.env.BASE_URL}seal.png`} alt="Barangay 181 seal" className={cn('size-9 shrink-0 rounded-full object-contain', className)} />
  }
  return (
    <span className={cn('inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white', className)}>
      <img src={`${import.meta.env.BASE_URL}seal.png`} alt="Barangay 181 seal" className="size-[90%] object-contain" />
    </span>
  )
}
