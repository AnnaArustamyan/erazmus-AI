import { apiFetch, parseErrorBody } from './http'

const SESSION_KEY = 'ea.session'

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

export interface PlanFeatures {
  plan: string
  aiTier: 'standard' | 'advanced'
  provider: string
  canGenerateDocuments: boolean
  monthlyDocumentLimit: number
  canUseAdvancedAgents: boolean
  monthlyTokenLimit: number
}

export interface UserProfile {
  id: string
  email: string
  name: string | null
  plan: string
  monthlyTokenLimit: number
  tokensUsed: number
  documentsUsedThisMonth: number
  guideYear: number
  createdAt: string
  features: PlanFeatures
}

function sessionFromPayload(data: {
  user: AuthUser
  access_token: string
  refresh_token: string
  expires_at: number
}): AuthSession {
  return {
    user: data.user,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at,
  }
}

export function loadStoredSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AuthSession
    if (!parsed?.accessToken || !parsed?.refreshToken || !parsed?.user?.id) return null
    return parsed
  } catch {
    return null
  }
}

export function persistSession(session: AuthSession | null): void {
  try {
    if (!session) localStorage.removeItem(SESSION_KEY)
    else localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // private mode / quota
  }
}

function mapProfile(data: Record<string, unknown>): UserProfile {
  const features = (data.features ?? {}) as Partial<PlanFeatures>
  const plan = String(data.plan ?? 'free')
  return {
    id: String(data.id),
    email: String(data.email),
    name: (data.name as string | null) ?? null,
    plan,
    monthlyTokenLimit: Number(data.monthly_token_limit ?? 20_000),
    tokensUsed: Number(data.tokens_used ?? 0),
    documentsUsedThisMonth: Number(data.documents_used_this_month ?? 0),
    guideYear: Number(data.guide_year ?? 2026),
    createdAt: String(data.created_at ?? ''),
    features: {
      plan: features.plan ?? plan,
      aiTier: features.aiTier === 'advanced' ? 'advanced' : 'standard',
      provider: features.provider ?? (plan === 'free' ? 'openai' : 'moonshot'),
      canGenerateDocuments: features.canGenerateDocuments !== false,
      monthlyDocumentLimit: Number(features.monthlyDocumentLimit ?? (plan === 'free' ? 3 : 20)),
      canUseAdvancedAgents: features.canUseAdvancedAgents !== false,
      monthlyTokenLimit: Number(features.monthlyTokenLimit ?? data.monthly_token_limit ?? 20_000),
    },
  }
}

export async function registerAccount(params: {
  email: string
  password: string
  name?: string
}): Promise<AuthUser> {
  const response = await apiFetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!response.ok) throw new Error(await parseErrorBody(response, 'Registration failed'))
  const data = await response.json()
  return data.user
}

export async function loginAccount(params: {
  email: string
  password: string
}): Promise<AuthSession> {
  const response = await apiFetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!response.ok) throw new Error(await parseErrorBody(response, 'Login failed'))
  const data = await response.json()
  const session = sessionFromPayload(data)
  persistSession(session)
  return session
}

export async function refreshSession(refreshToken?: string | null): Promise<AuthSession> {
  const response = await apiFetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(refreshToken ? { refresh_token: refreshToken } : {}),
  })
  if (!response.ok) throw new Error(await parseErrorBody(response, 'Session refresh failed'))
  const data = await response.json()
  const session = sessionFromPayload(data)
  persistSession(session)
  return session
}

export async function fetchProfile(accessToken?: string | null): Promise<UserProfile> {
  const response = await apiFetch('/api/auth/me', { accessToken })
  if (!response.ok) throw new Error(await parseErrorBody(response, 'Could not load profile'))
  const data = await response.json()
  return mapProfile(data)
}

export async function updateProfileName(
  accessToken: string | null,
  name: string,
): Promise<UserProfile> {
  const response = await apiFetch('/api/auth/me', {
    method: 'PATCH',
    accessToken,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!response.ok) throw new Error(await parseErrorBody(response, 'Could not update profile'))
  return mapProfile(await response.json())
}

export async function changePassword(
  accessToken: string | null,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const response = await apiFetch('/api/auth/password', {
    method: 'POST',
    accessToken,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword }),
  })
  if (!response.ok) throw new Error(await parseErrorBody(response, 'Could not change password'))
}

export async function logoutAccount(accessToken: string | null): Promise<void> {
  await apiFetch('/api/auth/logout', {
    method: 'POST',
    accessToken,
  })
  persistSession(null)
}
