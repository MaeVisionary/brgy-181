import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { APP_CONFIG } from '@/config/app'
import { ROLES } from '@/config/permissions'
import { listPreviewAccounts } from '@/services/authService'

/**
 * DEVELOPMENT PREVIEW (npm run dev only). Not linked anywhere and not part of
 * production builds. Lets the team review each role's screens with sample data
 * until backend sign-in exists. This is not authentication.
 */
export function DevPreviewPage() {
  const { previewAs } = useAuth()
  const navigate = useNavigate()
  if (!APP_CONFIG.devPreview) return <Navigate to="/" replace />
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <p className="label-caps">Development only</p>
      <h1 className="mt-1 font-display text-[length:calc(24px*var(--fs))] font-extrabold text-navy-900">Prototype preview</h1>
      <p className="mt-2 text-[length:calc(15.5px*var(--fs))] text-ink-muted">
        For reviewing role screens with sample data during development. This page does not exist in production builds and is not a sign-in.
      </p>
      <ul className="mt-6 divide-y divide-line-soft rounded-lg border border-line bg-surface">
        {listPreviewAccounts().map((u) => (
          <li key={u.id}>
            <button
              type="button"
              onClick={() => {
                previewAs(u.id)
                navigate('/dashboard')
              }}
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-sky-50"
            >
              <span className="text-[length:calc(15.5px*var(--fs))] font-semibold text-navy-900">{u.fullName}</span>
              <span className="text-[length:calc(14px*var(--fs))] text-ink-muted">{ROLES[u.roleId].name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
