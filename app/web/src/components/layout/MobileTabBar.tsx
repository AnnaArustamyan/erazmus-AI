import { NavLink } from 'react-router-dom'
import { FileStack, MessageSquare, Settings, Sparkles } from 'lucide-react'

const TABS = [
  { to: '/chat', label: 'Chat', icon: MessageSquare },
  { to: '/generator', label: 'Generator', icon: Sparkles },
  { to: '/grants', label: 'Grants', icon: FileStack },
  { to: '/settings/profile', label: 'Settings', icon: Settings },
]

export function MobileTabBar() {
  return (
    <nav
      aria-label="Primary"
      className="flex h-14 w-full shrink-0 items-center justify-around border-t border-app-border bg-app-panel sm:hidden"
    >
      {TABS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] ${
              isActive ? 'text-app-accent' : 'text-app-text-dim'
            }`
          }
        >
          <Icon size={18} strokeWidth={1.75} />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
