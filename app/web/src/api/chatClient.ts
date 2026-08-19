import type { SendMessageFn } from '../components/ErasmusChatWorkspace.types'
import { API_BASE_URL } from './config'

interface CreateApiChatClientOptions {
  baseUrl?: string
  getAccessToken: () => string | null
  initialConversationId?: string
  getActionCode?: () => string | null
  getGrantAnswers?: () => Record<string, string>
  onConversationChange?: (conversationId: string) => void
}

export function createApiChatClient({
  baseUrl = API_BASE_URL,
  getAccessToken,
  initialConversationId,
  getActionCode,
  getGrantAnswers,
  onConversationChange,
}: CreateApiChatClientOptions): SendMessageFn {
  let conversationId = initialConversationId

  return async (
    {
      text,
      agentId,
      attachment,
      regenerate,
      editMessageId,
      documentId,
      signal,
      onDocumentStart,
      onDocumentDelta,
      onDocument,
      onDocumentRejected,
      onUsage,
    },
    onDelta,
  ) => {
    const accessToken = getAccessToken()

    let fullText = ''
    let response: Response
    try {
      response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        credentials: 'include',
        signal,
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          agentId,
          message: text,
          conversationId,
          attachmentPath: attachment?.path,
          attachmentName: attachment?.name,
          regenerate: regenerate || undefined,
          editMessageId: editMessageId || undefined,
          documentId: documentId || undefined,
          actionCode: getActionCode?.() || undefined,
          grantAnswers: getGrantAnswers?.() || undefined,
        }),
      })
    } catch (err) {
      if (signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
        return fullText
      }
      throw err
    }

    if (!response.ok) {
      const body = await response.json().catch(() => null)
      throw new Error(body?.error ?? `Chat request failed (${response.status})`)
    }
    if (!response.body) {
      throw new Error('Streaming responses are not supported in this environment.')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    const consumeLine = (line: string) => {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) return
      const payload = trimmed.slice(5).trim()
      if (!payload) return

      let event: {
        delta?: string
        done?: boolean
        error?: string
        conversationId?: string
        documentStart?: boolean
        mode?: 'create' | 'revise'
        documentDelta?: string
        tokensUsed?: number
        tokenLimit?: number
        document?: {
          id: string
          title: string
          conversationId: string | null
          contentMd: string
          createdAt: string
              downloads?: { pdf: string; md: string; docx: string }
        }
        documentRejected?: boolean
        gaps?: string[]
        handoff?: boolean
      }
      try {
        event = JSON.parse(payload)
      } catch {
        return
      }

      if (event.error) {
        throw new Error(event.error)
      }
      if (event.documentStart) {
        onDocumentStart?.(event.mode === 'revise' ? 'revise' : 'create')
      }
      if (typeof event.documentDelta === 'string') {
        onDocumentDelta?.(event.documentDelta)
      }
      if (event.document) {
        onDocument?.(event.document)
      }
      if (event.documentRejected) {
        onDocumentRejected?.(event.gaps ?? [])
      }
      if (typeof event.delta === 'string') {
        fullText += event.delta
        onDelta?.(event.delta)
      }
      if (typeof event.tokensUsed === 'number') {
        onUsage?.({
          used: event.tokensUsed,
          limit: typeof event.tokenLimit === 'number' ? event.tokenLimit : 0,
        })
      }
      if (event.done && event.conversationId && event.conversationId !== conversationId) {
        conversationId = event.conversationId
        onConversationChange?.(event.conversationId)
      }
    }

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) consumeLine(line)
      }

      buffer += decoder.decode()
      if (buffer.trim()) {
        for (const line of buffer.split('\n')) consumeLine(line)
      }
    } catch (err) {
      if (signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
        return fullText
      }
      throw err
    }

    return fullText
  }
}
