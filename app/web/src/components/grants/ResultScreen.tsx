import { Download } from 'lucide-react'
import { MessageContent } from '../chat/MessageContent'
import type { GrantApplication, QuestionGraph } from '../../lib/grants/types'

interface ResultScreenProps {
  grant: GrantApplication
  graph: QuestionGraph
  path: string[]
}

export function ResultScreen({ grant, graph, path }: ResultScreenProps) {
  return (
    <div className="mx-auto max-w-3xl py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold text-app-text">{grant.title}</h1>
          <p className="mt-1.5 text-sm text-app-text-dim">
            {grant.actionCode} application draft. Download the PDF, or edit an answer and generate again.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {grant.downloads?.pdf && (
            <a
              href={grant.downloads.pdf}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 border border-app-accent bg-app-accent px-3 py-1.5 text-xs font-medium text-app-surface"
            >
              <Download size={12} />
              PDF
            </a>
          )}
          {grant.downloads?.docx && (
            <a
              href={grant.downloads.docx}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 border border-app-border px-3 py-1.5 text-xs text-app-text-dim hover:text-app-text"
            >
              DOCX
            </a>
          )}
        </div>
      </div>
      {grant.contentMd ? (
        <article className="doc-paper border border-app-border bg-app-surface px-5 py-6">
          <MessageContent text={grant.contentMd} markdown />
        </article>
      ) : (
        <div className="flex flex-col gap-3">
          {path.map((id) => {
            const question = graph.questions[id]
            const answer = grant.answers[id]
            if (!question || !answer) return null
            return (
              <section key={id} className="border border-app-border bg-app-surface p-4">
                <p className="text-xs text-app-text-dim">{question.formSection}</p>
                <h2 className="text-sm font-semibold text-app-text">{question.formFieldLabel}</h2>
                <p className="mt-2 text-sm leading-relaxed text-app-text">{answer}</p>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
