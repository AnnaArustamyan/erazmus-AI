/**
 * Minimal AI client for the schema-sync tool.
 * Mirrors app/api/src/config/openaiCompatible.js but non-streaming only.
 */

import { createRequire } from 'module'

const require = createRequire(import.meta.url)

export async function complete({ messages, temperature = 0.1 }) {
  const provider = process.env.AI_PROVIDER ?? 'moonshot'

  let baseUrl, apiKey, model, providerLabel

  if (provider === 'openai') {
    baseUrl = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1'
    apiKey = process.env.OPENAI_API_KEY
    model = process.env.OPENAI_MODEL ?? 'gpt-4o'
    providerLabel = 'OpenAI'
  } else {
    baseUrl = process.env.MOONSHOT_BASE_URL ?? 'https://api.moonshot.ai/v1'
    apiKey = process.env.MOONSHOT_API_KEY
    model = process.env.MOONSHOT_MODEL ?? 'moonshot-v1-128k'
    providerLabel = 'Moonshot'
  }

  if (!apiKey) throw new Error(`${providerLabel} API key not set. Copy .env.example to .env and fill it in.`)

  const body = { model, messages, stream: false }
  if (typeof temperature === 'number' && !model.includes('luna')) {
    body.temperature = temperature
  }

  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`${providerLabel} API error ${res.status}: ${err}`)
  }

  const json = await res.json()
  const content = json.choices?.[0]?.message?.content ?? ''
  const totalTokens = json.usage?.total_tokens ?? 0
  return { content, totalTokens }
}

/**
 * Parse JSON from model output — strips markdown code fences if present.
 */
export function parseJsonResponse(content) {
  // Strip ```json ... ``` or ``` ... ``` fences
  const stripped = content
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim()
  return JSON.parse(stripped)
}
