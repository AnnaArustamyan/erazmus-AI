/** Award-criteria section lists per Erasmus+ action family. */

import { recommendActionCode } from './actionLock.js';
import { formSchemaInstruction } from './formSchemas.js';

export const ACTION_FAMILIES = {
  ka1_youth: {
    id: 'ka1_youth',
    label: 'KA1 youth (KA152 / KA153 / KA154)',
    actionCodes: ['KA152', 'KA153', 'KA154', 'KA152-154'],
    sections: [
      { id: 'relevance', title: 'Relevance' },
      { id: 'design', title: 'Quality of project design' },
      { id: 'management', title: 'Quality of project management' },
      { id: 'annexes', title: 'Annexes' },
    ],
  },
  ka1_education: {
    id: 'ka1_education',
    label: 'KA1 education mobility (KA121 / KA122 / KA131-171)',
    actionCodes: ['KA121', 'KA122', 'KA131/171'],
    sections: [
      { id: 'objectives', title: 'Objectives and needs' },
      { id: 'participants', title: 'Participants' },
      { id: 'activities', title: 'Activities and learning outcomes' },
      { id: 'recognition', title: 'Recognition and follow-up' },
      { id: 'management', title: 'Management and accreditation' },
    ],
  },
  ka2: {
    id: 'ka2',
    label: 'KA2 partnerships (KA210 / KA220)',
    actionCodes: ['KA210', 'KA220'],
    sections: [
      { id: 'relevance', title: 'Relevance' },
      { id: 'partnership', title: 'Quality of partnership' },
      { id: 'design', title: 'Design and work packages' },
      { id: 'impact', title: 'Impact' },
      { id: 'management', title: 'Management' },
    ],
  },
};

const CODE_TO_FAMILY = Object.fromEntries(
  Object.values(ACTION_FAMILIES).flatMap((family) =>
    family.actionCodes.map((code) => [code, family.id]),
  ),
);

/**
 * @param {string | null | undefined} actionCode
 * @returns {typeof ACTION_FAMILIES[keyof typeof ACTION_FAMILIES] | null}
 */
export function familyForAction(actionCode) {
  if (!actionCode) return null;
  const id = CODE_TO_FAMILY[actionCode.trim()];
  return id ? ACTION_FAMILIES[id] : null;
}

/**
 * Recommend an action from free text. Never treat this as a confirmed lock.
 * @param {string} [text]
 * @returns {string | null}
 */
export function inferActionCode(text) {
  return recommendActionCode(text);
}

/**
 * @param {string | null | undefined} actionCode
 */
export function schemaFor(actionCode) {
  return familyForAction(actionCode)?.sections ?? null;
}

/** Default youth headings (tests / fallbacks). Prefer schemaFor(actionCode). */
export const APPLICATION_SECTIONS = ACTION_FAMILIES.ka1_youth.sections;

/**
 * @param {string | null | undefined} actionCode
 */
export function schemaInstruction(actionCode) {
  const family = familyForAction(actionCode);
  const sections = schemaFor(actionCode);
  if (!family || !sections) {
    return `Action family unknown. Do not guess KA152 vs KA153 vs KA154. Ask the user to confirm the exact action code. Never use Who / Where / When / What & How. Do not invent a blog outline.`;
  }
  const headings = sections.map((s) => `## ${s.title}`).join(', ');
  const familyLine = `Action family: ${family.label}. Action code: ${actionCode}. This code is user-confirmed — do not switch actions.`;
  const fieldBlock = formSchemaInstruction(actionCode);

  const extras = [];
  if (actionCode === 'KA153') {
    extras.push(
      'Match award criteria 30/40/30 (Relevance / Design / Management). Primary participants are youth workers. Annexes must include a day-by-day timetable for every activity (and APV only if a session programme exists). Use only locked confirmed facts.',
    );
  } else if (family?.id === 'ka1_youth') {
    extras.push(
      'Match award criteria 30/40/30 (Relevance / Design / Management). Do not apply KA153 youth-worker beneficiary rules unless the confirmed action is KA153.',
    );
  }
  if (family?.id === 'ka1_education') {
    extras.push(
      'Cover objectives, activities, participants, learning outcomes, and recognition. Do not label KA121 unless the organisation holds Erasmus accreditation.',
    );
  }
  if (family?.id === 'ka2') {
    extras.push(
      'This is a partnership, not a mobility training course. Cover relevance, partnership, design/work packages, impact, and management.',
    );
  }

  return `${familyLine}
Output Markdown only (no code fences wrapping the whole document).
Start with a single H1 title line: "# <Project title>"
Then include exactly these H2 sections in order: ${headings}
The model fills prose inside this structure; it does not invent a blog outline.
Use only supplied facts. Omit a bullet rather than write "—". Never invent partners, dates, or needs evidence.
${extras.join('\n')}${fieldBlock ? `\n${fieldBlock}` : ''}`;
}

export const APPLICATION_DRAFT_SYSTEM_PROMPT = schemaInstruction('KA153');

/**
 * Empty heading skeleton (no dash placeholders).
 * @param {string} [title]
 * @param {string | null} [actionCode]
 */
export function emptyApplicationMarkdown(title = 'Untitled Project', actionCode = 'KA153') {
  const sections = schemaFor(actionCode) || ACTION_FAMILIES.ka1_youth.sections;
  const headings = sections.map((section) => `## ${section.title}\n`).join('\n');
  return `# ${title}\n\n${headings}`;
}

/**
 * @param {string} markdown
 * @param {string} [fallback]
 */
export function extractTitleFromMarkdown(markdown, fallback = 'Erasmus+ Application') {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() || fallback;
}
