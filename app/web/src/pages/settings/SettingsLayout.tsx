import { NavLink, Outlet } from 'react-router-dom'
import { FileText, Gauge, Shield, SlidersHorizontal, UserRound } from 'lucide-react'

const NAV = [
  { to: '/settings/profile', label: 'Profile', icon: UserRound },
  { to: '/settings/preferences', label: 'Preferences', icon: SlidersHorizontal },
  { to: '/settings/usage', label: 'Usage', icon: Gauge },
  { to: '/settings/security', label: 'Security', icon: Shield },
  { to: '/settings/documents', label: 'Documents', icon: FileText },
]

export function SettingsLayout() {
  return (
    <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 gap-6 overflow-hidden p-6">
      <nav aria-label="Settings" className="w-44 shrink-0">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-app-text-dim">
          Settings
        </div>
        <ul className="flex flex-col gap-0.5">
          {NAV.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm ${
                    isActive
                      ? 'bg-app-panel-2 font-semibold text-app-text'
                      : 'text-app-text-dim hover:bg-app-panel hover:text-app-text'
                  }`
                }
              >
                <item.icon size={14} aria-hidden="true" />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0 flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  )
}
