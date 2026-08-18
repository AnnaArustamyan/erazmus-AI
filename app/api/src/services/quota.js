import { supabaseAdmin } from '../config/supabase.js';
import { getPlanConfig, startOfUtcMonth } from '../lib/plans.js';

function periodKey(now = new Date()) {
  return startOfUtcMonth(now).toISOString().slice(0, 10);
}

function isMissingQuotaColumn(error) {
  return /quota_period_start/i.test(error?.message ?? '');
}

/**
 * @param {string} userId
 * @param {Date} [now]
 * @returns {Promise<{ plan: string, monthly_token_limit: number, tokens_used: number, quota_period_start?: string } | null>}
 */
export async function getUserQuota(userId, now = new Date()) {
  const withPeriod = await supabaseAdmin
    .from('users')
    .select('plan, monthly_token_limit, tokens_used, quota_period_start')
    .eq('id', userId)
    .single();

  let data = withPeriod.data;
  let error = withPeriod.error;

  if (error && isMissingQuotaColumn(error)) {
    const legacy = await supabaseAdmin
      .from('users')
      .select('plan, monthly_token_limit, tokens_used')
      .eq('id', userId)
      .single();
    if (legacy.error || !legacy.data) return null;
    return legacy.data;
  }

  if (error || !data) return null;

  const month = periodKey(now);
  const stored = data.quota_period_start ? String(data.quota_period_start).slice(0, 10) : '';
  if (stored && stored < month) {
    await supabaseAdmin
      .from('users')
      .update({ tokens_used: 0, quota_period_start: month })
      .eq('id', userId);
    return { ...data, tokens_used: 0, quota_period_start: month };
  }
  return data;
}

/**
 * @param {{ monthly_token_limit: number, tokens_used: number }} profile
 */
export function isQuotaExhausted(profile) {
  return profile.tokens_used >= profile.monthly_token_limit;
}

/**
 * @param {string} userId
 * @param {number} currentUsed
 * @param {number} limit
 * @param {number} addedTokens
 */
export async function applyTokenUsage(userId, currentUsed, limit, addedTokens) {
  const tokensUsed = Math.min(limit, currentUsed + Math.max(0, addedTokens));
  await supabaseAdmin.from('users').update({ tokens_used: tokensUsed }).eq('id', userId);
  return tokensUsed;
}

/**
 * Count documents created this UTC month. Prefer this over a denormalized counter.
 * @param {string} userId
 * @param {Date} [now]
 */
export async function countDocumentsThisMonth(userId, now = new Date()) {
  const { count, error } = await supabaseAdmin
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', startOfUtcMonth(now).toISOString());

  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * @param {{ plan: string }} profile
 * @param {number} documentsThisMonth
 * @returns {string | null} error message when blocked
 */
export function documentCapError(profile, documentsThisMonth) {
  const config = getPlanConfig(profile.plan);
  if (!config.canGenerateDocuments) {
    return 'Document generation is not available on your plan. Upgrade for a stronger pass-rate model and higher limits.';
  }
  if (documentsThisMonth >= config.monthlyDocumentLimit) {
    return `Monthly document limit reached (${config.monthlyDocumentLimit} on the ${config.label} plan). Upgrade for a stronger pass-rate model and higher limits.`;
  }
  return null;
}
