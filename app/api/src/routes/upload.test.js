import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const { supabaseAdminMock, uploadMock } = vi.hoisted(() => {
  const uploadMock = vi.fn();
  return {
    uploadMock,
    supabaseAdminMock: {
      from: vi.fn(),
      auth: { getUser: vi.fn() },
      storage: { from: vi.fn(() => ({ upload: uploadMock })) },
    },
  };
});

vi.mock('../config/supabase.js', () => ({ supabaseAdmin: supabaseAdminMock }));

const { app } = await import('../app.js');

const USER = { id: 'user-1', email: 'a@b.com' };

beforeEach(() => {
  vi.clearAllMocks();
  supabaseAdminMock.auth.getUser.mockResolvedValue({ data: { user: USER }, error: null });
  uploadMock.mockResolvedValue({ data: {}, error: null });
});

describe('POST /api/upload', () => {
  it('requires authentication', async () => {
    const res = await request(app).post('/api/upload');
    expect(res.status).toBe(401);
  });

  it('rejects a request with no file', async () => {
    const res = await request(app).post('/api/upload').set('Authorization', 'Bearer t');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/file is required/);
  });

  it('rejects a disallowed file type', async () => {
    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', 'Bearer t')
      .attach('file', Buffer.from('#!/bin/sh\n'), {
        filename: 'script.sh',
        contentType: 'application/x-sh',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Unsupported file type/);
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it('rejects a file over the 10MB limit', async () => {
    const bigBuffer = Buffer.alloc(10 * 1024 * 1024 + 1);
    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', 'Bearer t')
      .attach('file', bigBuffer, { filename: 'huge.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/too large/i);
  }, 15000);

  it('uploads a valid file under the caller\'s own folder', async () => {
    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', 'Bearer t')
      .attach('file', Buffer.from('%PDF-1.4 fake'), {
        filename: 'budget plan.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('budget plan.pdf');
    expect(res.body.contentType).toBe('application/pdf');
    expect(res.body.path.startsWith(`${USER.id}/`)).toBe(true);
    expect(res.body.path).toContain('budget_plan.pdf');
    expect(uploadMock).toHaveBeenCalledTimes(1);
  });

  it('returns 500 when the Storage upload fails', async () => {
    uploadMock.mockResolvedValue({ data: null, error: { message: 'bucket missing' } });

    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', 'Bearer t')
      .attach('file', Buffer.from('hello'), { filename: 'a.txt', contentType: 'text/plain' });

    expect(res.status).toBe(500);
  });
});
