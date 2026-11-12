import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const base =
  'inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50'

const variants: Record<Variant, string> = {
  primary: 'bg-navy-900 text-white hover:bg-navy-800 active:bg-navy-950',
  secondary: 'border border-line bg-surface text-navy-900 hover:bg-surface-muted',
  ghost: 'text-ink-nav hover:bg-surface-muted hover:text-navy-900',
  danger: 'border border-danger/40 bg-surface text-danger-ink hover:bg-danger-tint',
}

const sizes: Record<Size, string> = {
  sm: 'h-11 px-4 text-[length:calc(15.5px*var(--fs))]',
  md: 'h-12 px-5 text-[length:calc(16.5px*var(--fs))]',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
  /**
   * Why the action cannot run yet (e.g. "Please choose a time."). The button
   * stays tappable; a tap shows this message under it instead of doing nothing.
   * The message goes away by itself once the reason is resolved.
   */
  blockedReason?: string | false | null
}

export function Button({ variant = 'primary', size = 'md', loading, icon, className, children, disabled, blockedReason, onClick, ...rest }: ButtonProps) {
  const [why, setWhy] = useState(false)
  // A second tap within 400 ms is ignored, so a double tap never runs an action twice (two steps, two submissions).
  const lastTap = useRef(0)
  useEffect(() => { if (!blockedReason) setWhy(false) }, [blockedReason])
  const btn = (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      onClick={(e) => {
        const now = Date.now()
        if (now - lastTap.current < 400) { e.preventDefault(); return }
        lastTap.current = now
        if (blockedReason) { e.preventDefault(); setWhy(true); return }
        onClick?.(e)
      }}
      {...rest}
    >
      {loading ? <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : icon}
      {children}
    </button>
  )
  if (!(why && blockedReason)) return btn
  return (
    <>
      {btn}
      <p role="alert" className="w-full basis-full text-[length:calc(15px*var(--fs))] leading-snug font-semibold whitespace-normal text-danger-ink">{blockedReason}</p>
    </>
  )
}

export function ButtonLink({
  to,
  variant = 'primary',
  size = 'md',
  icon,
  className,
  children,
}: {
  to: string
  variant?: Variant
  size?: Size
  icon?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <Link to={to} className={cn(base, variants[variant], sizes[size], className)}>
      {icon}
      {children}
    </Link>
  )
}
