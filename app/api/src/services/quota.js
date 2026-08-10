import { supabaseAdmin } from '../config/supabase.js';

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
