import { FlaskConical } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { ROLES } from '@/config/permissions'
import { listDemoUsers } from '@/services/authService'

/**
 * DEMO MODE ONLY. Lets reviewers switch between mock accounts.
 * Hidden unless APP_CONFIG.demoMode is on. Not a security feature.
 */
export function DemoBar() {
  const { user, switchUser } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-navy-900 px-4 py-1.5 text-[12px] text-white/85">
      <span className="inline-flex items-center gap-1.5 font-semibold text-white">
        <FlaskConical className="size-3.5" />
        Demo mode
      </span>
      <span className="hidden text-white/70 md:inline">Mock data · changes reset on reload · access checks are simulated in the browser</span>
      <label className="ml-auto inline-flex items-center gap-2">
        <span className="text-white/70">View as</span>
        <select
          value={user?.id ?? ''}
          onChange={(e) => {
            switchUser(e.target.value)
            navigate('/dashboard')
          }}
          className="h-7 rounded-md border border-white/20 bg-navy-800 px-2 text-[12px] text-white"
        >
          {listDemoUsers().map((u) => (
            <option key={u.id} value={u.id}>
              {ROLES[u.roleId].name} · {u.fullName}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
