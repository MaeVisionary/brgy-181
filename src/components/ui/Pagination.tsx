import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'

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
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft px-4 py-3 text-[14.5px] text-ink-muted sm:px-5">
      <span>
        Showing {from}–{to} of {total} {noun}
      </span>
      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center gap-2">
          <button type="button" disabled={page === 0} onClick={() => onPage(page - 1)} className="inline-flex h-9 items-center gap-1 rounded-[var(--radius-control)] border border-line bg-surface px-3 text-[14.5px] font-semibold text-navy-900 hover:bg-surface-muted disabled:opacity-40">
            <ChevronLeft className="size-4" /> Previous
          </button>
          <span className="px-1 text-[14.5px] font-semibold whitespace-nowrap text-navy-900" aria-live="polite">
            Page {page + 1} of {pages}
          </span>
          <button type="button" disabled={page >= pages - 1} onClick={() => onPage(page + 1)} className="inline-flex h-9 items-center gap-1 rounded-[var(--radius-control)] border border-line bg-surface px-3 text-[14.5px] font-semibold text-navy-900 hover:bg-surface-muted disabled:opacity-40">
            Next <ChevronRight className="size-4" />
          </button>
        </nav>
      )}
    </div>
  )
}
