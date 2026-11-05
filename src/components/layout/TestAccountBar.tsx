import { FlaskConical } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { ROLES } from '@/config/permissions'
import { TEST_LEVELS, isTestUser } from '@/config/testAccount'
import type { RoleId } from '@/types/auth'

/** Shown only to the test account: switch between every level to test each experience. */
export function TestAccountBar() {
  const { user, switchTestLevel } = useAuth()
  const navigate = useNavigate()
  if (!user || !isTestUser(user.id)) return null
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-[#7a4b00] px-4 py-1.5 text-[12px] text-white/90">
      <span className="inline-flex items-center gap-1.5 font-semibold text-white">
        <FlaskConical className="size-3.5" /> Test account
      </span>
      <span className="hidden text-white/75 md:inline">{user.email} · sample data</span>
      <label className="ml-auto inline-flex items-center gap-2">
        <span className="text-white/75">Viewing as</span>
        <select
          value={user.roleId}
          onChange={(e) => {
            switchTestLevel(e.target.value as RoleId)
            navigate('/dashboard')
          }}
          className="h-7 rounded-md border border-white/25 bg-[#5c3800] px-2 text-[12px] text-white"
        >
          {TEST_LEVELS.map((r) => (
            <option key={r} value={r}>{ROLES[r].name}</option>
          ))}
        </select>
      </label>
    </div>
  )
}
