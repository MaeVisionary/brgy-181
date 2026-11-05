import { cn } from '@/lib/cn'

/** Official Barangay 181 seal (public/seal.png, supplied by the barangay team). */
export function BarangaySeal({ className }: { className?: string }) {
  return <img src="/seal.png" alt="Barangay 181 seal" className={cn('size-9 shrink-0 object-contain', className)} />
}
