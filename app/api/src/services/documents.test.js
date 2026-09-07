import { describe, it, expect } from 'vitest';
import { expiryForPlan } from './documents.js';

describe('expiryForPlan', () => {
  it('returns null (indefinite retention) for paid plans', () => {
    expect(expiryForPlan('basic')).toBeNull();
    expect(expiryForPlan('pro')).toBeNull();
    expect(expiryForPlan('enterprise')).toBeNull();
  });

  it('returns an ISO timestamp ~30 days out for the free plan', () => {
    const before = Date.now();
    const iso = expiryForPlan('free');
    const after = Date.now();

    expect(iso).toEqual(expect.any(String));
    const expiryMs = new Date(iso).getTime();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    expect(expiryMs).toBeGreaterThanOrEqual(before + thirtyDaysMs - 1000);
    expect(expiryMs).toBeLessThanOrEqual(after + thirtyDaysMs + 1000);
  });

  it('treats an unrecognised/missing plan as free (matches getPlanConfig fallback)', () => {
    expect(expiryForPlan(null)).toEqual(expect.any(String));
    expect(expiryForPlan(undefined)).toEqual(expect.any(String));
  });
});
