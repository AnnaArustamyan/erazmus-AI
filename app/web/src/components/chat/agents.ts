import type { AIAgent } from '../ErasmusChatWorkspace.types'

export const DEFAULT_AGENT_ID = 'grant' as const

export const DEFAULT_AGENTS: AIAgent[] = [
  {
    id: 'grant',
    name: 'Erasmus AI',
    description: 'Helps you write an Erasmus+ application that can pass National Agency review.',
  },
]

export const DEFAULT_TOKENS_PER_MESSAGE = 500

export function formatTokens(value: number): string {
  return new Intl.NumberFormat('en-US').format(Math.max(0, Math.round(value)))
}

/** Rough live estimate until the provider reports actual usage. */
export function estimateTokensFromText(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return Math.max(1, Math.ceil(trimmed.length / 4))
}
