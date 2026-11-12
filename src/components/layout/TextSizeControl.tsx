import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'

export type TextSize = 'small' | 'default' | 'large'
const KEY = 'bmis.textSize'
const ORDER: TextSize[] = ['small', 'default', 'large']
const LABEL: Record<TextSize, string> = { small: 'Small', default: 'Default', large: 'Large' }

export function readTextSize(): TextSize {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'small' || v === 'large' ? v : 'default'
  } catch {
    return 'default'
  }
}

/** Applies the text size to <html> and remembers it on this device. */
export function applyTextSize(size: TextSize) {
  document.documentElement.dataset.text = size
  try {
    localStorage.setItem(KEY, size)
  } catch {
    /* ignore */
  }
}

/**
 * One compact "Aa" button; it opens a small panel with Smaller, Default and
 * Larger. The choice applies everywhere and is remembered.
 */
export function TextSizeControl({ className }: { className?: string }) {
  const [size, setSize] = useState<TextSize>(readTextSize)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => applyTextSize(size), [size])
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close) }
  }, [open])
  const opt = (s: TextSize, face: string, cls: string, label: string) => (
    <button
      type="button"
      onClick={() => setSize(s)}
      aria-pressed={size === s}
      aria-label={label}
      className={cn('flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-[10px] border font-bold', size === s ? 'border-navy-900 bg-sky-100 text-navy-900' : 'border-line text-navy-900 hover:bg-surface-muted')}
    >
      <span className={cls}>{face}</span>
      <span className="text-[12px] font-semibold text-ink-nav">{LABEL[s]}</span>
    </button>
  )
  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Text size: ${LABEL[size]}`}
        title="Text size"
        className={cn('grid size-11 place-items-center rounded-full font-bold text-navy-900 hover:bg-surface-muted', open && 'bg-surface-muted')}
      >
        <span className="text-[17px] leading-none">A<span className="text-[13px]">a</span></span>
      </button>
      {open && (
        <div role="dialog" aria-label="Text size" className="absolute top-full right-0 z-50 mt-2 w-[260px] rounded-2xl border border-line bg-surface p-3 shadow-xl">
          <p className="mb-2 px-1 text-[14px] font-semibold text-navy-900">Text size</p>
          <div className="flex gap-2">
            {opt('small', 'A−', 'text-[15px]', 'Smaller text')}
            {opt('default', 'A', 'text-[18px]', 'Default text size')}
            {opt('large', 'A+', 'text-[22px]', 'Larger text')}
          </div>
        </div>
      )}
    </div>
  )
}

export const TEXT_SIZES = ORDER
