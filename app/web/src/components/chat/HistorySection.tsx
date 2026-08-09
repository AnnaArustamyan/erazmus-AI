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
    <div className="mt-5 flex min-h-0 flex-1 flex-col">
      <button
        type="button"
        onClick={() => onNewChat?.()}
        className="mb-3 flex items-center gap-2 rounded-lg border border-app-border px-3 py-2 text-sm font-medium text-app-text hover:bg-app-panel-2 focus-visible:outline-2 focus-visible:outline-app-accent focus-visible:outline-offset-2"
      >
        <Plus size={14} aria-hidden="true" />
        New chat
      </button>

      <span className="mb-1.5 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-app-text-dim">
        History
      </span>

      <div
        role="list"
        aria-label="Conversation history"
        className="flex flex-1 flex-col gap-0.5 overflow-y-auto"
      >
        {conversations.length === 0 ? (
          <p className="px-1.5 py-2 text-xs text-app-text-dim">No previous chats yet.</p>
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
                  className={`flex w-full items-center rounded-lg py-1.5 pl-3 pr-7 text-left text-xs transition-colors focus-visible:outline-2 focus-visible:outline-app-accent focus-visible:outline-offset-2 ${
                    isActive
                      ? 'bg-app-panel-2 font-semibold text-app-text'
                      : 'text-app-text-dim hover:bg-app-panel-2 hover:text-app-text'
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
                  className="absolute right-1 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-md text-app-text-dim opacity-0 hover:bg-app-border hover:text-app-danger focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-app-accent focus-visible:outline-offset-2 group-hover:opacity-100"
                >
                  <X size={11} />
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
