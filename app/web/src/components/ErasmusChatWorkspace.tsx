import {
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type FormEvent,
} from 'react'
import { AlertTriangle, FileText, Moon, Sparkles, Sun } from 'lucide-react'
import type {
  AgentId,
  AIAgent,
  ChatMessage,
  ErasmusChatWorkspaceProps,
  PendingAttachment,
  ThemeMode,
} from './ErasmusChatWorkspace.types'
import { AgentTabList } from './chat/AgentTabs'
import { DEFAULT_AGENTS, DEFAULT_TOKENS_PER_MESSAGE, formatTokens } from './chat/agents'
import { ChatComposer } from './chat/ChatComposer'
import { HistorySection } from './chat/HistorySection'
import { MessageList } from './chat/MessageList'

export { DEFAULT_AGENTS }

async function defaultSendMessage(
  { text, agentId }: { text: string; agentId: AgentId },
  onDelta?: (chunk: string) => void,
): Promise<string> {
  const agent = DEFAULT_AGENTS.find((a) => a.id === agentId)
  const fullText = `[${agent?.name ?? 'Assistant'}] Got it — I'll look into: "${text}". (demo response — connect a real backend to stream live answers)`
  const words = fullText.split(' ')
  let sent = ''
  for (const word of words) {
    await new Promise((resolve) => setTimeout(resolve, 25))
    const chunk = sent ? ` ${word}` : word
    sent += chunk
    onDelta?.(chunk)
  }
  return sent
}

export function ErasmusChatWorkspace({
  agents = DEFAULT_AGENTS,
  initialAgentId,
  initialMessages = [],
  initialTheme = 'dark',
  tokenBalance,
  tokensPerMessage = DEFAULT_TOKENS_PER_MESSAGE,
  sendMessage = defaultSendMessage,
  onThemeChange,
  onAgentChange,
  onTokenBalanceChange,
  conversations,
  activeConversationId,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  uploadFile,
  onGenerateDocument,
  isGeneratingDocument = false,
}: ErasmusChatWorkspaceProps) {
  const [theme, setTheme] = useState<ThemeMode>(initialTheme)
  const [activeAgentId, setActiveAgentId] = useState<AgentId>(
    initialAgentId ?? agents[0]?.id ?? 'compliance',
  )
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [draft, setDraft] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [internalTokenBalance, setInternalTokenBalance] = useState(
    tokenBalance ?? { used: 0, limit: 3_000_000 },
  )
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null)
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false)
  const [attachmentError, setAttachmentError] = useState<string | null>(null)

  const idCounter = useRef(0)
  const tabRefs = useRef(new Map<AgentId, HTMLButtonElement | null>())
  const fileInputRef = useRef<HTMLInputElement>(null)
  const composerId = useId()
  const errorId = useId()
  const quotaId = useId()
  const attachmentErrorId = useId()

  const effectiveTokenBalance = tokenBalance ?? internalTokenBalance
  const remainingTokens = Math.max(
    0,
    effectiveTokenBalance.limit - effectiveTokenBalance.used,
  )
  const isExhausted = remainingTokens <= 0
  const usagePercent = useMemo(() => {
    if (effectiveTokenBalance.limit <= 0) return 100
    return Math.min(
      100,
      Math.round((effectiveTokenBalance.used / effectiveTokenBalance.limit) * 100),
    )
  }, [effectiveTokenBalance.limit, effectiveTokenBalance.used])

  const activeAgent = useMemo(
    () => agents.find((agent) => agent.id === activeAgentId) ?? agents[0],
    [agents, activeAgentId],
  )

  const canGenerateDocument =
    Boolean(onGenerateDocument) &&
    Boolean(activeConversationId) &&
    messages.some((m) => m.role === 'user' || m.role === 'assistant') &&
    !isSending &&
    !isGeneratingDocument &&
    !isExhausted

  const nextMessageId = useCallback(() => {
    idCounter.current += 1
    return `msg-${idCounter.current}`
  }, [])

  const registerTabRef = useCallback((id: AgentId, el: HTMLButtonElement | null) => {
    tabRefs.current.set(id, el)
  }, [])

  const handleSelectAgent = useCallback(
    (id: AgentId) => {
      setActiveAgentId(id)
      onAgentChange?.(id)
    },
    [onAgentChange],
  )

  const handleTabKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
      const lastIndex = agents.length - 1
      let nextIndex: number | null = null

      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        nextIndex = index === lastIndex ? 0 : index + 1
      } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        nextIndex = index === 0 ? lastIndex : index - 1
      } else if (event.key === 'Home') {
        nextIndex = 0
      } else if (event.key === 'End') {
        nextIndex = lastIndex
      }

      if (nextIndex === null) return
      event.preventDefault()
      const nextAgent = agents[nextIndex]
      handleSelectAgent(nextAgent.id)
      tabRefs.current.get(nextAgent.id)?.focus()
    },
    [agents, handleSelectAgent],
  )

  const handleThemeSelect = useCallback(
    (mode: ThemeMode) => {
      setTheme(mode)
      onThemeChange?.(mode)
    },
    [onThemeChange],
  )

  const updateTokenUsage = useCallback(() => {
    const nextBalance = {
      used: Math.min(
        effectiveTokenBalance.limit,
        effectiveTokenBalance.used + tokensPerMessage,
      ),
      limit: effectiveTokenBalance.limit,
    }
    if (!tokenBalance) {
      setInternalTokenBalance(nextBalance)
    }
    onTokenBalanceChange?.(nextBalance)
  }, [effectiveTokenBalance, tokenBalance, tokensPerMessage, onTokenBalanceChange])

  const dispatch = useCallback(
    async (
      userMessageId: string,
      text: string,
      agentId: AgentId,
      attachment?: PendingAttachment,
    ) => {
      setIsSending(true)
      setErrorMessage(null)

      const assistantMessageId = nextMessageId()
      setMessages((prev) => [
        ...prev.map((m) => (m.id === userMessageId ? { ...m, status: 'sent' as const } : m)),
        {
          id: assistantMessageId,
          role: 'assistant' as const,
          agentId,
          text: '',
          createdAt: Date.now(),
          status: 'sending' as const,
        },
      ])

      try {
        const replyText = await sendMessage(
          { text, agentId, history: messages, attachment },
          (chunk) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessageId ? { ...m, text: m.text + chunk } : m,
              ),
            )
          },
        )
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId
              ? { ...m, text: replyText, status: 'sent' as const }
              : m,
          ),
        )
        updateTokenUsage()
      } catch (error) {
        console.error('[chat] sendMessage failed', error)
        setMessages((prev) =>
          prev
            .filter((m) => m.id !== assistantMessageId)
            .map((m) => (m.id === userMessageId ? { ...m, status: 'error' as const } : m)),
        )
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Something went wrong while sending your message. Please try again.',
        )
      } finally {
        setIsSending(false)
      }
    },
    [messages, sendMessage, nextMessageId, updateTokenUsage],
  )

  const handleSend = useCallback(() => {
    const text = draft.trim()
    if ((!text && !pendingAttachment) || isSending || isExhausted || isUploadingAttachment) {
      return
    }

    const attachment = pendingAttachment ?? undefined
    const userMessage: ChatMessage = {
      id: nextMessageId(),
      role: 'user',
      agentId: activeAgentId,
      text,
      createdAt: Date.now(),
      status: 'sending',
      attachment: attachment ? { name: attachment.name, path: attachment.path } : undefined,
    }
    setMessages((prev) => [...prev, userMessage])
    setDraft('')
    setPendingAttachment(null)
    void dispatch(userMessage.id, text, activeAgentId, attachment)
  }, [
    draft,
    pendingAttachment,
    isSending,
    isExhausted,
    isUploadingAttachment,
    activeAgentId,
    nextMessageId,
    dispatch,
  ])

  const handleRetry = useCallback(
    (message: ChatMessage) => {
      if (isSending || isExhausted) return
      setMessages((prev) =>
        prev.map((m) => (m.id === message.id ? { ...m, status: 'sending' as const } : m)),
      )
      const attachment = message.attachment?.path
        ? { path: message.attachment.path, name: message.attachment.name }
        : undefined
      void dispatch(message.id, message.text, message.agentId, attachment)
    },
    [isSending, isExhausted, dispatch],
  )

  const handleComposerSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      handleSend()
    },
    [handleSend],
  )

  const handleComposerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  const handleAttachClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileSelected = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file || !uploadFile) return

      setAttachmentError(null)
      setIsUploadingAttachment(true)
      uploadFile(file)
        .then((uploaded) => setPendingAttachment(uploaded))
        .catch((error) => {
          console.error('[chat] file upload failed', error)
          setAttachmentError(
            error instanceof Error ? error.message : 'Could not upload this file.',
          )
        })
        .finally(() => setIsUploadingAttachment(false))
    },
    [uploadFile],
  )

  const handleRemoveAttachment = useCallback(() => {
    setPendingAttachment(null)
  }, [])

  return (
    <div
      data-theme={theme}
      data-testid="erasmus-chat-workspace"
      className="flex h-full min-h-[560px] w-full overflow-hidden rounded-2xl border border-app-border bg-app-bg text-app-text"
    >
      <aside className="flex w-64 shrink-0 flex-col border-r border-app-border bg-app-panel p-3.5">
        <div className="mb-5 flex items-center gap-2.5 px-1.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-app-text text-app-bg">
            <Sparkles size={14} />
          </div>
          <div>
            <div className="text-sm font-semibold">Erasmus AI</div>
            <div className="text-[10px] uppercase tracking-wide text-app-text-dim">
              Grant Workspace
            </div>
          </div>
        </div>

        <div
          id="erasmus-token-balance"
          role="group"
          aria-label="Token balance"
          className="mb-5 rounded-lg border border-app-border bg-app-panel-2 p-3"
        >
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-semibold text-app-text">Tokens</span>
            <span className="font-mono text-app-text-dim">
              {formatTokens(effectiveTokenBalance.used)} /{' '}
              {formatTokens(effectiveTokenBalance.limit)}
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="Tokens used this billing period"
            aria-valuenow={effectiveTokenBalance.used}
            aria-valuemin={0}
            aria-valuemax={effectiveTokenBalance.limit}
            className="h-1.5 w-full overflow-hidden rounded-full bg-app-border"
          >
            <div
              className="h-full rounded-full bg-app-accent transition-[width]"
              style={{ width: `${usagePercent}%` }}
            />
          </div>
          {isExhausted && (
            <p
              id={quotaId}
              role="alert"
              className="mt-2 flex items-start gap-1.5 text-xs font-medium text-app-danger"
            >
              <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
              You&apos;ve used all your tokens. Upgrade your plan to keep chatting.
            </p>
          )}
        </div>

        <AgentTabList
          agents={agents}
          activeAgentId={activeAgentId}
          onSelect={handleSelectAgent}
          registerRef={registerTabRef}
          onKeyDown={handleTabKeyDown}
        />

        {conversations !== undefined && (
          <HistorySection
            conversations={conversations}
            activeConversationId={activeConversationId}
            onNewChat={onNewChat}
            onSelectConversation={onSelectConversation}
            onDeleteConversation={onDeleteConversation}
          />
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-app-border px-5 py-3">
          <div className="flex items-center gap-2">
            <div
              data-testid="active-agent-pill"
              className="flex items-center gap-2 rounded-full border border-app-border px-3 py-1.5 text-sm font-semibold"
              aria-hidden="true"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-app-accent" />
              {activeAgent?.name}
            </div>
            {onGenerateDocument && (
              <button
                type="button"
                data-testid="generate-document"
                disabled={!canGenerateDocument}
                onClick={() => void onGenerateDocument()}
                className="inline-flex items-center gap-1.5 rounded-full border border-app-border px-3 py-1.5 text-xs font-semibold text-app-text hover:bg-app-panel-2 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-app-accent focus-visible:outline-offset-2"
              >
                <FileText size={13} aria-hidden="true" />
                {isGeneratingDocument ? 'Generating…' : 'Generate application'}
              </button>
            )}
          </div>

          <div
            role="group"
            aria-label="Theme"
            className="flex items-center gap-0.5 rounded-full border border-app-border bg-app-panel p-1"
          >
            <button
              type="button"
              aria-label="Light theme"
              aria-pressed={theme === 'light'}
              onClick={() => handleThemeSelect('light')}
              className={`flex h-6 w-7 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-app-accent focus-visible:outline-offset-2 ${
                theme === 'light'
                  ? 'bg-app-bg text-app-accent shadow-sm'
                  : 'text-app-text-dim'
              }`}
            >
              <Sun size={13} />
            </button>
            <button
              type="button"
              aria-label="Dark theme"
              aria-pressed={theme === 'dark'}
              onClick={() => handleThemeSelect('dark')}
              className={`flex h-6 w-7 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-app-accent focus-visible:outline-offset-2 ${
                theme === 'dark'
                  ? 'bg-app-bg text-app-accent shadow-sm'
                  : 'text-app-text-dim'
              }`}
            >
              <Moon size={13} />
            </button>
          </div>
        </header>

        <div
          id="erasmus-chat-panel"
          role="tabpanel"
          aria-labelledby={`agent-tab-${activeAgentId}`}
          className="flex-1 overflow-y-auto px-5 py-4"
        >
          <MessageList
            messages={messages}
            agents={agents as AIAgent[]}
            activeAgentName={activeAgent?.name}
            isSending={isSending}
            onRetry={handleRetry}
          />
        </div>

        <ChatComposer
          composerId={composerId}
          errorId={errorId}
          attachmentErrorId={attachmentErrorId}
          quotaId={quotaId}
          draft={draft}
          onDraftChange={setDraft}
          onSubmit={handleComposerSubmit}
          onKeyDown={handleComposerKeyDown}
          agentName={activeAgent?.name}
          isExhausted={isExhausted}
          isSending={isSending}
          isUploadingAttachment={isUploadingAttachment}
          errorMessage={errorMessage}
          attachmentError={attachmentError}
          pendingAttachment={pendingAttachment}
          onRemoveAttachment={handleRemoveAttachment}
          uploadFile={uploadFile}
          fileInputRef={fileInputRef}
          onAttachClick={handleAttachClick}
          onFileSelected={handleFileSelected}
        />
      </div>
    </div>
  )
}

export default ErasmusChatWorkspace
