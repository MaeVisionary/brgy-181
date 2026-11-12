import { cn } from '@/lib/cn'

/**
 * Progress for multi-step forms, driven by the same step list as Next/Back
 * (useSteps), so it always matches the step shown. Same place on every step.
 */
export function StepProgress({ labels, index, className }: { labels: readonly string[]; index: number; className?: string }) {
  return (
    <div className={cn('mb-4', className)}>
      <p className="text-[length:calc(15.5px*var(--fs))] font-semibold text-navy-900">Step {index + 1} of {labels.length}: {labels[index]}</p>
      <ol className="mt-1.5 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${labels.length}, minmax(0, 1fr))` }} aria-label="Steps">
        {labels.map((l, i) => (
          <li key={l} aria-current={i === index ? 'step' : undefined}>
            <span className={cn('block h-1.5 rounded-full transition-colors duration-300', i <= index ? 'bg-navy-900' : 'bg-line')} />
            <span className="sr-only">{l}{i < index ? ' (done)' : ''}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
