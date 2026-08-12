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
