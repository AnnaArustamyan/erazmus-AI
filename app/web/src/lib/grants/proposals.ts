/**
 * Requirement → candidate → evidence → feasibility → confirmation.
 *
 * The schema says what must be known. This module decides how a value may be
 * obtained. AI may invent a PLAN. It may not invent FACTS.
 */

export type FactKind = 'fact' | 'inference' | 'recommendation' | 'missing' | 'unsupported'
export type FillState = 'known' | 'proposed' | 'must_confirm' | 'missing'
export type Feasibility = 'unknown' | 'feasible' | 'infeasible' | 'needs_check'
export type ProposalStrategy = 'conservative' | 'none'

export interface FieldAi {
  canPropose?: boolean
  proposalStrategy?: ProposalStrategy
  requiresEvidence?: boolean
  feasibilityCheck?: boolean
  cannotInvent?: boolean
}

export interface RequirementPolicy {
  id: string
  factKey: string
  fieldId: string
  label: string
  category: string
  required: boolean
  dependsOn?: string[]
  canPropose: boolean
  proposalStrategy?: ProposalStrategy
  requiresEvidence?: boolean
  feasibilityCheck?: boolean
  cannotInvent?: boolean
}

export interface KnownContext {
  actionCode: string
  field?: 'school' | 'vet' | 'adult'
  accredited?: boolean
  mobilityRole?: 'learners' | 'staff' | 'both'
  durationMonths?: number
  participantCount?: number
  destinationCountry?: string
  hasHostPartner?: boolean
  budgetEur?: number
  learnerNeed?: string
  firstTime?: boolean
}

export interface CandidateAnswer {
  factKey: string
  fieldId: string
  label: string
  value: string | number | null
  answerValue: string
  range?: string
  kind: FactKind
  fillState: FillState
  feasibility: Feasibility
  rationale: string
  requiresEvidence: boolean
  confirmLabel: string
}

export interface ScaleOption {
  id: 'small' | 'medium' | 'large'
  label: string
  detail: string
}

export interface WorkingScenario {
  actionCode: string
  items: CandidateAnswer[]
  scales: ScaleOption[]
  checks: string[]
  warning?: string
  usableAsPlan: boolean
}

/** Planning floor only — not official Erasmus+ unit costs. */
export const PLANNING_COST_PER_LEARNER_MONTH_EUR = 1500

export const KA121_POLICIES: RequirementPolicy[] = [
  {
    id: 'accreditation',
    factKey: 'accredited',
    fieldId: 'accreditation',
    label: 'Erasmus accreditation',
    category: 'management',
    required: true,
    canPropose: false,
    cannotInvent: true,
  },
  {
    id: 'field',
    factKey: 'education_field',
    fieldId: 'field',
    label: 'Education field',
    category: 'mobility_design',
    required: true,
    canPropose: false,
  },
  {
    id: 'activity_mix',
    factKey: 'mobility_role',
    fieldId: 'activity_mix',
    label: 'Who travels',
    category: 'mobility_design',
    required: true,
    canPropose: true,
    proposalStrategy: 'conservative',
  },
  {
    id: 'learner_activities',
    factKey: 'mobility_format',
    fieldId: 'learner_activities',
    label: 'Learner mobility format',
    category: 'mobility_design',
    required: true,
    dependsOn: ['activity_mix'],
    canPropose: true,
    proposalStrategy: 'conservative',
  },
  {
    id: 'destinations',
    factKey: 'destination_country',
    fieldId: 'destinations',
    label: 'Host country and school',
    category: 'mobility_design',
    required: true,
    canPropose: false,
    cannotInvent: true,
    feasibilityCheck: true,
  },
  {
    id: 'participant_count',
    factKey: 'participant_count',
    fieldId: 'participant_count',
    label: 'Number of learners',
    category: 'mobility_design',
    required: true,
    dependsOn: ['mobility_format'],
    canPropose: true,
    proposalStrategy: 'conservative',
    feasibilityCheck: true,
  },
  {
    id: 'objectives',
    factKey: 'learner_need',
    fieldId: 'objectives',
    label: 'Learner need or goal',
    category: 'needs',
    required: true,
    canPropose: true,
    proposalStrategy: 'conservative',
    requiresEvidence: true,
  },
]

const FEASIBILITY_CHECKS = [
  'Does the school have enough grant or co-funding for this scale?',
  'Does it have, or can it establish, a host-school relationship?',
  'Can it support accommodation, safeguarding, and supervision?',
  'Are there learners suitable for this mobility?',
  'Does this match the accredited Erasmus objectives?',
]

export function parseBudgetEur(text: string): number | undefined {
  const match = text.match(/€\s*([\d.,]+)/i) || text.match(/([\d.,]+)\s*(?:€|euros?|eur)\b/i)
  if (!match) return undefined
  const n = Number.parseInt((match[1] || match[2] || '').replace(/[^\d]/g, ''), 10)
  return Number.isFinite(n) ? n : undefined
}

export function parseDurationMonths(text: string): number | undefined {
  const match = text.match(/(\d+)\s*(?:-\s*\d+)?\s*months?/i)
  if (!match) return undefined
  const n = Number.parseInt(match[1], 10)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

export function contextFromAnswers(
  actionCode: string,
  answers: Record<string, string> = {},
  extra: Partial<KnownContext> = {},
): KnownContext {
  const ctx: KnownContext = { actionCode, firstTime: extra.firstTime !== false, ...extra }
  if (answers.accreditation === 'yes') ctx.accredited = true
  if (answers.accreditation === 'no') ctx.accredited = false
  if (answers.field === 'school' || answers.field === 'vet' || answers.field === 'adult') {
    ctx.field = answers.field
  }
  if (answers.activity_mix === 'learners' || answers.activity_mix === 'staff' || answers.activity_mix === 'both') {
    ctx.mobilityRole = answers.activity_mix
  }
  const count = Number.parseInt(String(answers.participant_count ?? '').replace(/[^\d]/g, ''), 10)
  if (Number.isFinite(count) && count > 0) ctx.participantCount = count
  const dest = (answers.destinations ?? '').trim()
  if (dest) ctx.destinationCountry = dest
  const need = (answers.objectives ?? '').trim()
  if (need) ctx.learnerNeed = need
  const durationText = [answers.learner_activities, answers.summary].filter(Boolean).join(' ')
  ctx.durationMonths = extra.durationMonths ?? parseDurationMonths(durationText) ?? ctx.durationMonths
  return ctx
}

export function extractKnownContext(text: string, answers: Record<string, string> = {}): Partial<KnownContext> {
  const extra: Partial<KnownContext> = {}
  const duration = parseDurationMonths(text)
  if (duration) extra.durationMonths = duration
  const budget = parseBudgetEur(text)
  if (budget) extra.budgetEur = budget
  if (/\bschool education\b|\bschools?\b/i.test(text)) extra.field = extra.field ?? 'school'
  if (/\bvet\b|vocational/i.test(text)) extra.field = extra.field ?? 'vet'
  if (/\badult education\b/i.test(text)) extra.field = extra.field ?? 'adult'
  if (/\blearners?\b/i.test(text) && !/\bstaff only\b/i.test(text)) extra.mobilityRole = extra.mobilityRole ?? 'learners'
  if (/\byes\b/i.test(text) && /accredit/i.test(text)) extra.accredited = true
  if (/\bno\b/i.test(text) && /accredit/i.test(text)) extra.accredited = false
  return contextFromAnswers('KA121', answers, extra)
}

function item(partial: CandidateAnswer): CandidateAnswer {
  return partial
}

function maxLearnersForBudget(budgetEur: number, durationMonths: number): number {
  const per = durationMonths * PLANNING_COST_PER_LEARNER_MONTH_EUR
  if (per <= 0) return 1
  return Math.max(0, Math.floor(budgetEur / per))
}

export function proposeWorkingScenario(ctx: KnownContext): WorkingScenario {
  if (ctx.actionCode !== 'KA121') {
    return {
      actionCode: ctx.actionCode,
      items: [],
      scales: [],
      checks: FEASIBILITY_CHECKS,
      usableAsPlan: false,
      warning:
        'Conservative first-time defaults are defined for KA121. For other actions, propose only schema-allowed values and never invent partners, dates, or evidence.',
    }
  }

  const firstTime = ctx.firstTime !== false
  const durationMonths = ctx.durationMonths
  const longStay = (durationMonths ?? 0) >= 1
  const items: CandidateAnswer[] = []

  if (ctx.accredited === false) {
    return {
      actionCode: 'KA121',
      items: [],
      scales: [],
      checks: FEASIBILITY_CHECKS,
      usableAsPlan: false,
      warning:
        'KA121 is an accredited funding request. If the organisation does not hold Erasmus accreditation in this field, do not plan a KA121 application — KA122 is usually the right action.',
    }
  }

  if (ctx.accredited === true) {
    items.push(
      item({
        factKey: 'accredited',
        fieldId: 'accreditation',
        label: 'Erasmus accreditation',
        value: 'yes',
        answerValue: 'yes',
        kind: 'fact',
        fillState: 'known',
        feasibility: 'feasible',
        rationale: 'Supplied by the user.',
        requiresEvidence: false,
        confirmLabel: 'Known',
      }),
    )
  } else {
    items.push(
      item({
        factKey: 'accredited',
        fieldId: 'accreditation',
        label: 'Erasmus accreditation',
        value: null,
        answerValue: '',
        kind: 'missing',
        fillState: 'must_confirm',
        feasibility: 'needs_check',
        rationale: 'Cannot be invented. KA121 is only valid with a current accreditation.',
        requiresEvidence: false,
        confirmLabel: 'Needs school confirmation',
      }),
    )
  }

  if (ctx.field) {
    items.push(
      item({
        factKey: 'education_field',
        fieldId: 'field',
        label: 'Education field',
        value: ctx.field,
        answerValue: ctx.field,
        kind: 'fact',
        fillState: 'known',
        feasibility: 'feasible',
        rationale: 'Supplied by the user.',
        requiresEvidence: false,
        confirmLabel: 'Known',
      }),
    )
  }

  const mobilityRole = ctx.mobilityRole ?? (longStay ? 'learners' : undefined)
  if (ctx.mobilityRole) {
    items.push(
      item({
        factKey: 'mobility_role',
        fieldId: 'activity_mix',
        label: 'Who travels',
        value: ctx.mobilityRole,
        answerValue: ctx.mobilityRole,
        kind: 'fact',
        fillState: 'known',
        feasibility: 'feasible',
        rationale: 'Supplied by the user.',
        requiresEvidence: false,
        confirmLabel: 'Known',
      }),
    )
  } else if (mobilityRole) {
    items.push(
      item({
        factKey: 'mobility_role',
        fieldId: 'activity_mix',
        label: 'Who travels',
        value: mobilityRole,
        answerValue: mobilityRole,
        kind: 'inference',
        fillState: 'proposed',
        feasibility: 'unknown',
        rationale: 'A stay of about two months is normally learner mobility, not a short group trip.',
        requiresEvidence: false,
        confirmLabel: 'AI suggestion · Confirm or change',
      }),
    )
  }

  const learnerMobility = mobilityRole === 'learners' || mobilityRole === 'both'
  if (learnerMobility && longStay) {
    const monthsLabel = `${durationMonths} month${durationMonths === 1 ? '' : 's'}`
    items.push(
      item({
        factKey: 'mobility_format',
        fieldId: 'learner_activities',
        label: 'Learner mobility format',
        value: `individual long-term (${monthsLabel})`,
        answerValue: `Individual long-term learner mobility of about ${monthsLabel} at a host school. Host organisation is not identified yet.`,
        kind: 'inference',
        fillState: ctx.learnerNeed && ctx.participantCount ? 'known' : 'proposed',
        feasibility: 'unknown',
        rationale:
          'Group mobility is short and shared. A two-month stay at a host school is individual learner mobility — still a planning inference until the school confirms.',
        requiresEvidence: false,
        confirmLabel: 'AI suggestion · Confirm or change',
      }),
    )
  }

  let proposedCount = ctx.participantCount
  let countKind: FactKind = 'fact'
  let countState: FillState = 'known'
  let countFeasibility: Feasibility = 'unknown'
  let countRationale = 'Supplied by the user.'
  let warning: string | undefined
  const months = durationMonths ?? 2

  if (proposedCount == null && learnerMobility && firstTime) {
    proposedCount = 2
    countKind = 'recommendation'
    countState = 'proposed'
    countRationale = 'Conservative starting point for a first-time long-term learner mobility.'
  }

  if (proposedCount != null && ctx.budgetEur != null && learnerMobility) {
    const max = maxLearnersForBudget(ctx.budgetEur, months)
    const cost = proposedCount * months * PLANNING_COST_PER_LEARNER_MONTH_EUR
    if (cost > ctx.budgetEur) {
      countFeasibility = 'infeasible'
      warning = `A planning estimate (not official unit costs) puts ${proposedCount} learners × ${months} months above €${ctx.budgetEur.toLocaleString('en')}. Recalculating the plan.`
      proposedCount = Math.max(1, max)
      if (proposedCount * months * PLANNING_COST_PER_LEARNER_MONTH_EUR > ctx.budgetEur) {
        countFeasibility = 'infeasible'
        countRationale =
          'Even one learner for this duration may exceed the stated budget. Consider a shorter stay or more funding — still a hypothesis.'
      } else {
        countFeasibility = 'needs_check'
        countKind = 'recommendation'
        countState = 'proposed'
        countRationale = `Scaled down so the planning estimate fits €${ctx.budgetEur.toLocaleString('en')}. Confirm against real unit costs and school capacity.`
      }
    } else {
      countFeasibility = 'needs_check'
      countRationale = `${countRationale} Budget check used a planning estimate, not official Erasmus+ rates.`
    }
  }

  if (proposedCount != null && learnerMobility) {
    items.push(
      item({
        factKey: 'participant_count',
        fieldId: 'participant_count',
        label: 'Number of learners',
        value: proposedCount,
        answerValue: String(proposedCount),
        range: firstTime ? '1–2' : undefined,
        kind: ctx.participantCount != null ? 'fact' : countKind,
        fillState: ctx.participantCount != null && countFeasibility !== 'infeasible' ? 'known' : countState,
        feasibility: ctx.budgetEur == null ? 'unknown' : countFeasibility,
        rationale: ctx.participantCount != null ? 'Supplied by the user.' : countRationale,
        requiresEvidence: false,
        confirmLabel:
          ctx.participantCount != null ? 'Known' : 'AI suggestion · Confirm or change',
      }),
    )
  }

  if (ctx.destinationCountry) {
    items.push(
      item({
        factKey: 'destination_country',
        fieldId: 'destinations',
        label: 'Host country and school',
        value: ctx.destinationCountry,
        answerValue: ctx.destinationCountry,
        kind: 'fact',
        fillState: 'known',
        feasibility: ctx.hasHostPartner === false ? 'needs_check' : 'unknown',
        rationale: 'Supplied by the user. Still confirm a real host school exists.',
        requiresEvidence: false,
        confirmLabel: 'Known · needs host-school confirmation',
      }),
    )
  } else {
    items.push(
      item({
        factKey: 'destination_country',
        fieldId: 'destinations',
        label: 'Host country and school',
        value: null,
        answerValue: '',
        kind: 'missing',
        fillState: 'must_confirm',
        feasibility: 'needs_check',
        rationale:
          'Cannot invent a host school or pick a country because it is popular. Needs a real or realistically identifiable partner.',
        requiresEvidence: false,
        confirmLabel: 'Needs host-school confirmation',
      }),
    )
  }

  if (ctx.learnerNeed) {
    items.push(
      item({
        factKey: 'learner_need',
        fieldId: 'objectives',
        label: 'Learner need or goal',
        value: ctx.learnerNeed,
        answerValue: ctx.learnerNeed,
        kind: 'fact',
        fillState: 'known',
        feasibility: 'needs_check',
        rationale: 'Supplied by the user. Generation still needs the method and evidence behind it.',
        requiresEvidence: true,
        confirmLabel: 'Known · needs evidence',
      }),
    )
  } else if (learnerMobility) {
    items.push(
      item({
        factKey: 'learner_need',
        fieldId: 'objectives',
        label: 'Learner need or goal',
        value: 'language confidence, intercultural competence, learner independence',
        answerValue:
          'Planning focus: language development, intercultural competence, and learner independence. This is a working hypothesis — replace with a school-evidenced need (survey, assessments, or teacher observations) before using it in the application.',
        kind: 'recommendation',
        fillState: 'proposed',
        feasibility: 'unknown',
        rationale: 'A common first-time school-mobility focus. Not application evidence until the school supports it.',
        requiresEvidence: true,
        confirmLabel: 'AI suggestion · Needs evidence from school',
      }),
    )
  }

  const scales: ScaleOption[] = [
    { id: 'small', label: 'Small: 1–2 learners × this duration', detail: 'Lower organisational burden. Usual first project.' },
    { id: 'medium', label: 'Medium: 3–5 learners', detail: 'More impact; needs more hosting, safeguarding, and budget.' },
    { id: 'large', label: 'Large: 6+ learners', detail: 'Requires substantially more planning and resources.' },
  ]

  return {
    actionCode: 'KA121',
    items,
    scales,
    checks: FEASIBILITY_CHECKS,
    warning,
    usableAsPlan: ctx.accredited === true,
  }
}

export function proposedItems(scenario: WorkingScenario): CandidateAnswer[] {
  return scenario.items.filter((item) => item.fillState === 'proposed' || item.fillState === 'must_confirm')
}

export function confirmableItems(scenario: WorkingScenario): CandidateAnswer[] {
  return scenario.items.filter((item) => item.fillState === 'proposed' && item.answerValue.trim())
}
