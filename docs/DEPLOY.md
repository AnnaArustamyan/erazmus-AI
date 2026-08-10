# Deploy on a cheap VPS

Target shape: one VPS + Docker Compose + managed Supabase (Auth/DB/Storage) + OpenAI (free) + Moonshot (paid).

## Why this layout

- Long-lived Node process for SSE chat (no serverless timeouts)
- Static web UI via nginx
- Secrets only in host env / `app/api/.env` (never baked into images or shipped to the browser)
- Defer Redis/workers until PDF or heavy background jobs are required

## Prerequisites

- Docker + Docker Compose on the VPS
- Domain pointed at the VPS (optional but recommended)
- Supabase project (EU region preferred for Erasmus+)
- OpenAI API key (free / Standard AI)
- Moonshot API key (paid / Advanced AI)

## Steps

1. Clone this repository on the VPS.
2. Copy env and fill real values:

```bash
cp app/api/.env.example app/api/.env
```

Required:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (API only)
- `OPENAI_API_KEY` (free plan chat)
- `MOONSHOT_API_KEY` (paid chat + document generation)
- `CLIENT_ORIGIN` — your public UI origin, e.g. `https://app.example.com`
- `NODE_ENV=production`

Optional:

- `OPENAI_BASE_URL` / `OPENAI_MODEL` (default `gpt-5.6-luna` — cheapest GPT-5.6 tier)
- `MOONSHOT_BASE_URL` / `MOONSHOT_MODEL` (default `moonshot-v1-8k`)
- `PORT` (default `4000`)

3. Run SQL migrations in order in the Supabase SQL Editor:

- `app/api/migrations/001_users.sql` … `007_free_tier_quota.sql`

4. Build and start:

```bash
export VITE_API_BASE_URL=https://api.example.com   # public URL browsers use to reach the API
docker compose up --build -d
```

For a simple single-host setup you can expose:

- web on `:8080` (or put Caddy/nginx TLS in front)
- api on `:4000` (or reverse-proxy `/api` to the api container)

5. Put TLS in front (Caddy or host nginx). Example Caddy idea:

- `app.example.com` → `web:80`
- `api.example.com` → `api:4000`

Set `CLIENT_ORIGIN` to the app origin and `VITE_API_BASE_URL` to the API origin at **image build time** for the web app.

## Health

`GET /api/health` → `{ "status": "ok" }`

Compose waits for this before marking the api service healthy.

## Backups

- Prefer Supabase automated backups (Pro) or scheduled `pg_dump` if self-hosting Postgres later
- Storage buckets `attachments` and `documents` are private; only the API service role writes

## Scaling later

Early paying users: one API replica is enough. Add a worker/Redis only when you introduce PDF generation or long offline jobs.
