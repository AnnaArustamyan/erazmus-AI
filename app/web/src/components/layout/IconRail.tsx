import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { ClipboardCheck, FileStack, MessageSquare, Plus, ShieldCheck } from 'lucide-react'
import { BrandMark } from '../BrandMark'
import { useGrantInterview } from '../../grants/GrantInterviewContext'

const NAV = [
  { to: '/chat', label: 'Chat', icon: MessageSquare },
  { to: '/grants/builder', label: 'Application Form', icon: ClipboardCheck },
  { to: '/evaluate', label: 'Evaluate', icon: ShieldCheck },
  { to: '/application', label: 'My Application', icon: FileStack },
]

export function IconRail() {
  const location = useLocation()
  const navigate = useNavigate()
  const { startNewApplication } = useGrantInterview()

  function handleNew() {
    startNewApplication()
    if (location.pathname.startsWith('/grants')) {
      navigate('/grants/builder')
      return
    }
    if (location.pathname.startsWith('/application')) {
      navigate('/application')
      return
    }
    navigate('/chat', { state: { newChat: true } })
  }

  return (
    <nav
      aria-label="Primary"
      className="hidden h-full w-14 shrink-0 flex-col items-center gap-1.5 border-r border-app-border/80 bg-app-panel py-3 sm:flex"
    >
      <NavLink
        to="/chat"
        aria-label="EU Grantwriter"
        title="EU Grantwriter"
        className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl hover:bg-app-panel-2 focus-visible:outline-2 focus-visible:outline-app-accent focus-visible:outline-offset-2"
      >
        <BrandMark size={28} />
      </NavLink>
      <button
        type="button"
        onClick={handleNew}
        aria-label="New"
        className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-app-accent text-app-surface hover:opacity-90 focus-visible:outline-2 focus-visible:outline-app-accent focus-visible:outline-offset-2"
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
                `flex h-10 w-10 items-center justify-center rounded-lg text-app-text-dim hover:bg-app-panel-2 hover:text-app-text focus-visible:outline-2 focus-visible:outline-app-accent focus-visible:outline-offset-2 ${
                  isActive || (to === '/grants/builder' && location.pathname.startsWith('/grants'))
                    ? 'bg-app-accent-soft text-app-accent'
                    : ''
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
