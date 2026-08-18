import { needsAttention, type RequirementItem, type RequirementStatus } from '../../lib/grants/gaps'

const STATUS_LABEL: Record<RequirementStatus, string> = {
  missing: 'Missing',
  weak: 'Weak',
  confirm: 'Confirm',
  complete: 'Done',
}

interface RequirementsWorkspaceProps {
  actionCode: string
  callYear?: number
  items: RequirementItem[]
  onOpen: (fieldId: string) => void
}

export function RequirementsWorkspace({
  actionCode,
  callYear,
  items,
  onOpen,
}: RequirementsWorkspaceProps) {
  const open = needsAttention(items)
  const required = items.filter((item) => item.required)
  const done = required.filter((item) => item.status === 'complete').length
  const sections = [...new Set(items.map((item) => item.section || 'Requirements'))]

  return (
    <div className="mx-auto max-w-3xl py-8">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-app-text-dim">
        {actionCode} · {callYear ?? 2026}
      </p>
      <h1 className="mt-1 font-display text-xl font-semibold text-app-text">Requirements</h1>
      <p className="mt-1.5 text-sm text-app-text-dim">
        {done} of {required.length} required fields complete. Open any field — this is not a questionnaire sequence.
      </p>

      {open.length > 0 && (
        <section className="mt-6" aria-labelledby="needs-attention-heading">
          <h2 id="needs-attention-heading" className="mb-2 text-sm font-semibold text-app-text">
            Needs attention
          </h2>
          <ul className="flex flex-col border border-app-border bg-app-surface">
            {open.map((item) => (
              <RequirementRow key={item.fieldId} item={item} onOpen={onOpen} />
            ))}
          </ul>
        </section>
      )}

      {open.length === 0 && (
        <p className="mt-6 border border-app-border bg-app-surface px-4 py-3 text-sm text-app-text">
          Required fields are filled. Weak or Chat-inferred facts will show here if they appear later.
        </p>
      )}

      {sections.map((section) => {
        const rows = items.filter((item) => (item.section || 'Requirements') === section)
        return (
          <section key={section} className="mt-6">
            <h2 className="mb-2 text-sm font-semibold text-app-text">{section}</h2>
            <ul className="flex flex-col border border-app-border bg-app-surface">
              {rows.map((item) => (
                <RequirementRow key={item.fieldId} item={item} onOpen={onOpen} />
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
}: {
  item: RequirementItem
  onOpen: (fieldId: string) => void
}) {
  const tone =
    item.status === 'complete'
      ? 'text-app-text-dim'
      : item.status === 'confirm'
        ? 'text-app-accent'
        : 'text-app-danger'

  return (
    <li className="border-b border-app-border last:border-b-0">
      <button
        type="button"
        onClick={() => onOpen(item.fieldId)}
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-app-panel-2 focus-visible:outline-2 focus-visible:outline-app-accent"
      >
        <span className="min-w-0">
          <span className="block text-sm text-app-text">{item.label}</span>
          {item.issues[0] ? (
            <span className="mt-0.5 block text-xs text-app-text-dim">{item.issues[0]}</span>
          ) : null}
        </span>
        <span className={`shrink-0 text-[11px] font-semibold uppercase tracking-wide ${tone}`}>
          {STATUS_LABEL[item.status]}
        </span>
      </button>
    </li>
  )
}
