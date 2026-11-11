import { cn } from '@/lib/cn'

/**
 * Official Barangay 181 seal (public/seal.png, supplied by the barangay team).
 * On navy backgrounds use `onDark`: the seal-white.png copy has an even white
 * circle around the seal so its edge stays visible.
 */
export function BarangaySeal({ className, onDark }: { className?: string; onDark?: boolean }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}${onDark ? 'seal-white.png' : 'seal.png'}`}
      alt="Barangay 181 seal"
      className={cn('size-9 shrink-0 rounded-full object-contain', className)}
    />
  )
}
