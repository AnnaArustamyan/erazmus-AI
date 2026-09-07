import type { GrantApplication } from './types'

const GRANTS_KEY = 'erasmus.grantApplications'

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function loadGrants(): GrantApplication[] {
  return readJson(GRANTS_KEY, [])
}

export function saveGrants(grants: GrantApplication[]): void {
  localStorage.setItem(GRANTS_KEY, JSON.stringify(grants))
}

export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`
}
