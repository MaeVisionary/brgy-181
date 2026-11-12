import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export const inputClass =
  'w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 text-[length:calc(16.5px*var(--fs))] text-navy-900 placeholder:text-ink-subtle focus:border-navy-600 focus:outline-none disabled:bg-surface-muted disabled:text-ink-muted aria-[invalid=true]:border-danger aria-[invalid=true]:bg-danger-tint/30'

/** Label + control. `error` shows a plain-language correction under the control (pair it with aria-invalid on the control). */
export function FieldLabel({ label, required, error, children }: { label: ReactNode; hint?: ReactNode; required?: boolean; error?: string | null | false; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[length:calc(16px*var(--fs))] font-semibold text-navy-900">
        {label}
        {required && <span className="text-danger-ink"> *</span>}
      </span>
      {children}
      {error ? <FieldError>{error}</FieldError> : null}
    </label>
  )
}

export function FieldError({ children }: { children: ReactNode }) {
  return <span className="mt-1.5 block text-[length:calc(15px*var(--fs))] leading-snug text-danger-ink">{children}</span>
}

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputClass, 'h-12', className)} {...rest} />
}

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputClass, 'min-h-[88px] py-2 leading-relaxed', className)} {...rest} />
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(inputClass, 'h-12', className)} {...rest}>
      {children}
    </select>
  )
}
