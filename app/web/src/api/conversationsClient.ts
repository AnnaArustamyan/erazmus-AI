import type { AgentId } from '../components/ErasmusChatWorkspace.types'
import { API_BASE_URL } from './config'

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

async function parseErrorBody(response: Response): Promise<string> {
  const body = await response.json().catch(() => null)
  return body?.error ?? `Request failed (${response.status})`
}

export async function listConversations(accessToken: string): Promise<ConversationSummary[]> {
  const response = await fetch(`${API_BASE_URL}/api/conversations`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) throw new Error(await parseErrorBody(response))
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
  accessToken: string,
  conversationId: string,
): Promise<ConversationMessage[]> {
  const response = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}/messages`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) throw new Error(await parseErrorBody(response))
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

export async function deleteConversation(accessToken: string, conversationId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok && response.status !== 404) throw new Error(await parseErrorBody(response))
}
