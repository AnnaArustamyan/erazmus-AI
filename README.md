# EU Grantwriter Assistant

AI assistant for NGOs and youth organisations writing Erasmus+ grant applications.

## Layout

```
app/
  api/     Express API (auth, chat SSE, uploads, documents)
  web/     React + Vite + Tailwind UI
docs/      Deploy and stack notes
docker-compose.yml
```

## Stack

- **Web:** React + Vite + Tailwind — [`app/web`](app/web)
- **API:** Express — [`app/api`](app/api)
- **Data / Auth / Storage:** Supabase
- **AI:** Moonshot (server-side only)
- **Deploy:** Docker Compose on a single VPS

## Quick start (local)

```bash
cp app/api/.env.example app/api/.env
# Fill SUPABASE_* and MOONSHOT_API_KEY
# Run SQL in app/api/migrations/*.sql in the Supabase SQL editor (in order)

cd app/api && npm install && npm run dev    # http://localhost:4000
cd app/web && npm install && npm run dev    # Vite UI
```

Or with Docker:

```bash
cp app/api/.env.example app/api/.env   # set CLIENT_ORIGIN=http://localhost:8080
docker compose up --build
```

- API: http://localhost:4000  
- Web: http://localhost:8080  

## Tests

```bash
cd app/api && npm test
cd app/web && npx vitest run
```

## Production

See [docs/DEPLOY.md](docs/DEPLOY.md).

## Features

- Auth (Supabase), 4 specialized agents, streaming chat, attachments, token quotas
- Chat-based application draft → **PDF** download (DOCX and Markdown also available)
- Rate limiting, helmet, CORS locked to `CLIENT_ORIGIN`

## Known follow-ups

- Stripe billing
- Full Who/Where/When/What wizard UI
