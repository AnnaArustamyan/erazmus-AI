import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const { supabaseAdminMock, completeChatForPlanMock, isProviderConfiguredForPlanMock } = vi.hoisted(
  () => ({
    supabaseAdminMock: {
      from: vi.fn(),
      auth: { getUser: vi.fn() },
      storage: { from: vi.fn() },
    },
    completeChatForPlanMock: vi.fn(),
    isProviderConfiguredForPlanMock: vi.fn(() => true),
  }),
);

vi.mock('../config/supabase.js', () => ({ supabaseAdmin: supabaseAdminMock }));
vi.mock('../services/aiProvider.js', () => ({
  completeChatForPlan: completeChatForPlanMock,
  isProviderConfiguredForPlan: isProviderConfiguredForPlanMock,
}));

const { app } = await import('../app.js');
const { queueFromResults } = await import('../test/supabaseMock.js');

const USER = { id: 'user-1', email: 'a@b.com' };

const DENSE_PLAN = `# Climate youth exchange

## Summary
Two sending youth organisations in Armenia and Georgia will run a 10-day youth exchange in Dilijan for 20 participants aged 16–20 on community waste sorting, hosted by a local youth centre.

## Objectives
By day 10 each participant will run one neighbourhood waste-sorting session using a 4-step method practised during the exchange.

## Target group
20 young people (10 per country), selected by published criteria: motivation 40%, prior volunteer hours 30%, fewer-opportunity barriers 30%.

## Activities and timeline
Preparation in September: two online meetings. Mobility 1–10 October in Dilijan: daily workshops and a field sorting exercise with the municipality. Follow-up: each sending organisation hosts a local session in November.

## Expected outcomes
20 session plans; 2 local events; pre/post competence check on waste sorting.

## Risks
If the municipality cannot host the field day, the receiving organisation runs a simulated sorting line at the venue.

## Partners needed
Sending: youth NGO in Yerevan. Receiving: youth centre in Dilijan with a hall and municipal contact.
`;

beforeEach(() => {
  vi.clearAllMocks();
  isProviderConfiguredForPlanMock.mockReturnValue(true);
  supabaseAdminMock.auth.getUser.mockResolvedValue({ data: { user: USER }, error: null });
  supabaseAdminMock.storage.from.mockReturnValue({
    upload: vi.fn().mockResolvedValue({ data: {}, error: null }),
    createSignedUrl: vi
      .fn()
      .mockResolvedValue({ data: { signedUrl: 'https://signed.example/file' }, error: null }),
  });
});

describe('POST /api/plans', () => {
  it('requires a prompt', async () => {
    const res = await request(app).post('/api/plans').set('Authorization', 'Bearer t').send({});
    expect(res.status).toBe(400);
  });

  it('saves a strategy document as PDF', async () => {
    queueFromResults(supabaseAdminMock.from, [
      { data: { plan: 'pro', monthly_token_limit: 100000, tokens_used: 0 }, error: null },
      { data: null, error: null, count: 0 },
      { data: null, error: null },
      {
        data: {
          id: 'plan-1',
          user_id: USER.id,
          conversation_id: null,
          title: 'Climate youth exchange',
          content_md: DENSE_PLAN,
          md_storage_path: `${USER.id}/plan-1/application.md`,
          docx_storage_path: `${USER.id}/plan-1/application.docx`,
          pdf_storage_path: `${USER.id}/plan-1/application.pdf`,
          created_at: '2026-01-01T00:00:00.000Z',
        },
        error: null,
      },
    ]);
    completeChatForPlanMock.mockResolvedValue({
      content: DENSE_PLAN,
      totalTokens: 50,
      provider: { id: 'moonshot' },
    });

    const res = await request(app)
      .post('/api/plans')
      .set('Authorization', 'Bearer t')
      .send({
        prompt:
          'Two youth organisations in Armenia and Georgia will send 20 participants aged 16-20 on a 10-day youth exchange in Dilijan about community waste sorting. The host is a youth centre. After the mobility each sending organisation runs one local session.',
      });

    expect(res.status).toBe(201);
    expect(res.body.downloads.pdf).toBeTruthy();
    const systemContent = completeChatForPlanMock.mock.calls[0][0].messages[0].content;
    expect(systemContent).toContain('## Risks');
    expect(systemContent).toContain('not a National Agency application form');
    expect(systemContent).not.toContain('## Who');
  });

  it('refuses a slogan-only brief before calling the model', async () => {
    queueFromResults(supabaseAdminMock.from, [
      { data: { plan: 'free', monthly_token_limit: 20000, tokens_used: 0 }, error: null },
      { data: null, error: null, count: 0 },
    ]);

    const res = await request(app)
      .post('/api/plans')
      .set('Authorization', 'Bearer t')
      .send({ prompt: 'green project for students' });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('DRAFT_NOT_READY');
    expect(res.body.gaps.length).toBeGreaterThan(0);
    expect(completeChatForPlanMock).not.toHaveBeenCalled();
  });

  it('does not save a PDF when the model returns a hollow placeholder plan', async () => {
    queueFromResults(supabaseAdminMock.from, [
      { data: { plan: 'free', monthly_token_limit: 20000, tokens_used: 0 }, error: null },
      { data: null, error: null, count: 0 },
      { data: null, error: null },
    ]);
    completeChatForPlanMock.mockResolvedValue({
      content: `# Just Exchange for Green and Good Earth

## Summary
KA121 VET mobility in Albania for 10 learners. Greener earth. The current brief is not yet sufficiently developed.
## Objectives
The objective is: —
## Target group
field: — criteria: — support: —
## Activities and timeline
tasks: — timetable: — outcomes: —
## Expected outcomes
learner outcomes: — organisational outcomes: —
## Risks
activities are —
## Partners needed
names: — expertise: —
`,
      totalTokens: 80,
      provider: { id: 'openai' },
    });

    const res = await request(app)
      .post('/api/plans')
      .set('Authorization', 'Bearer t')
      .send({
        prompt:
          'Our organisation wants Just Exchange for Green and Good Earth: a KA121 mobility sending 10 VET learners to Albania for two weeks on environmental responsibility. Selection is individual interviews. We will hold information meetings before and after. Ten participants have fewer opportunities. Receiving educational institutes in Albania are aligned with the goals.',
      });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('DRAFT_NOT_READY');
    expect(res.body.error).toMatch(/not ready to export/i);
    expect(res.body.gaps.some((gap) => /KA121|placeholder|concept/i.test(gap))).toBe(true);
  });
});
