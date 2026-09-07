import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { assessAnswer } from '../../lib/grants/schemas/formSchemaToGraph'
import type { InterviewQuestion } from '../../lib/grants/types'
import { Select } from '../ui/Select'

interface InterviewStepProps {
  question: InterviewQuestion
  initialValue: string
  onSubmit: (value: string) => void
  onBack: () => void
  canGoBack: boolean
  progress: number
  submitLabel?: string
}

export function InterviewStep({
  question,
  initialValue,
  onSubmit,
  onBack,
  canGoBack,
  progress,
  submitLabel = 'Save',
}: InterviewStepProps) {
  const [value, setValue] = useState(initialValue)
  useEffect(() => setValue(initialValue), [question.id, initialValue])

  function handleSubmit() {
    onSubmit(value.trim())
  }

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col px-2 pb-10 pt-16">
      <div
        role="progressbar"
        aria-label="Application completeness"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mb-8 h-1 w-full overflow-hidden bg-app-border"
      >
        <div className="h-full bg-app-accent transition-[width]" style={{ width: `${progress}%` }} />
      </div>

      {canGoBack && (
        <button
          type="button"
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-1 text-xs text-app-text-dim hover:text-app-text"
        >
          <ArrowLeft size={14} />
          Back to list
        </button>
      )}

      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-app-text-dim">
        {question.formSection} · {question.formFieldLabel}
      </p>
      <h2 className="mb-2 font-display text-lg font-semibold text-app-text">{question.question}</h2>
      {question.helpText ? (
        <p className="mb-4 text-sm text-app-text-dim">{question.helpText}</p>
      ) : (
        <div className="mb-4" />
      )}

      {question.type === 'textarea' && (
        <textarea
          autoFocus
          rows={5}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={question.characterLimit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit()
          }}
          className="w-full border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text focus-visible:outline-2 focus-visible:outline-app-accent"
        />
      )}

      {question.type === 'text' && (
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={question.characterLimit}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          className="w-full border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text focus-visible:outline-2 focus-visible:outline-app-accent"
        />
      )}

      {question.type === 'select' && (
        <Select
          autoFocus
          value={value}
          onValueChange={setValue}
          options={question.options ?? []}
          className="w-full"
        />
      )}

      {(() => {
        const issues = assessAnswer(question, value)
        const remaining =
          question.characterLimit != null ? question.characterLimit - value.length : null
        return (
          <div className="mt-2 space-y-1">
            {remaining != null && (
              <p className="text-[11px] text-app-text-dim">{remaining} characters left</p>
            )}
            {value.trim() && issues.map((issue) => (
              <p key={issue} className="text-xs text-app-danger">
                {issue}
              </p>
            ))}
          </div>
        )
      })()}

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          className="border border-app-accent bg-app-accent px-4 py-2 text-sm font-medium text-app-surface"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  )
}
