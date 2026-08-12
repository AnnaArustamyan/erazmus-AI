import type { AgentId } from '../components/ErasmusChatWorkspace.types'
import { apiFetch, parseErrorBody } from './http'

export interface ConversationSummary {
  id: string
  agentId: AgentId
  title: string | null
  updatedAt: string
  createdAt: string
}

export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  agentId: AgentId | null
  createdAt: string
  attachment?: { name: string; url?: string; path?: string }
}

export async function listConversations(accessToken: string | null): Promise<ConversationSummary[]> {
  const response = await apiFetch('/api/conversations', { accessToken })
  if (!response.ok) throw new Error(await parseErrorBody(response, 'Could not load conversations'))
  const data = await response.json()
  return data.conversations.map(
    (c: { id: string; agent_id: AgentId; title: string | null; updated_at: string; created_at: string }) => ({
      id: c.id,
      agentId: c.agent_id,
      title: c.title,
      updatedAt: c.updated_at,
      createdAt: c.created_at,
    }),
  )
}

export async function getConversationMessages(
  accessToken: string | null,
  conversationId: string,
): Promise<ConversationMessage[]> {
  const response = await apiFetch(`/api/conversations/${conversationId}/messages`, { accessToken })
  if (!response.ok) throw new Error(await parseErrorBody(response, 'Could not load messages'))
  const data = await response.json()
  return data.messages.map(
    (m: {
      id: string
      role: 'user' | 'assistant'
      content: string
      agent_id: AgentId | null
      created_at: string
      attachment_path: string | null
      attachment_name: string | null
      attachment_url?: string | null
    }) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      agentId: m.agent_id,
      createdAt: m.created_at,
      attachment: m.attachment_name
        ? { name: m.attachment_name, url: m.attachment_url ?? undefined, path: m.attachment_path ?? undefined }
        : undefined,
    }),
  )
}

export async function deleteConversation(accessToken: string | null, conversationId: string): Promise<void> {
  const response = await apiFetch(`/api/conversations/${conversationId}`, {
    method: 'DELETE',
    accessToken,
  })
  if (!response.ok && response.status !== 404) {
    throw new Error(await parseErrorBody(response, 'Could not delete conversation'))
  }
}
