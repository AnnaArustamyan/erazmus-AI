# Erasmus AI — API (`app/api`)

Express API: auth, streaming chat, conversations, uploads, documents.

## Run

```bash
cp .env.example .env   # fill Supabase + Moonshot
npm install
npm run dev            # http://localhost:4000
```

Apply SQL in `migrations/` (001→006) via Supabase SQL Editor.

## Tests

```bash
npm test
```

## Security notes

- `SUPABASE_SERVICE_ROLE_KEY` and `MOONSHOT_API_KEY` are server-only.
- Chat/document routes return `503` if Moonshot is not configured.
- In production, missing required env vars fail startup (`validateEnv`).
