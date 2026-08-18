import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileStack } from 'lucide-react'
import { useGrantInterview } from '../grants/GrantInterviewContext'
import { confirmedActionCode } from '../lib/grants/activeGrant'
import { ka153FormSchema } from '../lib/grants/schemas/ka153'
import { flattenFormFields } from '../lib/grants/schemas/formSchemaToGraph'
import { factsFromAnswers } from '../lib/grants/facts'
import { requirementPath } from '../lib/grants/gaps'
import ReactMarkdown from 'react-markdown'

export function ApplicationPage() {
  const navigate = useNavigate()
  const { activeGrant, ensureActiveGrant, startNewApplication } = useGrantInterview()

  useEffect(() => {
    ensureActiveGrant()
  }, [ensureActiveGrant])

  const missingFacts = useMemo(() => {
    if (!activeGrant || confirmedActionCode(activeGrant) !== 'KA153') return []
    const fields = flattenFormFields(ka153FormSchema)
    const facts = activeGrant.facts?.length
      ? activeGrant.facts
      : factsFromAnswers(fields, activeGrant.answers)
    return (ka153FormSchema.minimumFacts ?? [])
      .filter(
        (key) => !facts.some((f) => f.key === key && f.status === 'locked' && f.confidence === 'confirmed'),
      )
      .map((key) => ({
        key,
        fieldId: fields.find((field) => field.factKey === key)?.id,
      }))
  }, [activeGrant])

  if (!activeGrant) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6">
        <FileStack size={22} className="mb-3 text-app-text-dim" />
        <h1 className="font-display text-lg font-semibold text-app-text">My Application</h1>
        <p className="mt-1.5 max-w-md text-center text-sm text-app-text-dim">
          This view shows the assembled draft for the active application. Chat and Requirements read and write the same record.
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

  const action = confirmedActionCode(activeGrant)

  return (
    <div className="h-full overflow-y-auto px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-app-text-dim">
          {action ?? 'Action not confirmed'} · {activeGrant.callYear ?? 2026} · {activeGrant.status.replace('_', ' ')}
        </p>
        <h1 className="mt-1 font-display text-lg font-semibold text-app-text">{activeGrant.title}</h1>
        {!action && (
          <p className="mt-4 text-sm text-app-text-dim">
            Confirm the exact action in Requirements when you know it. Chat can help you decide — it will not guess.
          </p>
        )}
        {missingFacts.length > 0 && (
          <div className="mt-4 border border-app-border bg-app-surface px-4 py-3 text-sm">
            <p className="font-medium text-app-text">These facts are not confirmed yet. Open any of them from Requirements — not only in order.</p>
            <ul className="mt-2 list-disc pl-5 text-app-text-dim">
              {missingFacts.map(({ key, fieldId }) => (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => navigate(requirementPath(fieldId))}
                    className="text-left text-app-accent underline"
                  >
                    {key.replaceAll('_', ' ')}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {activeGrant.contentMd ? (
          <div className="prose prose-sm mt-6 max-w-none text-app-text">
            <ReactMarkdown>{activeGrant.contentMd}</ReactMarkdown>
          </div>
        ) : (
          <p className="mt-6 text-sm text-app-text-dim">
            No generated sections yet. Locked facts will fill this document field by field — Chat, Requirements, and this view share the same facts.
          </p>
        )}
      </div>
    </div>
  )
}
