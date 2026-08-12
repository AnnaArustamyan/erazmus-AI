export type ThemeMode = 'light' | 'dark'

export type AgentId =
  | 'grant'
  | 'compliance'
  | 'budget'
  | 'partner-search'
  | 'report-writer'

export interface AIAgent {
  id: AgentId
  name: string
  description: string
}

export type MessageRole = 'user' | 'assistant'

export type MessageStatus = 'sending' | 'sent' | 'error'

export interface MessageAttachment {
  name: string
  /** Signed download URL, when known (e.g. loaded from history). */
  url?: string
  /** Storage reference, kept around so a retry can resend the same file. */
  path?: string
}

export interface ChatMessage {
  id: string
  role: MessageRole
  agentId: AgentId
  text: string
  createdAt: number
  status: MessageStatus
  attachment?: MessageAttachment
}

export interface TokenBalance {
  used: number
  limit: number
}

export interface PendingAttachment {
  path: string
  name: string
}

export interface SendMessageParams {
  text: string
  agentId: AgentId
  history: ChatMessage[]
  attachment?: PendingAttachment
  regenerate?: boolean
  editMessageId?: string
  signal?: AbortSignal
}

/** Called with each incremental chunk of the assistant's reply as it streams in. */
export type OnMessageDelta = (chunk: string) => void

/** Resolves with the full reply text once streaming completes (or the mock replies at once). */
export type SendMessageFn = (
  params: SendMessageParams,
  onDelta?: OnMessageDelta,
) => Promise<string>

export interface ConversationSummary {
  id: string
  agentId: AgentId
  title: string
}

export interface ErasmusChatWorkspaceProps {
  agents?: AIAgent[]
  initialAgentId?: AgentId
  initialMessages?: ChatMessage[]
  initialTheme?: ThemeMode
  tokenBalance?: TokenBalance
  tokensPerMessage?: number
  sendMessage?: SendMessageFn
  onThemeChange?: (theme: ThemeMode) => void
  onAgentChange?: (agentId: AgentId) => void
  onTokenBalanceChange?: (balance: TokenBalance) => void
  /** Omit entirely to hide the history section; pass [] once it's wired but empty. */
  conversations?: ConversationSummary[]
  activeConversationId?: string
  onNewChat?: () => void
  onSelectConversation?: (id: string) => void
  onDeleteConversation?: (id: string) => void
  /** Omit entirely to hide the attach button. */
  uploadFile?: (file: File) => Promise<PendingAttachment>
  /** Omit to hide the Generate application action. */
  onGenerateDocument?: () => void | Promise<void>
  isGeneratingDocument?: boolean
  enterToSend?: boolean
}
