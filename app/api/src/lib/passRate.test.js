import { describe, it, expect } from 'vitest';
import {
  GUIDE_YEAR,
  buildPassRateSystemPrompt,
  isLightweightChatQuery,
  retrievePassRateContext,
  shouldInjectKa153Pack,
} from './passRate.js';

describe('pass-rate knowledge pack', () => {
  it('labels the 2026 Guide year', () => {
    expect(GUIDE_YEAR).toBe(2026);
  });

  it('treats greetings as lightweight chat', () => {
    expect(isLightweightChatQuery('hi how to get started')).toBe(true);
    expect(isLightweightChatQuery('Hello!')).toBe(true);
    expect(isLightweightChatQuery('needs analysis for youth workers and APV timetable')).toBe(
      false,
    );
  });

  it('does not tell chat to output a blank application skeleton', () => {
    const prompt = buildPassRateSystemPrompt({
      agentSystemPrompt: 'You are Erasmus AI, a coach.',
      queryText: 'hi how to get started',
      latestUserMessage: 'hi how to get started',
      mode: 'chat',
    });

    expect(prompt).toContain('You are Erasmus AI, a coach.');
    expect(prompt).toContain('never dump a blank');
    expect(prompt).toContain('working scenario');
    expect(prompt).not.toContain('Start with a single H1 title line');
    expect(prompt).not.toContain('Right beneficiary');
    expect(prompt.length).toBeLessThan(8_000);
  });

  it('injects Guide excerpts and failure modes when drafting a youth-worker section in chat', () => {
    const prompt = buildPassRateSystemPrompt({
      agentSystemPrompt: 'You are Erasmus AI, a coach.',
      queryText: 'needs analysis for youth workers and APV timetable',
      latestUserMessage: 'Write the needs analysis and say what the APV timetable must include.',
      mode: 'chat',
      actionCode: 'KA153',
    });

    expect(prompt).toContain('Right beneficiary');
    expect(prompt).toContain('Award criteria');
    expect(prompt).toContain('EX-');
    expect(prompt).not.toMatch(/KA153-YOU-000/);
    expect(prompt).not.toContain('Start with a single H1 title line');
  });

  it('tells KA121 chat to propose a working scenario rather than interview', () => {
    const prompt = buildPassRateSystemPrompt({
      agentSystemPrompt: 'You are Erasmus AI, a coach.',
      queryText: 'KA121 school learner 2 months I have no plan',
      latestUserMessage: 'I have no plan',
      mode: 'chat',
      actionCode: 'KA121',
    });
    expect(prompt).toContain('Plan vs facts');
    expect(prompt).toContain('working scenario');
    expect(prompt).not.toContain('Right beneficiary');
  });

  it('retrieves APV failure notes for preparatory-visit queries on youth actions', () => {
    const ctx = retrievePassRateContext('preparatory visit APV without a day-by-day programme', {
      actionCode: 'KA153',
    });
    expect(ctx.failureModes).toMatch(/APV/i);
    expect(ctx.matchedAssessmentIds.some((id) => id === 'EX-2025-D' || id === 'EX-2025-E')).toBe(
      true,
    );
  });

  it('retrieves entrepreneur / wrong-beneficiary failure for that theme on youth actions', () => {
    const ctx = retrievePassRateContext('young entrepreneurs startup business plans training course', {
      actionCode: 'KA153',
    });
    expect(ctx.matchedAssessmentIds).toContain('EX-2024-B');
  });

  it('builds a document-mode prompt with the family schema, not Who/Where/When', () => {
    const prompt = buildPassRateSystemPrompt({
      queryText: 'draft the application',
      mode: 'document',
      actionCode: 'KA153',
    });
    expect(prompt).toContain('PASS National Agency');
    expect(prompt).toContain('## Relevance');
    expect(prompt).not.toContain('## Who');
    expect(prompt).toContain('Never');
    expect(prompt).not.toMatch(/KA153 \/ youth-worker mobility/);
    expect(prompt).toContain('KA1 mobility vs KA2 partnership');
  });

  it('loads the project-plan skill when requested', () => {
    const prompt = buildPassRateSystemPrompt({
      queryText: 'staff mobility for VET teachers',
      mode: 'document',
      skillName: 'project-plan',
    });
    expect(prompt).toContain('## Risks');
    expect(prompt).toContain('not a National Agency application form');
    expect(prompt).toContain('Do not label KA121');
    expect(prompt).not.toContain('## Who');
    expect(prompt).not.toContain('Right beneficiary');
  });

  it('does not inject the KA153 pack into KA220', () => {
    expect(shouldInjectKa153Pack({ actionCode: 'KA220', skillName: 'application-draft' })).toBe(
      false,
    );
    const prompt = buildPassRateSystemPrompt({
      queryText: 'KA220 cooperation partnership on digital VET curricula',
      mode: 'document',
      actionCode: 'KA220',
    });
    expect(prompt).toContain('work packages');
    expect(prompt).not.toContain('Right beneficiary');
    expect(prompt).not.toMatch(/primary participants of a KA153/);
  });
});
