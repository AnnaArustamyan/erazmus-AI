import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const { supabaseAdminMock } = vi.hoisted(() => ({
  supabaseAdminMock: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
      signInWithPassword: vi.fn(),
      refreshSession: vi.fn(),
      admin: {
        createUser: vi.fn(),
        deleteUser: vi.fn(),
        signOut: vi.fn(),
        updateUserById: vi.fn(),
      },
    },
    storage: { from: vi.fn() },
  },
}));

vi.mock('../config/supabase.js', () => ({ supabaseAdmin: supabaseAdminMock }));

const { app } = await import('../app.js');
const { queueFromResults } = await import('../test/supabaseMock.js');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/auth/register', () => {
  it('rejects a missing email or password', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'a@b.com' });
    expect(res.status).toBe(400);
    expect(supabaseAdminMock.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it('passes through a Supabase error (e.g. weak password) as 400', async () => {
    supabaseAdminMock.auth.admin.createUser.mockResolvedValue({
      data: null,
      error: { message: 'Password should be at least 6 characters' },
    });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'weak@example.com', password: '123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/at least 6 characters/);
  });

  it('rolls back the auth user if the profile insert fails', async () => {
    supabaseAdminMock.auth.admin.createUser.mockResolvedValue({
      data: { user: { id: 'u2', email: 'fail@example.com' } },
      error: null,
    });
    queueFromResults(supabaseAdminMock.from, [{ data: null, error: { message: 'insert failed' } }]);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'fail@example.com', password: 'password123' });

    expect(res.status).toBe(500);
    expect(supabaseAdminMock.auth.admin.deleteUser).toHaveBeenCalledWith('u2');
  });

  it('registers a new user and creates a profile row', async () => {
    supabaseAdminMock.auth.admin.createUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'new@example.com' } },
      error: null,
    });
    queueFromResults(supabaseAdminMock.from, [{ data: null, error: null }]);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'new@example.com', password: 'password123', name: 'Nick' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ user: { id: 'u1', email: 'new@example.com' } });
    expect(supabaseAdminMock.auth.admin.deleteUser).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/login', () => {
  it('rejects a missing email or password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.com' });
    expect(res.status).toBe(400);
    expect(supabaseAdminMock.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('returns 401 on invalid credentials', async () => {
    supabaseAdminMock.auth.signInWithPassword.mockResolvedValue({
      data: null,
      error: { message: 'Invalid login credentials' },
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nouser@example.com', password: 'wrongpass' });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Invalid login credentials/);
  });

  it('returns the session on success', async () => {
    supabaseAdminMock.auth.signInWithPassword.mockResolvedValue({
      data: {
        session: { access_token: 'at', refresh_token: 'rt', expires_at: 1234 },
        user: { id: 'u1', email: 'ok@example.com' },
      },
      error: null,
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ok@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      access_token: 'at',
      refresh_token: 'rt',
      expires_at: 1234,
      user: { id: 'u1', email: 'ok@example.com' },
    });
  });
});

describe('POST /api/auth/refresh', () => {
  it('rejects a missing refresh_token', async () => {
    const res = await request(app).post('/api/auth/refresh').send({});
    expect(res.status).toBe(400);
  });

  it('returns 401 when the refresh token is invalid', async () => {
    supabaseAdminMock.auth.refreshSession.mockResolvedValue({
      data: null,
      error: { message: 'Invalid Refresh Token' },
    });

    const res = await request(app).post('/api/auth/refresh').send({ refresh_token: 'stale' });

    expect(res.status).toBe(401);
  });

  it('returns a fresh session on success', async () => {
    supabaseAdminMock.auth.refreshSession.mockResolvedValue({
      data: {
        session: { access_token: 'at2', refresh_token: 'rt2', expires_at: 5678 },
        user: { id: 'u1', email: 'ok@example.com' },
      },
      error: null,
    });

    const res = await request(app).post('/api/auth/refresh').send({ refresh_token: 'rt' });

    expect(res.status).toBe(200);
    expect(res.body.access_token).toBe('at2');
  });
});

describe('POST /api/auth/logout', () => {
  it('requires authentication', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(401);
  });

  it('signs the caller out using their token', async () => {
    supabaseAdminMock.auth.getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.com' } },
      error: null,
    });
    supabaseAdminMock.auth.admin.signOut.mockResolvedValue({ error: null });

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', 'Bearer sometoken');

    expect(res.status).toBe(204);
    expect(supabaseAdminMock.auth.admin.signOut).toHaveBeenCalledWith('sometoken');
  });
});

describe('GET /api/auth/me', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 404 when no profile row exists', async () => {
    supabaseAdminMock.auth.getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.com' } },
      error: null,
    });
    queueFromResults(supabaseAdminMock.from, [{ data: null, error: { message: 'not found' } }]);

    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer sometoken');

    expect(res.status).toBe(404);
  });

  it('returns the profile on success', async () => {
    supabaseAdminMock.auth.getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.com' } },
      error: null,
    });
    const profile = {
      id: 'u1',
      email: 'a@b.com',
      name: 'Nick',
      plan: 'free',
      monthly_token_limit: 20000,
      tokens_used: 0,
      created_at: '2026-01-01T00:00:00.000Z',
    };
    queueFromResults(supabaseAdminMock.from, [
      { data: profile, error: null },
      { data: null, error: null, count: 0 },
    ]);

    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer sometoken');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('u1');
    expect(res.body.plan).toBe('free');
    expect(res.body.features).toEqual({
      plan: 'free',
      aiTier: 'standard',
      provider: 'openai',
      canGenerateDocuments: true,
      monthlyDocumentLimit: 3,
      canUseAdvancedAgents: true,
      monthlyTokenLimit: 20000,
    });
    expect(res.body.documents_used_this_month).toBe(0);
    expect(res.body.guide_year).toBe(2026);
  });
});

describe('PATCH /api/auth/me', () => {
  it('updates the display name', async () => {
    supabaseAdminMock.auth.getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.com' } },
      error: null,
    });
    supabaseAdminMock.auth.admin.updateUserById.mockResolvedValue({ data: {}, error: null });
    queueFromResults(supabaseAdminMock.from, [
      { data: null, error: null },
      {
        data: {
          id: 'u1',
          email: 'a@b.com',
          name: 'Ada',
          plan: 'free',
          monthly_token_limit: 20000,
          tokens_used: 0,
          created_at: '2026-01-01T00:00:00.000Z',
        },
        error: null,
      },
      { data: null, error: null, count: 1 },
    ]);

    const res = await request(app)
      .patch('/api/auth/me')
      .set('Authorization', 'Bearer t')
      .send({ name: 'Ada' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Ada');
    expect(supabaseAdminMock.auth.admin.updateUserById).toHaveBeenCalledWith('u1', {
      user_metadata: { name: 'Ada' },
    });
  });
});

describe('POST /api/auth/password', () => {
  it('rejects a wrong current password', async () => {
    supabaseAdminMock.auth.getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.com' } },
      error: null,
    });
    supabaseAdminMock.auth.signInWithPassword.mockResolvedValue({
      data: null,
      error: { message: 'Invalid login credentials' },
    });

    const res = await request(app)
      .post('/api/auth/password')
      .set('Authorization', 'Bearer t')
      .send({ currentPassword: 'wrong', newPassword: 'newpass1' });

    expect(res.status).toBe(401);
    expect(supabaseAdminMock.auth.admin.updateUserById).not.toHaveBeenCalled();
  });

  it('updates the password when the current one matches', async () => {
    supabaseAdminMock.auth.getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.com' } },
      error: null,
    });
    supabaseAdminMock.auth.signInWithPassword.mockResolvedValue({
      data: { session: {}, user: { id: 'u1' } },
      error: null,
    });
    supabaseAdminMock.auth.admin.updateUserById.mockResolvedValue({ data: {}, error: null });

    const res = await request(app)
      .post('/api/auth/password')
      .set('Authorization', 'Bearer t')
      .send({ currentPassword: 'oldpass1', newPassword: 'newpass1' });

    expect(res.status).toBe(204);
    expect(supabaseAdminMock.auth.admin.updateUserById).toHaveBeenCalledWith('u1', {
      password: 'newpass1',
    });
  });
});
