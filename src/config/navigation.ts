import {
  Bell,
  Boxes,
  ClipboardList,
  Database,
  ChartColumn,
  FileText,
  Gavel,
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
 * Single source for sidebar navigation. Every link checks the same permission
 * as its route guard in App.tsx, so typing a URL does not bypass it (in the simulation).
 * `phase` marks screens that need the backend; their route shows a labelled pending page.
 */
export interface NavLeaf {
  label: string
  path: string
  anyOf?: Permission[]
  phase?: number
  summary?: string
}

export interface NavGroup {
  label: string
  icon: LucideIcon
  path?: string
  anyOf?: Permission[]
  phase?: number
  summary?: string
  children?: NavLeaf[]
  /**
   * Flat-menu section heading (Resident and Admin portals, Figma v2/v3): items
   * are shown in always-open groups instead of collapsible ones.
   */
  section?: string
}

const PERSONNEL_NAV: NavGroup[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  {
    label: 'Resident Records',
    icon: Users,
    children: [
      { label: 'Master List', path: '/residents', anyOf: ['residents.view', 'residents.search'] },
      { label: 'Households', path: '/residents/households', anyOf: ['residents.view'] },
      { label: 'Registrations', path: '/residents/registrations', anyOf: ['residents.verify'] },
      { label: 'Update Requests', path: '/residents/change-requests', anyOf: ['residents.approve'] },
      { label: 'Master List Import', path: '/residents/import', anyOf: ['residents.import'] },
    ],
  },
  {
    label: 'Services',
    icon: Layers,
    children: [
      { label: 'Document Requests', path: '/documents', anyOf: ['documents.view'] },
      { label: 'Approvals', path: '/documents/approvals', anyOf: ['documents.approve'] },
      { label: 'Document Templates', path: '/documents/templates', anyOf: ['documents.view'] },
    ],
  },
  {
    label: 'Katarungang Pambarangay',
    icon: Gavel,
    children: [
      { label: 'Cases', path: '/cases', anyOf: ['cases.view', 'cases.manage'] },
      { label: 'Hearings and Mediation', path: '/hearings', anyOf: ['hearings.view', 'hearings.manage'] },
    ],
  },
  {
    label: 'Property and Equipment',
    icon: Boxes,
    children: [
      { label: 'Equipment Records', path: '/inventory', anyOf: ['inventory.view'] },
      { label: 'Borrowing', path: '/borrowing', anyOf: ['borrowing.approve', 'borrowing.release'] },
    ],
  },
  {
    label: 'Insights',
    icon: ChartColumn,
    children: [
      { label: 'Analytics', path: '/analytics', anyOf: ['analytics.view'] },
      { label: 'Reports', path: '/reports', anyOf: ['reports.view'] },
    ],
  },
  { label: 'Notifications', icon: Bell, path: '/notifications' },
  { label: 'Account Settings', icon: Settings2, path: '/account' },
]

/** System Administrator (Figma v3): flat groups, always open. */
const ADMIN_NAV: NavGroup[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { section: 'Users and Access', label: 'User Accounts', icon: Users, path: '/admin/users', anyOf: ['users.manage'] },
  { section: 'Users and Access', label: 'Roles and Permissions', icon: ShieldCheck, path: '/admin/roles', anyOf: ['roles.manage'] },
  { section: 'Users and Access', label: 'Barangay Personnel', icon: UserRound, path: '/admin/personnel', anyOf: ['users.manage'] },
  { section: 'Records', label: 'Activity Log', icon: ScrollText, path: '/admin/activity', anyOf: ['audit_logs.view'] },
  { section: 'System', label: 'System Settings', icon: SlidersHorizontal, path: '/admin/settings', anyOf: ['system.settings'] },
  { section: 'System', label: 'Health and Backups', icon: Database, path: '/admin/health', anyOf: ['system.health'] },
  { section: 'Account', label: 'Notifications', icon: Bell, path: '/notifications' },
  { section: 'Account', label: 'Account Settings', icon: Settings2, path: '/account' },
]

/** Resident portal (Figma Revision v2): Main menu + Account. */
const RESIDENT_NAV: NavGroup[] = [
  { section: 'Main menu', label: 'Home', icon: Home, path: '/dashboard' },
  { section: 'Main menu', label: 'Document Requests', icon: FileText, path: '/my/documents', anyOf: ['self.documents'] },
  { section: 'Main menu', label: 'My Complaints', icon: MessageSquareWarning, path: '/my/complaints', anyOf: ['self.complaints'] },
  { section: 'Main menu', label: 'Equipment Borrowing', icon: Package, path: '/my/borrowing', anyOf: ['self.borrowing'] },
  { section: 'Main menu', label: 'My Transactions', icon: ClipboardList, path: '/my/transactions', anyOf: ['self.documents', 'self.complaints', 'self.borrowing'] },
  { section: 'Main menu', label: 'Notifications', icon: Bell, path: '/notifications' },
  { section: 'Account', label: 'My Profile', icon: UserRound, path: '/my/profile', anyOf: ['self.profile'] },
  { section: 'Account', label: 'Account Settings', icon: Settings2, path: '/account' },
]

export const NAVIGATION: Record<Portal, NavGroup[]> = {
  personnel: PERSONNEL_NAV,
  admin: ADMIN_NAV,
  resident: RESIDENT_NAV,
}

/** Every leaf route across all portals. */
export function allLeaves(): (NavLeaf & { portal: Portal })[] {
  const out: (NavLeaf & { portal: Portal })[] = []
  for (const [portal, groups] of Object.entries(NAVIGATION) as [Portal, NavGroup[]][]) {
    for (const g of groups) {
      if (g.path && !['/dashboard', '/notifications', '/account'].includes(g.path)) {
        out.push({ label: g.label, path: g.path, anyOf: g.anyOf, phase: g.phase, summary: g.summary, portal })
      }
      for (const c of g.children ?? []) out.push({ ...c, portal })
    }
  }
  return out
}
