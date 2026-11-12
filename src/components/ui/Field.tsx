import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export const inputClass =
  'w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 text-[15.5px] text-navy-900 placeholder:text-ink-subtle focus:border-navy-600 focus:outline-none disabled:bg-surface-muted disabled:text-ink-muted'

export function FieldLabel({ label, required, children }: { label: ReactNode; hint?: ReactNode; required?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[14.5px] font-semibold text-navy-900">
        {label}
        {required && <span className="text-danger-ink"> *</span>}
      </span>
      {children}
    </label>
  )
}

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputClass, 'h-10', className)} {...rest} />
}

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputClass, 'min-h-[88px] py-2 leading-relaxed', className)} {...rest} />
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(inputClass, 'h-10', className)} {...rest}>
      {children}
    </select>
  )
}
