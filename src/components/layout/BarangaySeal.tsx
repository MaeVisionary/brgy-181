import { cn } from '@/lib/cn'

/** Official Barangay 181 seal (public/seal.png, supplied by the barangay team). */
export function BarangaySeal({ className, onDark }: { className?: string; onDark?: boolean }) {
  const img = <img src={`${import.meta.env.BASE_URL}seal.png`} alt="Barangay 181 seal" className={cn('size-9 shrink-0 object-contain', !onDark && className, onDark && 'size-full')} />
  if (!onDark) return img
  // On navy panels the seal sits on a white disc so its edge stays visible.
  return <span className={cn('grid size-9 shrink-0 place-items-center rounded-full bg-white p-0.5 shadow-sm', className)}>{img}</span>
}
