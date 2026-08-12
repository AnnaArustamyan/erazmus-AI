/**
 * Plan limits and feature flags.
 *
 * Free still costs us money (we pay OpenAI per token), so the free tier is
 * intentionally small: enough to try the product, not enough to run real
 * grant drafting for free. Document generation is available on every plan
 * and gated by token quota + monthly document caps — never “Free cannot generate.”
 */

export const PLANS = {
  free: {
    id: 'free',
    label: 'Free',
    /** ~a few short chats per month — Luna still bills per token */
    monthlyTokenLimit: 20_000,
    provider: 'openai',
    /** OpenAI GPT-5.6 Luna (ChatGPT Free–class / cheapest API tier) */
    aiTier: 'standard',
    maxHistoryMessages: 8,
    canGenerateDocuments: true,
    monthlyDocumentLimit: 3,
    canUseAdvancedAgents: true,
  },
  basic: {
    id: 'basic',
    label: 'Basic',
    monthlyTokenLimit: 500_000,
    provider: 'moonshot',
    aiTier: 'advanced',
    maxHistoryMessages: 20,
    canGenerateDocuments: true,
    monthlyDocumentLimit: 20,
    canUseAdvancedAgents: true,
  },
  pro: {
    id: 'pro',
    label: 'Pro',
    monthlyTokenLimit: 2_000_000,
    provider: 'moonshot',
    aiTier: 'advanced',
    maxHistoryMessages: 40,
    canGenerateDocuments: true,
    monthlyDocumentLimit: 100,
    canUseAdvancedAgents: true,
  },
  enterprise: {
    id: 'enterprise',
    label: 'Enterprise',
    monthlyTokenLimit: 10_000_000,
    provider: 'moonshot',
    aiTier: 'advanced',
    maxHistoryMessages: 40,
    canGenerateDocuments: true,
    monthlyDocumentLimit: 100,
    canUseAdvancedAgents: true,
  },
};

/**
 * @param {string | null | undefined} plan
 */
export function getPlanConfig(plan) {
  const key = typeof plan === 'string' ? plan.toLowerCase() : 'free';
  return PLANS[key] || PLANS.free;
}

/**
 * @param {string | null | undefined} plan
 */
export function planFeatures(plan) {
  const config = getPlanConfig(plan);
  return {
    plan: config.id,
    aiTier: config.aiTier,
    provider: config.provider,
    canGenerateDocuments: config.canGenerateDocuments,
    monthlyDocumentLimit: config.monthlyDocumentLimit,
    canUseAdvancedAgents: config.canUseAdvancedAgents,
    monthlyTokenLimit: config.monthlyTokenLimit,
  };
}

/**
 * UTC start of the current calendar month (for monthly document caps).
 * @param {Date} [now]
 */
export function startOfUtcMonth(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}
