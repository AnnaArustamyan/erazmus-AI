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
import { AlertTriangle, Moon, Sun } from 'lucide-react'
import type {
  AgentId,
  AIAgent,
  CanvasDocument,
  ChatMessage,
  ErasmusChatWorkspaceProps,
  PendingAttachment,
  ThemeMode,
} from './ErasmusChatWorkspace.types'
import { DEFAULT_AGENT_ID, DEFAULT_AGENTS, DEFAULT_TOKENS_PER_MESSAGE, estimateTokensFromText, formatTokens } from './chat/agents'
import { ChatComposer } from './chat/ChatComposer'
import { DocumentCanvas, DocumentCanvasToggle } from './chat/DocumentCanvas'
import { HistorySection } from './chat/HistorySection'
import { MessageList, useCopiedToast } from './chat/MessageList'

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
  onTokenBalanceChange,
  conversations,
  activeConversationId,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  uploadFile,
  initialDocument = null,
  onDocumentChange,
  enterToSend = true,
}: ErasmusChatWorkspaceProps) {
  const [theme, setTheme] = useState<ThemeMode>(initialTheme)
  const [activeAgentId] = useState<AgentId>(
    initialAgentId ?? agents[0]?.id ?? DEFAULT_AGENT_ID,
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
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [canvasDocument, setCanvasDocument] = useState<CanvasDocument | null>(
    initialDocument ?? null,
  )
  const [canvasContent, setCanvasContent] = useState(initialDocument?.contentMd ?? '')
  const [canvasOpen, setCanvasOpen] = useState(Boolean(initialDocument))
  const [isDraftingDocument, setIsDraftingDocument] = useState(false)
  const { copiedId, markCopied } = useCopiedToast()

  const idCounter = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
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

  const tokenBalanceRef = useRef(effectiveTokenBalance)
  tokenBalanceRef.current = effectiveTokenBalance

  const activeAgent = useMemo(
    () => agents.find((agent) => agent.id === activeAgentId) ?? agents[0],
    [agents, activeAgentId],
  )

  const nextMessageId = useCallback(() => {
    idCounter.current += 1
    return `msg-${idCounter.current}`
  }, [])

  const handleThemeSelect = useCallback(
    (mode: ThemeMode) => {
      setTheme(mode)
      onThemeChange?.(mode)
    },
    [onThemeChange],
  )

  const applyTokenBalance = useCallback(
    (next: { used: number; limit?: number }) => {
      const limit =
        typeof next.limit === 'number' && next.limit > 0
          ? next.limit
          : tokenBalanceRef.current.limit
      const used = Math.min(limit, Math.max(0, next.used))
      const balance = { used, limit }
      if (!tokenBalance) {
        setInternalTokenBalance(balance)
      }
      onTokenBalanceChange?.(balance)
    },
    [tokenBalance, onTokenBalanceChange],
  )

  const dispatch = useCallback(
    async (
      userMessageId: string,
      text: string,
      agentId: AgentId,
      attachment?: PendingAttachment,
      extras?: { regenerate?: boolean; editMessageId?: string },
    ) => {
      setIsSending(true)
      setErrorMessage(null)

      const controller = new AbortController()
      abortRef.current = controller

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
        const usedAtStart = tokenBalanceRef.current.used
        const limit = tokenBalanceRef.current.limit
        let reportedUsage = false
        let estimatedChars = 0
        let lastEstimateAt = 0

        const bumpEstimate = (chunk: string) => {
          estimatedChars += chunk.length
          const estimatedTurn = Math.max(1, Math.ceil(estimatedChars / 4))
          const now = Date.now()
          if (reportedUsage || now - lastEstimateAt < 80) return
          lastEstimateAt = now
          applyTokenBalance({
            used: Math.min(limit, usedAtStart + estimatedTurn),
            limit,
          })
        }

        const replyText = await sendMessage(
          {
            text,
            agentId,
            history: messages,
            attachment,
            regenerate: extras?.regenerate,
            editMessageId: extras?.editMessageId,
            documentId: canvasDocument?.id,
            signal: controller.signal,
            onDocumentStart: () => {
              setCanvasOpen(true)
              setIsDraftingDocument(true)
              setCanvasContent('')
            },
            onDocumentDelta: (chunk) => {
              setCanvasContent((prev) => prev + chunk)
              bumpEstimate(chunk)
            },
            onDocument: (doc) => {
              setCanvasDocument(doc)
              setCanvasContent(doc.contentMd)
              setIsDraftingDocument(false)
              onDocumentChange?.(doc)
            },
            onDocumentRejected: () => {
              setIsDraftingDocument(false)
              setCanvasContent('')
              setCanvasOpen(false)
            },
            onUsage: (usage) => {
              reportedUsage = true
              if (usage.used >= usedAtStart) {
                applyTokenBalance(usage)
              }
            },
          },
          (chunk) => {
            bumpEstimate(chunk)
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
              ? { ...m, text: replyText || m.text, status: 'sent' as const }
              : m,
          ),
        )
        if (!reportedUsage) {
          const fallbackTurn = Math.max(
            estimatedChars > 0 ? Math.max(1, Math.ceil(estimatedChars / 4)) : 0,
            estimateTokensFromText(replyText),
            tokensPerMessage,
          )
          applyTokenBalance({
            used: Math.min(limit, usedAtStart + fallbackTurn),
            limit,
          })
        }
      } catch (error) {
        if (controller.signal.aborted) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId ? { ...m, status: 'sent' as const } : m,
            ),
          )
        } else {
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
        }
      } finally {
        abortRef.current = null
        setIsSending(false)
        setIsDraftingDocument(false)
      }
    },
    [messages, sendMessage, nextMessageId, applyTokenBalance, tokensPerMessage, canvasDocument?.id, onDocumentChange],
  )

  const handleSend = useCallback(() => {
    const text = draft.trim()
    if ((!text && !pendingAttachment && !editingMessageId) || isSending || isExhausted || isUploadingAttachment) {
      return
    }

    const attachment = pendingAttachment ?? undefined

    if (editingMessageId) {
      const editId = editingMessageId
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === editId)
        if (idx < 0) return prev
        return prev.slice(0, idx + 1).map((m) =>
          m.id === editId
            ? {
                ...m,
                text,
                status: 'sending' as const,
                attachment: attachment
                  ? { name: attachment.name, path: attachment.path }
                  : m.attachment,
              }
            : m,
        )
      })
      setDraft('')
      setPendingAttachment(null)
      setEditingMessageId(null)
      void dispatch(editId, text, activeAgentId, attachment, { editMessageId: editId })
      return
    }

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
    editingMessageId,
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
        if (!enterToSend) return
        event.preventDefault()
        handleSend()
      }
    },
    [handleSend, enterToSend],
  )

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const handleCopy = useCallback(
    async (message: ChatMessage) => {
      try {
        await navigator.clipboard.writeText(message.text)
        markCopied(message.id)
      } catch (err) {
        console.error('[chat] copy failed', err)
        setErrorMessage('Could not copy to clipboard.')
      }
    },
    [markCopied],
  )

  const handleEdit = useCallback((message: ChatMessage) => {
    setEditingMessageId(message.id)
    setDraft(message.text)
    setErrorMessage(null)
  }, [])

  const handleRegenerate = useCallback(() => {
    if (isSending || isExhausted) return
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')
    if (!lastUser) return
    setMessages((prev) => {
      const lastAssistant = [...prev].reverse().find((m) => m.role === 'assistant')
      if (!lastAssistant) return prev
      return prev.filter((m) => m.id !== lastAssistant.id)
    })
    const attachment = lastUser.attachment?.path
      ? { path: lastUser.attachment.path, name: lastUser.attachment.name }
      : undefined
    void dispatch(lastUser.id, lastUser.text, lastUser.agentId, attachment, { regenerate: true })
  }, [isSending, isExhausted, messages, dispatch])

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
      className="workspace-shell flex h-full min-h-[560px] w-full overflow-hidden text-app-text"
    >
      <aside className="flex w-[17.5rem] shrink-0 flex-col border-r border-app-border bg-app-panel/90 px-4 py-5 backdrop-blur-[2px]">
        <div className="mb-6 px-0.5">
          <div className="font-display text-[1.35rem] font-semibold tracking-tight text-app-text">
            Erasmus AI
          </div>
          <p className="mt-1 text-xs leading-relaxed text-app-text-dim">
            KA1 and KA2 drafts under Programme Guide pass rules
          </p>
        </div>

        <div
          id="erasmus-token-balance"
          role="group"
          aria-label="Token balance"
          className="mb-5 border border-app-border bg-app-surface px-3 py-3"
        >
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-medium text-app-text">Monthly tokens</span>
            <span className="tabular-nums text-app-text-dim">
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
            className="h-1 w-full overflow-hidden bg-app-border"
          >
            <div
              className="h-full bg-app-accent transition-[width]"
              style={{ width: `${usagePercent}%` }}
            />
          </div>
          {isExhausted && (
            <p
              id={quotaId}
              role="alert"
              className="mt-2.5 flex items-start gap-1.5 text-xs font-medium text-app-danger"
            >
              <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
              Token quota used. Upgrade to keep drafting.
            </p>
          )}
        </div>

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

      <div className="flex min-w-0 flex-1 flex-col bg-transparent lg:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-app-border px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <div
              data-testid="active-agent-pill"
              className="truncate text-sm font-medium text-app-text"
            >
              {activeAgent?.name ?? 'Erasmus AI'}
            </div>
            {canvasDocument && !canvasOpen && (
              <DocumentCanvasToggle onClick={() => setCanvasOpen(true)} />
            )}
          </div>

          <div
            role="group"
            aria-label="Theme"
            className="flex items-center border border-app-border bg-app-surface p-0.5"
          >
            <button
              type="button"
              aria-label="Light theme"
              aria-pressed={theme === 'light'}
              onClick={() => handleThemeSelect('light')}
              className={`flex h-7 w-8 items-center justify-center focus-visible:outline-2 focus-visible:outline-app-accent focus-visible:outline-offset-2 ${
                theme === 'light' ? 'bg-app-panel-2 text-app-text' : 'text-app-text-dim'
              }`}
            >
              <Sun size={13} />
            </button>
            <button
              type="button"
              aria-label="Dark theme"
              aria-pressed={theme === 'dark'}
              onClick={() => handleThemeSelect('dark')}
              className={`flex h-7 w-8 items-center justify-center focus-visible:outline-2 focus-visible:outline-app-accent focus-visible:outline-offset-2 ${
                theme === 'dark' ? 'bg-app-panel-2 text-app-text' : 'text-app-text-dim'
              }`}
            >
              <Moon size={13} />
            </button>
          </div>
        </header>

        <div
          id="erasmus-chat-panel"
          role="region"
          aria-label="Conversation"
          className="flex-1 overflow-y-auto px-5 py-2"
        >
          <MessageList
            messages={messages}
            agents={agents as AIAgent[]}
            activeAgentName={activeAgent?.name}
            isSending={isSending}
            onRetry={handleRetry}
            onCopy={(message) => void handleCopy(message)}
            onRegenerate={handleRegenerate}
            onEdit={handleEdit}
            copiedId={copiedId}
          />
        </div>

        {editingMessageId && (
          <div className="mx-auto mb-1 flex max-w-2xl items-center justify-between px-5 text-xs text-app-text-dim">
            <span>Editing a previous message — send to replace everything after it.</span>
            <button
              type="button"
              className="underline underline-offset-2"
              onClick={() => {
                setEditingMessageId(null)
                setDraft('')
              }}
            >
              Cancel
            </button>
          </div>
        )}
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
          onStop={handleStop}
          hasDocument={Boolean(canvasDocument)}
        />
        </div>
        {canvasOpen && (
          <DocumentCanvas
            document={canvasDocument}
            contentMd={canvasContent}
            isDrafting={isDraftingDocument}
            onClose={() => setCanvasOpen(false)}
          />
        )}
      </div>
    </div>
  )
}

export default ErasmusChatWorkspace
