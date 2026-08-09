import type { KeyboardEvent } from 'react'
import type { AgentId, AIAgent } from '../ErasmusChatWorkspace.types'

interface AgentTabProps {
  agent: AIAgent
  isActive: boolean
  onSelect: (id: AgentId) => void
  registerRef: (id: AgentId, el: HTMLButtonElement | null) => void
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, index: number) => void
  index: number
}

export function AgentTab({
  agent,
  isActive,
  onSelect,
  registerRef,
  onKeyDown,
  index,
}: AgentTabProps) {
  return (
    <button
      ref={(el) => registerRef(agent.id, el)}
      type="button"
      role="tab"
      id={`agent-tab-${agent.id}`}
      aria-selected={isActive}
      aria-controls="erasmus-chat-panel"
      tabIndex={isActive ? 0 : -1}
      onClick={() => onSelect(agent.id)}
      onKeyDown={(event) => onKeyDown(event, index)}
      title={agent.description}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-app-accent focus-visible:outline-offset-2 ${
        isActive
          ? 'bg-app-accent-soft text-app-text'
          : 'text-app-text-dim hover:bg-app-panel-2 hover:text-app-text'
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
          isActive ? 'bg-app-accent' : 'bg-app-text-dim'
        }`}
      />
      <span className="flex-1 truncate font-medium">{agent.name}</span>
    </button>
  )
}

interface AgentTabListProps {
  agents: AIAgent[]
  activeAgentId: AgentId
  onSelect: (id: AgentId) => void
  registerRef: (id: AgentId, el: HTMLButtonElement | null) => void
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, index: number) => void
}

export function AgentTabList({
  agents,
  activeAgentId,
  onSelect,
  registerRef,
  onKeyDown,
}: AgentTabListProps) {
  return (
    <div
      role="tablist"
      aria-label="Specialized AI agents"
      aria-orientation="vertical"
      className="flex flex-col gap-1"
    >
      {agents.map((agent, index) => (
        <AgentTab
          key={agent.id}
          agent={agent}
          index={index}
          isActive={agent.id === activeAgentId}
          onSelect={onSelect}
          registerRef={registerRef}
          onKeyDown={onKeyDown}
        />
      ))}
    </div>
  )
}
