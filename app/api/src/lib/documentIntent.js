const DOC_NOUN =
  /\b(application|grant application|proposal|ka153|ka1\b|document|draft)\b/i;
const CREATE_VERB = /\b(generate|draft|write|create|prepare|produce|build|start)\b/i;
const REVISE_VERB =
  /\b(update|revise|change|edit|rewrite|expand|shorten|add|fix|improve|strengthen|replace|fill in|tweak|adjust|expand on)\b/i;
const SECTION =
  /\b(relevance|design|management|partnership|who|where|when|what & how|objectives?|activit(?:y|ies)|methodology|impact|dissemination|partners?|timeline|annex(?:es)?|needs analysis|work packages?)\b/i;
const QUESTION =
  /^(how (do|can|should|to)|what (is|are|does|do)|why |can you explain|tell me (about|how)|who (is|are) you)\b/i;

export const HANDOFF_INSTRUCTION = `The user asked to generate a full application. Do NOT draft a PDF, dump a section skeleton, or write Who / Where / When / What & How.
List the facts still missing as a short checklist (occupational field, evidenced need, who takes part and how they are selected, what they will do, host/partners, assessment).
Then tell them: the grant questionnaire is the reliable path; they can also use Generate from this thread — unknown facts will be marked as gaps, not invented.`;

/**
 * Decide whether this user turn should revise an open document, hand off to
 * explicit generate / questionnaire, or stay in ordinary chat.
 * Chat never auto-creates a PDF from regex.
 *
 * @param {string} message
 * @param {{ hasDocument?: boolean }} [options]
 * @returns {'handoff' | 'revise' | 'chat'}
 */
export function detectDocumentAction(message, options = {}) {
  const text = (message || '').trim();
  if (!text) return 'chat';

  const hasDocument = Boolean(options.hasDocument);
  const isQuestion = QUESTION.test(text);
  const wantsCreate = CREATE_VERB.test(text) && DOC_NOUN.test(text) && !isQuestion;
  const wantsRevise =
    hasDocument &&
    !isQuestion &&
    (REVISE_VERB.test(text) ||
      SECTION.test(text) ||
      (DOC_NOUN.test(text) && REVISE_VERB.test(text)));

  if (hasDocument && (wantsCreate || wantsRevise)) return 'revise';
  if (wantsCreate) return 'handoff';
  return 'chat';
}

export function documentChatNotice(mode) {
  return mode === 'revise'
    ? 'Updated the PDF draft in the canvas on the right. Tell me which section to change next.'
    : 'I drafted the application PDF in the canvas on the right. Review it there, download it, or tell me which section to change.';
}
