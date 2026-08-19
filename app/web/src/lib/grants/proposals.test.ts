import { describe, it, expect } from 'vitest'
import {
  confirmableItems,
  contextFromAnswers,
  parseBudgetEur,
  parseDurationMonths,
  proposeWorkingScenario,
} from './proposals'

describe('working-scenario proposals', () => {
  it('proposes a conservative first-time KA121 plan without inventing a host', () => {
    const scenario = proposeWorkingScenario({
      actionCode: 'KA121',
      field: 'school',
      accredited: true,
      mobilityRole: 'learners',
      durationMonths: 2,
      firstTime: true,
    })

    const count = scenario.items.find((item) => item.factKey === 'participant_count')
    const dest = scenario.items.find((item) => item.factKey === 'destination_country')
    const format = scenario.items.find((item) => item.factKey === 'mobility_format')
    const need = scenario.items.find((item) => item.factKey === 'learner_need')

    expect(count).toMatchObject({
      value: 2,
      kind: 'recommendation',
      fillState: 'proposed',
      feasibility: 'unknown',
    })
    expect(format?.kind).toBe('inference')
    expect(format?.fillState).toBe('proposed')
    expect(dest).toMatchObject({
      value: null,
      kind: 'missing',
      fillState: 'must_confirm',
    })
    expect(need).toMatchObject({
      kind: 'recommendation',
      requiresEvidence: true,
      fillState: 'proposed',
    })
    expect(scenario.usableAsPlan).toBe(true)
    expect(confirmableItems(scenario).every((item) => item.answerValue.trim())).toBe(true)
  })

  it('does not keep 2 learners × 2 months when the budget is €3000', () => {
    const scenario = proposeWorkingScenario({
      actionCode: 'KA121',
      field: 'school',
      accredited: true,
      mobilityRole: 'learners',
      durationMonths: 2,
      firstTime: true,
      budgetEur: 3000,
    })
    const count = scenario.items.find((item) => item.factKey === 'participant_count')
    expect(count?.value).toBe(1)
    expect(count?.fillState).toBe('proposed')
    expect(count?.feasibility).toBe('needs_check')
    expect(scenario.warning).toMatch(/3,000|3000/i)
  })

  it('refuses a KA121 plan when the organisation is not accredited', () => {
    const scenario = proposeWorkingScenario({
      actionCode: 'KA121',
      accredited: false,
      field: 'school',
      mobilityRole: 'learners',
      durationMonths: 2,
    })
    expect(scenario.usableAsPlan).toBe(false)
    expect(scenario.items).toEqual([])
    expect(scenario.warning).toMatch(/KA122/i)
  })

  it('treats user-supplied counts as facts, not recommendations', () => {
    const scenario = proposeWorkingScenario({
      actionCode: 'KA121',
      accredited: true,
      field: 'school',
      mobilityRole: 'learners',
      durationMonths: 2,
      participantCount: 4,
    })
    const count = scenario.items.find((item) => item.factKey === 'participant_count')
    expect(count).toMatchObject({ value: 4, kind: 'fact', fillState: 'known' })
  })

  it('reads KA121 answers into known context', () => {
    const ctx = contextFromAnswers('KA121', {
      accreditation: 'yes',
      field: 'school',
      activity_mix: 'learners',
      participant_count: '2 learners',
    })
    expect(ctx).toMatchObject({
      accredited: true,
      field: 'school',
      mobilityRole: 'learners',
      participantCount: 2,
    })
  })

  it('parses budget and duration from free text', () => {
    expect(parseBudgetEur('Our school only has €3,000.')).toBe(3000)
    expect(parseDurationMonths('learner mobility, 2 months')).toBe(2)
  })
})
