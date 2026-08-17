/**
 * Normalize provider usage payloads. Some OpenAI-compatible APIs omit
 * `total_tokens` and only send prompt/completion (or input/output) counts.
 * @param {unknown} usage
 * @returns {number}
 */
export function readUsageTotalTokens(usage) {
  if (!usage || typeof usage !== 'object') return 0;
  const record = /** @type {Record<string, unknown>} */ (usage);
  const total = Number(record.total_tokens);
  if (Number.isFinite(total) && total > 0) return total;
  const prompt = Number(record.prompt_tokens ?? record.input_tokens ?? 0);
  const completion = Number(record.completion_tokens ?? record.output_tokens ?? 0);
  const sum =
    (Number.isFinite(prompt) ? prompt : 0) + (Number.isFinite(completion) ? completion : 0);
  return sum > 0 ? sum : 0;
}

/**
 * Fallback when a provider does not return usage on the stream.
 * @param {string} text
 * @returns {number}
 */
export function estimateTokensFromText(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return 0;
  return Math.max(1, Math.ceil(trimmed.length / 4));
}
