/**
 * Model-agnostic quality gate for generated plans and applications.
 *
 * Weak models (and over-long prompts) will pad a thin brief into a full
 * template of "—" placeholders. That must never become a downloadable PDF.
 */

export const GENERIC_QUALITY_CONSTRAINTS = `Quality constraints (all actions, all models):
- Write only from facts the user supplied. Do not invent partners, dates, occupational fields, learning outcomes, or needs evidence.
- Do not fill unknown fields with "—" or tables of blanks. If too much is unknown, output a short "Not ready to draft" note listing blockers — not a fake full document.
- Do not label KA121 unless the user said the organisation holds Erasmus accreditation. KA1 VET without accreditation is usually KA122.
- Do not assume KA153 / youth workers unless the user said the participants are youth workers.
- A slogan ("greener earth", "innovative", "holistic") is not an objective. Need → objective → activity → learning outcome → assessment → impact must be one chain with the same numbers.
- Prefer one specific occupational problem over a global theme.`;

const PLACEHOLDER_RE = /(?:—|-\s*$|\bare:\s*[—\-]\s*$|not yet (?:defined|sufficiently)|cannot be stated|the following (?:information|elements|details|selection details) (?:is|are))/gim;
const SLOGAN_RE =
  /\b(greener earth|a better world|innovative|holistic|transformative|empower(?:ing|ment)? young people|raise awareness)\b/gi;

const BLOCKER_CHECKS = [
  {
    id: 'occupational_field',
    test: (text) =>
      !/\b(vet|vocational|hospitality|tourism|nurs(?:e|ing)|construction|it\b|digital|youth work|teacher|school|higher education|hei|student)\b/i.test(
        text,
      ),
    gap: 'Name the occupational / education field (e.g. VET hospitality, youth work, school education) — not only a theme like “green”.',
  },
  {
    id: 'specific_need',
    test: (text) =>
      !/\b(waste|need|gap|shortage|problem|barrier|competence|skill gap|unemployment|inclusion|drop-?out)\b/i.test(
        text,
      ),
    gap: 'State one specific problem the mobility or partnership will address, with how you know (method, who you asked).',
  },
  {
    id: 'who_takes_part',
    test: (text) => !/\b(\d+\s+(learners?|students?|pupils|staff|teachers?|youth workers?|participants?)|participants?)\b/i.test(text),
    gap: 'Who takes part: role (learners / staff / youth workers), number, and how they are selected (criteria, not only “interviews”).',
  },
  {
    id: 'concrete_activity',
    test: (text) =>
      !/\b(workshop|job[- ]shadow|training course|placement|mobility|work package|timetable|session|internship|exchange)\b/i.test(
        text,
      ),
    gap: 'What people will physically do, day by day or by work package — not “learn from institutes”.',
  },
  {
    id: 'host_or_partner',
    test: (text) =>
      !/\b(receiv(?:e|ing)|host|partner|sending|consortium|accreditation)\b/i.test(text),
    gap: 'Named sending/receiving organisations (or a clear plan to find them) and who supervises learning.',
  },
];

/**
 * @param {string} markdown
 * @returns {string}
 */
export function stripMarkdownFence(markdown) {
  let text = (markdown || '').trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:markdown|md)?\s*/i, '').replace(/\s*```$/, '').trim();
  }
  return text;
}

function wordCount(text) {
  return (text || '').trim().split(/\s+/).filter(Boolean).length;
}

function placeholderCount(text) {
  const matches = text.match(/—/g) || [];
  const phraseMatches = text.match(PLACEHOLDER_RE) || [];
  return Math.max(matches.length, phraseMatches.length);
}

function sloganCount(text) {
  return (text.match(SLOGAN_RE) || []).length;
}

/**
 * @param {string} sourceText
 * @returns {{ ready: boolean, gaps: string[], knownFacts: string[], wordCount: number }}
 */
export function assessBrief(sourceText) {
  const text = (sourceText || '').trim();
  const words = wordCount(text);
  const gaps = BLOCKER_CHECKS.filter((check) => check.test(text)).map((check) => check.gap);
  const knownFacts = [];
  const countMatch = text.match(/(\d+)\s+(learners?|students?|pupils|staff|teachers?|youth workers?|participants?)/i);
  if (countMatch) knownFacts.push(`${countMatch[1]} ${countMatch[2].toLowerCase()}`);
  const countryMatch = text.match(
    /\b(albania|armenia|georgia|portugal|spain|italy|romania|germany|france|poland|greece|turkey|ukraine)\b/i,
  );
  if (countryMatch) knownFacts.push(`location mentioned: ${countryMatch[1]}`);
  const durationMatch = text.match(/\b(\d+\s+(?:days?|weeks?|months?))\b/i);
  if (durationMatch) knownFacts.push(`duration: ${durationMatch[1]}`);

  const tooThin = words < 25;
  return {
    ready: !tooThin && gaps.length <= 3,
    gaps: tooThin
      ? [
          'The brief is too short to draft from. Add organisations, who takes part, the specific need, and what they will do.',
          ...gaps,
        ]
      : gaps,
    knownFacts,
    wordCount: words,
  };
}

/**
 * @param {string} markdown
 * @param {{ sourceText?: string, kind?: 'plan' | 'application' }} [options]
 */
export function assessGeneratedDraft(markdown, options = {}) {
  const text = stripMarkdownFence(markdown);
  const source = options.sourceText || '';
  const words = wordCount(text);
  const placeholders = placeholderCount(text);
  const slogans = sloganCount(text);
  const hollow =
    /not yet sufficiently developed|not yet a (?:project )?strategy|too generic|current brief is not/i.test(
      text,
    );
  const gaps = [];

  if (words < 80) {
    gaps.push('The draft is too short to be a strategy or application.');
  }
  if (placeholders >= 10) {
    gaps.push(
      `The draft is mostly placeholders (${placeholders} gaps). A National Agency cannot score empty sections. Add facts, then generate again.`,
    );
  }
  if (hollow) {
    gaps.push(
      'The model itself says this is still a concept. Do not export it as a plan or application.',
    );
  }
  if (words > 400 && placeholders >= 8) {
    gaps.push('A long document of blanks is worse than a short gap list. Do not pad unknown sections.');
  }
  if (slogans >= 2 && placeholders >= 6) {
    gaps.push('Theme language (“greener earth”, “innovative”) is standing in for objectives and learning outcomes.');
  }

  const claimsKa121 = /\bKA121\b/i.test(text);
  const sourceHasAccreditation = /accredit/i.test(source);
  if (claimsKa121 && !sourceHasAccreditation) {
    gaps.push(
      'Do not call this KA121 unless the organisation holds Erasmus accreditation in that field. Without accreditation the short-term route is usually KA122.',
    );
  }

  const notReadyHeading = /^#\s+not ready/i.test(text);
  if (notReadyHeading) {
    gaps.push('The draft correctly says it is not ready. Add facts before exporting a PDF.');
  }

  const uniqueGaps = [...new Set(gaps)];
  const ready =
    Boolean(text) &&
    words >= 80 &&
    placeholders < 10 &&
    !hollow &&
    !notReadyHeading &&
    !(claimsKa121 && !sourceHasAccreditation);

  return {
    ready,
    placeholderCount: placeholders,
    wordCount: words,
    gaps: uniqueGaps,
    knownFacts: assessBrief(source).knownFacts,
  };
}

/**
 * @param {{ gaps: string[] }} assessment
 * @param {'plan' | 'application'} [kind]
 */
export function notReadyError(assessment, kind = 'plan') {
  const noun = kind === 'application' ? 'application PDF' : 'strategy PDF';
  return `This is not ready to export as a ${noun}. Add the missing facts — a National Agency would reject a document this thin.`;
}

/**
 * @param {{ gaps: string[] }} assessment
 */
export function toNotReadyPayload(assessment, kind = 'plan') {
  return {
    error: notReadyError(assessment, kind),
    code: 'DRAFT_NOT_READY',
    gaps: assessment.gaps,
    knownFacts: assessment.knownFacts || [],
  };
}

/**
 * @param {{ gaps: string[] }} assessment
 */
export function notReadyChatNotice(assessment) {
  const lines = (assessment.gaps || []).slice(0, 8).map((gap) => `- ${gap}`);
  return [
    'I did not save a PDF. The draft was still a concept (too many unknowns / placeholders), and exporting it would look complete while scoring badly.',
    '',
    'Add these before generating again:',
    ...lines,
    '',
    'A slogan is not an objective. Need → activity → learning outcome → assessment → impact has to be one chain.',
  ].join('\n');
}
