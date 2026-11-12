import { TextSizeControl } from '@/components/layout/TextSizeControl'
import { Menu, X } from '@/icons'
import { useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BarangaySeal } from '@/components/layout/BarangaySeal'
import { BARANGAY } from '@/config/barangay'
import { cn } from '@/lib/cn'
import { useSmoothNavigate } from '@/lib/transition'

const NAV = [
  { href: '#top', label: 'Home' },
  { href: '#about', label: 'About Barangay 181' },
  { href: '#services', label: 'Services' },
  { href: '#contact', label: 'Contact Information' },
]

/** Public site chrome: navigation bar and footer for the Barangay 181 portal. */
export function PublicLayout({ children, minimal }: { children: ReactNode; minimal?: boolean }) {
  const go = useSmoothNavigate()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)

  const jump = (href: string) => {
    setOpen(false)
    if (pathname !== '/') {
      go(`/${href === '#top' ? '' : href}`, 'back')
      return
    }
    document.querySelector(href === '#top' ? 'body' : href)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div id="top" className="flex min-h-full flex-col bg-canvas">
      <header className="sticky top-0 z-40 border-b border-line/70 bg-surface/90 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center gap-4 px-4 sm:px-6">
          <Link to="/" onClick={(e) => { e.preventDefault(); jump('#top') }} className="flex items-center gap-2.5">
            <BarangaySeal className="size-10" />
            <span className="leading-tight">
              <span className="block font-display text-[length:calc(17px*var(--fs))] font-extrabold text-navy-900">{BARANGAY.name}</span>
              <span className="hidden text-[length:calc(13px*var(--fs))] text-ink-muted sm:block">Zone {BARANGAY.zone}, District {BARANGAY.district}, {BARANGAY.city}</span>
            </span>
          </Link>
          {!minimal && (
            <nav aria-label="Site" className="ml-auto hidden items-center gap-1 lg:flex">
              {NAV.map((n) => (
                <a key={n.href} href={n.href} onClick={(e) => { e.preventDefault(); jump(n.href) }} className="rounded-md px-3 py-2 text-[length:calc(15.5px*var(--fs))] font-medium text-ink-nav transition-colors hover:text-navy-900">
                  {n.label}
                </a>
              ))}
            </nav>
          )}
          <div className={cn('flex items-center gap-2', minimal ? 'ml-auto' : 'ml-auto lg:ml-3')}>
            <TextSizeControl />
            {!minimal && (
              <button type="button" onClick={() => go('/register')} className="bmis-press ml-auto hidden h-9 items-center rounded-[var(--radius-control)] border border-line bg-surface px-4 text-[length:calc(15.5px*var(--fs))] font-semibold text-navy-900 hover:bg-surface-muted sm:inline-flex lg:ml-0">
                Create account
              </button>
            )}
            {!minimal && (
              <button type="button" onClick={() => go('/portal')} className="bmis-press ml-auto inline-flex h-9 items-center rounded-[var(--radius-control)] bg-navy-900 px-5 text-[length:calc(15.5px*var(--fs))] font-semibold text-white hover:bg-navy-800 sm:ml-0">
                Login
              </button>
            )}
            {!minimal && (
              <button type="button" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen((o) => !o)} className="grid size-9 place-items-center rounded-md text-navy-900 lg:hidden">
                {open ? <X className="size-5" /> : <Menu className="size-5" />}
              </button>
            )}
          </div>
        </div>
        {open && !minimal && (
          <nav aria-label="Site" className="border-t border-line/70 px-4 py-2 lg:hidden">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} onClick={(e) => { e.preventDefault(); jump(n.href) }} className="block rounded-md px-2 py-2.5 text-[length:calc(16px*var(--fs))] font-medium text-navy-900">
                {n.label}
              </a>
            ))}
          </nav>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto grid grid-cols-1 max-w-[1180px] gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <BarangaySeal className="size-10" />
              <span className="leading-tight">
                <span className="block font-display text-[length:calc(17px*var(--fs))] font-extrabold text-navy-900">{BARANGAY.name}</span>
                <span className="block text-[length:calc(14px*var(--fs))] text-ink-muted">Zone {BARANGAY.zone}, District {BARANGAY.district}, City of {BARANGAY.city}</span>
              </span>
            </div>
            <p className="mt-3 font-display text-[length:calc(15px*var(--fs))] font-bold text-navy-900 italic">“{BARANGAY.motto}”</p>
          </div>
          <FooterCol title="Quick links" items={[['Home', '#top'], ['About Barangay 181', '#about'], ['Services', '#services'], ['Contact Information', '#contact']]} onJump={jump} />
          <FooterCol title="Services" items={[['Certificates and clearances', '#services'], ['Complaints and reports', '#services'], ['Equipment borrowing', '#services']]} onJump={jump} />
          <div>
            <p className="label-caps mb-2.5">Contact</p>
            <p className="text-[length:calc(15px*var(--fs))] text-ink-muted">Barangay 181 Hall, {BARANGAY.locality}</p>
            <p className="mt-1 text-[length:calc(14.5px*var(--fs))] text-ink-subtle">Walk-in assistance is available at the Barangay Hall.</p>
          </div>
        </div>
        <div className="border-t border-line-soft">
          <p className="mx-auto max-w-[1180px] px-4 py-4 text-[length:calc(14px*var(--fs))] text-ink-muted sm:px-6">
            © {new Date().getFullYear()} {BARANGAY.fullName}. Barangay 181 Information Management System.
          </p>
        </div>
      </footer>
    </div>
  )
}

function FooterCol({ title, items, onJump }: { title: string; items: [string, string][]; onJump: (href: string) => void }) {
  return (
    <div>
      <p className="label-caps mb-2.5">{title}</p>
      <ul className="space-y-1.5">
        {items.map(([label, href]) => (
          <li key={label}>
            <a href={href} onClick={(e) => { e.preventDefault(); onJump(href) }} className="text-[length:calc(15px*var(--fs))] text-ink-nav hover:text-navy-900">
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
