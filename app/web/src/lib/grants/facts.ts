import type {
  ApplicationFact,
  FactConfidence,
  FactFeasibility,
  FactKind,
  FactSource,
  FactStatus,
} from './types'
import { flattenFormFields, type FormField } from './schemas/formSchemaToGraph'

export function makeFact(input: {
  key: string
  value: string | number
  source?: FactSource
  sourceField?: string
  confidence?: FactConfidence
  status?: FactStatus
  kind?: FactKind
  feasibility?: FactFeasibility
  rationale?: string
  requiresEvidence?: boolean
}): ApplicationFact {
  const confidence = input.confidence ?? 'inferred'
  const status = input.status ?? (confidence === 'confirmed' ? 'locked' : 'pending')
  return {
    key: input.key,
    value: input.value,
    source: input.source ?? 'user',
    sourceField: input.sourceField,
    confidence,
    status,
    kind: input.kind,
    feasibility: input.feasibility,
    rationale: input.rationale,
    requiresEvidence: input.requiresEvidence,
  }
}

function coerce(key: string, raw: string): string | number {
  if (key === 'participant_count' || key === 'participating_organisations' || key === 'activity_duration_days') {
    const n = Number.parseInt(raw.replace(/[^\d-]/g, ''), 10)
    return Number.isFinite(n) ? n : raw
  }
  return raw
}

export function factsFromAnswers(
  fields: FormField[],
  answers: Record<string, string>,
  existing: ApplicationFact[] = [],
): ApplicationFact[] {
  const next = [...existing]
  for (const field of fields) {
    if (!field.factKey) continue
    const raw = answers[field.id]?.trim()
    if (!raw) continue
    const idx = next.findIndex((f) => f.key === field.factKey)
    const fact = makeFact({
      key: field.factKey,
      value: coerce(field.factKey, raw),
      source: 'questionnaire',
      sourceField: field.id,
      confidence: 'confirmed',
      status: 'locked',
    })
    if (idx === -1) next.push(fact)
    else if (next[idx].status === 'locked' && next[idx].value !== fact.value) next[idx] = { ...next[idx], status: 'stale' }
    else next[idx] = fact
  }
  return next
}

export function factsFromGraphAnswers(
  schemaFields: FormField[] | undefined,
  answers: Record<string, string>,
  existing: ApplicationFact[] = [],
): ApplicationFact[] {
  if (!schemaFields?.length) return existing
  return factsFromAnswers(schemaFields, answers, existing)
}

export { flattenFormFields }
