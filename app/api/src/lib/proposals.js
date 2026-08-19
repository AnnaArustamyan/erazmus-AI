/**
 * Requirement → candidate → evidence → feasibility → confirmation.
 * AI may invent a PLAN. It may not invent FACTS.
 */

export const PLANNING_COST_PER_LEARNER_MONTH_EUR = 1500;

const FEASIBILITY_CHECKS = [
  'Does the school have enough grant or co-funding for this scale?',
  'Does it have, or can it establish, a host-school relationship?',
  'Can it support accommodation, safeguarding, and supervision?',
  'Are there learners suitable for this mobility?',
  'Does this match the accredited Erasmus objectives?',
];

export function parseBudgetEur(text) {
  const match = String(text || '').match(/€\s*([\d.,]+)/i) || String(text || '').match(/([\d.,]+)\s*(?:€|euros?|eur)\b/i);
  if (!match) return undefined;
  const n = Number.parseInt((match[1] || match[2] || '').replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : undefined;
}

export function parseDurationMonths(text) {
  const match = String(text || '').match(/(\d+)\s*(?:-\s*\d+)?\s*months?/i);
  if (!match) return undefined;
  const n = Number.parseInt(match[1], 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function contextFromAnswers(actionCode, answers = {}, extra = {}) {
  const ctx = { actionCode, firstTime: extra.firstTime !== false, ...extra };
  if (answers.accreditation === 'yes') ctx.accredited = true;
  if (answers.accreditation === 'no') ctx.accredited = false;
  if (answers.field === 'school' || answers.field === 'vet' || answers.field === 'adult') {
    ctx.field = answers.field;
  }
  if (answers.activity_mix === 'learners' || answers.activity_mix === 'staff' || answers.activity_mix === 'both') {
    ctx.mobilityRole = answers.activity_mix;
  }
  const count = Number.parseInt(String(answers.participant_count ?? '').replace(/[^\d]/g, ''), 10);
  if (Number.isFinite(count) && count > 0) ctx.participantCount = count;
  const dest = String(answers.destinations ?? '').trim();
  if (dest) ctx.destinationCountry = dest;
  const need = String(answers.objectives ?? '').trim();
  if (need) ctx.learnerNeed = need;
  const durationText = [answers.learner_activities, answers.summary].filter(Boolean).join(' ');
  ctx.durationMonths = extra.durationMonths ?? parseDurationMonths(durationText) ?? ctx.durationMonths;
  return ctx;
}

export function extractKnownContext(text, answers = {}) {
  const extra = {};
  const duration = parseDurationMonths(text);
  if (duration) extra.durationMonths = duration;
  const budget = parseBudgetEur(text);
  if (budget) extra.budgetEur = budget;
  if (/\bschool education\b|\bschools?\b/i.test(text)) extra.field = extra.field ?? 'school';
  if (/\blearners?\b/i.test(text) && !/\bstaff only\b/i.test(text)) extra.mobilityRole = extra.mobilityRole ?? 'learners';
  if (/\byes\b/i.test(text) && /accredit/i.test(text)) extra.accredited = true;
  if (/\bno\b/i.test(text) && /accredit/i.test(text)) extra.accredited = false;
  return extra;
}

function maxLearnersForBudget(budgetEur, durationMonths) {
  const per = durationMonths * PLANNING_COST_PER_LEARNER_MONTH_EUR;
  if (per <= 0) return 1;
  return Math.max(0, Math.floor(budgetEur / per));
}

export function proposeWorkingScenario(ctx) {
  if (ctx.actionCode !== 'KA121') {
    return {
      actionCode: ctx.actionCode,
      items: [],
      scales: [],
      checks: FEASIBILITY_CHECKS,
      usableAsPlan: false,
      warning:
        'Conservative first-time defaults are defined for KA121. Never invent partners, dates, counts, or needs evidence.',
    };
  }

  const firstTime = ctx.firstTime !== false;
  const durationMonths = ctx.durationMonths;
  const longStay = (durationMonths ?? 0) >= 1;
  const items = [];

  if (ctx.accredited === false) {
    return {
      actionCode: 'KA121',
      items: [],
      scales: [],
      checks: FEASIBILITY_CHECKS,
      usableAsPlan: false,
      warning:
        'KA121 is an accredited funding request. If the organisation does not hold Erasmus accreditation in this field, do not plan a KA121 application — KA122 is usually the right action.',
    };
  }

  if (ctx.accredited === true) {
    items.push({
      factKey: 'accredited',
      fieldId: 'accreditation',
      label: 'Erasmus accreditation',
      value: 'yes',
      kind: 'fact',
      fillState: 'known',
      feasibility: 'feasible',
      rationale: 'Supplied by the user.',
      requiresEvidence: false,
    });
  } else {
    items.push({
      factKey: 'accredited',
      fieldId: 'accreditation',
      label: 'Erasmus accreditation',
      value: null,
      kind: 'missing',
      fillState: 'must_confirm',
      feasibility: 'needs_check',
      rationale: 'Cannot be invented. KA121 is only valid with a current accreditation.',
      requiresEvidence: false,
    });
  }

  if (ctx.field) {
    items.push({
      factKey: 'education_field',
      fieldId: 'field',
      label: 'Education field',
      value: ctx.field,
      kind: 'fact',
      fillState: 'known',
      feasibility: 'feasible',
      rationale: 'Supplied by the user.',
      requiresEvidence: false,
    });
  }

  const mobilityRole = ctx.mobilityRole ?? (longStay ? 'learners' : undefined);
  if (ctx.mobilityRole) {
    items.push({
      factKey: 'mobility_role',
      fieldId: 'activity_mix',
      label: 'Who travels',
      value: ctx.mobilityRole,
      kind: 'fact',
      fillState: 'known',
      feasibility: 'feasible',
      rationale: 'Supplied by the user.',
      requiresEvidence: false,
    });
  }

  const learnerMobility = mobilityRole === 'learners' || mobilityRole === 'both';
  if (learnerMobility && longStay) {
    items.push({
      factKey: 'mobility_format',
      fieldId: 'learner_activities',
      label: 'Learner mobility format',
      value: `individual long-term (${durationMonths} months)`,
      kind: 'inference',
      fillState: 'proposed',
      feasibility: 'unknown',
      rationale:
        'Group mobility is short and shared. A two-month stay at a host school is individual learner mobility until the school confirms.',
      requiresEvidence: false,
    });
  }

  let proposedCount = ctx.participantCount;
  let countKind = 'fact';
  let countState = 'known';
  let countFeasibility = 'unknown';
  let countRationale = 'Supplied by the user.';
  let warning;
  const months = durationMonths ?? 2;

  if (proposedCount == null && learnerMobility && firstTime) {
    proposedCount = 2;
    countKind = 'recommendation';
    countState = 'proposed';
    countRationale = 'Conservative starting point for a first-time long-term learner mobility.';
  }

  if (proposedCount != null && ctx.budgetEur != null && learnerMobility) {
    const max = maxLearnersForBudget(ctx.budgetEur, months);
    const cost = proposedCount * months * PLANNING_COST_PER_LEARNER_MONTH_EUR;
    if (cost > ctx.budgetEur) {
      countFeasibility = 'infeasible';
      warning = `A planning estimate (not official unit costs) puts ${proposedCount} learners × ${months} months above €${ctx.budgetEur}. Recalculating the plan.`;
      proposedCount = Math.max(1, max);
      if (proposedCount * months * PLANNING_COST_PER_LEARNER_MONTH_EUR > ctx.budgetEur) {
        countFeasibility = 'infeasible';
        countRationale =
          'Even one learner for this duration may exceed the stated budget. Consider a shorter stay or more funding.';
      } else {
        countFeasibility = 'needs_check';
        countKind = 'recommendation';
        countState = 'proposed';
        countRationale = `Scaled down so the planning estimate fits €${ctx.budgetEur}. Confirm against real unit costs and school capacity.`;
      }
    } else {
      countFeasibility = 'needs_check';
    }
  }

  if (proposedCount != null && learnerMobility) {
    items.push({
      factKey: 'participant_count',
      fieldId: 'participant_count',
      label: 'Number of learners',
      value: proposedCount,
      kind: ctx.participantCount != null ? 'fact' : countKind,
      fillState: ctx.participantCount != null && countFeasibility !== 'infeasible' ? 'known' : countState,
      feasibility: ctx.budgetEur == null ? 'unknown' : countFeasibility,
      rationale: ctx.participantCount != null ? 'Supplied by the user.' : countRationale,
      requiresEvidence: false,
    });
  }

  if (ctx.destinationCountry) {
    items.push({
      factKey: 'destination_country',
      fieldId: 'destinations',
      label: 'Host country and school',
      value: ctx.destinationCountry,
      kind: 'fact',
      fillState: 'known',
      feasibility: 'unknown',
      rationale: 'Supplied by the user. Still confirm a real host school exists.',
      requiresEvidence: false,
    });
  } else {
    items.push({
      factKey: 'destination_country',
      fieldId: 'destinations',
      label: 'Host country and school',
      value: null,
      kind: 'missing',
      fillState: 'must_confirm',
      feasibility: 'needs_check',
      rationale: 'Cannot invent a host school or pick a country because it is popular.',
      requiresEvidence: false,
    });
  }

  if (ctx.learnerNeed) {
    items.push({
      factKey: 'learner_need',
      fieldId: 'objectives',
      label: 'Learner need or goal',
      value: ctx.learnerNeed,
      kind: 'fact',
      fillState: 'known',
      feasibility: 'needs_check',
      rationale: 'Supplied by the user. Still needs a needs-analysis method.',
      requiresEvidence: true,
    });
  } else if (learnerMobility) {
    items.push({
      factKey: 'learner_need',
      fieldId: 'objectives',
      label: 'Learner need or goal',
      value: 'language confidence, intercultural competence, learner independence',
      kind: 'recommendation',
      fillState: 'proposed',
      feasibility: 'unknown',
      rationale: 'A common first-time school-mobility focus. Not application evidence until the school supports it.',
      requiresEvidence: true,
    });
  }

  return {
    actionCode: 'KA121',
    items,
    scales: [
      { id: 'small', label: 'Small: 1–2 learners', detail: 'Lower organisational burden. Usual first project.' },
      { id: 'medium', label: 'Medium: 3–5 learners', detail: 'More impact; more hosting, safeguarding, and budget.' },
      { id: 'large', label: 'Large: 6+ learners', detail: 'Requires substantially more planning and resources.' },
    ],
    checks: FEASIBILITY_CHECKS,
    warning,
    usableAsPlan: ctx.accredited === true,
  };
}

function lineFor(item) {
  const value = item.value == null || item.value === '' ? '— not known' : item.value;
  return `- ${item.label}: ${value} [${item.kind} · ${item.fillState} · feasibility ${item.feasibility}] ${item.rationale}`;
}

/**
 * System-prompt appendix. Hypotheses are not application facts.
 */
export function formatWorkingScenarioBlock({ actionCode, answers = {}, queryText = '' }) {
  if (actionCode !== 'KA121') {
    return `--- Plan vs facts ---
AI can invent a PLAN. AI cannot invent FACTS (partners, accreditation, dates, counts, host schools, or needs evidence).
If the user has no plan, propose a conservative working scenario, label every value as hypothesis, then ask whether to use it. Recalculate if budget or capacity arrives. Never bounce a questionnaire when a proposal would help.`;
  }

  const extracted = extractKnownContext(queryText, answers);
  const ctx = contextFromAnswers('KA121', answers, extracted);
  const scenario = proposeWorkingScenario(ctx);
  const known = scenario.items.filter((i) => i.fillState === 'known');
  const proposed = scenario.items.filter((i) => i.fillState === 'proposed');
  const must = scenario.items.filter((i) => i.fillState === 'must_confirm');

  return `--- Working scenario (hypotheses, not application facts) ---
AI can invent a PLAN. AI cannot invent FACTS. Do not present suggestions as application truth.
If the user has no plan, propose this (or an updated version after constraints), explain why, and ask: "Do you want me to use this as the working scenario?"
Do not interview them field-by-field when a conservative first-time plan would help.

${scenario.warning ? `Constraint: ${scenario.warning}\n` : ''}Known:
${known.length ? known.map(lineFor).join('\n') : '- (none locked yet)'}

Proposed — pending, not usable in generation:
${proposed.length ? proposed.map(lineFor).join('\n') : '- (none)'}

Must confirm — do not invent:
${must.length ? must.map(lineFor).join('\n') : '- (none)'}

Feasibility still unknown until checked:
${scenario.checks.map((c) => `- ${c}`).join('\n')}

If they give a budget, capacity, or "we cannot host N learners", recalculate. Do not keep an infeasible plan.`;
}
