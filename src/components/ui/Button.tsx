import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'success' | 'ghost' | 'danger' | 'danger-solid'
type Size = 'sm' | 'md' | 'lg'

/**
 * BMIS button standard (every button and button-like link uses these classes):
 *  - Height: min 44px (sm), 48px (md, default), 56px (lg, main action on a phone). Labels may wrap to a
 *    second line; the button grows instead of clipping, and buttons in one row stretch to the same height.
 *  - Text: semibold, centred, 15.5 / 16.5 / 17.5px (scaled by the text-size setting), leading-tight.
 *  - Icons: 20px, 8px from the label, never shrink.
 *  - Radius var(--radius-control), 1px border on every variant (transparent where not visible), so
 *    neighbouring buttons line up exactly.
 *  - Meaning, not decoration (one look per kind of action, everywhere):
 *      primary   dark navy: the main next step (Submit, Save, Approve, Start work, Confirm).
 *      secondary white with a light border: supporting actions (Edit, View, Back, Request more information).
 *      success   white with a restrained green outline: finishing work (Resolve, Mark as returned, Complete).
 *      danger    white with a red outline: starts a cancel/reject/deactivate (always confirmed).
 *      danger-solid red: only the final confirmation inside a dialog.
 *  - A blocked action (missing information) looks disabled but can still be tapped to show why.
 *  - States: hover, pressed (darker + slight press), visible focus ring, disabled (50% and not-allowed),
 *    loading (spinner in place of the icon, aria-busy).
 */
export const buttonBase =
  'bmis-press inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] border font-semibold leading-tight text-center whitespace-normal break-words transition-colors select-none [&_svg]:size-5 [&_svg]:shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-600 disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50'

export const buttonVariants: Record<Variant, string> = {
  primary: 'border-navy-900 bg-navy-900 text-white hover:bg-navy-800 hover:border-navy-800 active:bg-navy-950',
  secondary: 'border-line bg-surface text-navy-900 hover:border-navy-600/50 hover:bg-surface-muted active:bg-sky-100',
  ghost: 'border-transparent text-ink-nav hover:bg-surface-muted hover:text-navy-900 active:bg-sky-100',
  success: 'border-success/60 bg-surface text-success hover:bg-success-tint active:bg-success-tint',
  danger: 'border-danger/50 bg-surface text-danger-ink hover:bg-danger-tint active:bg-danger-tint',
  'danger-solid': 'border-danger bg-danger text-white hover:brightness-95 active:brightness-90',
}

export const buttonSizes: Record<Size, string> = {
  sm: 'min-h-11 px-4 py-1.5 text-[length:calc(15.5px*var(--fs))]',
  md: 'min-h-12 px-5 py-2 text-[length:calc(16.5px*var(--fs))]',
  lg: 'min-h-14 px-6 py-2.5 text-[length:calc(17.5px*var(--fs))]',
}

/** Class string for anything that must look like a button (e.g. a plain <a> or a custom Link). */
export const buttonClass = (variant: Variant = 'primary', size: Size = 'md', className?: string) => cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)

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
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      aria-disabled={blockedReason ? true : undefined}
      onClick={(e) => {
        const now = Date.now()
        if (now - lastTap.current < 400) { e.preventDefault(); return }
        lastTap.current = now
        if (blockedReason) { e.preventDefault(); setWhy(true); return }
        onClick?.(e)
      }}
      {...rest}
    >
      {loading ? <span aria-hidden className="size-5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" /> : icon}
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
    <Link to={to} className={buttonClass(variant, size, className)}>
      {icon}
      {children}
    </Link>
  )
}

/**
 * Icon-only button (notifications, edit, delete, expand…). Always 44×44 with a 20px icon and a
 * required accessible name, shown as a tooltip too.
 */
export function IconButton({ label, variant = 'ghost', className, children, ...rest }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> & { label: string; variant?: Variant }) {
  return (
    <button type="button" aria-label={label} title={label} className={cn(buttonBase, buttonVariants[variant], 'size-11 shrink-0 p-0', className)} {...rest}>
      {children}
    </button>
  )
}
