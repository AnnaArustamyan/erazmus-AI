import type { SendMessageFn } from '../components/ErasmusChatWorkspace.types'
import { API_BASE_URL } from './config'

interface CreateApiChatClientOptions {
  baseUrl?: string
  getAccessToken: () => string | null
  /** Resumes an existing thread instead of starting a new conversation. */
  initialConversationId?: string
  /** Called whenever the server confirms which conversation a message landed in. */
  onConversationChange?: (conversationId: string) => void
}

/**
 * Builds a sendMessage implementation backed by POST /api/chat, which
 * streams the reply as Server-Sent Events. The workspace keeps one
 * continuous transcript even as the active agent changes mid-conversation,
 * so this client tracks a single conversation thread rather than one per
 * agent.
 */
export function createApiChatClient({
  baseUrl = API_BASE_URL,
  getAccessToken,
  initialConversationId,
  onConversationChange,
}: CreateApiChatClientOptions): SendMessageFn {
  let conversationId = initialConversationId

  return async ({ text, agentId, attachment }, onDelta) => {
    const accessToken = getAccessToken()
    if (!accessToken) {
      throw new Error('You must be signed in to chat with an agent.')
    }

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        agentId,
        message: text,
        conversationId,
        attachmentPath: attachment?.path,
        attachmentName: attachment?.name,
      }),
    })

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
    let fullText = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const payload = trimmed.slice(5).trim()
        if (!payload) continue

        let event: { delta?: string; done?: boolean; error?: string; conversationId?: string }
        try {
          event = JSON.parse(payload)
        } catch {
          continue
        }

        if (event.error) {
          throw new Error(event.error)
        }
        if (typeof event.delta === 'string') {
          fullText += event.delta
          onDelta?.(event.delta)
        }
        if (event.done && event.conversationId && event.conversationId !== conversationId) {
          conversationId = event.conversationId
          onConversationChange?.(event.conversationId)
        }
      }
    }

    return fullText
  }
}
