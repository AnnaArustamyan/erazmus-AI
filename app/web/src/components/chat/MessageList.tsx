import { Bot, FileText, RefreshCw, User } from 'lucide-react'
import type { ChatMessage } from '../ErasmusChatWorkspace.types'

interface MessageBubbleProps {
  message: ChatMessage
  agentName: string
  onRetry: (message: ChatMessage) => void
}

export function MessageBubble({ message, agentName, onRetry }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  return (
    <div
      className={`flex items-start gap-3 py-2 ${isUser ? 'flex-row-reverse' : ''}`}
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
}

export function MessageList({
  messages,
  agents,
  activeAgentName,
  isSending,
  onRetry,
}: MessageListProps) {
  return (
    <div aria-live="polite" className="mx-auto flex max-w-2xl flex-col gap-1">
      {messages.length === 0 ? (
        <p className="pt-14 text-center text-sm text-app-text-dim">
          Ask {activeAgentName} about your Erasmus+ application to get started.
        </p>
      ) : (
        messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            agentName={agents.find((a) => a.id === message.agentId)?.name ?? 'Assistant'}
            onRetry={onRetry}
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
