import { useState } from 'react'
import { Check, Copy, FileText, Pencil, RefreshCw } from 'lucide-react'
import type { ChatMessage } from '../ErasmusChatWorkspace.types'
import { BrandMark } from '../BrandMark'
import { MessageContent } from './MessageContent'

interface MessageBubbleProps {
  message: ChatMessage
  isLastAssistant: boolean
  isSending: boolean
  onRetry: (message: ChatMessage) => void
  onCopy: (message: ChatMessage) => void
  onRegenerate?: () => void
  onEdit?: (message: ChatMessage) => void
  copiedId: string | null
}

export function MessageBubble({
  message,
  isLastAssistant,
  isSending,
  onRetry,
  onCopy,
  onRegenerate,
  onEdit,
  copiedId,
}: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const copied = copiedId === message.id

  return (
    <article
      className={`group py-5 ${isUser ? '' : 'border-b border-app-border/60 last:border-b-0'}`}
    >
      <div className={`mx-auto max-w-2xl ${isUser ? 'flex justify-end' : ''}`}>
        {!isUser && (
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-app-text-dim">
            EU Grantwriter
          </div>
        )}

        {message.attachment && (
          <div
            className={`mb-2 inline-flex items-center gap-1.5 rounded-lg border border-app-border bg-app-panel px-2.5 py-1.5 text-xs text-app-text-dim ${
              isUser ? 'ml-auto' : ''
            }`}
          >
            <FileText size={12} className="shrink-0" aria-hidden="true" />
            {message.attachment.url ? (
              <a
                href={message.attachment.url}
                target="_blank"
                rel="noreferrer"
                className="truncate underline-offset-2 hover:underline"
              >
                {message.attachment.name}
              </a>
            ) : (
              <span className="truncate">{message.attachment.name}</span>
            )}
          </div>
        )}

        {(message.text || !message.attachment) && (
          <div
            className={
              isUser
                ? 'max-w-[92%] rounded-2xl border border-app-border bg-app-bubble-user px-4 py-3 text-[0.95rem] leading-relaxed text-app-bubble-user-text shadow-app-sm transition-shadow duration-150'
                : 'text-app-text'
            }
          >
            <MessageContent text={message.text} markdown={!isUser} />
          </div>
        )}

        {isUser && message.status === 'sending' && (
          <span className="mt-1.5 block text-right text-xs text-app-text-dim">Sending…</span>
        )}

        {message.status === 'error' && (
          <button
            type="button"
            onClick={() => onRetry(message)}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-app-border px-2.5 py-1 text-xs font-medium text-app-danger transition-colors duration-150 hover:bg-app-panel focus-visible:outline-2 focus-visible:outline-app-accent focus-visible:outline-offset-2"
          >
            <RefreshCw size={12} aria-hidden="true" />
            Retry
          </button>
        )}

        {message.status !== 'error' && (message.text || isLastAssistant) && (
          <div
            className={`mt-2 flex items-center gap-1 ${
              isUser ? 'justify-end' : ''
            } opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:focus-within:opacity-100`}
          >
            <button
              type="button"
              aria-label={copied ? 'Copied' : 'Copy message'}
              onClick={() => onCopy(message)}
              className="inline-flex items-center gap-1 px-1.5 py-1 text-[11px] text-app-text-dim hover:text-app-text"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            {isUser && onEdit && !isSending && (
              <button
                type="button"
                aria-label="Edit and resend"
                onClick={() => onEdit(message)}
                className="inline-flex items-center gap-1 px-1.5 py-1 text-[11px] text-app-text-dim hover:text-app-text"
              >
                <Pencil size={12} />
                Edit
              </button>
            )}
            {!isUser && isLastAssistant && onRegenerate && !isSending && (
              <button
                type="button"
                aria-label="Regenerate response"
                onClick={onRegenerate}
                className="inline-flex items-center gap-1 px-1.5 py-1 text-[11px] text-app-text-dim hover:text-app-text"
              >
                <RefreshCw size={12} />
                Regenerate
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  )
}

interface MessageListProps {
  messages: ChatMessage[]
  agents: { id: string; name: string }[]
  activeAgentName?: string
  isSending: boolean
  onRetry: (message: ChatMessage) => void
  onCopy: (message: ChatMessage) => void
  onRegenerate?: () => void
  onEdit?: (message: ChatMessage) => void
  copiedId: string | null
}

export function MessageList({
  messages,
  activeAgentName,
  isSending,
  onRetry,
  onCopy,
  onRegenerate,
  onEdit,
  copiedId,
}: MessageListProps) {
  const lastAssistantIndex = [...messages]
    .map((m, i) => ({ m, i }))
    .reverse()
    .find((entry) => entry.m.role === 'assistant')?.i

  return (
    <div aria-live="polite" className="mx-auto flex w-full max-w-2xl flex-col px-1">
      {messages.length === 0 ? (
        <div className="flex flex-col items-start gap-4 pt-16 pb-8">
          <BrandMark size={48} />
          <p className="font-display text-2xl font-semibold tracking-tight text-app-text sm:text-[1.75rem]">
            Draft an Erasmus+ application that can pass review.
          </p>
          <p className="max-w-lg text-[0.95rem] leading-relaxed text-app-text-dim">
            Share your organisations, countries, participant numbers, and the need you want to
            address. When you are ready, ask me to draft the application — it opens beside the
            chat so we can keep revising it.
          </p>
        </div>
      ) : (
        messages.map((message, index) => (
          <MessageBubble
            key={message.id}
            message={message}
            isLastAssistant={index === lastAssistantIndex}
            isSending={isSending}
            onRetry={onRetry}
            onCopy={onCopy}
            onRegenerate={onRegenerate}
            onEdit={onEdit}
            copiedId={copiedId}
          />
        ))
      )}
      {isSending && messages[messages.length - 1]?.text === '' && (
        <p className="py-3 text-xs text-app-text-dim" role="status">
          {activeAgentName ?? 'EU Grantwriter'} is writing…
        </p>
      )}
    </div>
  )
}

export function useCopiedToast() {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  return {
    copiedId,
    markCopied: (id: string) => {
      setCopiedId(id)
      window.setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1600)
    },
  }
}
