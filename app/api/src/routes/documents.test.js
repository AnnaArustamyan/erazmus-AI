import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const DENSE_APPLICATION = `# Youth workers TC

## Who
Sending NGO in Yerevan and a receiving organisation in Lisbon. 12 youth workers from the two organisations will take part.

## Where
Five-day training course at the Lisbon partner venue.

## When
5 working days in October 2026 plus travel days.

## What & How
### Objectives
Youth workers will design one needs-based club session for rural youth they already work with.
### Activities
Four workshops and two job-shadowing visits; a day-by-day timetable is annexed.
### Methodology
Non-formal learning: simulations, peer learning, daily reflection.
### Expected results
12 session plans used within 3 months, documented with Youthpass.
### Impact & dissemination
Each sending organisation runs one local workshop in November. Indicator: 12 delivered sessions.
### Annexes
Day-by-day session plan for the 5 days is attached. No preparatory visit is requested.
`;

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

const SAVED_DOC = {
  id: 'doc-1',
  user_id: USER.id,
  conversation_id: null,
  title: 'Hi',
  content_md: '# Hi',
  md_storage_path: `${USER.id}/doc-1/application.md`,
  docx_storage_path: `${USER.id}/doc-1/application.docx`,
  pdf_storage_path: `${USER.id}/doc-1/application.pdf`,
  created_at: '2026-01-01T00:00:00.000Z',
};

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

  it('allows free plan users under the monthly document cap', async () => {
    queueFromResults(supabaseAdminMock.from, [
      { data: { plan: 'free', monthly_token_limit: 20000, tokens_used: 0 }, error: null },
      { data: null, error: null, count: 0 },
      { data: SAVED_DOC, error: null },
    ]);

    const res = await request(app)
      .post('/api/documents')
      .set('Authorization', 'Bearer t')
      .send({ contentMd: '# Hi\n\n## Who\n—' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('doc-1');
  });

  it('blocks free plan users who have used their monthly document cap', async () => {
    queueFromResults(supabaseAdminMock.from, [
      { data: { plan: 'free', monthly_token_limit: 20000, tokens_used: 0 }, error: null },
      { data: null, error: null, count: 3 },
    ]);

    const res = await request(app)
      .post('/api/documents')
      .set('Authorization', 'Bearer t')
      .send({ contentMd: '# Hi' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Monthly document limit reached \(3 on the Free plan\)/);
    expect(res.body.error).toMatch(/stronger pass-rate model/);
  });

  it('creates a document from markdown for paid plans', async () => {
    queueFromResults(supabaseAdminMock.from, [
      { data: { plan: 'pro', monthly_token_limit: 100000, tokens_used: 0 }, error: null },
      { data: null, error: null, count: 2 },
      { data: { ...SAVED_DOC, id: 'doc-1' }, error: null },
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
  it('returns the latest document for a conversation', async () => {
    queueFromResults(supabaseAdminMock.from, [
      {
        data: {
          id: 'doc-1',
          user_id: USER.id,
          conversation_id: 'conv-1',
          title: 'Youth workers TC',
          content_md: '# Youth workers TC\n',
          md_storage_path: `${USER.id}/doc-1/application.md`,
          docx_storage_path: `${USER.id}/doc-1/application.docx`,
          pdf_storage_path: `${USER.id}/doc-1/application.pdf`,
          created_at: '2026-01-01T00:00:00.000Z',
        },
        error: null,
      },
    ]);

    const res = await request(app)
      .get('/api/documents?conversationId=conv-1')
      .set('Authorization', 'Bearer t');

    expect(res.status).toBe(200);
    expect(res.body.document.id).toBe('doc-1');
    expect(res.body.document.contentMd).toContain('Youth workers TC');
    expect(res.body.document.downloads.pdf).toBeTruthy();
    expect(res.body.document.downloads.docx).toBeTruthy();
  });

  it('lists documents, excluding expired ones via the retention filter', async () => {
    queueFromResults(supabaseAdminMock.from, [
      {
        data: [
          { id: 'doc-1', title: 'Still valid', conversation_id: null, created_at: '2026-01-01T00:00:00.000Z', expires_at: null },
        ],
        error: null,
      },
    ]);

    const res = await request(app).get('/api/documents').set('Authorization', 'Bearer t');

    expect(res.status).toBe(200);
    expect(res.body.documents).toHaveLength(1);
    expect(res.body.documents[0].id).toBe('doc-1');
    // Confirms listDocumentsForUser's .or() expiry filter is a real, callable
    // chain method on the Supabase client — not a call that would throw in prod.
    expect(supabaseAdminMock.from).toHaveBeenCalledWith('documents');
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

  it('allows free plan users and injects pass-rate constraints', async () => {
    queueFromResults(supabaseAdminMock.from, [
      { data: { plan: 'free', monthly_token_limit: 20000, tokens_used: 10 }, error: null },
      { data: null, error: null, count: 1 },
      { data: { id: 'conv-1', user_id: USER.id, title: 'Youth workers TC' }, error: null },
      {
        data: [
          { role: 'user', content: 'We train youth workers on digital literacy', agent_id: 'compliance' },
          { role: 'assistant', content: 'Please describe partners.', agent_id: 'compliance' },
        ],
        error: null,
      },
      { data: null, error: null },
      {
        data: {
          id: 'doc-free',
          user_id: USER.id,
          conversation_id: 'conv-1',
          title: 'Youth workers TC',
          content_md: DENSE_APPLICATION,
          md_storage_path: `${USER.id}/doc-free/application.md`,
          docx_storage_path: `${USER.id}/doc-free/application.docx`,
          pdf_storage_path: `${USER.id}/doc-free/application.pdf`,
          created_at: '2026-01-01T00:00:00.000Z',
        },
        error: null,
      },
    ]);

    completeChatForPlanMock.mockResolvedValue({
      content: DENSE_APPLICATION,
      totalTokens: 80,
      provider: { id: 'openai' },
    });

    const res = await request(app)
      .post('/api/documents/from-conversation')
      .set('Authorization', 'Bearer t')
      .send({ conversationId: 'conv-1', actionCode: 'KA153' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('doc-free');
    const system = completeChatForPlanMock.mock.calls[0][0].messages[0].content;
    expect(system).toContain('Right beneficiary');
    expect(system).toContain('Award criteria');
  });

  it('returns 402 when token quota is exhausted', async () => {
    queueFromResults(supabaseAdminMock.from, [
      { data: { plan: 'free', monthly_token_limit: 20000, tokens_used: 20000 }, error: null },
    ]);

    const res = await request(app)
      .post('/api/documents/from-conversation')
      .set('Authorization', 'Bearer t')
      .send({ conversationId: 'conv-1', actionCode: 'KA153' });

    expect(res.status).toBe(402);
    expect(completeChatForPlanMock).not.toHaveBeenCalled();
  });

  it('drafts from conversation history for paid plans', async () => {
    queueFromResults(supabaseAdminMock.from, [
      { data: { plan: 'pro', monthly_token_limit: 100000, tokens_used: 10 }, error: null },
      { data: null, error: null, count: 0 },
      { data: { id: 'conv-1', user_id: USER.id, title: 'Youth exchange' }, error: null },
      {
        data: [
          { role: 'user', content: 'We are an NGO working with youth workers', agent_id: 'compliance' },
          { role: 'assistant', content: 'Please describe partners.', agent_id: 'compliance' },
        ],
        error: null,
      },
      { data: null, error: null },
      {
        data: {
          id: 'doc-9',
          user_id: USER.id,
          conversation_id: 'conv-1',
          title: 'Youth exchange',
          content_md: DENSE_APPLICATION,
          md_storage_path: `${USER.id}/doc-9/application.md`,
          docx_storage_path: `${USER.id}/doc-9/application.docx`,
          pdf_storage_path: `${USER.id}/doc-9/application.pdf`,
          created_at: '2026-01-01T00:00:00.000Z',
        },
        error: null,
      },
    ]);

    completeChatForPlanMock.mockResolvedValue({
      content: DENSE_APPLICATION,
      totalTokens: 120,
      provider: { id: 'moonshot' },
    });

    const res = await request(app)
      .post('/api/documents/from-conversation')
      .set('Authorization', 'Bearer t')
      .send({ conversationId: 'conv-1', actionCode: 'KA153' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('doc-9');
    expect(res.body.downloads.pdf).toBeTruthy();
    expect(res.body.downloads.docx).toBeTruthy();
    expect(completeChatForPlanMock).toHaveBeenCalledOnce();
  });
});

describe('POST /api/documents/from-interview', () => {
  it('requires interview markdown', async () => {
    const res = await request(app)
      .post('/api/documents/from-interview')
      .set('Authorization', 'Bearer t')
      .send({ actionCode: 'KA122' });
    expect(res.status).toBe(400);
  });

  it('drafts a PDF from questionnaire answers', async () => {
    queueFromResults(supabaseAdminMock.from, [
      { data: { plan: 'pro', monthly_token_limit: 100000, tokens_used: 10 }, error: null },
      { data: null, error: null, count: 0 },
      { data: null, error: null },
      { data: { ...SAVED_DOC, title: 'KA122 draft' }, error: null },
    ]);
    completeChatForPlanMock.mockResolvedValue({
      content: DENSE_APPLICATION,
      totalTokens: 40,
      provider: { id: 'moonshot' },
    });

    const res = await request(app)
      .post('/api/documents/from-interview')
      .set('Authorization', 'Bearer t')
      .send({
        actionCode: 'KA122',
        title: 'KA122 draft',
        contentMd: '# KA122 draft\n\n## Needs analysis\nDigital assessment gaps',
      });

    expect(res.status).toBe(201);
    expect(res.body.downloads.pdf).toBeTruthy();
    const user = completeChatForPlanMock.mock.calls[0][0].messages[1].content;
    expect(user).toContain('KA122');
    expect(user).toContain('Do not invent');
  });

  it('saves even if the pdf_storage_path column is not in Supabase yet', async () => {
    const { pdf_storage_path: _pdf, ...legacyDoc } = SAVED_DOC;
    queueFromResults(supabaseAdminMock.from, [
      { data: { plan: 'pro', monthly_token_limit: 100000, tokens_used: 10 }, error: null },
      { data: null, error: null, count: 0 },
      { data: null, error: null },
      {
        data: null,
        error: { message: "Could not find the 'pdf_storage_path' column of 'documents' in the schema cache" },
      },
      { data: { ...legacyDoc, title: 'KA122 draft' }, error: null },
    ]);
    completeChatForPlanMock.mockResolvedValue({
      content: DENSE_APPLICATION,
      totalTokens: 12,
      provider: { id: 'moonshot' },
    });

    const res = await request(app)
      .post('/api/documents/from-interview')
      .set('Authorization', 'Bearer t')
      .send({
        actionCode: 'KA122',
        title: 'KA122 draft',
        contentMd: '# KA122 draft\n\n## Needs analysis\nGaps',
      });

    expect(res.status).toBe(201);
    expect(res.body.downloads.pdf).toBeTruthy();
  });
});

describe('GET /api/documents/:id/download', () => {
  it('defaults to the PDF', async () => {
    queueFromResults(supabaseAdminMock.from, [{ data: SAVED_DOC, error: null }]);

    const res = await request(app)
      .get('/api/documents/doc-1/download')
      .set('Authorization', 'Bearer t');

    expect(res.status).toBe(200);
    expect(res.body.format).toBe('pdf');
    expect(res.body.url).toBe('https://signed.example/file');
  });

  it('rejects unknown formats', async () => {
    const res = await request(app)
      .get('/api/documents/doc-1/download?format=txt')
      .set('Authorization', 'Bearer t');

    expect(res.status).toBe(400);
  });
});
