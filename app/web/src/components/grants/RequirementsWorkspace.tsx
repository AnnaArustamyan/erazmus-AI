import type { RequirementItem, RequirementStatus } from '../../lib/grants/gaps'
import type { WorkingScenario } from '../../lib/grants/proposals'

const STATUS_LABEL: Record<RequirementStatus, string> = {
  missing: 'Missing',
  weak: 'Weak',
  confirm: 'Confirm',
  proposed: 'Proposed',
  complete: 'Done',
}

interface RequirementsWorkspaceProps {
  actionCode: string
  callYear?: number
  items: RequirementItem[]
  scenario?: WorkingScenario | null
  onOpen: (fieldId: string) => void
  onConfirmProposal?: (fieldId: string, value: string) => void
  onUseWorkingScenario?: () => void
}

export function RequirementsWorkspace({
  actionCode,
  callYear,
  items,
  scenario,
  onOpen,
  onConfirmProposal,
  onUseWorkingScenario,
}: RequirementsWorkspaceProps) {
  const required = items.filter((item) => item.required)
  const done = required.filter((item) => item.status === 'complete').length
  const sections = [...new Set(items.map((item) => item.section || 'Requirements'))]
  const proposed = items.filter((item) => item.status === 'proposed')
  const showScenario = Boolean(scenario && (proposed.length > 0 || scenario.warning || !scenario.usableAsPlan))

  return (
    <div className="mx-auto max-w-3xl py-8">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-app-text-dim">
        {actionCode} · {callYear ?? 2026}
      </p>
      <h1 className="mt-1 font-display text-xl font-semibold text-app-text">Application Form</h1>
      <p className="mt-1.5 text-sm text-app-text-dim">
        {done} of {required.length} required fields complete. Fields below are grouped to match the official
        application form — open any one, in any order. "Missing" just means not answered yet, not wrong.
        Suggestions are a plan until you confirm them.
      </p>

      {showScenario && scenario ? (
        <section
          className="mt-6 rounded-xl border border-app-border bg-app-surface px-4 py-4 shadow-app-sm transition-all duration-150"
          aria-labelledby="working-scenario-heading"
        >
          <h2 id="working-scenario-heading" className="text-sm font-semibold text-app-text">
            Proposed project setup
          </h2>
          <p className="mt-1 text-sm text-app-text-dim">
            A working hypothesis, not application facts. Confirm what is right, change what is not, and do not treat
            unconfirmed values as ready to generate.
          </p>
          {scenario.warning ? <p className="mt-2 text-sm text-app-danger">{scenario.warning}</p> : null}
          <ul className="mt-3 flex flex-col gap-2">
            {scenario.items
              .filter((row) => row.fillState !== 'known')
              .map((row) => (
                <li
                  key={row.factKey}
                  className="rounded-lg border border-app-border bg-app-panel/40 px-3 py-2 transition-colors duration-150"
                >
                  <p className="text-sm text-app-text">
                    {row.value == null || row.value === '' ? row.label : `${row.label}: ${row.value}`}
                  </p>
                  <p className="mt-0.5 text-xs text-app-text-dim">{row.confirmLabel}</p>
                </li>
              ))}
          </ul>
          {onUseWorkingScenario && proposed.length > 0 ? (
            <button
              type="button"
              onClick={onUseWorkingScenario}
              className="mt-3 rounded-lg border border-app-accent bg-app-accent px-3 py-2 text-sm font-medium text-app-surface shadow-app-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-app-md"
            >
              Use this working scenario
            </button>
          ) : null}
        </section>
      ) : null}

      {required.length > 0 && done === required.length && (
        <p className="mt-6 rounded-xl border border-app-border bg-app-surface px-4 py-3 text-sm text-app-text shadow-app-sm">
          Required fields are filled. Weak or Chat-inferred facts will show here if they appear later.
        </p>
      )}

      {sections.map((section) => {
        const rows = items.filter((item) => (item.section || 'Requirements') === section)
        return (
          <section key={section} className="mt-6">
            <h2 className="mb-2 text-sm font-semibold text-app-text">{section}</h2>
            <ul className="flex flex-col overflow-hidden rounded-xl border border-app-border bg-app-surface shadow-app-sm transition-all duration-150">
              {rows.map((item) => (
                <RequirementRow
                  key={item.fieldId}
                  item={item}
                  onOpen={onOpen}
                  onConfirmProposal={onConfirmProposal}
                />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

function RequirementRow({
  item,
  onOpen,
  onConfirmProposal,
}: {
  item: RequirementItem
  onOpen: (fieldId: string) => void
  onConfirmProposal?: (fieldId: string, value: string) => void
}) {
  const tone =
    item.status === 'complete'
      ? 'text-app-text-dim'
      : item.status === 'confirm' || item.status === 'proposed'
        ? 'text-app-accent'
        : 'text-app-danger'

  return (
    <li className="border-b border-app-border last:border-b-0">
      <div className="flex w-full items-start justify-between gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => onOpen(item.fieldId)}
          className="min-w-0 flex-1 text-left transition-colors duration-150 hover:bg-app-panel-2 focus-visible:outline-2 focus-visible:outline-app-accent"
        >
          <span className="block text-sm text-app-text">{item.label}</span>
          {item.issues[0] ? (
            <span className="mt-0.5 block text-xs text-app-text-dim">{item.issues[0]}</span>
          ) : null}
        </button>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={`text-[11px] font-semibold uppercase tracking-wide ${tone}`}>
            {STATUS_LABEL[item.status]}
          </span>
          {item.status === 'proposed' && item.proposedValue && onConfirmProposal ? (
            <button
              type="button"
              onClick={() => onConfirmProposal(item.fieldId, item.proposedValue!)}
              className="text-[11px] font-medium text-app-accent underline decoration-app-accent/40 underline-offset-2 transition-colors duration-150 hover:decoration-app-accent"
            >
              Confirm
            </button>
          ) : null}
        </div>
      </div>
    </li>
  )
}
