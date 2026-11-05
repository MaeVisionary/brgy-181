import { cn } from '@/lib/cn'

/**
 * PLACEHOLDER SEAL. Replace with the official Barangay 181 seal (PNG/SVG)
 * once provided: drop it in /public/seal.png and swap this markup for an <img>.
 */
export function BarangaySeal({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Barangay 181 seal (placeholder)"
      className={cn(
        'grid size-8 shrink-0 place-items-center rounded-full border-2 border-navy-900 bg-sky-100 font-display text-[10px] font-extrabold text-navy-900',
        className,
      )}
    >
      181
    </span>
  )
}
