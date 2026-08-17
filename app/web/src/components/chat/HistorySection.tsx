import { Plus, X } from 'lucide-react'
import type { ConversationSummary } from '../ErasmusChatWorkspace.types'

interface HistorySectionProps {
  conversations: ConversationSummary[]
  activeConversationId?: string
  onNewChat?: () => void
  onSelectConversation?: (id: string) => void
  onDeleteConversation?: (id: string) => void
}

export function HistorySection({
  conversations,
  activeConversationId,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
}: HistorySectionProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <button
        type="button"
        onClick={() => onNewChat?.()}
        className="mb-4 flex items-center justify-center gap-2 border border-app-border bg-app-surface px-3 py-2 text-sm font-medium text-app-text hover:bg-app-panel-2 focus-visible:outline-2 focus-visible:outline-app-accent focus-visible:outline-offset-2"
      >
        <Plus size={14} aria-hidden="true" />
        New chat
      </button>

      <span className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-app-text-dim">
        Conversations
      </span>

      <div
        role="list"
        aria-label="Conversation history"
        className="flex flex-1 flex-col gap-0.5 overflow-y-auto"
      >
        {conversations.length === 0 ? (
          <p className="py-2 text-xs leading-relaxed text-app-text-dim">
            No conversations yet. Start with your organisations and the need you want to address.
          </p>
        ) : (
          conversations.map((conversation) => {
            const isActive = conversation.id === activeConversationId
            const label = conversation.title || 'New chat'
            return (
              <div key={conversation.id} role="listitem" className="group relative">
                <button
                  type="button"
                  onClick={() => onSelectConversation?.(conversation.id)}
                  aria-current={isActive ? 'true' : undefined}
                  className={`flex w-full items-center py-2 pl-2.5 pr-7 text-left text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-app-accent focus-visible:outline-offset-2 ${
                    isActive
                      ? 'border-l-2 border-app-accent bg-app-panel-2 font-medium text-app-text'
                      : 'border-l-2 border-transparent text-app-text-dim hover:bg-app-panel-2 hover:text-app-text'
                  }`}
                >
                  <span className="truncate">{label}</span>
                </button>
                <button
                  type="button"
                  aria-label={`Delete "${label}"`}
                  onClick={(event) => {
                    event.stopPropagation()
                    onDeleteConversation?.(conversation.id)
                  }}
                  className="absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center text-app-text-dim opacity-0 hover:text-app-danger focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-app-accent focus-visible:outline-offset-2 group-hover:opacity-100"
                >
                  <X size={12} />
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
