import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const { supabaseAdminMock, streamChatCompletionMock } = vi.hoisted(() => ({
  supabaseAdminMock: {
    from: vi.fn(),
    auth: { getUser: vi.fn() },
    storage: { from: vi.fn() },
  },
  streamChatCompletionMock: vi.fn(),
}));

vi.mock('../config/supabase.js', () => ({ supabaseAdmin: supabaseAdminMock }));
vi.mock('../config/moonshot.js', () => ({ streamChatCompletion: streamChatCompletionMock }));

const { app } = await import('../app.js');
const { queueFromResults } = await import('../test/supabaseMock.js');

const USER = { id: 'user-1', email: 'a@b.com' };

function parseSSE(text) {
  return text
    .split('\n\n')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => JSON.parse(chunk.replace(/^data: /, '')));
}

beforeEach(() => {
  vi.clearAllMocks();
  supabaseAdminMock.auth.getUser.mockResolvedValue({ data: { user: USER }, error: null });
});

describe('POST /api/chat — validation', () => {
  it('requires authentication', async () => {
    const res = await request(app).post('/api/chat').send({ agentId: 'budget', message: 'hi' });
    expect(res.status).toBe(401);
  });

  it('rejects an unknown agentId', async () => {
    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', 'Bearer t')
      .send({ agentId: 'not-real', message: 'hi' });
    expect(res.status).toBe(400);
  });

  it('rejects an empty message with no attachment', async () => {
    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', 'Bearer t')
      .send({ agentId: 'budget', message: '   ' });
    expect(res.status).toBe(400);
  });

  it('rejects an attachment path outside the caller\'s own folder', async () => {
    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', 'Bearer t')
      .send({ agentId: 'budget', message: 'hi', attachmentPath: 'someone-else/file.pdf' });
    expect(res.status).toBe(403);
  });
});

describe('POST /api/chat — quota and lookups', () => {
  it('returns 404 when the caller has no profile row', async () => {
    queueFromResults(supabaseAdminMock.from, [{ data: null, error: { message: 'not found' } }]);

    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', 'Bearer t')
      .send({ agentId: 'budget', message: 'hi' });

    expect(res.status).toBe(404);
  });

  it('returns 402 when the token quota is exhausted', async () => {
    queueFromResults(supabaseAdminMock.from, [
      { data: { monthly_token_limit: 100, tokens_used: 100 }, error: null },
    ]);

    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', 'Bearer t')
      .send({ agentId: 'budget', message: 'hi' });

    expect(res.status).toBe(402);
    expect(streamChatCompletionMock).not.toHaveBeenCalled();
  });

  it('returns 404 when a given conversationId does not belong to the caller', async () => {
    queueFromResults(supabaseAdminMock.from, [
      { data: { monthly_token_limit: 100000, tokens_used: 0 }, error: null },
      { data: null, error: { message: 'not found' } },
    ]);

    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', 'Bearer t')
      .send({ agentId: 'budget', message: 'hi', conversationId: 'not-mine' });

    expect(res.status).toBe(404);
  });
});

describe('POST /api/chat — streaming happy path', () => {
  it('streams deltas, then a done event, and persists the exchange', async () => {
    queueFromResults(supabaseAdminMock.from, [
      { data: { monthly_token_limit: 100000, tokens_used: 0 }, error: null }, // profile
      { data: { id: 'conv-1', agent_id: 'budget', user_id: USER.id }, error: null }, // new conversation
      { data: [], error: null }, // history
      { data: null, error: null }, // insert user message
      { data: null, error: null }, // insert assistant message
      { data: null, error: null }, // update conversation.updated_at
      { data: null, error: null }, // update users.tokens_used
    ]);
    streamChatCompletionMock.mockImplementation(async ({ onDelta, onUsage }) => {
      onDelta('Hello');
      onDelta(' world');
      onUsage({ total_tokens: 42 });
    });

    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', 'Bearer t')
      .send({ agentId: 'budget', message: 'What is the travel band?' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/event-stream/);

    const events = parseSSE(res.text);
    expect(events[0]).toEqual({ delta: 'Hello' });
    expect(events[1]).toEqual({ delta: ' world' });
    expect(events[2]).toEqual({
      done: true,
      conversationId: 'conv-1',
      tokensUsed: 42,
      tokenLimit: 100000,
    });
  });

  it('sends an error event and stops if the Moonshot stream fails mid-flight', async () => {
    queueFromResults(supabaseAdminMock.from, [
      { data: { monthly_token_limit: 100000, tokens_used: 0 }, error: null },
      { data: { id: 'conv-2', agent_id: 'budget', user_id: USER.id }, error: null },
      { data: [], error: null },
      { data: null, error: null },
    ]);
    streamChatCompletionMock.mockRejectedValue(new Error('upstream exploded'));

    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', 'Bearer t')
      .send({ agentId: 'budget', message: 'hi' });

    const events = parseSSE(res.text);
    expect(events).toEqual([{ error: 'AI provider request failed. Please try again.' }]);
  });

  it('allows an attachment-only message with empty text', async () => {
    queueFromResults(supabaseAdminMock.from, [
      { data: { monthly_token_limit: 100000, tokens_used: 0 }, error: null },
      { data: { id: 'conv-3', agent_id: 'budget', user_id: USER.id }, error: null },
      { data: [], error: null },
      { data: null, error: null },
      { data: null, error: null },
      { data: null, error: null },
      { data: null, error: null },
    ]);
    streamChatCompletionMock.mockImplementation(async ({ onDelta }) => {
      onDelta('Got it.');
    });

    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', 'Bearer t')
      .send({ agentId: 'budget', message: '', attachmentPath: `${USER.id}/abc-plan.pdf`, attachmentName: 'plan.pdf' });

    expect(res.status).toBe(200);
    const events = parseSSE(res.text);
    expect(events.at(-1).done).toBe(true);
  });
});
