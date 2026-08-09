/** Section headings used for Erasmus+ application drafts (ported from legacy wizard). */
export const APPLICATION_SECTIONS = [
  { id: 'who', title: 'Who' },
  { id: 'where', title: 'Where' },
  { id: 'when', title: 'When' },
  { id: 'what-how', title: 'What & How' },
];

export const APPLICATION_DRAFT_SYSTEM_PROMPT = `You are an Erasmus+ grant application drafting assistant.
Given a conversation between a user and specialized agents, produce a structured grant application draft in Markdown.

Rules:
- Output Markdown only (no code fences wrapping the whole document).
- Start with a single H1 title line: "# <Project title>"
- Then include exactly these H2 sections in order: "## Who", "## Where", "## When", "## What & How"
- Under What & How, include H3 subsections: Objectives, Activities, Methodology, Expected results, Impact & dissemination
- Use only information present in the conversation; if something is unknown write "—"
- Be concise, professional, and suitable for an Erasmus+ National Agency reader.
- Do not invent partners, budgets, or dates that were not discussed.`;

/**
 * Builds a minimal empty application skeleton (for tests / fallbacks).
 * @param {string} [title]
 */
export function emptyApplicationMarkdown(title = 'Untitled Project') {
  return `# ${title}

## Who
- **Applicant:** —
- **Type:** —
- **Country:** —
- **Contact:** —
- **Partners:** —
- **Target group:** —

## Where
- **Countries:** —
- **Main venue:** —
- **Mobility locations:** —
- **Virtual activities:** —

## When
- **Duration:** —
- **Timeline:** —
- **Milestones:** —

## What & How
### Objectives
—

### Activities
—

### Methodology
—

### Expected results
—

### Impact & dissemination
—
`;
}

/**
 * Extract a title from generated markdown (first H1), with fallback.
 * @param {string} markdown
 * @param {string} [fallback]
 */
export function extractTitleFromMarkdown(markdown, fallback = 'Erasmus+ Application') {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() || fallback;
}
