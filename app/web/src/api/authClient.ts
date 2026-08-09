import { API_BASE_URL } from './config'

export interface AuthUser {
  id: string
  email: string
}

export interface AuthSession {
  user: AuthUser
  accessToken: string
  refreshToken: string
  expiresAt: number
}

export interface UserProfile {
  id: string
  email: string
  name: string | null
  plan: string
  monthlyTokenLimit: number
  tokensUsed: number
  createdAt: string
}

async function parseErrorBody(response: Response): Promise<string> {
  const body = await response.json().catch(() => null)
  return body?.error ?? `Request failed (${response.status})`
}

export async function registerAccount(params: {
  email: string
  password: string
  name?: string
}): Promise<AuthUser> {
  const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!response.ok) throw new Error(await parseErrorBody(response))
  const data = await response.json()
  return data.user
}

export async function loginAccount(params: {
  email: string
  password: string
}): Promise<AuthSession> {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!response.ok) throw new Error(await parseErrorBody(response))
  const data = await response.json()
  return {
    user: data.user,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at,
  }
}

export async function refreshSession(refreshToken: string): Promise<AuthSession> {
  const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
  if (!response.ok) throw new Error(await parseErrorBody(response))
  const data = await response.json()
  return {
    user: data.user,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at,
  }
}

export async function fetchProfile(accessToken: string): Promise<UserProfile> {
  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) throw new Error(await parseErrorBody(response))
  const data = await response.json()
  return {
    id: data.id,
    email: data.email,
    name: data.name,
    plan: data.plan,
    monthlyTokenLimit: data.monthly_token_limit,
    tokensUsed: data.tokens_used,
    createdAt: data.created_at,
  }
}

export async function logoutAccount(accessToken: string): Promise<void> {
  await fetch(`${API_BASE_URL}/api/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}
