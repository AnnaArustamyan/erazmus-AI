/**
 * Action lock: recommend from conversation, never generate from a guess.
 * Exact codes only — KA152, KA153 and KA154 are distinct.
 */

export const SUPPORTED_ACTION_CODES = new Set([
  'KA121',
  'KA122',
  'KA131/171',
  'KA152',
  'KA153',
  'KA154',
]);

export const VISIBLE_UNSUPPORTED_ACTION_CODES = new Set(['KA210', 'KA220']);

export const ALL_ACTION_CODES = new Set([
  ...SUPPORTED_ACTION_CODES,
  ...VISIBLE_UNSUPPORTED_ACTION_CODES,
]);

const YOUTH_FAMILY = new Set(['KA152', 'KA153', 'KA154', 'KA152-154']);

export function isYouthFamily(actionCode) {
  return YOUTH_FAMILY.has(actionCode);
}

export function isKa153(actionCode) {
  return actionCode === 'KA153';
}

/**
 * Suggest an action from free text. Never treat this as confirmed.
 * A vague “youth project” does not choose KA152 vs KA153 vs KA154.
 * @param {string} [text]
 * @returns {string | null}
 */
export function recommendActionCode(text) {
  const t = text || '';
  if (/\bKA220\b/i.test(t)) return 'KA220';
  if (/\bKA210\b/i.test(t)) return 'KA210';
  if (/\bKA122\b/i.test(t)) return 'KA122';
  if (/\bKA121\b/i.test(t)) return 'KA121';
  if (/\bKA171\b/i.test(t) || /\bKA131\b/i.test(t)) return 'KA131/171';
  if (/\bKA154\b/i.test(t) || /\byouth participation\b/i.test(t)) return 'KA154';
  if (/\bKA153\b/i.test(t) || /\bmobility of youth workers\b/i.test(t) || /\byouth workers?\b/i.test(t)) {
    return 'KA153';
  }
  if (/\bKA152\b/i.test(t) || /\byouth exchange/i.test(t)) return 'KA152';
  if (/\bsmall-scale partnership\b/i.test(t)) return 'KA210';
  if (/\bcooperation partnership\b/i.test(t)) return 'KA220';
  return null;
}

/** @deprecated Use recommendActionCode. Kept so chat can still retrieve a pack while coaching. */
export const inferActionCode = recommendActionCode;

export function normalizeConfirmedAction(actionCode) {
  if (typeof actionCode !== 'string') return null;
  const code = actionCode.trim();
  if (code === 'KA152-154') return null;
  return ALL_ACTION_CODES.has(code) ? code : null;
}

/**
 * @param {string | null | undefined} actionCode
 * @returns {{ ok: true, actionCode: string } | { ok: false, status: number, error: string, code: string }}
 */
export function requireConfirmedAction(actionCode) {
  const code = normalizeConfirmedAction(actionCode);
  if (!code) {
    return {
      ok: false,
      status: 400,
      code: 'ACTION_NOT_CONFIRMED',
      error:
        'Confirm the exact action type before generating (for example KA152, KA153 or KA154). The system will not guess.',
    };
  }
  if (VISIBLE_UNSUPPORTED_ACTION_CODES.has(code) || !SUPPORTED_ACTION_CODES.has(code)) {
    return {
      ok: false,
      status: 422,
      code: 'ACTION_NOT_SUPPORTED',
      error: `${code} is listed as Coming soon. KA2 generation stays closed until KA1 gates are green.`,
    };
  }
  return { ok: true, actionCode: code };
}
