import { Download, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { MessageContent } from './MessageContent'
import type { CanvasDocument } from '../ErasmusChatWorkspace.types'

interface DocumentCanvasProps {
  document: CanvasDocument | null
  contentMd: string
  isDrafting: boolean
  onClose: () => void
}

export function DocumentCanvas({
  document,
  contentMd,
  isDrafting,
  onClose,
}: DocumentCanvasProps) {
  const title = document?.title || extractHeading(contentMd) || 'Application draft'

  return (
    <aside
      data-testid="document-canvas"
      aria-label="Application draft"
      className="flex min-h-[42vh] min-w-0 flex-1 flex-col border-t border-app-border bg-app-surface lg:min-h-0 lg:border-t-0 lg:border-l"
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-app-border px-4 py-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-app-text-dim">
            Application
          </div>
          <h2 className="truncate font-display text-sm font-semibold text-app-text">{title}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {document?.downloads?.pdf && (
            <a
              href={document.downloads.pdf}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-7 items-center gap-1 px-2 text-xs font-medium text-app-text hover:text-app-accent"
            >
              <Download size={12} aria-hidden="true" />
              PDF
            </a>
          )}
          {document?.downloads?.docx && (
            <a
              href={document.downloads.docx}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-7 items-center gap-1 px-2 text-xs text-app-text-dim hover:text-app-text"
            >
              DOCX
            </a>
          )}
          {document?.downloads?.md && (
            <a
              href={document.downloads.md}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-7 items-center gap-1 px-2 text-xs text-app-text-dim hover:text-app-text"
            >
              MD
            </a>
          )}
          <button
            type="button"
            aria-label="Hide document"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center text-app-text-dim hover:text-app-text focus-visible:outline-2 focus-visible:outline-app-accent focus-visible:outline-offset-2"
          >
            <PanelRightClose size={14} />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        <article className="doc-paper mx-auto">
          {isDrafting && !contentMd ? (
            <p className="text-sm text-app-text-dim" role="status">
              Drafting the application…
            </p>
          ) : (
            <MessageContent text={contentMd || '_Empty draft._'} markdown />
          )}
          {isDrafting && contentMd ? (
            <p className="mt-4 text-xs text-app-text-dim" role="status">
              Updating…
            </p>
          ) : null}
        </article>
      </div>
    </aside>
  )
}

export function DocumentCanvasToggle({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      data-testid="open-document-canvas"
      onClick={onClick}
      className="inline-flex shrink-0 items-center gap-1.5 border border-app-border bg-app-surface px-3 py-1.5 text-xs font-medium text-app-text hover:bg-app-panel-2 focus-visible:outline-2 focus-visible:outline-app-accent focus-visible:outline-offset-2"
    >
      <PanelRightOpen size={13} aria-hidden="true" />
      View draft
    </button>
  )
}

function extractHeading(markdown: string): string | null {
  const match = markdown.match(/^#\s+(.+)$/m)
  return match?.[1]?.trim() || null
}
