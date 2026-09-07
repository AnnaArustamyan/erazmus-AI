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
- Plan routing: free → OpenAI **GPT-5.6 Luna** (standard), paid → Moonshot (advanced)
- Tight free quota (20k tokens/mo); document generation paid-only
- SSE chat, agents, attachments, quotas, tests, CI
- Chat → application document (**PDF** primary, plus Markdown + DOCX)

## Deliberate non-goals (for now)

- No Vercel/Railway/Upstash split
- No Redis/worker until heavy background jobs
- API remains JavaScript (TypeScript in `app/web` only)
- Billing and full grant wizard UI are next, not blocking deploy. **Not Stripe** — Armenia-based
  accounts aren't Stripe-eligible; Ameriabank is the current candidate, unconfirmed
  (PRODUCT-SPEC.md OQ-8). Plan changes are manual for now (`app/api/scripts/set-plan.js`).

## Legacy Next.js

Previous Next/Prisma work is archived at `~/dev/erazmus-AI-legacy-next` for porting domain logic (wizard forms, billing schema ideas).
