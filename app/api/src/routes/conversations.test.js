import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const { supabaseAdminMock, createSignedUrlMock } = vi.hoisted(() => {
  const createSignedUrlMock = vi.fn();
  return {
    createSignedUrlMock,
    supabaseAdminMock: {
      from: vi.fn(),
      auth: { getUser: vi.fn() },
      storage: { from: vi.fn(() => ({ createSignedUrl: createSignedUrlMock })) },
    },
  };
});

vi.mock('../config/supabase.js', () => ({ supabaseAdmin: supabaseAdminMock }));

const { app } = await import('../app.js');
const { queueFromResults } = await import('../test/supabaseMock.js');

const USER = { id: 'user-1', email: 'a@b.com' };

beforeEach(() => {
  vi.clearAllMocks();
  supabaseAdminMock.auth.getUser.mockResolvedValue({ data: { user: USER }, error: null });
  createSignedUrlMock.mockResolvedValue({ data: { signedUrl: 'https://signed.example/file' }, error: null });
});

describe('GET /api/conversations', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/conversations');
    expect(res.status).toBe(401);
  });

  it('returns 500 when the query fails', async () => {
    queueFromResults(supabaseAdminMock.from, [{ data: null, error: { message: 'db down' } }]);
    const res = await request(app).get('/api/conversations').set('Authorization', 'Bearer t');
    expect(res.status).toBe(500);
  });

  it('lists the caller\'s conversations', async () => {
    const rows = [{ id: 'c1', agent_id: 'budget', title: 'Budget chat', updated_at: 't1', created_at: 't0' }];
    queueFromResults(supabaseAdminMock.from, [{ data: rows, error: null }]);

    const res = await request(app).get('/api/conversations').set('Authorization', 'Bearer t');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ conversations: rows });
  });
});

describe('GET /api/conversations/:id/messages', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/conversations/c1/messages');
    expect(res.status).toBe(401);
  });

  it('returns 404 when the conversation does not belong to the caller', async () => {
    queueFromResults(supabaseAdminMock.from, [{ data: null, error: { message: 'not found' } }]);
    const res = await request(app)
      .get('/api/conversations/not-mine/messages')
      .set('Authorization', 'Bearer t');
    expect(res.status).toBe(404);
  });

  it('returns messages with a signed URL attached to any attachment', async () => {
    queueFromResults(supabaseAdminMock.from, [
      { data: { id: 'c1', agent_id: 'budget' }, error: null },
      {
        data: [
          { id: 'm1', role: 'user', content: 'hi', agent_id: 'budget', attachment_path: null, attachment_name: null, created_at: 't1' },
          { id: 'm2', role: 'user', content: 'see file', agent_id: 'budget', attachment_path: 'user-1/x.pdf', attachment_name: 'x.pdf', created_at: 't2' },
        ],
        error: null,
      },
    ]);

    const res = await request(app).get('/api/conversations/c1/messages').set('Authorization', 'Bearer t');

    expect(res.status).toBe(200);
    expect(res.body.messages[0].attachment_url).toBeUndefined();
    expect(res.body.messages[1].attachment_url).toBe('https://signed.example/file');
    expect(createSignedUrlMock).toHaveBeenCalledTimes(1);
    expect(createSignedUrlMock).toHaveBeenCalledWith('user-1/x.pdf', 3600);
  });
});

describe('DELETE /api/conversations/:id', () => {
  it('requires authentication', async () => {
    const res = await request(app).delete('/api/conversations/c1');
    expect(res.status).toBe(401);
  });

  it('returns 404 when nothing matched (not the caller\'s conversation)', async () => {
    queueFromResults(supabaseAdminMock.from, [{ data: null, error: null, count: 0 }]);
    const res = await request(app).delete('/api/conversations/not-mine').set('Authorization', 'Bearer t');
    expect(res.status).toBe(404);
  });

  it('deletes and returns 204 on success', async () => {
    queueFromResults(supabaseAdminMock.from, [{ data: null, error: null, count: 1 }]);
    const res = await request(app).delete('/api/conversations/c1').set('Authorization', 'Bearer t');
    expect(res.status).toBe(204);
  });
});
