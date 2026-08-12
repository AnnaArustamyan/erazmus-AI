import { supabaseAdmin } from '../config/supabase.js';
import { getPlanConfig, startOfUtcMonth } from '../lib/plans.js';

/**
 * @param {string} userId
 * @returns {Promise<{ plan: string, monthly_token_limit: number, tokens_used: number } | null>}
 */
export async function getUserQuota(userId) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('plan, monthly_token_limit, tokens_used')
    .eq('id', userId)
    .single();

  if (error || !data) return null;
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
