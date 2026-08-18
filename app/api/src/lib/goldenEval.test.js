import { describe, it, expect } from 'vitest';
import { assessGeneratedDraft } from './draftQuality.js';
import { buildPassRateSystemPrompt, retrievePassRateContext, shouldInjectKa153Pack } from './passRate.js';
import { schemaInstruction } from './applicationSchema.js';

const HOLLOW_KA220 = `# Just Exchange for Green and Good Earth

## Relevance
We will empower young people for a greener earth with an innovative holistic approach.

## Quality of partnership
—

## Design and work packages
—

## Impact
—

## Management
—
`;

const SLOGAN_BRIEF = 'Innovative project for a greener earth and a better world.';

describe('golden-set eval per action family', () => {
  it('keeps Youth Exchange out of the KA153 youth-worker pack', () => {
    const prompt = buildPassRateSystemPrompt({
      queryText: 'KA153 mobility of youth workers digital youth work',
      mode: 'document',
      actionCode: 'KA153',
    });
    expect(prompt).toContain('Right beneficiary');
    expect(prompt).toMatch(/Never write a KA153 as if youth/);
    expect(schemaInstruction('KA153')).toContain('## Relevance');
    expect(schemaInstruction('KA153')).not.toContain('## Who');
  });

  it('does not rank youth-worker assessments into a KA220 draft', () => {
    expect(shouldInjectKa153Pack({ actionCode: 'KA220', queryText: 'partnership' })).toBe(false);
    const ctx = retrievePassRateContext('youth workers training course needs analysis', {
      actionCode: 'KA220',
    });
    expect(ctx.matchedAssessmentIds).not.toContain('EX-2024-B');
    expect(ctx.failureModes).not.toMatch(/youth workers/i);

    const prompt = buildPassRateSystemPrompt({
      queryText: 'KA220 cooperation partnership VET curricula work packages',
      mode: 'document',
      actionCode: 'KA220',
    });
    expect(prompt).toContain('work packages');
    expect(prompt).toContain('Do **not** apply KA153');
    expect(prompt).not.toContain('Right beneficiary');
  });

  it('does not inject youth-worker rules into KA122', () => {
    const prompt = buildPassRateSystemPrompt({
      queryText: 'KA122 VET staff mobility hospitality waste sorting',
      mode: 'document',
      actionCode: 'KA122',
    });
    expect(prompt).toContain('Objectives and needs');
    expect(prompt).not.toContain('Right beneficiary');
    expect(prompt).toContain('KA121 only');
  });

  it('rejects a slogan-only / dash-padded draft at the quality gate', () => {
    const assessment = assessGeneratedDraft(HOLLOW_KA220, {
      sourceText: SLOGAN_BRIEF,
      kind: 'application',
    });
    expect(assessment.ready).toBe(false);
    expect(assessment.gaps.length).toBeGreaterThan(0);
  });

  it('requires a needs method in the youth and KA122 family schemas', () => {
    const youth = buildPassRateSystemPrompt({
      queryText: 'needs analysis method survey youth workers',
      mode: 'document',
      actionCode: 'KA153',
    });
    expect(youth).toMatch(/Needs analysis[\s*]+must show method/i);

    const ka122 = buildPassRateSystemPrompt({
      queryText: 'needs method staff survey VET',
      mode: 'document',
      actionCode: 'KA122',
    });
    expect(ka122).toMatch(/Needs analysis must show a method/i);
  });
});
