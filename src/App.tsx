import { CalendarManagePage, MyCalendarPage } from '@/pages/calendar/CalendarPages'
import { AnnouncementAdminPage, AnnouncementEditorPage, AnnouncementsAdminPage, ResidentAnnouncementPage, ResidentAnnouncementsPage } from '@/pages/announcements/AnnouncementPages'
import { AppointmentDetailPage, AppointmentsPage, BookVisitPage, MyAppointmentPage, MyAppointmentsPage } from '@/pages/appointments/AppointmentPages'
import { ConcernIssuePage, ConcernsPage, MyConcernPage } from '@/pages/concerns/ConcernPages'
import { SecurityPage } from '@/pages/admin/SecurityPage'
import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth, RequirePermission } from '@/auth/guards'
import { AppShell } from '@/components/layout/AppShell'
import { allLeaves } from '@/config/navigation'
import type { Permission, Portal } from '@/types/auth'
import { HomePage } from '@/pages/public/HomePage'
import { PortalPage } from '@/pages/public/PortalPage'
import { RoleLoginPage } from '@/pages/public/RoleLoginPage'
import { ForgotPasswordPage } from '@/pages/public/ForgotPasswordPage'
import { RegisterPage } from '@/pages/public/RegisterPage'
import { AccountPage } from '@/pages/AccountPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { DocumentRequestsPage } from '@/pages/documents/DocumentRequestsPage'
import { ApprovalsPage } from '@/pages/documents/ApprovalsPage'
import { NewAssistedRequestPage } from '@/pages/documents/NewAssistedRequestPage'
import { PreviewPage } from '@/pages/documents/PreviewPage'
import { RequestDetailPage } from '@/pages/documents/RequestDetailPage'
import { TemplatesPage } from '@/pages/documents/TemplatesPage'
import { ActivityPage, HealthPage, PersonnelPage, RolesPage, SettingsPage } from '@/pages/admin/AdminPages'
import { UsersPage } from '@/pages/admin/UserAccountsPage'
import { CaseDetailPage } from '@/pages/cases/CaseDetailPage'
import { NewCasePage } from '@/pages/cases/NewCasePage'
import { CaseRecordPrintPage } from '@/pages/cases/CaseRecordPrintPage'
import { CasesPage, HearingsPage } from '@/pages/cases/CasesPage'
import { BorrowingDetailPage, BorrowingPage } from '@/pages/equipment/BorrowingPages'
import { InventoryPage } from '@/pages/equipment/InventoryPage'
import { HouseholdDetailPage, HouseholdsPage } from '@/pages/residents/HouseholdsPage'
import { ResidentProfilePage } from '@/pages/residents/ResidentProfilePage'
import { ResidentsPage } from '@/pages/residents/ResidentsPage'
import { ChangeRequestsPage, RegistrationDetailPage, RegistrationsPage } from '@/pages/residents/ReviewPages'
import { MyBorrowingPage, NewBorrowingPage, MyComplaintsPage, MyProfilePage } from '@/pages/resident/ResidentPortalPages'
import { AnalyticsPage } from '@/pages/analytics/AnalyticsPage'
import { ReportsPage } from '@/pages/analytics/ReportsPage'
import { NotificationsPage } from '@/pages/NotificationsPage'
import { BorrowingDetailsPage, ComplaintDetailsPage, ContactPage, DocumentDetailsPage, MyTransactionsPage } from '@/pages/resident/ResidentV2Pages'
import { MyRequestsPage } from '@/pages/resident/MyRequestsPage'
import { NewRequestPage } from '@/pages/resident/NewRequestPage'
import { RequestFormPage } from '@/pages/resident/RequestFormPage'
import { NewComplaintPage } from '@/pages/resident/NewComplaintPage'
import { ModulePending } from '@/pages/system/ModulePending'
import { NotFound } from '@/pages/system/NotFound'

/** Development-only preview; `import.meta.env.DEV` is false in production, so this module is not bundled. */
const DevPreviewPage = import.meta.env.DEV ? lazy(() => import('@/pages/public/DevPreviewPage').then((m) => ({ default: m.DevPreviewPage }))) : null

/** Modules not built yet come from the navigation registry, so links and guards never drift apart. */
const pendingRoutes = allLeaves().filter((leaf) => leaf.phase)

const guard = (anyOf: Permission[], portal: Portal, el: ReactNode) => (
  <RequirePermission anyOf={anyOf} portal={portal}>
    {el}
  </RequirePermission>
)

export default function App() {
  return (
    <Routes>
      {/* Public portal: Homepage → account type → role-specific login */}
      <Route path="/" element={<HomePage />} />
      <Route path="/portal" element={<PortalPage />} />
      <Route path="/login" element={<Navigate to="/portal" replace />} />
      <Route path="/login/:role" element={<RoleLoginPage />} />
      <Route path="/forgot-password/:role" element={<ForgotPasswordPage />} />
      <Route path="/register" element={<RegisterPage />} />
      {DevPreviewPage && <Route path="/preview" element={<Suspense fallback={null}><DevPreviewPage /></Suspense>} />}

      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/account" element={<AccountPage />} />

          {/* Documents: personnel */}
          <Route path="/documents" element={guard(['documents.view'], 'personnel', <DocumentRequestsPage />)} />
          <Route path="/documents/approvals" element={guard(['documents.approve'], 'personnel', <ApprovalsPage />)} />
          <Route path="/documents/templates" element={guard(['documents.view'], 'personnel', <TemplatesPage />)} />
          <Route path="/documents/new" element={guard(['documents.create'], 'personnel', <NewAssistedRequestPage />)} />
          <Route path="/documents/:id" element={guard(['documents.view'], 'personnel', <RequestDetailPage />)} />
          <Route path="/documents/:id/preview" element={guard(['documents.view'], 'personnel', <PreviewPage />)} />

          {/* Resident records */}
          <Route path="/residents" element={guard(['residents.view', 'residents.search'], 'personnel', <ResidentsPage />)} />
          <Route path="/residents/households" element={guard(['residents.view'], 'personnel', <HouseholdsPage />)} />
          <Route path="/residents/households/:id" element={guard(['residents.view'], 'personnel', <HouseholdDetailPage />)} />
          <Route path="/residents/registrations" element={guard(['residents.verify', 'residents.override'], 'personnel', <RegistrationsPage />)} />
          <Route path="/residents/registrations/:id" element={guard(['residents.verify', 'residents.override'], 'personnel', <RegistrationDetailPage />)} />
          <Route path="/residents/change-requests" element={guard(['residents.approve'], 'personnel', <ChangeRequestsPage />)} />
          <Route path="/residents/import" element={<Navigate to="/residents" replace />} />
          <Route path="/residents/:id" element={guard(['residents.view'], 'personnel', <ResidentProfilePage />)} />

          {/* Katarungang Pambarangay */}
          <Route path="/cases" element={guard(['cases.view', 'cases.manage', 'cases.assigned'], 'personnel', <CasesPage />)} />
          <Route path="/cases/new" element={guard(['cases.manage'], 'personnel', <NewCasePage />)} />
          <Route path="/cases/:id" element={guard(['cases.view', 'cases.manage', 'cases.assigned'], 'personnel', <CaseDetailPage />)} />
          <Route path="/cases/:id/print/:kind" element={guard(['cases.view', 'cases.manage'], 'personnel', <CaseRecordPrintPage />)} />
          <Route path="/hearings" element={guard(['hearings.view', 'hearings.manage'], 'personnel', <HearingsPage />)} />

          {/* Property and equipment */}
          <Route path="/inventory" element={guard(['inventory.view'], 'personnel', <InventoryPage />)} />
          <Route path="/borrowing" element={guard(['borrowing.approve', 'borrowing.release'], 'personnel', <BorrowingPage />)} />
          <Route path="/borrowing/:id" element={guard(['borrowing.approve', 'borrowing.release'], 'personnel', <BorrowingDetailPage />)} />

          {/* System administration */}
          <Route path="/admin/users" element={guard(['users.manage'], 'admin', <UsersPage />)} />
          <Route path="/admin/security" element={<RequirePermission anyOf={['security.approve']}><SecurityPage /></RequirePermission>} />
          <Route path="/admin/roles" element={guard(['roles.manage'], 'admin', <RolesPage />)} />
          <Route path="/admin/personnel" element={guard(['users.manage'], 'admin', <PersonnelPage />)} />
          <Route path="/admin/activity" element={guard(['audit_logs.view'], 'admin', <ActivityPage />)} />
          <Route path="/admin/settings" element={guard(['system.settings'], 'admin', <SettingsPage />)} />
          <Route path="/admin/health" element={guard(['system.health'], 'admin', <HealthPage />)} />

          {/* Resident portal */}
          <Route path="/my/complaints" element={guard(['self.complaints'], 'resident', <MyComplaintsPage />)} />
          <Route path="/my/appointments" element={guard(['self.documents', 'self.complaints', 'self.borrowing', 'self.change_requests'], 'resident', <MyAppointmentsPage />)} />
          <Route path="/my/appointments/new" element={guard(['self.documents', 'self.complaints', 'self.borrowing', 'self.change_requests'], 'resident', <BookVisitPage />)} />
          <Route path="/my/appointments/:id" element={guard(['self.documents', 'self.complaints', 'self.borrowing', 'self.change_requests'], 'resident', <MyAppointmentPage />)} />
          <Route path="/appointments" element={guard(['residents.approve', 'documents.release', 'cases.manage', 'borrowing.release', 'hearings.view', 'cases.assigned'], 'personnel', <AppointmentsPage />)} />
          <Route path="/appointments/:id" element={guard(['residents.approve', 'documents.release', 'cases.manage', 'borrowing.release', 'hearings.view'], 'personnel', <AppointmentDetailPage />)} />
          <Route path="/my/concerns/:id" element={guard(['self.complaints'], 'resident', <MyConcernPage />)} />
          <Route path="/concerns" element={guard(['concerns.manage', 'concerns.view'], 'personnel', <ConcernsPage />)} />
          <Route path="/concerns/:id" element={guard(['concerns.manage', 'concerns.view'], 'personnel', <ConcernIssuePage />)} />
          <Route path="/my/complaints/new" element={guard(['self.complaints'], 'resident', <NewComplaintPage />)} />
          <Route path="/my/complaints/new/:kind" element={guard(['self.complaints'], 'resident', <NewComplaintPage />)} />
          <Route path="/my/complaints/:id" element={guard(['self.complaints'], 'resident', <ComplaintDetailsPage />)} />
          <Route path="/my/borrowing" element={guard(['self.borrowing'], 'resident', <MyBorrowingPage />)} />
          <Route path="/my/borrowing/new" element={guard(['self.borrowing'], 'resident', <NewBorrowingPage />)} />
          <Route path="/my/borrowing/:id" element={guard(['self.borrowing'], 'resident', <BorrowingDetailsPage />)} />
          <Route path="/my/transactions" element={guard(['self.documents', 'self.complaints', 'self.borrowing'], 'resident', <MyTransactionsPage />)} />
          <Route path="/my/contact" element={guard([], 'resident', <ContactPage />)} />
          <Route path="/my/announcements" element={guard([], 'resident', <ResidentAnnouncementsPage />)} />
          <Route path="/my/announcements/:id" element={guard([], 'resident', <ResidentAnnouncementPage />)} />
          <Route path="/calendar" element={<RequirePermission anyOf={['calendar.manage', 'system.settings', 'announcements.approve']}><CalendarManagePage /></RequirePermission>} />
          <Route path="/my/calendar" element={guard([], 'resident', <MyCalendarPage />)} />
          <Route path="/announcements" element={guard(['announcements.manage', 'announcements.approve'], 'personnel', <AnnouncementsAdminPage />)} />
          <Route path="/announcements/new" element={guard(['announcements.manage'], 'personnel', <AnnouncementEditorPage />)} />
          <Route path="/announcements/:id" element={guard(['announcements.manage', 'announcements.approve'], 'personnel', <AnnouncementAdminPage />)} />
          <Route path="/announcements/:id/edit" element={guard(['announcements.manage'], 'personnel', <AnnouncementEditorPage />)} />
          <Route path="/my/profile" element={guard(['self.profile'], 'resident', <MyProfilePage />)} />

          {/* Analytics and reports */}
          <Route path="/analytics" element={guard(['analytics.view'], 'personnel', <AnalyticsPage />)} />
          <Route path="/reports" element={guard(['reports.view'], 'personnel', <ReportsPage />)} />

          {/* Documents: resident portal (own records only, enforced in the service) */}
          <Route path="/my/documents" element={guard(['self.documents'], 'resident', <MyRequestsPage />)} />
          <Route path="/my/documents/new" element={guard(['self.documents'], 'resident', <NewRequestPage />)} />
          <Route path="/my/documents/new/:typeId" element={guard(['self.documents'], 'resident', <RequestFormPage />)} />
          <Route path="/my/documents/:id" element={guard(['self.documents'], 'resident', <DocumentDetailsPage />)} />

          {pendingRoutes.map((leaf) => (
            <Route key={leaf.portal + leaf.path} path={leaf.path} element={guard(leaf.anyOf ?? [], leaf.portal, <ModulePending title={leaf.label} phase={leaf.phase} summary={leaf.summary} />)} />
          ))}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  )
}
