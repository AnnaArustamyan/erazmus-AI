import { ACTION_TYPES } from '../../lib/grants/actionTypes'
import type { ActionGroup } from '../../lib/grants/types'

const GROUP_LABEL: Record<ActionGroup, string> = {
  KA1: 'KA1 — Mobility',
  KA2: 'KA2 — Cooperation partnerships',
}

export function ActionTypePicker({ onSelect }: { onSelect: (code: string) => void }) {
  const groups: ActionGroup[] = ['KA1', 'KA2']

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 text-center">
        <h1 className="font-display text-xl font-semibold text-app-text">What are you applying for?</h1>
        <p className="mt-1.5 text-sm text-app-text-dim">
        KA1 mobility and KA2 partnerships. Confirm the exact action — we will not guess KA152 vs KA153 vs KA154.
        </p>
      </div>
      {groups.map((group) => (
        <div key={group} className="mb-6">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-app-text-dim">
            {GROUP_LABEL[group]}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ACTION_TYPES.filter((action) => action.group === group).map((action) => (
              <button
                key={action.code}
                type="button"
                disabled={!action.supported}
                onClick={() => onSelect(action.code)}
                className="flex flex-col gap-2 border border-app-border bg-app-surface p-4 text-left hover:bg-app-panel-2 focus-visible:outline-2 focus-visible:outline-app-accent focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-app-accent">{action.code}</span>
                  {!action.supported && (
                    <span className="text-[10px] uppercase tracking-wide text-app-text-dim">Coming soon</span>
                  )}
                </div>
                <p className="text-sm font-medium text-app-text">{action.name}</p>
                <p className="text-xs text-app-text-dim">{action.description}</p>
                <p className="text-xs text-app-text-dim">For: {action.audience}</p>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
