import type { FormSchema } from './formSchemaToGraph'
import { ka153FormSchema } from './ka153'

/**
 * Mirrors app/resources/schemas/manifest.json — the API's source of truth for
 * which actions have a reviewed schema. Vite bundles JSON at build time, so
 * the web app can't read the API's copy at runtime; this file is kept in
 * sync by tools/schema-sync/src/sync.js when it promotes a reviewed schema.
 */
export interface SchemaManifestEntry {
  callYear: number
  supported: boolean
  verifiedAt?: string
}

export const SCHEMA_MANIFEST: Record<string, SchemaManifestEntry> = {
  KA153: { callYear: 2026, supported: true, verifiedAt: '2026-08-01' },
}

// Static imports are unavoidable for a bundled JSON schema — but this map is
// the only place a new action's module needs registering. Whether it's
// *enabled* is governed entirely by SCHEMA_MANIFEST above.
const SCHEMA_BY_ACTION: Record<string, FormSchema> = {
  KA153: ka153FormSchema,
}

/** The reviewed schema for actionCode, or null if it isn't supported/loaded yet. */
export function schemaForAction(actionCode: string): FormSchema | null {
  if (!SCHEMA_MANIFEST[actionCode]?.supported) return null
  return SCHEMA_BY_ACTION[actionCode] ?? null
}

export function isActionSupported(actionCode: string): boolean {
  return Boolean(SCHEMA_MANIFEST[actionCode]?.supported)
}

export function schemaVerifiedAt(actionCode: string): string | undefined {
  return SCHEMA_MANIFEST[actionCode]?.verifiedAt
}
