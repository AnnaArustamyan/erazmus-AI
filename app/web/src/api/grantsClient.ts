import { apiFetch, parseErrorBody } from './http'
import type { GrantApplication, GrantStatus } from '../lib/grants/types'

export interface GrantWriteInput {
  actionCode?: string
  title?: string
  callYear?: number
  answers?: Record<string, string>
  path?: string[]
  facts?: GrantApplication['facts']
  sections?: Record<string, string>
  status?: GrantStatus
  percentComplete?: number
  contentMd?: string
  documentId?: string | null
  conversationId?: string
}

function fromApi(row: GrantApplication): GrantApplication {
  const status = row.status as GrantStatus | 'complete'
  return {
    ...row,
    answers: row.answers ?? {},
    facts: row.facts ?? [],
    path: row.path ?? [],
    status: status === 'complete' ? 'ready' : status,
  }
}

export async function listGrants(accessToken: string | null): Promise<GrantApplication[]> {
  const res = await apiFetch('/api/grants', { accessToken })
  if (!res.ok) throw new Error(await parseErrorBody(res, 'Could not list grant applications'))
  const body = (await res.json()) as { grants: GrantApplication[] }
  return (body.grants ?? []).map(fromApi)
}

export async function createGrant(
  accessToken: string | null,
  input: GrantWriteInput,
): Promise<GrantApplication> {
  const res = await apiFetch('/api/grants', {
    method: 'POST',
    accessToken,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await parseErrorBody(res, 'Could not create grant application'))
  const body = (await res.json()) as { grant: GrantApplication }
  return fromApi(body.grant)
}

export async function updateGrant(
  accessToken: string | null,
  id: string,
  patch: Partial<GrantWriteInput>,
): Promise<GrantApplication> {
  const res = await apiFetch(`/api/grants/${id}`, {
    method: 'PATCH',
    accessToken,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error(await parseErrorBody(res, 'Could not update grant application'))
  const body = (await res.json()) as { grant: GrantApplication }
  return fromApi(body.grant)
}
