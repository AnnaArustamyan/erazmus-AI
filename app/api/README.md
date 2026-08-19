# Erasmus AI — API (`app/api`)

Express API: auth, streaming chat, conversations, uploads, documents.

## Run

```bash
cp .env.example .env   # fill Supabase + Moonshot
npm install
npm run dev            # http://localhost:4000
```

Apply SQL in `migrations/` (001→012) via Supabase SQL Editor. If `/api/grants` returns that `grant_applications` is missing, run `011_grant_applications.sql` then `012_application_state.sql`.

## Tests

```bash
npm test
```

## Security notes

- `SUPABASE_SERVICE_ROLE_KEY` and `MOONSHOT_API_KEY` are server-only.
- Chat/document routes return `503` if Moonshot is not configured.
- In production, missing required env vars fail startup (`validateEnv`).
