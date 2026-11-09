import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'

/** Rows per page on desktop tables (Figma v3: "up to 10 rows drawn per page"). */
export const PAGE_SIZE = 10

/** Client-side paging for a list; resets to page 1 when the list length changes. */
export function usePaged<T>(items: T[], size = PAGE_SIZE) {
  const [page, setPage] = useState(0)
  const pages = Math.max(1, Math.ceil(items.length / size))
  useEffect(() => {
    if (page > pages - 1) setPage(0)
  }, [page, pages])
  return { page, pages, setPage, slice: items.slice(page * size, page * size + size), total: items.length, size }
}

/** "Showing 1–10 of 23" + previous/next + page numbers. Hidden when everything fits on one page. */
export function Pagination({ page, pages, total, size, onPage, noun = 'records' }: { page: number; pages: number; total: number; size: number; onPage: (p: number) => void; noun?: string }) {
  if (total === 0) return null
  const from = page * size + 1
  const to = Math.min(total, from + size - 1)
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft px-4 py-3 text-[12.5px] text-ink-muted sm:px-5">
      <span>
        Showing {from}–{to} of {total} {noun}
      </span>
      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center gap-1">
          <PageBtn label="Previous page" disabled={page === 0} onClick={() => onPage(page - 1)}>
            <ChevronLeft className="size-4" />
          </PageBtn>
          {Array.from({ length: pages }, (_, i) => (
            <PageBtn key={i} label={`Page ${i + 1}`} current={i === page} onClick={() => onPage(i)}>
              {i + 1}
            </PageBtn>
          ))}
          <PageBtn label="Next page" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>
            <ChevronRight className="size-4" />
          </PageBtn>
        </nav>
      )}
    </div>
  )
}

function PageBtn({ children, label, onClick, disabled, current }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; current?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={current ? 'page' : undefined}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'grid size-9 place-items-center rounded-[var(--radius-control)] text-[12.5px] font-semibold transition-colors disabled:opacity-40',
        current ? 'bg-navy-900 text-white' : 'text-navy-900 hover:bg-surface-muted',
      )}
    >
      {children}
    </button>
  )
}
