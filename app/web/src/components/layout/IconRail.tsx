import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { FileStack, MessageSquare, Plus, Sparkles } from 'lucide-react'
import { useGrantInterview } from '../../grants/GrantInterviewContext'

const NAV = [
  { to: '/chat', label: 'Chat', icon: MessageSquare },
  { to: '/generator', label: 'Generator', icon: Sparkles },
  { to: '/grants', label: 'Grants', icon: FileStack },
]

export function IconRail() {
  const location = useLocation()
  const navigate = useNavigate()
  const resetInterview = useGrantInterview().reset

  function handleNew() {
    if (location.pathname.startsWith('/generator')) {
      navigate('/generator', { state: { reset: true } })
      return
    }
    if (location.pathname.startsWith('/grants')) {
      resetInterview()
      navigate('/grants/builder')
      return
    }
    navigate('/chat', { state: { newChat: true } })
  }

  return (
    <nav
      aria-label="Primary"
      className="hidden h-full w-14 shrink-0 flex-col items-center gap-2 border-r border-app-border bg-app-panel py-3 sm:flex"
    >
      <button
        type="button"
        onClick={handleNew}
        aria-label="New"
        className="mb-2 flex h-9 w-9 items-center justify-center bg-app-accent text-app-surface hover:opacity-90 focus-visible:outline-2 focus-visible:outline-app-accent focus-visible:outline-offset-2"
      >
        <Plus size={16} />
      </button>
      <ul className="flex flex-col items-center gap-1">
        {NAV.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              aria-label={label}
              title={label}
              className={({ isActive }) =>
                `flex h-10 w-10 items-center justify-center text-app-text-dim hover:bg-app-panel-2 hover:text-app-text focus-visible:outline-2 focus-visible:outline-app-accent focus-visible:outline-offset-2 ${
                  isActive ? 'bg-app-accent-soft text-app-accent' : ''
                }`
              }
            >
              <Icon size={18} strokeWidth={1.75} />
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
