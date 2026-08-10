import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { emptyApplicationMarkdown } from '../lib/applicationSchema.js';

const {
  supabaseAdminMock,
  completeChatForPlanMock,
  isProviderConfiguredForPlanMock,
} = vi.hoisted(() => ({
  supabaseAdminMock: {
    from: vi.fn(),
    auth: { getUser: vi.fn() },
    storage: { from: vi.fn() },
  },
  completeChatForPlanMock: vi.fn(),
  isProviderConfiguredForPlanMock: vi.fn(() => true),
}));

vi.mock('../config/supabase.js', () => ({ supabaseAdmin: supabaseAdminMock }));
vi.mock('../services/aiProvider.js', () => ({
  completeChatForPlan: completeChatForPlanMock,
  isProviderConfiguredForPlan: isProviderConfiguredForPlanMock,
}));

const { app } = await import('../app.js');
const { queueFromResults } = await import('../test/supabaseMock.js');

const USER = { id: 'user-1', email: 'a@b.com' };

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

describe('POST /api/documents', () => {
  it('requires authentication', async () => {
    const res = await request(app).post('/api/documents').send({ contentMd: '# Hi' });
    expect(res.status).toBe(401);
  });

  it('blocks free plan users', async () => {
    queueFromResults(supabaseAdminMock.from, [
      { data: { plan: 'free', monthly_token_limit: 20000, tokens_used: 0 }, error: null },
    ]);

    const res = await request(app)
      .post('/api/documents')
      .set('Authorization', 'Bearer t')
      .send({ contentMd: '# Hi' });

    expect(res.status).toBe(403);
  });

  it('creates a document from markdown for paid plans', async () => {
    queueFromResults(supabaseAdminMock.from, [
      { data: { plan: 'pro', monthly_token_limit: 100000, tokens_used: 0 }, error: null },
      {
        data: {
          id: 'doc-1',
          user_id: USER.id,
          conversation_id: null,
          title: 'Hi',
          content_md: '# Hi',
          md_storage_path: `${USER.id}/doc-1/application.md`,
          docx_storage_path: `${USER.id}/doc-1/application.docx`,
          created_at: '2026-01-01T00:00:00.000Z',
        },
        error: null,
      },
    ]);

    const res = await request(app)
      .post('/api/documents')
      .set('Authorization', 'Bearer t')
      .send({ contentMd: '# Hi\n\n## Who\n—' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('doc-1');
  });
});

describe('GET /api/documents', () => {
  it('lists documents for the caller', async () => {
    queueFromResults(supabaseAdminMock.from, [
      {
        data: [{ id: 'doc-1', title: 'App', conversation_id: null, created_at: '2026-01-01T00:00:00.000Z' }],
        error: null,
      },
    ]);

    const res = await request(app).get('/api/documents').set('Authorization', 'Bearer t');
    expect(res.status).toBe(200);
    expect(res.body.documents).toHaveLength(1);
  });
});

describe('POST /api/documents/from-conversation', () => {
  it('requires a conversationId', async () => {
    const res = await request(app)
      .post('/api/documents/from-conversation')
      .set('Authorization', 'Bearer t')
      .send({});
    expect(res.status).toBe(400);
  });

  it('blocks free plan users', async () => {
    queueFromResults(supabaseAdminMock.from, [
      { data: { plan: 'free', monthly_token_limit: 20000, tokens_used: 0 }, error: null },
    ]);

    const res = await request(app)
      .post('/api/documents/from-conversation')
      .set('Authorization', 'Bearer t')
      .send({ conversationId: 'conv-1' });

    expect(res.status).toBe(403);
    expect(completeChatForPlanMock).not.toHaveBeenCalled();
  });

  it('drafts from conversation history for paid plans', async () => {
    queueFromResults(supabaseAdminMock.from, [
      { data: { plan: 'pro', monthly_token_limit: 100000, tokens_used: 10 }, error: null },
      { data: { id: 'conv-1', user_id: USER.id, title: 'Youth exchange' }, error: null },
      {
        data: [
          { role: 'user', content: 'We are NGO X in Armenia', agent_id: 'compliance' },
          { role: 'assistant', content: 'Please describe partners.', agent_id: 'compliance' },
        ],
        error: null,
      },
      {
        data: {
          id: 'doc-9',
          user_id: USER.id,
          conversation_id: 'conv-1',
          title: 'Youth exchange',
          content_md: emptyApplicationMarkdown('Youth exchange'),
          md_storage_path: `${USER.id}/doc-9/application.md`,
          docx_storage_path: `${USER.id}/doc-9/application.docx`,
          created_at: '2026-01-01T00:00:00.000Z',
        },
        error: null,
      },
      { data: null, error: null },
    ]);

    completeChatForPlanMock.mockResolvedValue({
      content: emptyApplicationMarkdown('Youth exchange'),
      totalTokens: 120,
      provider: { id: 'moonshot' },
    });

    const res = await request(app)
      .post('/api/documents/from-conversation')
      .set('Authorization', 'Bearer t')
      .send({ conversationId: 'conv-1' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('doc-9');
    expect(res.body.downloads.docx).toBeTruthy();
    expect(completeChatForPlanMock).toHaveBeenCalledOnce();
  });
});
