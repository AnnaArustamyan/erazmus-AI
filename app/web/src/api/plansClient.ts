import { apiFetch, throwIfNotOk } from './http'
import type { GeneratedDocument } from './documentsClient'

export async function generateProjectPlan(
  accessToken: string | null,
  prompt: string,
): Promise<GeneratedDocument> {
  const res = await apiFetch('/api/plans', {
    method: 'POST',
    accessToken,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  })
  await throwIfNotOk(res, 'Could not generate plan')
  return (await res.json()) as GeneratedDocument
}
