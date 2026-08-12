import { useState } from 'react'
import { Bot, Check, Copy, FileText, Pencil, RefreshCw, User } from 'lucide-react'
import type { ChatMessage } from '../ErasmusChatWorkspace.types'

interface MessageBubbleProps {
  message: ChatMessage
  agentName: string
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
  agentName,
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
    <div
      className={`group flex items-start gap-3 py-2 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      <div
        aria-hidden="true"
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
          isUser
            ? 'bg-app-panel-2 text-app-text-dim'
            : 'bg-app-accent-soft text-app-accent'
        }`}
      >
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>
      <div className={`flex max-w-[78%] flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        {!isUser && (
          <span className="mb-1 text-xs font-semibold text-app-text-dim">
            {agentName}
          </span>
        )}
        {message.attachment && (
          <div
            className={`mb-1.5 flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs ${
              isUser
                ? 'border-transparent bg-app-panel-2 text-app-text-dim'
                : 'border-app-border bg-app-panel text-app-text-dim'
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
                ? 'rounded-2xl rounded-tr-sm bg-app-bubble-user px-4 py-2.5 text-sm leading-relaxed text-app-bubble-user-text'
                : 'text-sm leading-relaxed text-app-text'
            }
          >
            {message.text}
          </div>
        )}
        {isUser && message.status === 'sending' && (
          <span className="mt-1 text-xs text-app-text-dim">Sending…</span>
        )}
        {message.status === 'error' && (
          <button
            type="button"
            onClick={() => onRetry(message)}
            className="mt-1.5 inline-flex items-center gap-1.5 rounded-md border border-app-border px-2 py-1 text-xs font-medium text-app-danger hover:bg-app-panel-2 focus-visible:outline-2 focus-visible:outline-app-accent focus-visible:outline-offset-2"
          >
            <RefreshCw size={12} aria-hidden="true" />
            Retry
          </button>
        )}
        {message.status !== 'error' && (message.text || isLastAssistant) && (
          <div
            className={`mt-1 flex items-center gap-0.5 ${
              isUser ? 'justify-end' : ''
            } opacity-100 sm:opacity-0 sm:group-hover:opacity-100`}
          >
            <button
              type="button"
              aria-label={copied ? 'Copied' : 'Copy message'}
              onClick={() => onCopy(message)}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-app-text-dim hover:bg-app-panel-2 hover:text-app-text"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            {isUser && onEdit && !isSending && (
              <button
                type="button"
                aria-label="Edit and resend"
                onClick={() => onEdit(message)}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-app-text-dim hover:bg-app-panel-2 hover:text-app-text"
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
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-app-text-dim hover:bg-app-panel-2 hover:text-app-text"
              >
                <RefreshCw size={12} />
                Regenerate
              </button>
            )}
          </div>
        )}
      </div>
    </div>
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
  agents,
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
    <div aria-live="polite" className="mx-auto flex max-w-2xl flex-col gap-1">
      {messages.length === 0 ? (
        <p className="pt-14 text-center text-sm text-app-text-dim">
          Tell me about your Erasmus+ project to get started. When you are ready, generate an
          application draft from this chat.
        </p>
      ) : (
        messages.map((message, index) => (
          <MessageBubble
            key={message.id}
            message={message}
            agentName={
              agents.find((a) => a.id === message.agentId)?.name ??
              activeAgentName ??
              'Erasmus AI'
            }
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
        <p className="py-1 text-xs text-app-text-dim" role="status">
          {activeAgentName} is thinking…
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
