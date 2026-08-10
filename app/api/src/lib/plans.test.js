import { describe, it, expect } from 'vitest';
import { PLANS, getPlanConfig, planFeatures } from './plans.js';

describe('plans', () => {
  it('keeps free quota tight and on OpenAI', () => {
    expect(PLANS.free.monthlyTokenLimit).toBe(20_000);
    expect(PLANS.free.provider).toBe('openai');
    expect(PLANS.free.canGenerateDocuments).toBe(false);
  });

  it('gives paid plans Moonshot + documents', () => {
    expect(getPlanConfig('pro').provider).toBe('moonshot');
    expect(planFeatures('basic').canGenerateDocuments).toBe(true);
    expect(planFeatures('basic').aiTier).toBe('advanced');
  });
});
