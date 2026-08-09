import type { AIAgent } from '../ErasmusChatWorkspace.types'

export const DEFAULT_AGENTS: AIAgent[] = [
  {
    id: 'compliance',
    name: 'Compliance Officer',
    description: 'Checks your application against the Erasmus+ Programme Guide.',
  },
  {
    id: 'budget',
    name: 'Budget Agent',
    description: 'Calculates travel bands, per-diems and grant ceilings.',
  },
  {
    id: 'partner-search',
    name: 'Partner Search',
    description: 'Finds and drafts outreach to potential partner organisations.',
  },
  {
    id: 'report-writer',
    name: 'Report Writing',
    description: 'Drafts interim and final dissemination reports.',
  },
]

export const DEFAULT_TOKENS_PER_MESSAGE = 500

export function formatTokens(value: number): string {
  return new Intl.NumberFormat('en-US').format(Math.max(0, Math.round(value)))
}
