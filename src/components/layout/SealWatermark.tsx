import { cn } from '@/lib/cn'

/**
 * Oversized, very faint Barangay 181 seal behind a panel (the official asset,
 * unchanged). The parent needs `relative overflow-hidden`; content inside the
 * parent should sit in a `relative` wrapper so it stays above the seal.
 * Never use behind tables, forms, personal data, charts, warnings, buttons or
 * links: if the space is too tight, leave it out. Use of the official seal is
 * subject to the barangay's approval (to be confirmed by the barangay).
 */
export function SealWatermark({ size = 320, onDark, side, className }: { size?: number; onDark?: boolean; /** Vertically centred on the right, for short panels. */ side?: boolean; className?: string }) {
  return (
    <img
      aria-hidden
      alt=""
      draggable={false}
      src={`${import.meta.env.BASE_URL}${onDark ? 'seal-white.png' : 'seal.png'}`}
      style={side ? { width: size, right: -size * 0.12, top: '50%', transform: 'translateY(-50%)' } : { width: size, right: -size * 0.28, bottom: -size * 0.32 }}
      className={cn('pointer-events-none absolute max-w-none select-none', onDark ? 'opacity-[0.08]' : 'opacity-[0.06]', className)}
    />
  )
}
