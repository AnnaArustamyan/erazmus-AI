# Erasmus AI — Product Development Requirements

**Version:** 1.0  
**Date:** 2026-08-10  
**Status:** Ready for implementation  
**Audience:** Frontend + backend developers  
**Codebase:** `app/web` (React + Vite), `app/api` (Express), Supabase, OpenAI Luna + Moonshot  

---

## 1. Purpose

Turn the current MVP into a **polished, client-ready product** with:

1. Document generation available on **all plans** (including Free)
2. A proper **user profile & settings** area (as expected on modern SaaS AI products)
3. **ChatGPT-like chat UX** (regenerate, edit message, copy, etc.) while keeping **our existing visual design** (Erasmus AI theme — not a ChatGPT clone look)

This document is the source of truth for the next development sprint. Anything not listed here is out of scope unless product explicitly adds it.

---

## 2. Current product (baseline)

Already working:

- Auth (register / login / session refresh)
- streaming chat + conversation history + attachments
- Token quotas by plan
- Plan-based AI routing: Free → OpenAI `gpt-5.6-luna`; Paid → Moonshot
- Document generation from conversation (MD + DOCX) — **currently paid-only**
- Minimal profile menu (name, plan, tokens, sign out)

Pain points to fix:

- Free users cannot generate documents
- remove the 4 agents from agents we will need only one which asks 20-30 choice and free text input field questions to generate the document based on that
- No dedicated settings / account management pages
- Chat lacks modern message actions and page refresh and other intuitive actions dont have the standard common behaviors(edit, regenerate, copy, stop, etc.)
- user login session should not disappear after refresh we should have proper session handling
---

## 3. Goals & non-goals

### Goals

- Every plan can generate application documents (subject to token quota)
- Users can manage account preferences in a clear Profile / Settings area
- Chat feels modern and controllable (edit / regenerate / copy), in our design system
- Keep cost controls via quotas (not by blocking document generation)

- Full Who/Where/When grant wizard UI (chat-first remains primary)
- PDF export (MD + DOCX only)
- can upload and analyse the uploaded files (pdf text md and stuff)
- Mobile native
- Replacing Supabase or rewriting the stack analysis

---

## 4. Personas

| Persona | Needs |
|---|---|
| NGO grant writer (Free) | Try product, chat with agents, generate a draft doc without paying first |
| Paying subscriber (Basic/Pro) | Higher quota, Advanced AI (Moonshot), same UX as free + more capacity |
| Admin (internal) | Change user plan in DB for now (Stripe later) |

---

## 5. Feature requirements

### 5.1 Document generation on all plans

**FR-DOC-1.** `canGenerateDocuments` must be `true` for `free`, `basic`, `pro`, and `enterprise`.

**FR-DOC-2.** Free users use the Free AI provider (OpenAI Luna) for both chat and document drafting. Paid users use Moonshot for both (unless product later splits this).

**FR-DOC-3.** Document generation must still:

- Require an authenticated user
- Consume tokens from the user’s monthly quota
- Fail with `402` when quota is exhausted (clear upgrade message)
- Produce Markdown + DOCX download links
- Support `POST /api/documents/from-conversation` and list/download APIs

**FR-DOC-4.** UI: show **Generate application** for all logged-in users when the active conversation has at least one user or assistant message.

**FR-DOC-5.** Free-tier cost control (mandatory product rules, not feature locks):

| Rule | Requirement |
|---|---|
| Monthly token cap | Keep Free at **20,000** tokens/month (configurable in `plans.js`) |
| Docs per month (Free) | Soft limit: **max 3 generated documents / calendar month** (enforce server-side) |
| Docs per month (Basic) | **20** |
| Docs per month (Pro+) | **100** (or unlimited within token quota — pick one and document in code) |
| Empty / tiny chats | Reject generation if conversation has fewer than **2 messages** or total content &lt; ~200 characters |

**FR-DOC-6.** After generation, show a persistent “Documents” section (not only a dismissible banner): title, date, Download MD, Download DOCX.

**Acceptance**

- [ ] Free user can generate MD + DOCX from a real conversation
- [ ] Free user blocked after doc monthly cap with clear message
- [ ] Paid user uses Moonshot for generation
- [ ] Existing tests updated; new tests for free generation + caps

---

### 5.2 User profile & settings

Build a proper account area comparable to ChatGPT / Claude / Notion-style settings (content & structure), **using our design tokens / layout**.

#### Information architecture

```
/app (chat workspace — default after login)
/settings                  → redirect to /settings/profile
/settings/profile          → name, email (read-only email), avatar optional later
/settings/preferences      → theme, default agent, language placeholder
/settings/usage            → plan, AI tier, tokens used/limit, docs used/limit
/settings/security         → change password, sign out all sessions (best-effort)
/settings/documents        → list generated documents + downloads
```

Use client-side routing in the Vite app (React Router or equivalent). Keep the existing chat as the home experience.

**FR-PROF-1. Profile**

- Display and edit **display name**
- Show email (read-only for now; change-email can be “coming soon”)
- Save via `PATCH /api/auth/me` (or `PATCH /api/users/me`)
- Success / error toasts or inline status

**FR-PROF-2. Preferences**

- Theme: Light / Dark (persist to `localStorage` and optionally `users.theme` column)
- Default agent on new chat (one of the 4 agents)
- Optional: “Enter sends message” vs newline (ChatGPT-like toggle)

**FR-PROF-3. Usage**

- Plan name, AI tier label (“Standard AI” / “Advanced AI”)
- Token progress bar (used / limit)
- Documents this month (used / limit)
- Copy explaining Free vs Paid differences (quota + model quality — not “docs locked”)

**FR-PROF-4. Security**

- Change password (Supabase Auth update password flow via API)
- Sign out
- Optional: “Sign out of this device”

**FR-PROF-5. Navigation**

- Replace / extend the small avatar menu:
  - Settings
  - Documents
  - Usage
  - Sign out
- Settings pages share a left subnav + content panel, desktop-first; usable on mobile

**FR-PROF-6. API**

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/auth/me` | Already exists; extend with `features`, `documentsThisMonth`, prefs |
| `PATCH` | `/api/auth/me` | Update `name`, `theme`, `default_agent` |
| `POST` | `/api/auth/change-password` | `{ currentPassword, newPassword }` |

**Acceptance**

- [ ] User can open Settings from avatar menu and update name
- [ ] Theme preference persists across refresh
- [ ] Usage page shows accurate quota numbers
- [ ] Documents page lists generated files with downloads

---

### 5.3 Chat UX (ChatGPT-like behavior, our design)

Keep current Erasmus AI visual language (colors, sidebar, agent tabs). Add **behaviors** users expect from modern AI chat.

#### Message actions (assistant messages)

**FR-CHAT-1. Copy** — copy message text to clipboard; brief “Copied” feedback.

**FR-CHAT-2. Regenerate** — re-run the last assistant reply for the same user prompt (new assistant message or replace last — **replace last** is preferred). Deduct tokens again. Keep agent id.

**FR-CHAT-3. Stop generating** — abort in-flight SSE stream; keep partial text; mark status complete/partial.

#### Message actions (user messages)

**FR-CHAT-4. Edit & resend** — user can edit a prior user message; on submit:

1. Truncate conversation after that message (UI + server)
2. Save edited user message
3. Stream a new assistant reply

Server must support this safely (recommended endpoint below).

**FR-CHAT-5. Retry** — already exists for failed sends; keep it.

#### Composer / thread

**FR-CHAT-6.** Streaming cursor / “thinking” indicator (already partly present — polish).

**FR-CHAT-7.** Keyboard: Enter to send, Shift+Enter newline (honor preference from settings).

**FR-CHAT-8.** Disable composer while streaming unless Stop is available.

**FR-CHAT-9.** Hover or focus reveals action icons; accessible via keyboard.

#### Suggested API additions

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/chat` | Existing stream; add optional `replaceAssistantMessageId` for regenerate |
| `POST` | `/api/chat/edit` | `{ conversationId, messageId, text, agentId }` → truncate after message, update text, stream new reply |
| `POST` | `/api/chat/stop` | Optional if abort is client-only (AbortController); document approach |

**Client abort:** Prefer `AbortController` on the fetch/SSE reader for Stop (no server endpoint required if connection drop is enough).

**Acceptance**

- [ ] Copy works on assistant messages
- [ ] Regenerate replaces last assistant answer and updates DB
- [ ] Edit user message truncates later messages and regenerates
- [ ] Stop cancels stream without crashing UI
- [ ] All actions styled in existing design system (no ChatGPT branding)

---

## 6. Plan & pricing rules (updated)

| Plan | AI | Monthly tokens | Doc generation | Docs / month |
|---|---|---|---|---|
| Free | OpenAI Luna (Standard) | 20,000 | **Yes** | 3 |
| Basic | Moonshot (Advanced) | 500,000 | Yes | 20 |
| Pro | Moonshot (Advanced) | 2,000,000 | Yes | 100 |
| Enterprise | Moonshot (Advanced) | 10,000,000 | Yes | 100 (or unlimited) |

**Differentiation is quality + quota, not “can’t export.”**

Update `app/api/src/lib/plans.js` and enforce doc caps in document routes. Add DB tracking (see Data model).

---

## 7. Data model changes

### 7.1 `users` table (additive)

```sql
-- preferences
alter table public.users
  add column if not exists theme text default 'system',
  add column if not exists default_agent text default 'compliance',
  add column if not exists enter_to_send boolean default true,
  add column if not exists documents_generated_this_month integer not null default 0,
  add column if not exists documents_quota_reset_at timestamptz not null default date_trunc('month', now());
```

Validate `default_agent` against known agent ids in API.

### 7.2 Document monthly reset

On each document create:

1. If `now()` is past `documents_quota_reset_at` month → reset counter to 0 and bump reset date to start of current month
2. If counter ≥ plan limit → `403` with upgrade message
3. Else create document and increment counter

(Alternatively derive count from `documents` table by `created_at` this month — preferred for accuracy; counter is optional cache.)

**Preferred:** count rows in `documents` for `user_id` where `created_at >= date_trunc('month', now())`.

---

## 8. UX / design constraints

- Reuse existing CSS variables / theme (`data-theme`, app-* tokens)
- No purple “generic AI SaaS” redesign; no ChatGPT logo or copycat layout
- Settings: simple two-column layout (nav + panel), not a heavy dashboard
- Chat actions: subtle icon buttons (lucide-react already in project)
- Empty states with one short sentence + primary action

---

## 9. Technical constraints

- Keep monorepo layout: `app/api`, `app/web`
- Secrets only in `app/api/.env` (never expose OpenAI/Moonshot/Supabase secret to web)
- Preserve SSE streaming for chat
- Update / add Vitest tests for API; RTL tests for critical UI (edit, regenerate, settings save)
- Do not break existing auth cookie/token flow (Bearer access token)

---

## 10. Delivery phases (recommended)

### Phase A — Plan + documents (0.5–1 day)

- Enable docs on Free
- Doc monthly caps
- Documents list page / panel
- Tests

### Phase B — Settings shell (1–1.5 days)

- Routing + settings layout
- Profile name edit
- Preferences (theme, default agent)
- Usage page
- Wire avatar menu

### Phase C — Chat actions (1.5–2 days)

- Copy, Stop, Regenerate
- Edit & resend + server truncate
- Polish + tests

### Phase D — Hardening (0.5 day)

- Error messages for quota / AI billing failures
- README / STACK update
- Smoke checklist for QA

**Target order:** A → B → C → D

---

## 11. QA smoke checklist

1. Register free user → chat with Compliance Officer → **Generate application** → download MD + DOCX  
2. Generate until Free doc cap → clear error  
3. Open Settings → change name + theme → refresh → persisted  
4. Usage shows tokens + docs counts  
5. Edit an old user message → later messages removed → new answer streams  
6. Regenerate last answer  
7. Copy assistant message  
8. Stop mid-stream  
9. Upgrade user to `pro` in DB → Advanced AI label + higher limits  

---

## 12. Open questions (resolve before / during Phase A)

1. Free doc cap: **3 / month** OK, or product wants **1** / **5**?  
2. After edit: delete messages after the edited one in DB, or soft-hide? (**Recommend hard delete** for simplicity.)  
3. Regenerate: replace last assistant message vs append variant? (**Recommend replace.**)  
4. Settings URL paths: `/settings/...` vs modal-only? (**Recommend real routes.**)

---

## 13. Success definition

This sprint is done when a new Free user can:

1. Sign up and use chat with modern message controls  
2. Manage profile/settings in a dedicated area  
3. Generate and download an application document without upgrading  

…and paid users still get Advanced AI + higher quotas as the upgrade incentive.

---

## 14. References (code)

| Area | Location |
|---|---|
| Plans / features | `app/api/src/lib/plans.js` |
| Chat API | `app/api/src/routes/chat.js` |
| Documents API | `app/api/src/routes/documents.js` |
| Chat UI | `app/web/src/components/ErasmusChatWorkspace.tsx` + `components/chat/*` |
| Auth / profile menu | `app/web/src/App.tsx`, `ProfileMenu.tsx`, `auth/AuthContext.tsx` |
| Deploy notes | `docs/DEPLOY.md`, `docs/STACK.md` |
