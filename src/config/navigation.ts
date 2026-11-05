import {
  Bell,
  Boxes,
  ChartColumn,
  FileText,
  Home,
  Layers,
  LayoutDashboard,
  MessageSquareWarning,
  Package,
  ScrollText,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { Permission, Portal } from '@/types/auth'

/**
 * Single source for sidebar navigation AND route protection.
 * A link only shows when the user holds one of `anyOf`; the same check
 * guards the route, so typing the URL does not bypass it (in the simulation).
 *
 * `phase` marks modules not built yet; their route shows a clearly labelled
 * "scheduled for Phase N" page instead of a fake screen.
 */
export interface NavLeaf {
  label: string
  path: string
  anyOf?: Permission[]
  phase?: number
  /** One-line description shown on the pending page. */
  summary?: string
}

export interface NavGroup {
  label: string
  icon: LucideIcon
  /** Direct link (no children). */
  path?: string
  anyOf?: Permission[]
  phase?: number
  summary?: string
  children?: NavLeaf[]
}

const PERSONNEL_NAV: NavGroup[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  {
    label: 'Residents',
    icon: Users,
    children: [
      { label: 'Resident Directory', path: '/residents', anyOf: ['residents.view', 'residents.search'], phase: 4, summary: 'Search, filter and view resident profiles and households.' },
      { label: 'Registrations', path: '/residents/registrations', anyOf: ['residents.verify'], phase: 4, summary: 'Manual verification queue for online registrations.' },
      { label: 'Change Requests', path: '/residents/change-requests', anyOf: ['residents.approve'], phase: 4, summary: 'Review resident requests to correct their information.' },
      { label: 'Master List Import', path: '/residents/import', anyOf: ['residents.import'], phase: 4, summary: 'CSV preview, column mapping, duplicate review and import history.' },
      { label: 'Borrower Lookup', path: '/residents/borrowers', anyOf: ['residents.lookup_borrower'], phase: 7, summary: 'Name and address lookup for equipment borrowing only.' },
    ],
  },
  {
    label: 'Services',
    icon: Layers,
    children: [
      { label: 'Document Requests', path: '/documents', anyOf: ['documents.view'], phase: 5, summary: 'Per-document workflows from submission to release.' },
      { label: 'Approvals', path: '/documents/approvals', anyOf: ['documents.approve'], phase: 5, summary: 'Documents verified by the Secretary awaiting your decision.' },
      { label: 'Complaints & Blotter', path: '/cases', anyOf: ['complaints.view', 'cases.view'], phase: 6, summary: 'Complaints, incident reports, blotter records and KP cases.' },
      { label: 'Hearings', path: '/hearings', anyOf: ['hearings.view', 'hearings.manage'], phase: 6, summary: 'Hearing and mediation schedules, attendance and outcomes.' },
    ],
  },
  {
    label: 'Resources',
    icon: Boxes,
    children: [
      { label: 'Equipment Inventory', path: '/inventory', anyOf: ['inventory.view'], phase: 7, summary: 'Equipment records, quantity, condition and history.' },
      { label: 'Borrowing', path: '/borrowing', anyOf: ['borrowing.approve', 'borrowing.release'], phase: 7, summary: 'Requests, releases, returns and overdue tracking.' },
    ],
  },
  {
    label: 'Insights',
    icon: ChartColumn,
    children: [
      { label: 'Analytics & Ayuda', path: '/analytics', anyOf: ['analytics.view'], phase: 8, summary: 'Population analytics and disaster/ayuda planning by area.' },
      { label: 'Reports', path: '/reports', anyOf: ['reports.view'], phase: 8, summary: 'Report selection, preview and export. Templates follow the formats you provide.' },
    ],
  },
  { label: 'Notifications', icon: Bell, path: '/notifications' },
]

const ADMIN_NAV: NavGroup[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  {
    label: 'Users & Access',
    icon: ShieldCheck,
    children: [
      { label: 'User Accounts', path: '/admin/users', anyOf: ['users.manage'], phase: 3, summary: 'Create, edit, activate and deactivate accounts.' },
      { label: 'Roles & Permissions', path: '/admin/roles', anyOf: ['roles.manage'], phase: 3, summary: 'Review the permission matrix and configure staff access.' },
    ],
  },
  { label: 'Activity Log', icon: ScrollText, path: '/admin/activity', anyOf: ['audit_logs.view'], phase: 3, summary: 'Protected audit trail of sensitive actions.' },
  {
    label: 'System',
    icon: SlidersHorizontal,
    children: [
      { label: 'Settings', path: '/admin/settings', anyOf: ['system.settings'], phase: 3, summary: 'Lockout, session, reminder intervals and other configuration.' },
      { label: 'Health & Backups', path: '/admin/health', anyOf: ['system.health'], phase: 3, summary: 'System status and backup history.' },
    ],
  },
  { label: 'Notifications', icon: Bell, path: '/notifications' },
]

const RESIDENT_NAV: NavGroup[] = [
  { label: 'Home', icon: Home, path: '/dashboard' },
  { label: 'My Documents', icon: FileText, path: '/my/documents', anyOf: ['self.documents'], phase: 5, summary: 'Request barangay documents and track their status.' },
  { label: 'My Reports', icon: MessageSquareWarning, path: '/my/complaints', anyOf: ['self.complaints'], phase: 6, summary: 'Submit complaints or incident reports and follow their status.' },
  { label: 'Borrow Equipment', icon: Package, path: '/my/borrowing', anyOf: ['self.borrowing'], phase: 7, summary: 'Request barangay equipment and see due dates.' },
  { label: 'My Profile', icon: UserRound, path: '/my/profile', anyOf: ['self.profile'], phase: 4, summary: 'Your resident information and correction requests.' },
  { label: 'Notifications', icon: Bell, path: '/notifications' },
  { label: 'Account Settings', icon: Settings2, path: '/my/settings', anyOf: ['self.profile'], phase: 4, summary: 'Password and contact preferences.' },
]

export const NAVIGATION: Record<Portal, NavGroup[]> = {
  personnel: PERSONNEL_NAV,
  admin: ADMIN_NAV,
  resident: RESIDENT_NAV,
}

/** Every leaf route across all portals, for building the router. */
export function allLeaves(): (NavLeaf & { portal: Portal })[] {
  const out: (NavLeaf & { portal: Portal })[] = []
  for (const [portal, groups] of Object.entries(NAVIGATION) as [Portal, NavGroup[]][]) {
    for (const g of groups) {
      if (g.path && g.path !== '/dashboard' && g.path !== '/notifications') {
        out.push({ label: g.label, path: g.path, anyOf: g.anyOf, phase: g.phase, summary: g.summary, portal })
      }
      for (const c of g.children ?? []) out.push({ ...c, portal })
    }
  }
  return out
}
