import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth, RequirePermission } from '@/auth/guards'
import { AppShell } from '@/components/layout/AppShell'
import { allLeaves } from '@/config/navigation'
import type { Permission, Portal } from '@/types/auth'
import { HomePage } from '@/pages/public/HomePage'
import { PortalPage } from '@/pages/public/PortalPage'
import { RoleLoginPage } from '@/pages/public/RoleLoginPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { DocumentRequestsPage } from '@/pages/documents/DocumentRequestsPage'
import { NewAssistedRequestPage } from '@/pages/documents/NewAssistedRequestPage'
import { PreviewPage } from '@/pages/documents/PreviewPage'
import { RequestDetailPage } from '@/pages/documents/RequestDetailPage'
import { TemplatesPage } from '@/pages/documents/TemplatesPage'
import { NotificationsPage } from '@/pages/NotificationsPage'
import { MyRequestDetailPage } from '@/pages/resident/MyRequestDetailPage'
import { MyRequestsPage } from '@/pages/resident/MyRequestsPage'
import { NewRequestPage } from '@/pages/resident/NewRequestPage'
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
      {DevPreviewPage && <Route path="/preview" element={<Suspense fallback={null}><DevPreviewPage /></Suspense>} />}

      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />

          {/* Documents: personnel */}
          <Route path="/documents" element={guard(['documents.view'], 'personnel', <DocumentRequestsPage />)} />
          <Route path="/documents/approvals" element={guard(['documents.approve'], 'personnel', <DocumentRequestsPage approvalsOnly />)} />
          <Route path="/documents/templates" element={guard(['documents.view'], 'personnel', <TemplatesPage />)} />
          <Route path="/documents/new" element={guard(['documents.create'], 'personnel', <NewAssistedRequestPage />)} />
          <Route path="/documents/:id" element={guard(['documents.view'], 'personnel', <RequestDetailPage />)} />
          <Route path="/documents/:id/preview" element={guard(['documents.view'], 'personnel', <PreviewPage />)} />

          {/* Documents: resident portal (own records only, enforced in the service) */}
          <Route path="/my/documents" element={guard(['self.documents'], 'resident', <MyRequestsPage />)} />
          <Route path="/my/documents/new" element={guard(['self.documents'], 'resident', <NewRequestPage />)} />
          <Route path="/my/documents/:id" element={guard(['self.documents'], 'resident', <MyRequestDetailPage />)} />

          {pendingRoutes.map((leaf) => (
            <Route key={leaf.portal + leaf.path} path={leaf.path} element={guard(leaf.anyOf ?? [], leaf.portal, <ModulePending title={leaf.label} phase={leaf.phase} summary={leaf.summary} />)} />
          ))}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  )
}
