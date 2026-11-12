import { Code2 } from '@/icons'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { ROLES } from '@/config/permissions'
import { listPreviewAccounts } from '@/services/authService'

/**
 * DEVELOPMENT PREVIEW ONLY. Shown only in `npm run dev` so the team can review each
 * role's screens before backend sign-in exists. It is compiled out of production
 * builds and never appears on the public site or login screens.
 */
export function DevPreviewBar() {
  const { user, previewAs, logout } = useAuth()
  const navigate = useNavigate()
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-navy-900 px-4 py-1.5 text-[length:calc(14px*var(--fs))] text-white/85">
      <span className="inline-flex items-center gap-1.5 font-semibold text-white">
        <Code2 className="size-3.5" />
        Development preview
      </span>
      <span className="hidden text-white/70 md:inline">Sample data · not signed in · not available in production builds</span>
      <label className="ml-auto inline-flex min-w-0 max-w-full items-center gap-2">
        <span className="text-white/70">Preview as</span>
        <select
          value={user?.id ?? ''}
          onChange={(e) => {
            previewAs(e.target.value)
            navigate('/dashboard')
          }}
          className="h-7 min-w-0 max-w-[55vw] rounded-md border border-white/20 bg-navy-800 px-2 text-[length:calc(14px*var(--fs))] text-white"
        >
          {listPreviewAccounts().map((u) => (
            <option key={u.id} value={u.id}>
              {ROLES[u.roleId].name} · {u.fullName}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={() => {
          logout()
          navigate('/')
        }}
        className="rounded-md border border-white/20 px-2 py-0.5 text-white/85 hover:bg-white/10"
      >
        Exit preview
      </button>
    </div>
  )
}
