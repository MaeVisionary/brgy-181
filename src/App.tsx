import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth, RequirePermission } from '@/auth/guards'
import { AppShell } from '@/components/layout/AppShell'
import { allLeaves } from '@/config/navigation'
import { LoginPage } from '@/pages/auth/LoginPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { NotificationsPage } from '@/pages/NotificationsPage'
import { ModulePending } from '@/pages/system/ModulePending'
import { NotFound } from '@/pages/system/NotFound'

/** Routes come from the navigation registry so links and guards never drift apart. */
const moduleRoutes = allLeaves()

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          {moduleRoutes.map((leaf) => (
            <Route
              key={leaf.portal + leaf.path}
              path={leaf.path}
              element={
                <RequirePermission anyOf={leaf.anyOf} portal={leaf.portal}>
                  <ModulePending title={leaf.label} phase={leaf.phase} summary={leaf.summary} />
                </RequirePermission>
              }
            />
          ))}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  )
}
