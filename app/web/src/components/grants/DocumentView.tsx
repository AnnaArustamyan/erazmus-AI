/**
 * DocumentView — flowing readable narrative of the application.
 * Secondary view. Useful for review and sharing, not for portal submission.
 *
 * If contentMd exists (generated), renders that.
 * Otherwise synthesises a structured narrative from answers.
 */
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useNavigate } from 'react-router-dom'
import type { FormSchema } from '../../lib/grants/schemas/formSchemaToGraph'
import { isFieldApplicable } from '../../lib/grants/schemas/formSchemaToGraph'

interface DocumentViewProps {
  schema: FormSchema
  answers: Record<string, string>
  contentMd?: string
  actionCode: string
  callYear: number
  title: string
}

/**
 * Synthesise a readable markdown document from raw answers when no
 * AI-generated contentMd is available yet.
 */
function synthesiseMarkdown(
  schema: FormSchema,
  answers: Record<string, string>,
  title: string,
  actionCode: string,
  callYear: number,
): string {
  const lines: string[] = []
  lines.push(`# ${title}`)
  lines.push(`*${actionCode} · ${callYear}*`)
  lines.push('')

  for (const section of schema.sections) {
    const applicable = section.fields.filter((f) => isFieldApplicable(f, answers))
    const hasContent = applicable.some((f) => answers[f.id]?.trim())
    if (!hasContent) continue

    lines.push(`## ${section.title}`)
    lines.push('')

    for (const field of applicable) {
      const value = answers[field.id]?.trim()
      if (!value) continue

      // Select fields: show the human-readable label
      if (field.type === 'select') {
        const label = field.options?.find((o) => o.value === value)?.label ?? value
        lines.push(`**${field.label}:** ${label}`)
        lines.push('')
        continue
      }

      lines.push(`**${field.label}**`)
      lines.push('')
      lines.push(value)
      lines.push('')
    }
  }

  return lines.join('\n')
}

export function DocumentView({
  schema,
  answers,
  contentMd,
  actionCode,
  callYear,
  title,
}: DocumentViewProps) {
  const navigate = useNavigate()
  const hasAnyAnswer = schema.sections.some((s) =>
    s.fields.some((f) => answers[f.id]?.trim()),
  )

  const markdown =
    contentMd?.trim() ||
    (hasAnyAnswer
      ? synthesiseMarkdown(schema, answers, title, actionCode, callYear)
      : null)

  if (!markdown) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-app-text-dim">
          No content yet. Answer questions in{' '}
          <button
            type="button"
            onClick={() => navigate('/grants/builder')}
            className="text-app-accent underline"
          >
            Application Form
          </button>{' '}
          — the document will build as you go.
        </p>
      </div>
    )
  }

  return (
    <article className="doc-paper mx-auto">
      <div className="chat-md">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
      </div>
    </article>
  )
}
