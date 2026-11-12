import { Check, X } from '@/icons'
import { cn } from '@/lib/cn'

/**
 * On/off switch. With `showState` it shows "Enabled" / "Disabled" beside it.
 * `offTone="danger"` makes the off state red (for explicit denials); the
 * default grey suits large grids where most cells are off.
 */
export function Toggle({
  checked,
  onChange,
  label,
  disabled,
  showState,
  offTone = 'neutral',
  size = 'md',
}: {
  checked: boolean
  onChange: (next: boolean) => void
  /** Accessible name, e.g. "Secretary: View document requests". */
  label: string
  disabled?: boolean
  showState?: boolean
  offTone?: 'neutral' | 'danger'
  size?: 'sm' | 'md'
}) {
  const sm = size === 'sm'
  return (
    <span className="inline-flex items-center gap-3">
      {showState && (
        <span className={cn('w-[72px] text-right text-[length:calc(14.5px*var(--fs))] font-semibold', disabled ? 'text-ink-subtle' : checked ? 'text-navy-600' : offTone === 'danger' ? 'text-danger-ink' : 'text-ink-muted')}>
          {checked ? 'Enabled' : 'Disabled'}
        </span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        title={disabled ? `${label} (locked)` : label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-600 disabled:cursor-not-allowed disabled:opacity-50',
          sm ? 'h-6 w-10' : 'h-7 w-12',
          checked ? 'bg-navy-600' : offTone === 'danger' ? 'bg-danger' : 'bg-line',
        )}
      >
        <span
          className={cn(
            'absolute grid place-items-center rounded-full bg-white shadow-sm transition-transform',
            sm ? 'size-5 translate-x-0.5' : 'size-6 translate-x-0.5',
            checked && (sm ? 'translate-x-[18px]' : 'translate-x-[22px]'),
          )}
        >
          {checked ? (
            <Check className={cn('text-navy-600', sm ? 'size-3' : 'size-3.5')} strokeWidth={3} />
          ) : offTone === 'danger' ? (
            <X className={cn('text-danger', sm ? 'size-3' : 'size-3.5')} strokeWidth={3} />
          ) : null}
        </span>
      </button>
    </span>
  )
}
