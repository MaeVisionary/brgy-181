import type { ReactNode } from 'react'

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {icon && <span className="mb-3 grid size-10 place-items-center rounded-lg bg-sky-100 text-navy-900">{icon}</span>}
      <p className="font-display text-[15px] font-bold text-navy-900">{title}</p>
      {body && <div className="mt-1 max-w-md text-[13px] text-ink-muted">{body}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
