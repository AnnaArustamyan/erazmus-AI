import { describe, it, expect } from 'vitest';
import {
  contextFromAnswers,
  extractKnownContext,
  formatWorkingScenarioBlock,
  parseBudgetEur,
  proposeWorkingScenario,
} from './proposals.js';

describe('working-scenario proposals', () => {
  it('proposes a conservative first-time KA121 plan without inventing a host', () => {
    const scenario = proposeWorkingScenario({
      actionCode: 'KA121',
      field: 'school',
      accredited: true,
      mobilityRole: 'learners',
      durationMonths: 2,
      firstTime: true,
    });
    const count = scenario.items.find((item) => item.factKey === 'participant_count');
    const dest = scenario.items.find((item) => item.factKey === 'destination_country');
    expect(count).toMatchObject({ value: 2, kind: 'recommendation', fillState: 'proposed' });
    expect(dest).toMatchObject({ value: null, fillState: 'must_confirm' });
  });

  it('recalculates when a €3000 budget cannot fund 2 learners for 2 months', () => {
    const scenario = proposeWorkingScenario({
      actionCode: 'KA121',
      field: 'school',
      accredited: true,
      mobilityRole: 'learners',
      durationMonths: 2,
      budgetEur: 3000,
    });
    expect(scenario.items.find((item) => item.factKey === 'participant_count')?.value).toBe(1);
    expect(scenario.warning).toMatch(/3000/);
  });

  it('extracts duration and budget from the user message', () => {
    expect(parseBudgetEur('only has €3,000')).toBe(3000);
    const extracted = extractKnownContext('school education, learner, 2 months. We have 2500 eur.');
    expect(extracted.durationMonths).toBe(2);
    expect(extracted.budgetEur).toBe(2500);
    expect(extracted.field).toBe('school');
    expect(extracted.mobilityRole).toBe('learners');
  });

  it('injects a hypothesis block, not application facts', () => {
    const block = formatWorkingScenarioBlock({
      actionCode: 'KA121',
      answers: { accreditation: 'yes', field: 'school', activity_mix: 'learners' },
      queryText: 'I have no plan. 2 months. Our school only has €3,000.',
    });
    expect(block).toContain('not application facts');
    expect(block).toContain('working scenario');
    expect(block).toMatch(/Number of learners: 1/);
    expect(block).not.toMatch(/Spain|Italy/);
    expect(contextFromAnswers('KA121', { accreditation: 'yes' }).accredited).toBe(true);
  });
});
