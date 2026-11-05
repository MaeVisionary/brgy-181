import { ChevronRight, LogOut } from 'lucide-react'
import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { NAVIGATION, type NavGroup, type NavLeaf } from '@/config/navigation'
import { cn } from '@/lib/cn'
import { initials } from '@/lib/format'

const itemBase =
  'flex w-full items-center gap-3 rounded-[var(--radius-control)] px-3 py-2 text-[14px] leading-[1.3] font-medium transition-colors'

function useVisibleNav(): NavGroup[] {
  const { role, canAny } = useAuth()
  if (!role) return []
  const visible = (item: { anyOf?: NavLeaf['anyOf'] }) => !item.anyOf || canAny(item.anyOf)
  return NAVIGATION[role.portal]
    .map((g) => (g.children ? { ...g, children: g.children.filter(visible) } : g))
    .filter((g) => (g.children ? g.children.length > 0 : visible(g)))
}

export function Sidebar({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { user, role, logout } = useAuth()
  const groups = useVisibleNav()
  const { pathname } = useLocation()
  const [open, setOpen] = useState<Record<string, boolean>>({})

  if (!user || !role) return null

  const isGroupActive = (g: NavGroup) => g.children?.some((c) => pathname === c.path || pathname.startsWith(c.path + '/'))

  return (
    <nav aria-label="Main" className="flex h-full flex-col bg-surface">
      {!collapsed && <p className="label-caps px-6 pt-5 pb-2 text-navy-900">{role.portalLabel}</p>}
      <ul className={cn('flex-1 space-y-0.5 overflow-y-auto', collapsed ? 'px-2 pt-4' : 'px-3')}>
        {groups.map((g) => {
          const Icon = g.icon
          if (!g.children) {
            return (
              <li key={g.label}>
                <NavLink
                  to={g.path!}
                  end
                  onClick={onNavigate}
                  title={collapsed ? g.label : undefined}
                  className={({ isActive }) =>
                    cn(itemBase, collapsed && 'justify-center px-0', isActive ? 'bg-sky-100 text-navy-900' : 'text-ink-nav hover:bg-surface-muted hover:text-navy-900')
                  }
                >
                  <Icon className="size-[18px] shrink-0" strokeWidth={1.75} />
                  {!collapsed && <span className="truncate">{g.label}</span>}
                </NavLink>
              </li>
            )
          }
          const expanded = open[g.label] ?? isGroupActive(g)
          return (
            <li key={g.label}>
              <button
                type="button"
                onClick={() => setOpen((o) => ({ ...o, [g.label]: !expanded }))}
                aria-expanded={expanded}
                title={collapsed ? g.label : undefined}
                className={cn(
                  itemBase,
                  collapsed && 'justify-center px-0',
                  isGroupActive(g) ? 'text-navy-900' : 'text-ink-nav hover:bg-surface-muted hover:text-navy-900',
                )}
              >
                <Icon className="size-[18px] shrink-0" strokeWidth={1.75} />
                {!collapsed && (
                  <>
                    <span className="flex-1 truncate text-left">{g.label}</span>
                    <ChevronRight className={cn('size-4 shrink-0 transition-transform', expanded && 'rotate-90')} />
                  </>
                )}
              </button>
              {expanded && !collapsed && (
                <ul className="mt-0.5 mb-1 ml-[21px] space-y-0.5 border-l border-line-soft pl-3">
                  {g.children.map((c) => (
                    <li key={c.path}>
                      <NavLink
                        to={c.path}
                        end
                        onClick={onNavigate}
                        className={({ isActive }) =>
                          cn(
                            'block rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
                            isActive ? 'bg-sky-100 text-navy-900' : 'text-ink-nav hover:bg-surface-muted hover:text-navy-900',
                          )
                        }
                      >
                        {c.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>

      <div className={cn('p-3', collapsed && 'px-2')}>
        <div className={cn('flex items-center gap-3 rounded-[10px] bg-surface-muted p-2.5', collapsed && 'justify-center p-1.5')}>
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-navy-900 text-[11px] font-semibold text-white">
            {initials(user.fullName)}
          </span>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-semibold text-navy-900">{user.fullName}</span>
                <span className="block truncate text-[11px] text-ink-muted">{user.position}</span>
              </span>
              <button
                type="button"
                onClick={logout}
                aria-label="Sign out"
                title="Sign out"
                className="rounded-md p-1.5 text-ink-nav hover:bg-surface hover:text-navy-900"
              >
                <LogOut className="size-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
