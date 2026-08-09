import {
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
} from 'react'
import { AlertTriangle, FileText, Loader2, Paperclip, Send, X } from 'lucide-react'
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
}: ChatComposerProps) {
  const isComposerDisabled = isExhausted

  return (
    <div className="shrink-0 px-5 pb-5 pt-2">
      {errorMessage && (
        <p
          id={errorId}
          role="alert"
          className="mx-auto mb-2 flex max-w-2xl items-start gap-1.5 rounded-lg border border-app-danger/40 bg-app-panel px-3 py-2 text-xs font-medium text-app-danger"
        >
          <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
          {errorMessage}
        </p>
      )}
      {attachmentError && (
        <p
          id={attachmentErrorId}
          role="alert"
          className="mx-auto mb-2 flex max-w-2xl items-start gap-1.5 rounded-lg border border-app-danger/40 bg-app-panel px-3 py-2 text-xs font-medium text-app-danger"
        >
          <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
          {attachmentError}
        </p>
      )}
      <form
        onSubmit={onSubmit}
        className="mx-auto max-w-2xl rounded-2xl border border-app-border bg-app-panel p-3 shadow-sm"
      >
        {(pendingAttachment || isUploadingAttachment) && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            <div className="flex items-center gap-1.5 rounded-lg border border-app-border bg-app-panel-2 py-1 pl-2.5 pr-1.5 text-xs text-app-text">
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
                  className="flex h-4 w-4 items-center justify-center rounded text-app-text-dim hover:bg-app-border hover:text-app-danger"
                >
                  <X size={11} />
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
          rows={1}
          value={draft}
          disabled={isComposerDisabled}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={onKeyDown}
          aria-describedby={isExhausted ? quotaId : errorMessage ? errorId : undefined}
          placeholder={
            isExhausted
              ? 'Token quota exhausted — upgrade to continue'
              : `Ask ${agentName} about your application…`
          }
          className="max-h-32 min-h-6 w-full resize-none bg-transparent text-sm text-app-text placeholder:text-app-text-dim focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        />
        <div className="mt-2 flex items-center justify-between">
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
                className="flex h-8 w-8 items-center justify-center rounded-lg text-app-text-dim hover:bg-app-panel-2 hover:text-app-text disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Paperclip size={15} />
              </button>
            </>
          ) : (
            <span />
          )}
          <button
            type="submit"
            aria-label="Send message"
            disabled={
              isComposerDisabled ||
              isSending ||
              isUploadingAttachment ||
              (!draft.trim() && !pendingAttachment)
            }
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-app-text text-app-bg disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send size={14} />
          </button>
        </div>
      </form>
    </div>
  )
}
