import { describe, it, expect, vi, beforeEach } from 'vitest';

const { supabaseAdminMock } = vi.hoisted(() => ({
  supabaseAdminMock: { from: vi.fn() },
}));

vi.mock('../config/supabase.js', () => ({ supabaseAdmin: supabaseAdminMock }));

const { getUserQuota, isQuotaExhausted } = await import('./quota.js');
const { queueFromResults } = await import('../test/supabaseMock.js');

describe('getUserQuota', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resets tokens_used when the stored period is a previous UTC month', async () => {
    queueFromResults(supabaseAdminMock.from, [
      {
        data: {
          plan: 'free',
          monthly_token_limit: 20000,
          tokens_used: 19999,
          quota_period_start: '2026-07-01',
        },
        error: null,
      },
      { data: null, error: null },
    ]);

    const profile = await getUserQuota('user-1', new Date('2026-08-16T12:00:00.000Z'));
    expect(profile.tokens_used).toBe(0);
    expect(profile.quota_period_start).toBe('2026-08-01');
    expect(isQuotaExhausted(profile)).toBe(false);
  });

  it('keeps usage inside the current UTC month', async () => {
    queueFromResults(supabaseAdminMock.from, [
      {
        data: {
          plan: 'free',
          monthly_token_limit: 20000,
          tokens_used: 100,
          quota_period_start: '2026-08-01',
        },
        error: null,
      },
    ]);

    const profile = await getUserQuota('user-1', new Date('2026-08-16T12:00:00.000Z'));
    expect(profile.tokens_used).toBe(100);
  });
});
