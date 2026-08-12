import { env, isMoonshotConfigured, isOpenAiConfigured } from '../config/env.js';
import {
  completeOpenAiCompatibleChat,
  streamOpenAiCompatibleChat,
} from '../config/openaiCompatible.js';
import { getPlanConfig } from '../lib/plans.js';

/**
 * @typedef {{
 *   id: 'openai' | 'moonshot',
 *   label: string,
 *   model: string,
 *   baseUrl: string,
 *   apiKey: string,
 * }} AiProviderConfig
 */

/**
 * @param {string | null | undefined} plan
 * @returns {AiProviderConfig}
 */
export function resolveProviderForPlan(plan) {
  const config = getPlanConfig(plan);

  if (config.provider === 'openai') {
    return {
      id: 'openai',
      label: 'OpenAI',
      model: env.openaiModel,
      baseUrl: env.openaiBaseUrl,
      apiKey: env.openaiApiKey,
    };
  }

  return {
    id: 'moonshot',
    label: 'Moonshot',
    model: env.moonshotModel,
    baseUrl: env.moonshotBaseUrl,
    apiKey: env.moonshotApiKey,
  };
}

/**
 * @param {string | null | undefined} plan
 */
export function isProviderConfiguredForPlan(plan) {
  const provider = resolveProviderForPlan(plan);
  if (provider.id === 'openai') return isOpenAiConfigured();
  return isMoonshotConfigured();
}

/**
 * Stream chat using the provider for the user's plan.
 * @param {{
 *   plan: string | null | undefined,
 *   messages: {role: string, content: string}[],
 *   temperature?: number,
 *   onDelta?: (chunk: string) => void,
 *   onUsage?: (usage: { total_tokens?: number }) => void,
 * }} params
 */
export async function streamChatForPlan({
  plan,
  messages,
  temperature,
  onDelta,
  onUsage,
  signal,
}) {
  const provider = resolveProviderForPlan(plan);
  if (!isProviderConfiguredForPlan(plan)) {
    throw new Error(`${provider.label} is not configured for this plan`);
  }

  await streamOpenAiCompatibleChat({
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey,
    model: provider.model,
    messages,
    temperature,
    onDelta,
    onUsage,
    providerLabel: provider.label,
    signal,
  });

  return provider;
}

/**
 * Non-streaming completion using the provider for the user's plan.
 * Free → Luna; paid → Moonshot. Same pass-rate prompts at the call site.
 */
export async function completeChatForPlan({ plan, messages, temperature }) {
  const provider = resolveProviderForPlan(plan);
  if (!isProviderConfiguredForPlan(plan)) {
    throw new Error(`${provider.label} is not configured for this plan`);
  }

  const result = await completeOpenAiCompatibleChat({
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey,
    model: provider.model,
    messages,
    temperature,
    providerLabel: provider.label,
  });

  return { ...result, provider };
}
