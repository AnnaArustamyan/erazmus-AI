/**
 * Pass-rate knowledge injection (server-side only).
 *
 * Canonical: derived/rules.md + Guide youth-worker excerpts + anonymized assessments.
 * Full application PDFs are negative examples and are never loaded here.
 * Do not dump the 456-page Guide or 50–60 page applications into the model.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const GUIDE_YEAR = 2026;
export const GUIDE_VERSION_LABEL = 'Programme Guide 2026 (EN, Version 1, 12/11/2025)';

const MAX_GUIDE_CHARS = 3500;
const MAX_FAILURE_CHARS = 2800;
const MAX_RULES_CHARS = 8000;

const STOP = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'from',
  'are',
  'was',
  'were',
  'not',
  'but',
  'you',
  'your',
  'our',
  'into',
  'about',
  'have',
  'has',
  'had',
  'will',
  'can',
  'should',
  'must',
  'than',
  'then',
  'them',
  'they',
  'their',
  'what',
  'when',
  'where',
  'which',
  'who',
  'how',
  'all',
  'any',
  'each',
  'also',
  'only',
  'more',
  'most',
  'some',
  'such',
  'project',
  'application',
]);

/**
 * @returns {string}
 */
function resolveDerivedDir() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const fromEnv = process.env.KNOWLEDGE_PACK_DIR;
  const candidates = [
    fromEnv,
    path.resolve(here, '../../../resources/derived'),
    path.resolve(here, '../../resources/derived'),
  ].filter(Boolean);

  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'rules.md'))) return dir;
  }
  throw new Error('Pass-rate knowledge pack not found (derived/rules.md)');
}

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function splitSections(markdown) {
  const chunks = [];
  const parts = markdown.split(/\n(?=## )/);
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.length < 40) continue;
    const titleMatch = trimmed.match(/^##\s+(.+)$/m);
    chunks.push({
      title: titleMatch?.[1]?.trim() || 'Excerpt',
      text: trimmed,
    });
  }
  return chunks;
}

function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9+\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

function scoreText(text, queryTokens) {
  if (!queryTokens.length) return 0;
  const hay = text.toLowerCase();
  let score = 0;
  for (const token of queryTokens) {
    if (hay.includes(token)) score += 1;
  }
  return score;
}

function clip(text, max) {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}\n…`;
}

let cached = null;

function loadPack() {
  if (cached) return cached;

  const dir = resolveDerivedDir();
  const rules = clip(readUtf8(path.join(dir, 'rules.md')), MAX_RULES_CHARS);
  const guide = readUtf8(path.join(dir, 'guide-youth-workers.md'));
  const assessmentsDir = path.join(dir, 'assessments');
  const assessmentFiles = fs
    .readdirSync(assessmentsDir)
    .filter((name) => /^EX-\d{4}-[A-Z]\.md$/.test(name))
    .sort();

  const assessments = assessmentFiles.map((name) => {
    const text = readUtf8(path.join(assessmentsDir, name));
    const id = name.replace(/\.md$/, '');
    return { id, title: id, text };
  });

  cached = {
    dir,
    rules,
    guide,
    guideSections: splitSections(guide),
    assessments,
  };
  return cached;
}

/**
 * Short greetings should not pull the full Guide + assessment pack (slow, and
 * the model will dump a blank application). Full retrieval is for drafting.
 * @param {string} latestUserMessage
 */
export function isLightweightChatQuery(latestUserMessage) {
  const t = (latestUserMessage || '').trim();
  if (!t) return true;
  if (t.length > 220) return false;
  return /^(hi|hello|hey|yo|thanks|thank you|ok|okay|please|help|start|get started|how (do i|to)|what (can|do) you|who are you)\b/i.test(
    t,
  );
}

/**
 * Always-on award-criteria excerpt plus top matching Guide + failure-mode notes.
 * @param {string} queryText
 * @param {{ compact?: boolean }} [options]
 */
export function retrievePassRateContext(queryText, options = {}) {
  const pack = loadPack();
  const queryTokens = tokenize(queryText);

  const award =
    pack.guideSections.find((s) => /award criteria/i.test(s.title)) ||
    pack.guideSections[0];

  const guideRanked = pack.guideSections
    .map((s) => ({ ...s, score: scoreText(s.text, queryTokens) }))
    .filter((s) => s.score > 0 && s.title !== award?.title)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  const failureRanked = pack.assessments
    .map((s) => ({ ...s, score: scoreText(s.text, queryTokens) }))
    .sort((a, b) => b.score - a.score);

  const failures = (failureRanked[0]?.score > 0 ? failureRanked.slice(0, 2) : pack.assessments.slice(0, 2)).map(
    (s) => ({ id: s.id, text: clip(s.text, options.compact ? 400 : 1400) }),
  );

  const guideParts = [award?.text, ...guideRanked.map((s) => s.text)].filter(Boolean);

  if (options.compact) {
    return {
      guideYear: GUIDE_YEAR,
      guideVersion: GUIDE_VERSION_LABEL,
      rules: clip(pack.rules, 1800),
      guideExcerpts: '',
      failureModes: '',
      matchedAssessmentIds: [],
    };
  }

  return {
    guideYear: GUIDE_YEAR,
    guideVersion: GUIDE_VERSION_LABEL,
    rules: pack.rules,
    guideExcerpts: clip(guideParts.join('\n\n'), MAX_GUIDE_CHARS),
    failureModes: clip(
      failures.map((f) => `### ${f.id}\n${f.text}`).join('\n\n'),
      MAX_FAILURE_CHARS,
    ),
    matchedAssessmentIds: failures.map((f) => f.id),
  };
}

const DOCUMENT_STRUCTURE = `Output Markdown only (no code fences wrapping the whole document).
Start with a single H1 title line: "# <Project title>"
Then include exactly these H2 sections in order: "## Who", "## Where", "## When", "## What & How"
Under What & How, include H3 subsections: Objectives, Activities, Methodology, Expected results, Impact & dissemination, Annexes (day-by-day session plan; omit APV if no session programme)
Use only information present in the conversation; if something is unknown write "—"
Do not invent partners, budgets, or dates that were not discussed.`;

/**
 * @param {{
 *   agentSystemPrompt?: string,
 *   queryText: string,
 *   mode?: 'chat' | 'document',
 * }} params
 */
export function buildPassRateSystemPrompt({
  agentSystemPrompt = '',
  queryText,
  latestUserMessage,
  mode = 'chat',
}) {
  const compact =
    mode === 'chat' && isLightweightChatQuery(latestUserMessage ?? queryText);
  const ctx = retrievePassRateContext(queryText, { compact });
  const role =
    mode === 'document'
      ? `You are an Erasmus+ grant application drafting assistant. ${GUIDE_VERSION_LABEL}. Drafts must be written to PASS National Agency quality assessment for Mobility of youth workers (KA153 / youth-worker mobility) — not generic LLM prose.`
      : agentSystemPrompt;

  const structureBlock =
    mode === 'document'
      ? `\n${DOCUMENT_STRUCTURE}\n`
      : `\nIn chat: never dump a blank Who / Where / When / What & How application. Ask questions or draft the one section they asked for.\n`;

  const extra = [];
  extra.push(`--- Pass-rate rules (always apply; hard constraints) ---\n${ctx.rules}`);
  if (ctx.guideExcerpts) {
    extra.push(`--- Relevant Programme Guide excerpts (${ctx.guideVersion}) ---\n${ctx.guideExcerpts}`);
  }
  if (ctx.failureModes) {
    extra.push(
      `--- Failure modes to avoid (negative examples; internal IDs only; do not copy) ---\n${ctx.failureModes}`,
    );
  }

  return `${role}

You always operate under constrained Erasmus+ pass-rate rules. Prefer retrieval below over your frozen memory of older Programme Guides. Guide year: ${ctx.guideYear}.
${structureBlock}
${extra.join('\n\n')}

Never mention organisation legal names, official project codes, emails, or people's names. Use internal example IDs (EX-2024-A … EX-2025-E) if you refer to known failure patterns.`;
}

export function getGuideYear() {
  loadPack();
  return GUIDE_YEAR;
}
