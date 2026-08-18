import { Download, FileOutput } from 'lucide-react'
import { MessageContent } from '../chat/MessageContent'
import type { ProjectPlan } from '../../lib/grants/types'

interface ProjectPlanDocumentProps {
  plan: ProjectPlan
  onTurnIntoGrant: () => void
}

export function ProjectPlanDocument({ plan, onTurnIntoGrant }: ProjectPlanDocumentProps) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold text-app-text">{plan.title}</h1>
          <p className="mt-1.5 text-sm text-app-text-dim">
            Strategic plan from your brief. Turn it into Requirements when you are ready to apply.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {plan.downloads?.pdf && (
            <a
              href={plan.downloads.pdf}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 border border-app-border px-3 py-1.5 text-xs text-app-text-dim hover:text-app-text"
            >
              <Download size={12} />
              PDF
            </a>
          )}
          <button
            type="button"
            onClick={onTurnIntoGrant}
            className="inline-flex items-center gap-1.5 border border-app-accent bg-app-accent px-3 py-1.5 text-xs font-medium text-app-surface"
          >
            <FileOutput size={14} />
            Turn into a grant application
          </button>
        </div>
      </div>
      <article className="doc-paper border border-app-border bg-app-surface px-5 py-6">
        <MessageContent text={plan.contentMd} markdown />
      </article>
    </div>
  )
}
