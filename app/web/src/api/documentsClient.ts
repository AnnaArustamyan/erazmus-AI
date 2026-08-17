import { apiFetch, parseErrorBody, throwIfNotOk } from './http'

export interface DocumentSummary {
  id: string
  title: string
  conversationId: string | null
  createdAt: string
}

export interface GeneratedDocument extends DocumentSummary {
  tokensUsed?: number
  tokenLimit?: number
  contentMd?: string
  downloads: {
    pdf: string
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

export async function getDocumentForConversation(
  accessToken: string | null,
  conversationId: string,
): Promise<GeneratedDocument | null> {
  const res = await apiFetch(
    `/api/documents?conversationId=${encodeURIComponent(conversationId)}`,
    { accessToken },
  )
  if (!res.ok) throw new Error(await parseErrorBody(res, 'Could not load document'))
  const body = (await res.json()) as { document: GeneratedDocument | null }
  return body.document
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
  await throwIfNotOk(res, 'Could not generate document')
  return (await res.json()) as GeneratedDocument
}

export async function generateDocumentFromInterview(
  accessToken: string | null,
  input: { actionCode: string; title: string; contentMd: string },
): Promise<GeneratedDocument> {
  const res = await apiFetch('/api/documents/from-interview', {
    method: 'POST',
    accessToken,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  await throwIfNotOk(res, 'Could not generate document')
  return (await res.json()) as GeneratedDocument
}

export async function getDocumentDownloadUrl(
  accessToken: string | null,
  documentId: string,
  format: 'pdf' | 'md' | 'docx' = 'pdf',
): Promise<string> {
  const res = await apiFetch(`/api/documents/${documentId}/download?format=${format}`, {
    accessToken,
  })
  if (!res.ok) throw new Error(await parseErrorBody(res, 'Could not get download URL'))
  const body = (await res.json()) as { url: string }
  return body.url
}
