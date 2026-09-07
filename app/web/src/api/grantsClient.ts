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

export type GateStatus = 'pass' | 'fail' | 'review'

export interface ValidationReport {
  actionCode: string | null
  findings: Array<{
    id: string
    level: 'critical' | 'major' | 'minor'
    gate: string
    layer: string
    location?: string
    message: string
    suggestion?: string
  }>
  readiness: {
    status: 'not_ready' | 'in_review'
    counts: { critical: number; major: number; minor: number }
    gates: {
      schema: GateStatus
      compliance: GateStatus
      consistency: GateStatus
      evidence: GateStatus
      quality: GateStatus
    }
  }
}

export async function validateGrant(
  accessToken: string | null,
  id: string,
): Promise<{ grant: GrantApplication; report: ValidationReport }> {
  const res = await apiFetch(`/api/grants/${id}/validate`, {
    method: 'POST',
    accessToken,
  })
  if (!res.ok) throw new Error(await parseErrorBody(res, 'Could not validate grant application'))
  const body = (await res.json()) as { grant: GrantApplication; report: ValidationReport }
  return { grant: fromApi(body.grant), report: body.report }
}
