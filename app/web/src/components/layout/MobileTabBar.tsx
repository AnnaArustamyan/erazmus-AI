import { NavLink, useLocation } from 'react-router-dom'
import { ClipboardCheck, FileStack, MessageSquare, ShieldCheck } from 'lucide-react'

const TABS = [
  { to: '/chat', label: 'Chat', icon: MessageSquare },
  { to: '/grants/builder', label: 'App Form', icon: ClipboardCheck },
  { to: '/evaluate', label: 'Evaluate', icon: ShieldCheck },
  { to: '/application', label: 'My App', icon: FileStack },
]

export function MobileTabBar() {
  const location = useLocation()

  return (
    <nav
      aria-label="Primary"
      className="flex h-14 w-full shrink-0 items-center justify-around border-t border-app-border bg-app-panel sm:hidden"
    >
      {TABS.map(({ to, label, icon: Icon }) => {
        const isActive =
          location.pathname === to ||
          (to === '/grants/builder' && location.pathname.startsWith('/grants'))
        return (
          <NavLink
            key={to}
            to={to}
            className={`flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] ${
              isActive ? 'text-app-accent' : 'text-app-text-dim'
            }`}
          >
            <Icon size={18} strokeWidth={1.75} />
            {label}
          </NavLink>
        )
      })}
    </nav>
  )
}
