# Environment Setup Guide

This guide walks you through setting up your `.env` file for local development.

## Quick start (minimum to run the app)

```bash
cp .env.example .env
```

Then fill in these **required** values:

### 1. Database (already configured for local Docker)

```env
DATABASE_URL="postgresql://erazmus:erazmus_dev@localhost:5433/erazmus_ai?schema=public"
```

Make sure Docker is running:
```bash
npm run docker:up
npm run db:migrate
```

### 2. Auth secret (required)

Generate a random secret:
```bash
openssl rand -base64 32
```

Add to `.env`:
```env
AUTH_SECRET=your-generated-secret-here
AUTH_URL=http://localhost:3000
```

### 3. Moonshot AI key (required for chat)

1. Go to [platform.moonshot.cn](https://platform.moonshot.cn/)
2. Create an account and generate an API key
3. Add to `.env`:

```env
MOONSHOT_API_KEY=sk-your-key-here
MOONSHOT_API_URL=https://api.moonshot.cn/v1
MOONSHOT_MODEL=moonshot-v1-8k
```

> **Note:** Moonshot's API is hosted in China. If you have connectivity issues, we can swap to OpenAI/Anthropic later via the provider abstraction.

---

## Optional (can add later)

### Google OAuth (social login)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project → APIs & Services → Credentials
3. Create **OAuth 2.0 Client ID** (Web application)
4. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
5. Add to `.env`:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true
```

### Stripe (billing — Phase 3)

1. Go to [dashboard.stripe.com](https://dashboard.stripe.com/)
2. Use **Test mode** for development
3. Create products: Basic ($19/mo), Pro ($49/mo)
4. Add to `.env`:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_BASIC=price_...
STRIPE_PRICE_PRO=price_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

For local webhook testing:
```bash
stripe listen --forward-to localhost:3000/api/billing/webhook
```

### Resend (email — Phase 3)

1. Go to [resend.com](https://resend.com/)
2. Create API key
3. Add to `.env`:

```env
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@yourdomain.com
```

### Supabase Storage (document export — Phase 3)

1. Go to [supabase.com](https://supabase.com/) → create project (Frankfurt region)
2. Settings → API → copy URL and service role key
3. Storage → create bucket `documents`
4. Add to `.env`:

```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
SUPABASE_STORAGE_BUCKET=documents
```

### Sentry (monitoring — Phase 4)

```env
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

---

## Complete `.env` template

```env
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development

# Database (local Docker on port 5433)
DATABASE_URL="postgresql://erazmus:erazmus_dev@localhost:5433/erazmus_ai?schema=public"

# Auth (REQUIRED)
AUTH_SECRET=                          # run: openssl rand -base64 32
AUTH_URL=http://localhost:3000

# Google OAuth (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false

# Moonshot AI (REQUIRED for chat)
MOONSHOT_API_KEY=
MOONSHOT_API_URL=https://api.moonshot.cn/v1
MOONSHOT_MODEL=moonshot-v1-8k

# Redis (local Docker)
REDIS_URL=redis://localhost:6379

# Supabase (Phase 3)
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
SUPABASE_STORAGE_BUCKET=documents

# Stripe (Phase 3)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_BASIC=
STRIPE_PRICE_PRO=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Email (Phase 3)
RESEND_API_KEY=
EMAIL_FROM=noreply@erazmus.ai

# Monitoring (Phase 4)
SENTRY_DSN=

# Worker
WORKER_MODE=false
```

---

## Verify your setup

```bash
# 1. Start services
npm run docker:up

# 2. Run migrations
npm run db:migrate

# 3. Start dev server
npm run dev
```

Open http://localhost:3000 → Register → Dashboard → Chat

If chat fails with "MOONSHOT_API_KEY is required", add your Moonshot key to `.env` and restart the dev server.
