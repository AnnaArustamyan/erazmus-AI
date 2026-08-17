import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { LoginScreen } from './components/LoginScreen'
import { ErasmusChatWorkspace } from './components/ErasmusChatWorkspace'
import { ProfileMenu } from './components/ProfileMenu'
import { createApiChatClient } from './api/chatClient'
import { uploadFile as uploadFileRequest } from './api/uploadClient'
import {
  deleteConversation as deleteConversationRequest,
  getConversationMessages,
  listConversations,
  type ConversationSummary as ApiConversationSummary,
} from './api/conversationsClient'
import {
  getDocumentForConversation,
  listDocuments,
  type DocumentSummary,
} from './api/documentsClient'
import type {
  AgentId,
  CanvasDocument,
  ChatMessage,
  ConversationSummary,
  ThemeMode,
} from './components/ErasmusChatWorkspace.types'
import { DEFAULT_AGENT_ID } from './components/chat/agents'
import {
  loadActiveConversationId,
  loadPreferences,
  saveActiveConversationId,
  savePreferences,
  type UserPreferences,
} from './preferences'
import { SettingsLayout } from './pages/settings/SettingsLayout'
import { ProfilePage } from './pages/settings/ProfilePage'
import { PreferencesPage } from './pages/settings/PreferencesPage'
import { UsagePage } from './pages/settings/UsagePage'
import { SecurityPage } from './pages/settings/SecurityPage'
import { DocumentsPage } from './pages/settings/DocumentsPage'
import { GeneratorPage } from './pages/GeneratorPage'
import { GrantsLibraryPage } from './pages/GrantsLibraryPage'
import { GrantsBuilderPage } from './pages/GrantsBuilderPage'
import { GrantInterviewProvider } from './grants/GrantInterviewContext'
import { IconRail } from './components/layout/IconRail'
import { MobileTabBar } from './components/layout/MobileTabBar'

function toSummary(c: ApiConversationSummary): ConversationSummary {
  return { id: c.id, agentId: c.agentId, title: c.title ?? '' }
}

function AppHeader({
  theme,
  preferences,
}: {
  theme: ThemeMode
  preferences: UserPreferences
}) {
  const { user, profile, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-app-border bg-app-panel/95 px-5 py-2.5 backdrop-blur-[2px]">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="min-w-0 truncate text-left text-xs text-app-text-dim hover:text-app-text"
      >
        Erasmus+ KA1 & KA2 · Guide-aligned drafting
      </button>
      <ProfileMenu
        name={profile?.name ?? null}
        email={profile?.email ?? user?.email ?? ''}
        plan={profile?.plan ?? 'free'}
        tokensUsed={profile?.tokensUsed ?? 0}
        tokenLimit={profile?.monthlyTokenLimit ?? 20_000}
        aiTier={profile?.features?.aiTier ?? 'standard'}
        onSignOut={() => void logout()}
      />
      <span className="sr-only" data-theme={theme}>
        {preferences.theme}
      </span>
    </div>
  )
}

function ChatWorkspace({
  theme,
  onThemeChange,
  enterToSend,
}: {
  theme: ThemeMode
  onThemeChange: (theme: ThemeMode) => void
  enterToSend: boolean
}) {
  const { accessToken, profile, setProfileTokensUsed } = useAuth()
  const tokenRef = useRef(accessToken)
  tokenRef.current = accessToken
  const location = useLocation()
  const navigate = useNavigate()

  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>()
  const [threadMessages, setThreadMessages] = useState<ChatMessage[]>([])
  const [threadAgentId, setThreadAgentId] = useState<AgentId>(DEFAULT_AGENT_ID)
  const [isLoadingThread, setIsLoadingThread] = useState(true)
  const [threadError, setThreadError] = useState<string | null>(null)
  const [workspaceKey, setWorkspaceKey] = useState(0)
  const [threadDocument, setThreadDocument] = useState<CanvasDocument | null>(null)
  const [documents, setDocuments] = useState<DocumentSummary[]>([])

  const refreshConversations = useCallback(async () => {
    const token = tokenRef.current
    if (!token) return
    try {
      const list = await listConversations(token)
      setConversations(list.map(toSummary))
    } catch (err) {
      console.error('[conversations] failed to refresh list', err)
    }
  }, [])

  const refreshDocuments = useCallback(async () => {
    const token = tokenRef.current
    if (!token) return
    try {
      const list = await listDocuments(token)
      setDocuments(list)
    } catch (err) {
      console.error('[documents] failed to refresh list', err)
    }
  }, [])

  const openConversation = useCallback(async (id: string | undefined) => {
    const token = tokenRef.current
    if (!token) return
    setIsLoadingThread(true)
    setThreadError(null)
    try {
      if (id) {
        const rows = await getConversationMessages(token, id)
        const messages: ChatMessage[] = rows.map((row) => ({
          id: row.id,
          role: row.role,
          agentId: row.agentId ?? DEFAULT_AGENT_ID,
          text: row.content,
          createdAt: new Date(row.createdAt).getTime(),
          status: 'sent',
          attachment: row.attachment,
        }))
        const lastAgentId = [...rows].reverse().find((row) => row.agentId)?.agentId
        setThreadMessages(messages)
        setThreadAgentId(lastAgentId ?? DEFAULT_AGENT_ID)
        setActiveConversationId(id)
        saveActiveConversationId(id)
        const doc = await getDocumentForConversation(token, id).catch((err) => {
          console.error('[documents] failed to load conversation draft', err)
          return null
        })
        setThreadDocument(
          doc
            ? {
                id: doc.id,
                title: doc.title,
                conversationId: doc.conversationId,
                contentMd: doc.contentMd ?? '',
                createdAt: doc.createdAt,
                downloads: doc.downloads,
              }
            : null,
        )
      } else {
        setThreadMessages([])
        setThreadAgentId(DEFAULT_AGENT_ID)
        setActiveConversationId(undefined)
        saveActiveConversationId(undefined)
        setThreadDocument(null)
      }
      setWorkspaceKey((key) => key + 1)
    } catch (err) {
      console.error('[conversations] failed to open conversation', id, err)
      setThreadError(err instanceof Error ? err.message : 'Could not load this conversation.')
    } finally {
      setIsLoadingThread(false)
    }
  }, [])

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false
    ;(async () => {
      const list = await listConversations(accessToken).catch((err) => {
        console.error('[conversations] failed to load initial list', err)
        return []
      })
      if (cancelled) return
      setConversations(list.map(toSummary))
      const remembered = loadActiveConversationId()
      const initialId =
        (remembered && list.some((c) => c.id === remembered) ? remembered : undefined) ??
        list[0]?.id
      await openConversation(initialId)
      await refreshDocuments()
    })()
    return () => {
      cancelled = true
    }
  }, [accessToken])

  const handleNewChat = useCallback(() => {
    void openConversation(undefined)
  }, [openConversation])

  useEffect(() => {
    if ((location.state as { newChat?: boolean } | null)?.newChat) {
      handleNewChat()
      navigate('/chat', { replace: true, state: {} })
    }
  }, [handleNewChat, location.state, navigate])

  const handleSelectConversation = useCallback(
    (id: string) => {
      if (id === activeConversationId) return
      void openConversation(id)
    },
    [activeConversationId, openConversation],
  )

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      const token = tokenRef.current
      if (!token) return
      try {
        await deleteConversationRequest(token, id)
        setConversations((prev) => prev.filter((c) => c.id !== id))
        if (id === activeConversationId) {
          void openConversation(undefined)
        }
      } catch (err) {
        console.error('[conversations] failed to delete conversation', id, err)
        setThreadError(err instanceof Error ? err.message : 'Could not delete this conversation.')
      }
    },
    [activeConversationId, openConversation],
  )

  const handleUploadFile = useCallback(async (file: File) => {
    const token = tokenRef.current
    if (!token) throw new Error('You must be signed in to attach a file.')
    const uploaded = await uploadFileRequest(token, file)
    return { path: uploaded.path, name: uploaded.name }
  }, [])

  const sendMessage = useMemo(
    () =>
      createApiChatClient({
        getAccessToken: () => tokenRef.current,
        initialConversationId: activeConversationId,
        onConversationChange: (id) => {
          setActiveConversationId(id)
          saveActiveConversationId(id)
          void refreshConversations()
        },
      }),
    [workspaceKey],
  )

  return (
    <>
      <div className="min-w-0 truncate border-b border-app-border/60 px-5 py-1.5 text-[11px] text-app-text-dim">
        {documents.length > 0
          ? `${documents.length} saved draft${documents.length === 1 ? '' : 's'} this account`
          : profile?.plan === 'free'
            ? 'Free · Standard AI · 3 application drafts / month'
            : 'Paid · Advanced AI · higher token and draft limits'}
      </div>
      <div className="min-h-0 flex-1 p-0">
        {isLoadingThread ? (
          <div className="flex h-full items-center justify-center text-sm text-app-text-dim">
            Loading your workspace…
          </div>
        ) : (
          <>
            {threadError && (
              <p
                role="alert"
                className="mx-auto mt-2 max-w-2xl rounded-lg border border-app-danger/40 bg-app-panel px-3 py-2 text-center text-xs font-medium text-app-danger"
              >
                {threadError}
              </p>
            )}
            <ErasmusChatWorkspace
              key={workspaceKey}
              sendMessage={sendMessage}
              initialMessages={threadMessages}
              initialAgentId={threadAgentId}
              initialTheme={theme}
              onThemeChange={onThemeChange}
              enterToSend={enterToSend}
              conversations={conversations}
              activeConversationId={activeConversationId}
              onNewChat={handleNewChat}
              onSelectConversation={handleSelectConversation}
              onDeleteConversation={(id) => void handleDeleteConversation(id)}
              uploadFile={handleUploadFile}
              initialDocument={threadDocument}
              onDocumentChange={() => {
                void refreshDocuments()
              }}
              tokenBalance={
                profile
                  ? { used: profile.tokensUsed, limit: profile.monthlyTokenLimit }
                  : undefined
              }
              onTokenBalanceChange={(balance) => setProfileTokensUsed(balance.used)}
            />
          </>
        )}
      </div>
    </>
  )
}

function AuthenticatedApp({
  theme,
  onThemeChange,
  preferences,
  setPreferences,
}: {
  theme: ThemeMode
  onThemeChange: (theme: ThemeMode) => void
  preferences: UserPreferences
  setPreferences: (next: UserPreferences) => void
}) {
  return (
    <GrantInterviewProvider>
    <div data-theme={theme} className="workspace-shell flex h-screen flex-col">
      <AppHeader theme={theme} preferences={preferences} />
      <div className="flex min-h-0 flex-1">
      <IconRail />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <Routes>
        <Route path="/" element={<Navigate to="/chat" replace />} />
        <Route
          path="/chat"
          element={
            <ChatWorkspace
              theme={theme}
              onThemeChange={onThemeChange}
              enterToSend={preferences.enterToSend}
            />
          }
        />
        <Route path="/generator" element={<GeneratorPage />} />
        <Route path="/grants" element={<GrantsLibraryPage />} />
        <Route path="/grants/builder" element={<GrantsBuilderPage />} />
        <Route path="/settings" element={<SettingsLayout />}>
          <Route index element={<Navigate to="profile" replace />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route
            path="preferences"
            element={
              <PreferencesPage
                preferences={preferences}
                onChange={(next) => {
                  setPreferences(next)
                  onThemeChange(next.theme)
                }}
              />
            }
          />
          <Route path="usage" element={<UsagePage />} />
          <Route path="security" element={<SecurityPage />} />
          <Route path="documents" element={<DocumentsPage />} />
        </Route>
      </Routes>
      </div>
      </div>
      <MobileTabBar />
    </div>
    </GrantInterviewProvider>
  )
}

function AppShell() {
  const { user, isRestoring } = useAuth()
  const [preferences, setPreferencesState] = useState<UserPreferences>(() => loadPreferences())
  const theme = preferences.theme

  const setPreferences = useCallback((next: UserPreferences) => {
    setPreferencesState(next)
    savePreferences(next)
  }, [])

  const onThemeChange = useCallback(
    (next: ThemeMode) => {
      setPreferences({ ...loadPreferences(), theme: next })
    },
    [setPreferences],
  )

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  if (isRestoring) {
    return (
      <div data-theme={theme} className="flex h-screen items-center justify-center bg-app-bg text-sm text-app-text-dim">
        Restoring your session…
      </div>
    )
  }

  if (!user) {
    return <LoginScreen theme={theme} onThemeChange={onThemeChange} />
  }

  return (
    <AuthenticatedApp
      theme={theme}
      onThemeChange={onThemeChange}
      preferences={preferences}
      setPreferences={setPreferences}
    />
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
