import type { GrantApplication } from './types'

export const PENDING_ACTION = 'PENDING'

const ACTIVE_KEY = 'erasmus.activeGrantId'

export function loadActiveGrantId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY)
  } catch {
    return null
  }
}

export function saveActiveGrantId(id: string | null): void {
  try {
    if (!id) localStorage.removeItem(ACTIVE_KEY)
    else localStorage.setItem(ACTIVE_KEY, id)
  } catch {
    /* ignore quota / private mode */
  }
}

export function isConfirmedAction(grant: GrantApplication | null | undefined): boolean {
  if (!grant) return false
  if (grant.actionConfirmed === false) return false
  const code = grant.actionCode?.trim()
  return Boolean(code && code !== PENDING_ACTION)
}

export function confirmedActionCode(grant: GrantApplication | null | undefined): string | null {
  return isConfirmedAction(grant) ? grant!.actionCode : null
}

export function resolveActiveGrantId(
  grants: GrantApplication[],
  remembered: string | null,
): string | null {
  if (remembered && grants.some((grant) => grant.id === remembered)) return remembered
  const sorted = [...grants].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return sorted[0]?.id ?? null
}

export function grantForConversation(
  grants: GrantApplication[],
  conversationId: string | undefined,
): GrantApplication | undefined {
  if (!conversationId) return undefined
  return grants.find((grant) => grant.conversationId === conversationId)
}
