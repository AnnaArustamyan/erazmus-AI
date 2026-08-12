import { describe, it, expect } from 'vitest';
import {
  GUIDE_YEAR,
  buildPassRateSystemPrompt,
  isLightweightChatQuery,
  retrievePassRateContext,
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
    expect(prompt).not.toContain('Start with a single H1 title line');
    expect(prompt).toContain('Right beneficiary');
    expect(prompt.length).toBeLessThan(8_000);
  });

  it('injects Guide excerpts and failure modes when drafting a section in chat', () => {
    const prompt = buildPassRateSystemPrompt({
      agentSystemPrompt: 'You are Erasmus AI, a coach.',
      queryText: 'needs analysis for youth workers and APV timetable',
      latestUserMessage: 'Write the needs analysis and say what the APV timetable must include.',
      mode: 'chat',
    });

    expect(prompt).toContain('Right beneficiary');
    expect(prompt).toContain('Award criteria');
    expect(prompt).toContain('EX-');
    expect(prompt).not.toMatch(/KA153-YOU-000/);
    expect(prompt).not.toContain('Start with a single H1 title line');
  });

  it('retrieves APV failure notes for preparatory-visit queries', () => {
    const ctx = retrievePassRateContext('preparatory visit APV without a day-by-day programme');
    expect(ctx.failureModes).toMatch(/APV/i);
    expect(ctx.matchedAssessmentIds.some((id) => id === 'EX-2025-D' || id === 'EX-2025-E')).toBe(
      true,
    );
  });

  it('retrieves entrepreneur / wrong-beneficiary failure for that theme', () => {
    const ctx = retrievePassRateContext('young entrepreneurs startup business plans training course');
    expect(ctx.matchedAssessmentIds).toContain('EX-2024-B');
  });

  it('builds a document-mode prompt that is not a thin wrapper', () => {
    const prompt = buildPassRateSystemPrompt({
      queryText: 'draft the application',
      mode: 'document',
    });
    expect(prompt).toContain('PASS National Agency');
    expect(prompt).toContain('## Who');
    expect(prompt).toContain('Never');
  });
});
