import {
  CalendarCheck2,
  BadgeCheck,
  Bell,
  BookOpenCheck,
  Boxes,
  CalendarClock,
  FileCheck2,
  FilePen,
  Files,
  HandHelping,
  Home as HouseIcon,
  ChartPie,
  ClipboardList,
  Database,
  FileText,
  Gavel,
  Home,
  LayoutDashboard,
  Lock,
  MegaphoneIcon, MessageSquareWarning,
  Package,
  ScrollText,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  Users,
  KeyRound,
  type LucideIcon,
} from '@/icons'
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

/**
 * Barangay Personnel (Chairman, Secretary, Kagawad, Property Custodian, other
 * Barangay Personnel). Same flat format as the other portals; each item only
 * appears when the account has its permission. The Secretary, who sees the most
 * items, can fold sections (see Sidebar).
 */
const PERSONNEL_NAV: NavGroup[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { section: 'Resident Records', label: 'Resident Master List', icon: Users, path: '/residents', anyOf: ['residents.view', 'residents.search'] },
  { section: 'Resident Records', label: 'Households', icon: HouseIcon, path: '/residents/households', anyOf: ['residents.view'] },
  { section: 'Resident Records', label: 'Registrations', icon: BadgeCheck, path: '/residents/registrations', anyOf: ['residents.verify', 'residents.override'] },
  { section: 'Resident Records', label: 'Account Recovery', icon: KeyRound, path: '/account-recovery', anyOf: ['residents.verify', 'users.manage', 'security.approve'] },
  { section: 'Resident Records', label: 'Calendar', icon: CalendarClock, path: '/appointments', anyOf: ['residents.approve', 'documents.release', 'cases.manage', 'borrowing.release', 'hearings.view', 'cases.assigned'] },
  { section: 'Resident Records', label: 'Record Update Requests', icon: FilePen, path: '/residents/change-requests', anyOf: ['residents.approve'] },
  { section: 'Services', label: 'Document Requests', icon: FileText, path: '/documents', anyOf: ['documents.view'] },
  { section: 'Services', label: 'Approvals', icon: FileCheck2, path: '/documents/approvals', anyOf: ['documents.approve'] },
  { section: 'Services', label: 'Document Templates', icon: Files, path: '/documents/templates', anyOf: ['documents.view'] },
  { section: 'Community', label: 'Community Concerns', icon: MessageSquareWarning, path: '/concerns', anyOf: ['concerns.manage', 'concerns.view'] },
  { section: 'Community', label: 'Announcements', icon: MegaphoneIcon, path: '/announcements', anyOf: ['announcements.manage', 'announcements.approve'] },
  { section: 'Community', label: 'Barangay Calendar', icon: CalendarClock, path: '/calendar', anyOf: ['calendar.manage', 'announcements.approve'] },
  { section: 'Katarungang Pambarangay', label: 'Cases', icon: Gavel, path: '/cases', anyOf: ['cases.view', 'cases.manage', 'cases.assigned'] },
  { section: 'Katarungang Pambarangay', label: 'Hearings and Mediation', icon: CalendarClock, path: '/hearings', anyOf: ['hearings.view', 'hearings.manage'] },
  { section: 'Property and Equipment', label: 'Equipment Records', icon: Boxes, path: '/inventory', anyOf: ['inventory.view'] },
  { section: 'Property and Equipment', label: 'Borrowing', icon: HandHelping, path: '/borrowing', anyOf: ['borrowing.approve', 'borrowing.release'] },
  { section: 'Insights', label: 'Analytics', icon: ChartPie, path: '/analytics', anyOf: ['analytics.view'] },
  { section: 'Insights', label: 'Reports', icon: BookOpenCheck, path: '/reports', anyOf: ['reports.view'] },
  { section: 'Insights', label: 'Access approvals', icon: Lock, path: '/admin/security', anyOf: ['security.approve'] },
  { section: 'Account', label: 'Notifications', icon: Bell, path: '/notifications' },
  { section: 'Account', label: 'Account Settings', icon: Settings2, path: '/account' },
]

/** System Administrator (Figma v3): flat groups, always open. */
const ADMIN_NAV: NavGroup[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { section: 'Users and Access', label: 'User Accounts', icon: Users, path: '/admin/users', anyOf: ['users.manage'] },
  { section: 'Users and Access', label: 'Roles and Permissions', icon: ShieldCheck, path: '/admin/roles', anyOf: ['roles.manage'] },
  { section: 'Users and Access', label: 'Barangay Personnel', icon: UserRound, path: '/admin/personnel', anyOf: ['users.manage'] },
  { section: 'Users and Access', label: 'Security', icon: Lock, path: '/admin/security', anyOf: ['security.approve'] },
  { section: 'Users and Access', label: 'Account Recovery', icon: KeyRound, path: '/account-recovery', anyOf: ['users.manage'] },
  { section: 'Records', label: 'Activity Log', icon: ScrollText, path: '/admin/activity', anyOf: ['audit_logs.view'] },
  { section: 'System', label: 'System Settings', icon: SlidersHorizontal, path: '/admin/settings', anyOf: ['system.settings'] },
  { section: 'System', label: 'Holidays and Calendar', icon: CalendarClock, path: '/calendar', anyOf: ['system.settings'] },
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
  { section: 'Main menu', label: 'My Appointments', icon: CalendarClock, path: '/my/appointments', anyOf: ['self.documents', 'self.complaints', 'self.borrowing', 'self.change_requests'] },
  { section: 'Main menu', label: 'My Calendar', icon: CalendarCheck2, path: '/my/calendar' },
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
