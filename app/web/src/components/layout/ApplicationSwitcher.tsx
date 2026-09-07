import { useNavigate } from 'react-router-dom'
import { useGrantInterview } from '../../grants/GrantInterviewContext'
import { confirmedActionCode } from '../../lib/grants/activeGrant'
import { Select } from '../ui/Select'

export function ApplicationSwitcher() {
  const navigate = useNavigate()
  const { grants, activeGrant, setActiveGrant } = useGrantInterview()
  const label = activeGrant
    ? `${confirmedActionCode(activeGrant) ?? 'Action not confirmed'} · ${activeGrant.title}`
    : 'No active application'

  return (
    <div className="flex min-w-0 items-center gap-2">
      {grants.length === 0 ? (
        <span className="max-w-56 truncate rounded-lg border border-app-border bg-app-surface px-2.5 py-1.5 text-xs text-app-text-dim sm:max-w-xs">
          {label}
        </span>
      ) : (
        <Select
          triggerId="active-application"
          aria-label="Active application"
          value={activeGrant?.id ?? ''}
          onValueChange={(id) => setActiveGrant(id)}
          options={grants.map((grant) => ({
            value: grant.id,
            label: `${confirmedActionCode(grant) ?? 'Unconfirmed'} · ${grant.title}`,
          }))}
          className="max-w-56 py-1.5 text-xs sm:max-w-xs"
        />
      )}
      <button
        type="button"
        onClick={() => navigate('/grants')}
        className="shrink-0 rounded-lg px-2 py-1 text-[11px] text-app-text-dim transition-colors duration-150 hover:bg-app-panel-2 hover:text-app-text"
      >
        All
      </button>
    </div>
  )
}
