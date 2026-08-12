import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getUserMock } = vi.hoisted(() => ({ getUserMock: vi.fn() }));
vi.mock('../config/supabase.js', () => ({
  supabaseAdmin: { auth: { getUser: getUserMock } },
}));

const { verifyAuth } = await import('./auth.js');

function createRes() {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

describe('verifyAuth', () => {
  beforeEach(() => {
    getUserMock.mockReset();
  });

  it('rejects a request with no Authorization header', async () => {
    const req = { headers: {} };
    const res = createRes();
    const next = vi.fn();

    await verifyAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing bearer token' });
    expect(next).not.toHaveBeenCalled();
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it('rejects a header that is not in "Bearer <token>" form', async () => {
    const req = { headers: { authorization: 'Token abc123' } };
    const res = createRes();
    const next = vi.fn();

    await verifyAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects when Supabase reports the token invalid', async () => {
    getUserMock.mockResolvedValue({ data: null, error: { message: 'bad token' } });
    const req = { headers: { authorization: 'Bearer bad' } };
    const res = createRes();
    const next = vi.fn();

    await verifyAuth(req, res, next);

    expect(getUserMock).toHaveBeenCalledWith('bad');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects when Supabase returns no error but also no user', async () => {
    getUserMock.mockResolvedValue({ data: {}, error: null });
    const req = { headers: { authorization: 'Bearer weird' } };
    const res = createRes();
    const next = vi.fn();

    await verifyAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts an httpOnly access cookie when the Authorization header is missing', async () => {
    const user = { id: 'user-1', email: 'a@b.com' };
    getUserMock.mockResolvedValue({ data: { user }, error: null });
    const req = { headers: {}, cookies: { ea_access_token: 'cookie-token' } };
    const res = createRes();
    const next = vi.fn();

    await verifyAuth(req, res, next);

    expect(getUserMock).toHaveBeenCalledWith('cookie-token');
    expect(req.user).toEqual(user);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('attaches req.user and req.userToken and calls next on a valid token', async () => {
    const user = { id: 'user-1', email: 'a@b.com' };
    getUserMock.mockResolvedValue({ data: { user }, error: null });
    const req = { headers: { authorization: 'Bearer good-token' } };
    const res = createRes();
    const next = vi.fn();

    await verifyAuth(req, res, next);

    expect(req.user).toEqual(user);
    expect(req.userToken).toBe('good-token');
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 500 if the Supabase call throws unexpectedly', async () => {
    getUserMock.mockRejectedValue(new Error('network down'));
    const req = { headers: { authorization: 'Bearer good-token' } };
    const res = createRes();
    const next = vi.fn();

    await verifyAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Auth check failed' });
    expect(next).not.toHaveBeenCalled();
  });
});
