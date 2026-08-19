import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const { supabaseAdminMock } = vi.hoisted(() => ({
  supabaseAdminMock: {
    from: vi.fn(),
    auth: { getUser: vi.fn() },
    storage: { from: vi.fn() },
  },
}));

vi.mock('../config/supabase.js', () => ({ supabaseAdmin: supabaseAdminMock }));

const { app } = await import('../app.js');
const { queueFromResults } = await import('../test/supabaseMock.js');

const USER = { id: 'user-1', email: 'a@b.com' };
const GRANT_ROW = {
  id: '11111111-1111-1111-1111-111111111111',
  user_id: USER.id,
  action_code: 'KA122',
  title: 'Hospitality mobility',
  answers: { summary: 'Six tutors to Spain' },
  path: ['summary'],
  status: 'draft',
  percent_complete: 10,
  document_id: null,
  content_md: null,
  created_at: '2026-08-01T00:00:00.000Z',
  updated_at: '2026-08-01T00:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  supabaseAdminMock.auth.getUser.mockResolvedValue({ data: { user: USER }, error: null });
});

describe('GET /api/grants', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/grants');
    expect(res.status).toBe(401);
  });

  it('lists the caller\'s grant interviews', async () => {
    queueFromResults(supabaseAdminMock.from, [{ data: [GRANT_ROW], error: null }]);
    const res = await request(app).get('/api/grants').set('Authorization', 'Bearer t');
    expect(res.status).toBe(200);
    expect(res.body.grants).toHaveLength(1);
    expect(res.body.grants[0].actionCode).toBe('KA122');
    expect(res.body.grants[0].answers.summary).toContain('tutors');
  });

  it('returns 503 when grant_applications is missing', async () => {
    queueFromResults(supabaseAdminMock.from, [{
      data: null,
      error: {
        code: 'PGRST205',
        message: "Could not find the table 'public.grant_applications' in the schema cache",
      },
    }]);
    const res = await request(app).get('/api/grants').set('Authorization', 'Bearer t');
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('GRANT_TABLE_MISSING');
  });
});

describe('POST /api/grants', () => {
  it('creates an unconfirmed draft without an action code', async () => {
    queueFromResults(supabaseAdminMock.from, [
      { data: { ...GRANT_ROW, action_code: 'PENDING', action_confirmed: false, title: 'Untitled application' }, error: null },
    ]);
    const res = await request(app)
      .post('/api/grants')
      .set('Authorization', 'Bearer t')
      .send({ title: 'Untitled application' });
    expect(res.status).toBe(201);
    expect(res.body.grant.actionCode).toBe('PENDING');
    expect(res.body.grant.actionConfirmed).toBe(false);
  });

  it('creates a server-backed interview', async () => {
    queueFromResults(supabaseAdminMock.from, [{ data: GRANT_ROW, error: null }]);
    const res = await request(app)
      .post('/api/grants')
      .set('Authorization', 'Bearer t')
      .send({ actionCode: 'KA122', title: 'Hospitality mobility', answers: { summary: 'Six tutors to Spain' } });
    expect(res.status).toBe(201);
    expect(res.body.grant.id).toBe(GRANT_ROW.id);
  });
});

describe('PATCH /api/grants/:id', () => {
  it('updates answers and status', async () => {
    queueFromResults(supabaseAdminMock.from, [
      { data: { ...GRANT_ROW, status: 'in_review', percent_complete: 100 }, error: null },
    ]);
    const res = await request(app)
      .patch(`/api/grants/${GRANT_ROW.id}`)
      .set('Authorization', 'Bearer t')
      .send({ status: 'in_review', percentComplete: 100, answers: { summary: 'Six tutors to Spain' } });
    expect(res.status).toBe(200);
    expect(res.body.grant.status).toBe('in_review');
  });
});
