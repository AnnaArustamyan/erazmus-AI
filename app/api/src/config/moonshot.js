import { env, isMoonshotConfigured } from './env.js';

/**
 * Streams a chat completion, invoking onDelta with each text chunk as it
 * arrives and onUsage once the final usage totals are known.
 * @param {{
 *   messages: {role: string, content: string}[],
 *   model?: string,
 *   temperature?: number,
 *   onDelta?: (chunk: string) => void,
 *   onUsage?: (usage: { total_tokens?: number, prompt_tokens?: number, completion_tokens?: number }) => void,
 * }} params
 * @returns {Promise<void>}
 */
export async function streamChatCompletion({
  messages,
  model = env.moonshotModel,
  temperature = 0.3,
  onDelta,
  onUsage,
}) {
  if (!isMoonshotConfigured()) {
    throw new Error('MOONSHOT_API_KEY is not configured');
  }

  const response = await fetch(`${env.moonshotBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.moonshotApiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      stream: true,
      stream_options: { include_usage: true },
    }),
  });

  if (!response.ok || !response.body) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`Moonshot API error ${response.status}: ${errorBody}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;

      let json;
      try {
        json = JSON.parse(payload);
      } catch {
        continue;
      }

      const delta = json.choices?.[0]?.delta?.content;
      if (delta) onDelta?.(delta);
      if (json.usage) onUsage?.(json.usage);
    }
  }
}

/**
 * Non-streaming chat completion for document drafting and similar jobs.
 * @param {{
 *   messages: {role: string, content: string}[],
 *   model?: string,
 *   temperature?: number,
 * }} params
 * @returns {Promise<{ content: string, totalTokens: number }>}
 */
export async function completeChat({
  messages,
  model = env.moonshotModel,
  temperature = 0.2,
}) {
  if (!isMoonshotConfigured()) {
    throw new Error('MOONSHOT_API_KEY is not configured');
  }

  const response = await fetch(`${env.moonshotBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.moonshotApiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`Moonshot API error ${response.status}: ${errorBody}`);
  }

  const json = await response.json();
  const content = json.choices?.[0]?.message?.content ?? '';
  const totalTokens = json.usage?.total_tokens ?? 0;
  return { content, totalTokens };
}
