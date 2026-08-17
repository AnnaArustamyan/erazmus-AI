import { readUsageTotalTokens } from '../lib/tokenUsage.js';

/**
 * @param {{
 *   baseUrl: string,
 *   apiKey: string,
 *   model: string,
 *   messages: {role: string, content: string}[],
 *   temperature?: number,
 *   onDelta?: (chunk: string) => void,
 *   onUsage?: (usage: { total_tokens?: number }) => void,
 *   providerLabel?: string,
 * }} params
 */
export async function streamOpenAiCompatibleChat({
  baseUrl,
  apiKey,
  model,
  messages,
  temperature = 0.3,
  onDelta,
  onUsage,
  providerLabel = 'AI provider',
  signal,
}) {
  if (!apiKey) {
    throw new Error(`${providerLabel} API key is not configured`);
  }

  const body = {
    model,
    messages,
    stream: true,
    stream_options: { include_usage: true },
  };
  // Some OpenAI models (e.g. gpt-5.6-luna) only allow the default temperature.
  if (typeof temperature === 'number' && !String(model).toLowerCase().includes('luna')) {
    body.temperature = temperature;
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok || !response.body) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`${providerLabel} API error ${response.status}: ${errorBody}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const consumeLine = (line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) return;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === '[DONE]') return;

    let json;
    try {
      json = JSON.parse(payload);
    } catch {
      return;
    }

    const delta = json.choices?.[0]?.delta?.content;
    if (delta) onDelta?.(delta);
    if (json.usage) {
      onUsage?.({
        ...json.usage,
        total_tokens: readUsageTotalTokens(json.usage),
      });
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) consumeLine(line);
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    for (const line of buffer.split('\n')) consumeLine(line);
  }
}

/**
 * @param {{
 *   baseUrl: string,
 *   apiKey: string,
 *   model: string,
 *   messages: {role: string, content: string}[],
 *   temperature?: number,
 *   providerLabel?: string,
 * }} params
 * @returns {Promise<{ content: string, totalTokens: number }>}
 */
export async function completeOpenAiCompatibleChat({
  baseUrl,
  apiKey,
  model,
  messages,
  temperature = 0.2,
  providerLabel = 'AI provider',
}) {
  if (!apiKey) {
    throw new Error(`${providerLabel} API key is not configured`);
  }

  const body = {
    model,
    messages,
    stream: false,
  };
  if (typeof temperature === 'number' && !String(model).toLowerCase().includes('luna')) {
    body.temperature = temperature;
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`${providerLabel} API error ${response.status}: ${errorBody}`);
  }

  const json = await response.json();
  const content = json.choices?.[0]?.message?.content ?? '';
  const totalTokens = readUsageTotalTokens(json.usage);
  return { content, totalTokens };
}
