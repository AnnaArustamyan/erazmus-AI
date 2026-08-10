/**
 * @deprecated Prefer services/aiProvider.js — kept as thin Moonshot helpers for scripts/tests.
 */
import { env, isMoonshotConfigured } from './env.js';
import {
  completeOpenAiCompatibleChat,
  streamOpenAiCompatibleChat,
} from './openaiCompatible.js';

export async function streamChatCompletion(params) {
  if (!isMoonshotConfigured()) {
    throw new Error('MOONSHOT_API_KEY is not configured');
  }
  return streamOpenAiCompatibleChat({
    baseUrl: env.moonshotBaseUrl,
    apiKey: env.moonshotApiKey,
    model: params.model || env.moonshotModel,
    messages: params.messages,
    temperature: params.temperature,
    onDelta: params.onDelta,
    onUsage: params.onUsage,
    providerLabel: 'Moonshot',
  });
}

export async function completeChat(params) {
  if (!isMoonshotConfigured()) {
    throw new Error('MOONSHOT_API_KEY is not configured');
  }
  return completeOpenAiCompatibleChat({
    baseUrl: env.moonshotBaseUrl,
    apiKey: env.moonshotApiKey,
    model: params.model || env.moonshotModel,
    messages: params.messages,
    temperature: params.temperature,
    providerLabel: 'Moonshot',
  });
}
