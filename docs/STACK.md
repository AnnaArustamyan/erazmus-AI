# Stack review

## Choice

`app/web` (Vite SPA) + `app/api` (Express) + Supabase + Moonshot, deployed with Docker Compose on a single VPS.

## Layout

```
app/api   — Express API
app/web   — React UI
docs/     — deploy / product notes
```

## What is solid

- Clear API/web boundary; AI keys stay on the server
- SSE chat, agents, attachments, quotas, tests, CI
- Chat → application document (Markdown + DOCX)

## Deliberate non-goals (for now)

- No Vercel/Railway/Upstash split
- No Redis/worker until PDF or heavy jobs
- API remains JavaScript (TypeScript in `app/web` only)
- Stripe and full grant wizard UI are next, not blocking deploy

## Legacy Next.js

Previous Next/Prisma work is archived at `~/dev/erazmus-AI-legacy-next` for porting domain logic (wizard forms, billing schema ideas).
