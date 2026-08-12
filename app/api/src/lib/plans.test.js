import { describe, it, expect } from 'vitest';
import { PLANS, getPlanConfig, planFeatures, startOfUtcMonth } from './plans.js';

describe('plans', () => {
  it('keeps free quota tight, on OpenAI, and allows documents with a 3/mo cap', () => {
    expect(PLANS.free.monthlyTokenLimit).toBe(20_000);
    expect(PLANS.free.provider).toBe('openai');
    expect(PLANS.free.canGenerateDocuments).toBe(true);
    expect(PLANS.free.monthlyDocumentLimit).toBe(3);
    expect(planFeatures('free').canGenerateDocuments).toBe(true);
    expect(planFeatures('free').monthlyDocumentLimit).toBe(3);
  });

  it('gives paid plans Moonshot + higher document caps', () => {
    expect(getPlanConfig('pro').provider).toBe('moonshot');
    expect(planFeatures('basic').canGenerateDocuments).toBe(true);
    expect(planFeatures('basic').aiTier).toBe('advanced');
    expect(planFeatures('basic').monthlyDocumentLimit).toBe(20);
    expect(planFeatures('pro').monthlyDocumentLimit).toBe(100);
    expect(planFeatures('enterprise').monthlyDocumentLimit).toBe(100);
  });

  it('computes the UTC month start', () => {
    const start = startOfUtcMonth(new Date('2026-08-11T23:00:00.000Z'));
    expect(start.toISOString()).toBe('2026-08-01T00:00:00.000Z');
  });
});
