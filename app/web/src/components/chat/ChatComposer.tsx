import {
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
} from 'react'
import { AlertTriangle, FileText, Loader2, Paperclip, Send, Square, X } from 'lucide-react'
import type { PendingAttachment } from '../ErasmusChatWorkspace.types'

interface ChatComposerProps {
  composerId: string
  errorId: string
  attachmentErrorId: string
  quotaId: string
  draft: string
  onDraftChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void
  agentName?: string
  isExhausted: boolean
  isSending: boolean
  isUploadingAttachment: boolean
  errorMessage: string | null
  attachmentError: string | null
  pendingAttachment: PendingAttachment | null
  onRemoveAttachment: () => void
  uploadFile?: (file: File) => Promise<PendingAttachment>
  fileInputRef: RefObject<HTMLInputElement | null>
  onAttachClick: () => void
  onFileSelected: (event: ChangeEvent<HTMLInputElement>) => void
  onStop?: () => void
  hasDocument?: boolean
}

export function ChatComposer({
  composerId,
  errorId,
  attachmentErrorId,
  quotaId,
  draft,
  onDraftChange,
  onSubmit,
  onKeyDown,
  agentName,
  isExhausted,
  isSending,
  isUploadingAttachment,
  errorMessage,
  attachmentError,
  pendingAttachment,
  onRemoveAttachment,
  uploadFile,
  fileInputRef,
  onAttachClick,
  onFileSelected,
  onStop,
  hasDocument = false,
}: ChatComposerProps) {
  const isComposerDisabled = isExhausted

  return (
    <div className="shrink-0 px-5 pb-6 pt-3">
      {errorMessage && (
        <p
          id={errorId}
          role="alert"
          className="mx-auto mb-3 flex max-w-2xl items-start gap-2 border border-app-danger/30 bg-app-surface px-3 py-2 text-xs font-medium text-app-danger"
        >
          <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
          {errorMessage}
        </p>
      )}
      {attachmentError && (
        <p
          id={attachmentErrorId}
          role="alert"
          className="mx-auto mb-3 flex max-w-2xl items-start gap-2 border border-app-danger/30 bg-app-surface px-3 py-2 text-xs font-medium text-app-danger"
        >
          <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
          {attachmentError}
        </p>
      )}
      <form
        onSubmit={onSubmit}
        className="mx-auto max-w-2xl border border-app-border bg-app-surface px-3.5 py-3"
      >
        {(pendingAttachment || isUploadingAttachment) && (
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            <div className="flex items-center gap-1.5 border border-app-border bg-app-panel py-1 pl-2.5 pr-1.5 text-xs text-app-text">
              {isUploadingAttachment ? (
                <Loader2 size={12} className="shrink-0 animate-spin" aria-hidden="true" />
              ) : (
                <FileText size={12} className="shrink-0" aria-hidden="true" />
              )}
              <span className="truncate">
                {isUploadingAttachment ? 'Uploading…' : pendingAttachment?.name}
              </span>
              {pendingAttachment && (
                <button
                  type="button"
                  aria-label={`Remove attachment "${pendingAttachment.name}"`}
                  onClick={onRemoveAttachment}
                  className="flex h-5 w-5 items-center justify-center text-app-text-dim hover:bg-app-panel-2 hover:text-app-danger"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        )}

        <label htmlFor={composerId} className="sr-only">
          Message {agentName}
        </label>
        <textarea
          id={composerId}
          rows={2}
          value={draft}
          disabled={isComposerDisabled}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={onKeyDown}
          aria-describedby={isExhausted ? quotaId : errorMessage ? errorId : undefined}
          placeholder={
            isExhausted
              ? 'Token quota exhausted — upgrade to continue'
              : hasDocument
                ? 'Tell me which section to change, or ask a question…'
                : 'Ask about criteria, partners, or missing facts. Use Generate from this thread for a PDF.'
          }
          className="max-h-40 min-h-12 w-full resize-none bg-transparent text-[0.95rem] leading-relaxed text-app-text placeholder:text-app-text-dim focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        />
        <div className="mt-2.5 flex items-center justify-between border-t border-app-border/70 pt-2.5">
          {uploadFile ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                data-testid="attachment-input"
                onChange={onFileSelected}
                className="sr-only"
                aria-hidden="true"
                tabIndex={-1}
              />
              <button
                type="button"
                aria-label="Attach file"
                onClick={onAttachClick}
                disabled={isComposerDisabled || isUploadingAttachment}
                className="inline-flex h-8 items-center gap-1.5 px-2 text-xs font-medium text-app-text-dim hover:text-app-text disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Paperclip size={14} />
                Attach
              </button>
            </>
          ) : (
            <span />
          )}
          {isSending && onStop ? (
            <button
              type="button"
              aria-label="Stop generating"
              onClick={onStop}
              className="inline-flex h-8 items-center gap-1.5 bg-app-text px-3 text-xs font-semibold text-app-bg focus-visible:outline-2 focus-visible:outline-app-accent focus-visible:outline-offset-2"
            >
              <Square size={11} fill="currentColor" />
              Stop
            </button>
          ) : (
            <button
              type="submit"
              aria-label="Send message"
              disabled={
                isComposerDisabled ||
                isSending ||
                isUploadingAttachment ||
                (!draft.trim() && !pendingAttachment)
              }
              className="inline-flex h-8 items-center gap-1.5 bg-app-text px-3 text-xs font-semibold text-app-bg disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Send size={13} />
              Send
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
