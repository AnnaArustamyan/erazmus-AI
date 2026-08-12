import { API_BASE_URL } from './config'

export async function parseErrorBody(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null)
  return body?.error ?? `${fallback} (${response.status})`
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
