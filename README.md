# Erasmus AI Assistant

AI-powered SaaS platform for designing, auditing, and finalizing Erasmus+ grant applications.

## Stack

- **Frontend/API:** Next.js 16, React 19, Tailwind CSS 4, TypeScript
- **Database:** PostgreSQL (Prisma ORM)
- **Auth:** Auth.js v5 (email + Google OAuth)
- **AI:** Moonshot API (provider-abstracted for easy swapping)
- **Jobs:** BullMQ + Redis (Railway worker in production)
- **Billing:** Stripe
- **Hosting:** Vercel (web) + Railway (worker) + Supabase (DB/storage) + Upstash (Redis)

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for full production hosting architecture.

## Local Development

### Prerequisites

- Node.js 20+
- Docker (for Postgres + Redis)

### Setup

```bash
# Clone and install
npm install

# Start local database services
npm run docker:up

# Configure environment
cp .env.example .env
# Edit .env with your keys

# Run database migrations
npm run db:migrate

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Background Worker (optional locally)

```bash
npm run worker:dev
```

## Project Structure

```
src/
├── app/           # Next.js App Router pages and API routes
├── components/    # React components
├── lib/           # Business logic (AI, auth, billing, tokens)
├── workers/       # Background job processors
└── types/         # TypeScript type extensions
prisma/            # Database schema and migrations
docs/              # Architecture and deployment docs
```

## Development Phases

- [x] Phase 0: Foundation (scaffold, DB schema, theme, auth skeleton)
- [ ] Phase 1: Dashboard, token ledger, AI chat streaming
- [ ] Phase 2: Grant wizard, 4 AI agents, plan gating
- [ ] Phase 3: Document export, Stripe billing
- [ ] Phase 4: Admin panel, polish, E2E tests
- [ ] Phase 5: Production deployment

## License

MIT
