import { useNavigate } from 'react-router-dom'
import { useGrantInterview } from '../../grants/GrantInterviewContext'
import { confirmedActionCode } from '../../lib/grants/activeGrant'

export function ApplicationSwitcher() {
  const navigate = useNavigate()
  const { grants, activeGrant, setActiveGrant, startNewApplication } = useGrantInterview()
  const label = activeGrant
    ? `${confirmedActionCode(activeGrant) ?? 'Action not confirmed'} · ${activeGrant.title}`
    : 'No active application'

  return (
    <div className="flex min-w-0 items-center gap-2">
      <label className="sr-only" htmlFor="active-application">
        Active application
      </label>
      <select
        id="active-application"
        value={activeGrant?.id ?? ''}
        onChange={(e) => {
          if (!e.target.value) return
          setActiveGrant(e.target.value)
        }}
        className="max-w-[14rem] truncate border border-app-border bg-app-surface px-2 py-1 text-xs text-app-text sm:max-w-xs"
      >
        {grants.length === 0 ? (
          <option value="">{label}</option>
        ) : (
          grants.map((grant) => (
            <option key={grant.id} value={grant.id}>
              {(confirmedActionCode(grant) ?? 'Unconfirmed')} · {grant.title}
            </option>
          ))
        )}
      </select>
      <button
        type="button"
        onClick={() => {
          startNewApplication()
          navigate('/chat', { state: { newChat: true } })
        }}
        className="shrink-0 text-[11px] text-app-text-dim hover:text-app-text"
      >
        New
      </button>
      <button
        type="button"
        onClick={() => navigate('/grants')}
        className="shrink-0 text-[11px] text-app-text-dim hover:text-app-text"
      >
        All
      </button>
    </div>
  )
}
