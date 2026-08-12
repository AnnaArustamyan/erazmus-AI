import { vi } from 'vitest';

const CHAIN_METHODS = [
  'select',
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'in',
  'order',
  'limit',
  'single',
  'maybeSingle',
  'insert',
  'update',
  'delete',
  'upsert',
];

/**
 * Mimics a Supabase query builder: every chain method returns the same
 * thenable object, which resolves with `result` ({ data, error, count? })
 * when awaited — however deep the chain (.select().eq().single(), etc).
 */
export function makeQueryResult(result) {
  const builder = {};
  for (const method of CHAIN_METHODS) {
    builder[method] = vi.fn(() => builder);
  }
  builder.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return builder;
}

/**
 * Reconfigures an existing `from` vi.fn() to resolve with each entry of
 * `results` in order, one per `.from(...)` call — matching the exact
 * sequence the route under test makes them in. Extra calls beyond the
 * queue resolve with `{ data: null, error: null }`.
 */
export function queueFromResults(fromMock, results) {
  const queue = [...results];
  fromMock.mockImplementation(() =>
    makeQueryResult(queue.length ? queue.shift() : { data: null, error: null }),
  );
}

/**
 * Builds a supabaseAdmin mock. `fromResults` is an array of { data, error }
 * (or { data, error, count }) consumed in order, one per `.from(...)` call —
 * matching the exact sequence the route under test makes them in.
 */
export function makeSupabaseAdminMock({ fromResults = [], auth = {}, storage = {} } = {}) {
  const queue = [...fromResults];
  const from = vi.fn(() => makeQueryResult(queue.length ? queue.shift() : { data: null, error: null }));

  return {
    from,
    auth: {
      getUser: vi.fn(),
      signInWithPassword: vi.fn(),
      refreshSession: vi.fn(),
      admin: {
        createUser: vi.fn(),
        deleteUser: vi.fn(),
        signOut: vi.fn(),
      },
      ...auth,
    },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ data: {}, error: null }),
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://signed.example/file' }, error: null }),
        ...storage,
      })),
    },
  };
}
