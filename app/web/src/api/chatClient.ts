import type { SendMessageFn } from '../components/ErasmusChatWorkspace.types'
import { API_BASE_URL } from './config'

interface CreateApiChatClientOptions {
  baseUrl?: string
  getAccessToken: () => string | null
  initialConversationId?: string
  onConversationChange?: (conversationId: string) => void
}

export function createApiChatClient({
  baseUrl = API_BASE_URL,
  getAccessToken,
  initialConversationId,
  onConversationChange,
}: CreateApiChatClientOptions): SendMessageFn {
  let conversationId = initialConversationId

  return async ({ text, agentId, attachment, regenerate, editMessageId, signal }, onDelta) => {
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

    try {
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
    } catch (err) {
      if (signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
        return fullText
      }
      throw err
    }

    return fullText
  }
}
