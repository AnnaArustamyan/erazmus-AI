import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileStack } from 'lucide-react'
import { useGrantInterview } from '../grants/GrantInterviewContext'
import { confirmedActionCode } from '../lib/grants/activeGrant'
import { ka153FormSchema } from '../lib/grants/schemas/ka153'
import { flattenFormFields } from '../lib/grants/schemas/formSchemaToGraph'
import { schemaForAction, schemaVerifiedAt } from '../lib/grants/schemas/registry'
import { factsFromAnswers } from '../lib/grants/facts'
import { requirementPath } from '../lib/grants/gaps'
import { PortalView } from '../components/grants/PortalView'
import { DocumentView } from '../components/grants/DocumentView'

type ViewMode = 'portal' | 'document'

const VIEW_KEY = 'erasmus.application.view'

function loadView(): ViewMode {
  try {
    const v = localStorage.getItem(VIEW_KEY)
    if (v === 'document') return 'document'
  } catch {
    // ignore
  }
  return 'portal'
}

function saveView(v: ViewMode) {
  try {
    localStorage.setItem(VIEW_KEY, v)
  } catch {
    // ignore
  }
}

export function ApplicationPage() {
  const navigate = useNavigate()
  const { activeGrant, ensureActiveGrant, startNewApplication } = useGrantInterview()
  const [view, setView] = useState<ViewMode>(loadView)

  useEffect(() => {
    ensureActiveGrant()
  }, [ensureActiveGrant])

  function handleViewChange(next: ViewMode) {
    setView(next)
    saveView(next)
  }

  // Compute missing minimum facts for the banner
  const missingFacts = useMemo(() => {
    if (!activeGrant || confirmedActionCode(activeGrant) !== 'KA153') return []
    const fields = flattenFormFields(ka153FormSchema)
    const facts = activeGrant.facts?.length
      ? activeGrant.facts
      : factsFromAnswers(fields, activeGrant.answers)
    return (ka153FormSchema.minimumFacts ?? [])
      .filter(
        (key) =>
          !facts.some(
            (f) => f.key === key && f.status === 'locked' && f.confidence === 'confirmed',
          ),
      )
      .map((key) => ({
        key,
        fieldId: fields.find((field) => field.factKey === key)?.id,
      }))
  }, [activeGrant])

  // ── No active grant ──────────────────────────────────────────────────────────
  if (!activeGrant) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6">
        <FileStack size={22} className="mb-3 text-app-text-dim" strokeWidth={1.75} />
        <h1 className="font-display text-lg font-semibold text-app-text">My Application</h1>
        <p className="mt-1.5 max-w-md text-center text-sm text-app-text-dim">
          Start an application to see your draft here. Portal View lets you copy each field
          directly into the Erasmus+ submission form.
        </p>
        <button
          type="button"
          onClick={() => {
            startNewApplication()
            navigate('/application')
          }}
          className="mt-5 border border-app-accent bg-app-accent px-3 py-2 text-sm font-medium text-app-surface"
        >
          New application
        </button>
      </div>
    )
  }

  const actionCode = confirmedActionCode(activeGrant)
  const schema = actionCode ? schemaForAction(actionCode) : null

  // ── Action not confirmed ─────────────────────────────────────────────────────
  if (!actionCode) {
    return (
      <div className="h-full overflow-y-auto px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-app-text-dim">
            Action not confirmed
          </p>
          <h1 className="mt-1 font-display text-lg font-semibold text-app-text">
            {activeGrant.title}
          </h1>
          <p className="mt-4 text-sm text-app-text-dim">
            Confirm the exact action type in{' '}
            <button
              type="button"
              onClick={() => navigate('/grants/builder')}
              className="text-app-accent underline"
            >
              Application Form
            </button>{' '}
            before your draft can be assembled. Chat can help you choose — it will not guess.
          </p>
        </div>
      </div>
    )
  }

  // ── Action confirmed but schema not yet available ────────────────────────────
  if (!schema) {
    return (
      <div className="h-full overflow-y-auto px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-app-text-dim">
            {actionCode} · {activeGrant.callYear ?? 2026}
          </p>
          <h1 className="mt-1 font-display text-lg font-semibold text-app-text">
            {activeGrant.title}
          </h1>
          <div className="mt-4 rounded-lg border border-app-border bg-app-surface px-4 py-3">
            <p className="text-sm text-app-text-dim">
              <span className="font-medium text-app-text">{actionCode}</span> portal view is coming
              soon. The form schema for this action is not yet encoded.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Full view ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Sticky header */}
      <div className="shrink-0 border-b border-app-border bg-app-bg px-4 pb-0 pt-5 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-app-text-dim">
                {actionCode} · {activeGrant.callYear ?? 2026} ·{' '}
                {activeGrant.status.replace('_', ' ')}
              </p>
              <h1 className="mt-0.5 truncate font-display text-lg font-semibold text-app-text">
                {activeGrant.title}
              </h1>
            </div>
          </div>

          {/* Missing facts banner */}
          {missingFacts.length > 0 && (
            <div className="mt-3 rounded-lg border border-app-warn/30 bg-app-warn-soft px-3 py-2.5">
              <p className="text-xs font-medium text-app-warn">
                {missingFacts.length} required fact{missingFacts.length === 1 ? '' : 's'} not
                confirmed — generation will refuse to fill these fields.
              </p>
              <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                {missingFacts.map(({ key, fieldId }) => (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => navigate(requirementPath(fieldId))}
                      className="text-[11px] text-app-warn underline transition-colors duration-150 hover:text-app-text"
                    >
                      {key.replaceAll('_', ' ')}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* View toggle */}
          <div className="mt-4 flex gap-0" role="tablist" aria-label="Application view">
            {(['portal', 'document'] as const).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                type="button"
                onClick={() => handleViewChange(v)}
                className={`border-b-2 px-4 pb-2.5 text-sm font-medium transition-colors ${
                  view === v
                    ? 'border-app-accent text-app-accent'
                    : 'border-transparent text-app-text-dim hover:text-app-text'
                }`}
              >
                {v === 'portal' ? 'Portal View' : 'Document View'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-3xl">
          {view === 'portal' ? (
            <PortalView
              schema={schema}
              answers={activeGrant.answers}
              verifiedAt={schemaVerifiedAt(actionCode)}
            />
          ) : (
            <DocumentView
              schema={schema}
              answers={activeGrant.answers}
              contentMd={activeGrant.contentMd}
              actionCode={actionCode}
              callYear={activeGrant.callYear ?? 2026}
              title={activeGrant.title}
            />
          )}
        </div>
      </div>
    </div>
  )
}
