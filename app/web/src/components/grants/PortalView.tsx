/**
 * PortalView — renders the application field-by-field matching the exact
 * portal structure (section → field label → answer text → char count → copy).
 *
 * Primary output. The user opens the webgate portal side-by-side and pastes
 * each field directly.
 */
import { useState, useCallback } from 'react'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { FormSchema, FormField } from '../../lib/grants/schemas/formSchemaToGraph'
import { isFieldApplicable } from '../../lib/grants/schemas/formSchemaToGraph'
import { requirementPath } from '../../lib/grants/gaps'
import { Card } from '../ui/Card'

interface PortalViewProps {
  schema: FormSchema
  answers: Record<string, string>
  verifiedAt?: string
}

function charColor(length: number, limit: number): string {
  const ratio = length / limit
  if (ratio > 1) return 'text-app-danger font-semibold'
  if (ratio > 0.9) return 'text-app-warn'
  return 'text-app-text-dim'
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // clipboard not available (non-https or blocked)
    }
  }, [text])

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      aria-label="Copy to clipboard"
      className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] transition-all duration-150 ${
        copied ? 'scale-105 text-app-good' : 'text-app-text-dim hover:bg-app-panel hover:text-app-text'
      }`}
    >
      {copied ? (
        <>
          <Check size={11} strokeWidth={2.5} className="text-app-good" />
          <span className="text-app-good">Copied</span>
        </>
      ) : (
        <>
          <Copy size={11} strokeWidth={1.75} />
          <span>Copy</span>
        </>
      )}
    </button>
  )
}

function SelectFieldValue({
  field,
  value,
}: {
  field: FormField
  value: string
}) {
  const label = field.options?.find((o) => o.value === value)?.label ?? value
  return (
    <Card variant={value ? 'elevated' : 'flat'} className="py-2">
      <p className="text-sm text-app-text">{label || <EmptyPlaceholder fieldId={field.id} />}</p>
      {value && (
        <p className="mt-1 text-[11px] text-app-text-dim">
          Select <strong className="font-medium">"{label}"</strong> in the portal dropdown.
        </p>
      )}
    </Card>
  )
}

function EmptyPlaceholder({ fieldId }: { fieldId: string }) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => navigate(requirementPath(fieldId))}
      className="text-app-text-dim italic hover:text-app-accent hover:underline"
    >
      Not answered yet — fill in Application Form
    </button>
  )
}

function FieldBlock({
  field,
  answer,
}: {
  field: FormField
  answer: string
}) {
  const isEmpty = !answer.trim()
  const navigate = useNavigate()

  if (field.type === 'select') {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-app-text-dim">
            {field.label}
            {field.required !== false && (
              <span className="ml-1 text-app-danger" aria-label="required">
                *
              </span>
            )}
          </span>
        </div>
        <SelectFieldValue field={field} value={answer} />
      </div>
    )
  }

  const charCount = answer.length
  const limit = field.characterLimit

  return (
    <div className="space-y-1.5">
      {/* Field header */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-app-text-dim">
          {field.label}
          {field.required !== false && (
            <span className="ml-1 text-app-danger" aria-label="required">
              *
            </span>
          )}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          {!isEmpty && <CopyButton text={answer} />}
          {limit && (
            <span className={`text-[11px] tabular-nums ${charColor(charCount, limit)}`}>
              {charCount.toLocaleString()} / {limit.toLocaleString()}
            </span>
          )}
          {!isEmpty && (
            <button
              type="button"
              onClick={() => navigate(requirementPath(field.id))}
              aria-label="Edit in Application Form"
              className="rounded p-0.5 text-app-text-dim hover:text-app-text"
            >
              <ExternalLink size={11} strokeWidth={1.75} />
            </button>
          )}
        </div>
      </div>

      {/* Answer content */}
      {isEmpty ? (
        <div className="rounded-lg border border-dashed border-app-border bg-app-surface/50 px-3 py-2.5 transition-colors duration-150">
          <button
            type="button"
            onClick={() => navigate(requirementPath(field.id))}
            className="text-sm italic text-app-text-dim hover:text-app-accent hover:underline"
          >
            Not answered yet — fill in Application Form
          </button>
        </div>
      ) : (
        <Card className="py-2.5">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-app-text">{answer}</p>
        </Card>
      )}

      {/* Over-limit warning */}
      {limit && charCount > limit && (
        <p className="text-[11px] text-app-danger">
          {charCount - limit} characters over the limit — shorten before pasting.
        </p>
      )}
    </div>
  )
}

function SectionBlock({
  section,
  answers,
}: {
  section: FormSchema['sections'][number]
  answers: Record<string, string>
}) {
  const applicableFields = section.fields.filter((field) =>
    isFieldApplicable(field, answers),
  )
  const filled = applicableFields.filter((f) => answers[f.id]?.trim()).length
  const total = applicableFields.filter((f) => f.required !== false).length

  return (
    <div className="space-y-5">
      {/* Section header */}
      <div className="flex items-baseline justify-between gap-3 border-b border-app-border pb-2">
        <h2 className="font-display text-base font-semibold text-app-text">{section.title}</h2>
        <span className="shrink-0 text-[11px] text-app-text-dim">
          {filled} / {total} required filled
        </span>
      </div>

      {/* Fields */}
      {applicableFields.map((field) => (
        <FieldBlock
          key={field.id}
          field={field}
          answer={answers[field.id] ?? ''}
        />
      ))}
    </div>
  )
}

export function PortalView({ schema, answers, verifiedAt }: PortalViewProps) {
  return (
    <div className="space-y-10">
      {/* Schema freshness */}
      {verifiedAt && (
        <p className="text-[11px] text-app-text-dim">
          Schema verified against the official portal on{' '}
          <span className="font-medium text-app-text">{verifiedAt}</span>.
        </p>
      )}

      {/* Mobile nudge — the copy-into-portal workflow below is desktop-shaped */}
      <Card className="py-2.5 text-xs text-app-text-dim sm:hidden">
        For the best experience pasting into the official portal, use a desktop.
      </Card>

      {/* Instructions */}
      <Card className="text-sm text-app-text-dim">
        Open the{' '}
        <a
          href="https://webgate.ec.europa.eu/app-forms/af-ui-opportunities/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-app-accent underline"
        >
          Erasmus+ portal
        </a>{' '}
        side-by-side. Each section below matches a section in your application form. Use{' '}
        <span className="font-medium text-app-text">Copy</span> to paste each field answer directly
        into the portal. Choice fields show which option to select.
      </Card>

      {/* Sections */}
      {schema.sections.map((section) => (
        <SectionBlock key={section.id} section={section} answers={answers} />
      ))}
    </div>
  )
}
