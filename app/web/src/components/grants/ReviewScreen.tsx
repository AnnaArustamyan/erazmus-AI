import { Pencil } from 'lucide-react'
import type { QuestionGraph } from '../../lib/grants/types'

interface ReviewScreenProps {
  graph: QuestionGraph
  path: string[]
  answers: Record<string, string>
  onEdit: (questionId: string) => void
  onGenerate: () => void
  isGenerating: boolean
}

export function ReviewScreen({
  graph,
  path,
  answers,
  onEdit,
  onGenerate,
  isGenerating,
}: ReviewScreenProps) {
  const sections = new Map<string, string[]>()
  for (const id of path) {
    const question = graph.questions[id]
    if (!question) continue
    const list = sections.get(question.formSection) ?? []
    list.push(id)
    sections.set(question.formSection, list)
  }

  return (
    <div className="mx-auto max-w-3xl py-8">
      <h1 className="font-display text-xl font-semibold text-app-text">Review your answers</h1>
      <p className="mt-1.5 mb-6 text-sm text-app-text-dim">
        Check everything, then generate the application PDF. Missing facts stay as gaps — we will not invent them.
      </p>
      <div className="flex flex-col gap-4">
        {[...sections.entries()].map(([section, ids]) => (
          <section key={section} className="border border-app-border bg-app-surface p-4">
            <h2 className="mb-3 text-sm font-semibold text-app-text">{section}</h2>
            <div className="flex flex-col gap-3">
              {ids.map((id) => {
                const question = graph.questions[id]
                return (
                  <div key={id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-app-text-dim">{question.formFieldLabel}</p>
                      <p className="mt-0.5 text-sm text-app-text">{answers[id] || '—'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onEdit(id)}
                      aria-label={`Edit ${question.formFieldLabel}`}
                      className="shrink-0 text-app-text-dim hover:text-app-accent"
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>
      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={onGenerate}
          disabled={isGenerating}
          className="border border-app-accent bg-app-accent px-4 py-2 text-sm font-medium text-app-surface disabled:opacity-40"
        >
          {isGenerating ? 'Generating application…' : 'Generate application PDF'}
        </button>
      </div>
    </div>
  )
}
