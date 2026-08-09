import { API_BASE_URL } from './config'

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

async function parseError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string }
    return body.error || res.statusText
  } catch {
    return res.statusText
  }
}

export async function listDocuments(accessToken: string): Promise<DocumentSummary[]> {
  const res = await fetch(`${API_BASE_URL}/api/documents`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(await parseError(res))
  const body = (await res.json()) as { documents: DocumentSummary[] }
  return body.documents
}

export async function generateDocumentFromConversation(
  accessToken: string,
  conversationId: string,
): Promise<GeneratedDocument> {
  const res = await fetch(`${API_BASE_URL}/api/documents/from-conversation`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ conversationId }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return (await res.json()) as GeneratedDocument
}

export async function getDocumentDownloadUrl(
  accessToken: string,
  documentId: string,
  format: 'md' | 'docx' = 'docx',
): Promise<string> {
  const res = await fetch(
    `${API_BASE_URL}/api/documents/${documentId}/download?format=${format}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (!res.ok) throw new Error(await parseError(res))
  const body = (await res.json()) as { url: string }
  return body.url
}
