import { API_BASE_URL } from './config'

export async function parseErrorBody(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null)
  return body?.error ?? `${fallback} (${response.status})`
}

export class DraftNotReadyError extends Error {
  readonly code = 'DRAFT_NOT_READY'
  readonly gaps: string[]
  readonly knownFacts: string[]

  constructor(body: { error?: string; gaps?: string[]; knownFacts?: string[] }) {
    super(body.error || 'This draft is not ready to export.')
    this.name = 'DraftNotReadyError'
    this.gaps = body.gaps ?? []
    this.knownFacts = body.knownFacts ?? []
  }
}

export async function throwIfNotOk(response: Response, fallback: string): Promise<void> {
  if (response.ok) return
  const body = await response.json().catch(() => null)
  if (response.status === 422 && body?.code === 'DRAFT_NOT_READY') {
    throw new DraftNotReadyError(body)
  }
  throw new Error(body?.error ?? `${fallback} (${response.status})`)
}

export function apiFetch(
  path: string,
  init: RequestInit & { accessToken?: string | null } = {},
): Promise<Response> {
  const { accessToken, headers, ...rest } = init
  const nextHeaders = new Headers(headers)
  if (accessToken) nextHeaders.set('Authorization', `Bearer ${accessToken}`)
  return fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    credentials: 'include',
    headers: nextHeaders,
  })
}
