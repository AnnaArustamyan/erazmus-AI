import { apiFetch, parseErrorBody } from './http'

export interface DocumentSummary {
  id: string
  title: string
  conversationId: string | null
  createdAt: string
}

export interface GeneratedDocument extends DocumentSummary {
  tokensUsed?: number
  tokenLimit?: number
  downloads: {
    md: string
    docx: string
  }
}

export async function listDocuments(accessToken: string | null): Promise<DocumentSummary[]> {
  const res = await apiFetch('/api/documents', { accessToken })
  if (!res.ok) throw new Error(await parseErrorBody(res, 'Could not list documents'))
  const body = (await res.json()) as { documents: DocumentSummary[] }
  return body.documents
}

export async function generateDocumentFromConversation(
  accessToken: string | null,
  conversationId: string,
): Promise<GeneratedDocument> {
  const res = await apiFetch('/api/documents/from-conversation', {
    method: 'POST',
    accessToken,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId }),
  })
  if (!res.ok) throw new Error(await parseErrorBody(res, 'Could not generate document'))
  return (await res.json()) as GeneratedDocument
}

export async function getDocumentDownloadUrl(
  accessToken: string | null,
  documentId: string,
  format: 'md' | 'docx' = 'docx',
): Promise<string> {
  const res = await apiFetch(`/api/documents/${documentId}/download?format=${format}`, {
    accessToken,
  })
  if (!res.ok) throw new Error(await parseErrorBody(res, 'Could not get download URL'))
  const body = (await res.json()) as { url: string }
  return body.url
}
