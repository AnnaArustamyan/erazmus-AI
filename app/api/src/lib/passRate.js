/**
 * Pass-rate knowledge injection (server-side only).
 *
 * Youth (KA153): derived/rules.md + Guide youth-worker excerpts + assessments.
 * Other families: thin packs under derived/families/. Never inject KA153
 * “youth workers” rules into KA152, KA154, KA121/122/131/210/220.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GENERIC_QUALITY_CONSTRAINTS } from './draftQuality.js';
import { loadSkillBody } from './skills.js';
import { familyForAction, inferActionCode, schemaInstruction } from './applicationSchema.js';

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

  const familyDir = path.join(dir, 'families');
  const familyPacks = {
    ka1_education: clip(readUtf8(path.join(familyDir, 'ka1-education.md')), MAX_RULES_CHARS),
    ka2: clip(readUtf8(path.join(familyDir, 'ka2.md')), MAX_RULES_CHARS),
  };

  cached = {
    dir,
    rules,
    guide,
    guideSections: splitSections(guide),
    assessments,
    familyPacks,
  };
  return cached;
}

/**
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

function isYouthWorkerAssessment(text) {
  return /\byouth workers?\b/i.test(text) || /\bKA153\b/i.test(text) || /\bMobility of youth workers\b/i.test(text);
}

/**
 * @param {string} queryText
 * @param {{ compact?: boolean, actionCode?: string | null, familyId?: string | null }} [options]
 */
export function retrievePassRateContext(queryText, options = {}) {
  const pack = loadPack();
  const queryTokens = tokenize(queryText);
  const resolvedAction = options.actionCode || inferActionCode(queryText);
  const familyId = options.familyId || familyForAction(resolvedAction)?.id || null;
  const ka153Pack = resolvedAction === 'KA153';

  const award =
    pack.guideSections.find((s) => /award criteria/i.test(s.title)) ||
    pack.guideSections[0];

  const guideRanked = ka153Pack
    ? pack.guideSections
        .map((s) => ({ ...s, score: scoreText(s.text, queryTokens) }))
        .filter((s) => s.score > 0 && s.title !== award?.title)
        .sort((a, b) => b.score - a.score)
        .slice(0, 2)
    : [];

  const eligibleAssessments = ka153Pack
    ? pack.assessments
    : pack.assessments.filter((s) => !isYouthWorkerAssessment(s.text));

  const failureRanked = eligibleAssessments
    .map((s) => ({ ...s, score: scoreText(s.text, queryTokens) }))
    .sort((a, b) => b.score - a.score);

  const failures = ka153Pack
    ? (failureRanked[0]?.score > 0 ? failureRanked.slice(0, 2) : pack.assessments.slice(0, 2)).map(
        (s) => ({ id: s.id, text: clip(s.text, options.compact ? 400 : 1400) }),
      )
    : [];

  const guideParts = ka153Pack
    ? [award?.text, ...guideRanked.map((s) => s.text)].filter(Boolean)
    : [];

  const familyRules =
    familyId === 'ka1_education'
      ? pack.familyPacks.ka1_education
      : familyId === 'ka2'
        ? pack.familyPacks.ka2
        : ka153Pack
          ? pack.rules
          : '';

  if (options.compact) {
    return {
      guideYear: GUIDE_YEAR,
      guideVersion: GUIDE_VERSION_LABEL,
      rules: clip(ka153Pack ? pack.rules : familyRules, 1800),
      familyRules: familyRules ? clip(familyRules, 1800) : '',
      guideExcerpts: '',
      failureModes: '',
      matchedAssessmentIds: [],
      familyId,
    };
  }

  return {
    guideYear: GUIDE_YEAR,
    guideVersion: GUIDE_VERSION_LABEL,
    rules: ka153Pack ? pack.rules : familyRules,
    familyRules,
    guideExcerpts: clip(guideParts.join('\n\n'), MAX_GUIDE_CHARS),
    failureModes: clip(
      failures.map((f) => `### ${f.id}\n${f.text}`).join('\n\n'),
      MAX_FAILURE_CHARS,
    ),
    matchedAssessmentIds: failures.map((f) => f.id),
    familyId,
  };
}

/**
 * KA153 youth-worker pack only for confirmed or recommended KA153.
 * Project-plan stays generic unless the brief is clearly youth workers.
 * @param {{ skillName?: string | null, actionCode?: string | null, queryText?: string }} params
 */
export function shouldInjectKa153Pack({ skillName, actionCode, queryText } = {}) {
  if (skillName === 'project-plan') {
    return /\byouth workers?\b/i.test(queryText || '');
  }
  const resolved = actionCode || inferActionCode(queryText);
  return resolved === 'KA153';
}

/**
 * @param {{
 *   agentSystemPrompt?: string,
 *   queryText: string,
 *   latestUserMessage?: string,
 *   mode?: 'chat' | 'document',
 *   skillName?: string | null,
 *   actionCode?: string | null,
 * }} params
 */
export function buildPassRateSystemPrompt({
  agentSystemPrompt = '',
  queryText,
  latestUserMessage,
  mode = 'chat',
  skillName,
  actionCode,
}) {
  const resolvedSkill =
    skillName === undefined
      ? mode === 'document'
        ? 'application-draft'
        : null
      : skillName;
  const resolvedAction = actionCode || inferActionCode(queryText);
  const family = familyForAction(resolvedAction);
  const injectKa153 = shouldInjectKa153Pack({
    skillName: resolvedSkill,
    actionCode: resolvedAction,
    queryText,
  });
  const compact =
    (mode === 'chat' && isLightweightChatQuery(latestUserMessage ?? queryText)) ||
    (!injectKa153 && !family);
  const ctx = retrievePassRateContext(queryText, {
    compact,
    actionCode: resolvedAction,
    familyId: family?.id,
  });
  const skillBody = resolvedSkill ? loadSkillBody(resolvedSkill) : '';
  const role = skillBody || agentSystemPrompt;

  const structureBlock =
    mode === 'chat' && resolvedSkill !== 'application-draft' && resolvedSkill !== 'project-plan'
      ? `\nIn chat: never dump a blank application skeleton. Ask questions or draft the one section they asked for.\n`
      : '';

  const extra = [];
  extra.push(`--- Quality constraints (always apply; all models) ---\n${GENERIC_QUALITY_CONSTRAINTS}`);

  if (resolvedSkill === 'application-draft') {
    extra.push(
      `--- Application form sections ---\n${schemaInstruction(resolvedAction)}`,
    );
  }

  if (injectKa153) {
    extra.push(`--- Pass-rate rules (always apply; hard constraints) ---\n${ctx.rules}`);
    if (ctx.guideExcerpts) {
      extra.push(`--- Relevant Programme Guide excerpts (${ctx.guideVersion}) ---\n${ctx.guideExcerpts}`);
    }
    if (ctx.failureModes) {
      extra.push(
        `--- Failure modes to avoid (negative examples; internal IDs only; do not copy) ---\n${ctx.failureModes}`,
      );
    }
  } else if (family && family.id !== 'ka1_youth' && ctx.familyRules) {
    extra.push(`--- Action-family constraints (${family.label}) ---\n${ctx.familyRules}`);
  }

  return `${role}

You always operate under constrained Erasmus+ pass-rate rules. Prefer retrieval below over your frozen memory of older Programme Guides. Guide year: ${ctx.guideYear}.
${structureBlock}
${extra.join('\n\n')}

Never mention organisation legal names, official project codes, emails, or people's names. Use internal example IDs (EX-2024-A … EX-2025-E) if you refer to known failure patterns.
Never apply KA153 youth-worker beneficiary rules to KA121, KA122, KA131/171, KA210, or KA220.`;
}

export function getGuideYear() {
  loadPack();
  return GUIDE_YEAR;
}
