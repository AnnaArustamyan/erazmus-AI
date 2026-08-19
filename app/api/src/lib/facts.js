/**
 * Application facts with provenance. The generator may only use locked + confirmed facts.
 */

export const FACT_SOURCES = new Set(['questionnaire', 'chat', 'document', 'user']);
export const FACT_CONFIDENCE = new Set(['confirmed', 'inferred', 'suggested']);
export const FACT_STATUS = new Set(['locked', 'pending', 'stale']);

export const KA153_MINIMUM_FACTS = [
  'participant_count',
  'participating_organisations',
  'countries',
  'activity_duration_days',
  'needs_method',
  'selection_criteria',
  'venue_country',
];

export function normalizeFacts(input) {
  if (!Array.isArray(input)) return [];
  return input.filter((row) => row && typeof row === 'object' && typeof row.key === 'string');
}

/**
 * @param {{ key: string, value: unknown, source?: string, sourceField?: string, confidence?: string, status?: string }} fact
 */
export function makeFact(fact) {
  const source = FACT_SOURCES.has(fact.source) ? fact.source : 'user';
  const confidence = FACT_CONFIDENCE.has(fact.confidence) ? fact.confidence : 'inferred';
  const status =
    FACT_STATUS.has(fact.status)
      ? fact.status
      : confidence === 'confirmed'
        ? 'locked'
        : 'pending';
  return {
    key: fact.key,
    value: fact.value,
    source,
    sourceField: fact.sourceField || undefined,
    confidence,
    status,
    kind: fact.kind || undefined,
    feasibility: fact.feasibility || undefined,
    rationale: fact.rationale || undefined,
    requiresEvidence: fact.requiresEvidence || undefined,
  };
}

export function getFact(facts, key) {
  return normalizeFacts(facts).find((f) => f.key === key) || null;
}

/**
 * Upsert a fact. If a locked confirmed value changes from a different source/field, mark stale instead of silently replacing.
 * @param {object[]} facts
 * @param {ReturnType<typeof makeFact>} next
 */
export function upsertFact(facts, next) {
  const list = normalizeFacts(facts).map((f) => ({ ...f }));
  const idx = list.findIndex((f) => f.key === next.key);
  if (idx === -1) {
    list.push(makeFact(next));
    return list;
  }
  const prev = list[idx];
  const sameValue = valuesEqual(prev.value, next.value);
  if (prev.status === 'locked' && prev.confidence === 'confirmed' && !sameValue) {
    list[idx] = { ...prev, status: 'stale' };
    list.push(
      makeFact({
        ...next,
        key: `${next.key}__conflict`,
        status: 'pending',
        confidence: next.confidence === 'confirmed' ? 'confirmed' : 'inferred',
      }),
    );
    return list;
  }
  list[idx] = makeFact({ ...prev, ...next });
  return list;
}

function valuesEqual(a, b) {
  if (a === b) return true;
  if (typeof a === 'number' || typeof b === 'number') return Number(a) === Number(b);
  if (typeof a === 'string' && typeof b === 'string') return a.trim() === b.trim();
  return JSON.stringify(a) === JSON.stringify(b);
}

export function confirmFact(facts, key) {
  return normalizeFacts(facts).map((f) =>
    f.key === key ? { ...f, confidence: 'confirmed', status: 'locked' } : f,
  );
}

export function isUsableFact(fact) {
  return Boolean(fact) && fact.status === 'locked' && fact.confidence === 'confirmed';
}

/**
 * Generation is refused (not degraded) if any required fact is missing or pending.
 * @param {object[]} facts
 * @param {string[]} requiredKeys
 */
export function missingGenerationFacts(facts, requiredKeys) {
  return requiredKeys.filter((key) => !isUsableFact(getFact(facts, key)));
}

export function canGenerateFromFacts(facts, requiredKeys = KA153_MINIMUM_FACTS) {
  return missingGenerationFacts(facts, requiredKeys).length === 0;
}

/**
 * Map questionnaire answers onto facts using schema field.factKey.
 * Confirmed questionnaire answers become locked facts.
 * @param {object[]} fields
 * @param {Record<string, string>} answers
 * @param {object[]} [existing]
 */
export function factsFromAnswers(fields, answers, existing = []) {
  let next = normalizeFacts(existing);
  for (const field of fields) {
    const factKey = field.factKey;
    if (!factKey) continue;
    const raw = answers[field.id];
    if (raw == null || String(raw).trim() === '') continue;
    next = upsertFact(
      next,
      makeFact({
        key: factKey,
        value: coerceFactValue(factKey, raw),
        source: 'questionnaire',
        sourceField: field.id,
        confidence: 'confirmed',
        status: 'locked',
      }),
    );
  }
  return next;
}

function coerceFactValue(key, raw) {
  const text = String(raw).trim();
  if (
    key === 'participant_count' ||
    key === 'participating_organisations' ||
    key === 'activity_duration_days'
  ) {
    const n = Number.parseInt(text.replace(/[^\d-]/g, ''), 10);
    return Number.isFinite(n) ? n : text;
  }
  return text;
}
