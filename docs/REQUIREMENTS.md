# EU Grantwriter — Development Requirements Document

**Version:** 1.2  
**Date:** 2026-08-17  
**Status:** Ready for implementation  
**Audience:** Frontend + backend developers  
**Owners:** Product  
**Codebase:** `app/web` (React + Vite + Tailwind), `app/api` (Express), Supabase, OpenAI Luna + Moonshot  

---

## 1. Summary

Ship a paid Erasmus+ grant assistant whose drafts are built to **pass National Agency review**.

Anyone can open ChatGPT or Claude and ask for a grant. Those drafts are often rejected because of AI-sounding language, missed Programme Guide criteria, and weak alignment with what reviewers actually mark down. We win only if our models are **preconfigured** to follow Erasmus+ rules every time — not if we are “another chat box.”

Product UX (settings, durable session, ChatGPT-like controls, docs on every plan) is required for a shippable SaaS. The **moat** is pass-rate knowledge and constrained generation.

This sprint must deliver:

1. Document generation on **all plans** (Free included; quota- and cap-gated)
2. Real **profile / settings** area
3. **ChatGPT-like chat controls** (edit, regenerate, copy, stop) in our design
4. Session that survives refresh
5. Cost control via quotas and monthly doc caps (not by locking export behind paywall)
6. **Pass-rate foundation:** Programme Guide + failed-grant examples wired into generation (at least v1 prompts + ingestion path)
7. **Action scope:** product destination is **KA1 and KA2**. Generate **KA1 only** until KA1 drafts meet the pass-rate bar. KA2 stays visible as Coming soon. Do not ship one action code as the whole product, and do not generate all six actions under a KA153 pack.

---

## 2. Product differentiator (non-negotiable)

### Problem we solve

Generic LLMs produce fluent text. National Agencies reject many of those drafts because:

- AI traces / generic phrasing
- Programme Guide criteria not met for the action type and year
- Prior rejection patterns ignored (same mistakes repeat)

### What we uniquely bring

| Asset | Source | Cadence |
|---|---|---|
| Erasmus+ Programme Guide (“the book”) | Public EU / NA materials on the internet | **Updates every year** — we must refresh our knowledge pack yearly |
| Failed grant examples | Our corpus | With **reviewer feedback explaining why they failed** |
| Pass rules | Derived from guide + failure feedback | Encoded into system prompts and retrieval so every generation follows them |

### Hard product rules

**FR-PASS-1.** Every chat reply and every generated application section must run under a **constrained Erasmus+ system configuration** (not a bare model with a short user prompt).

**FR-PASS-2.** Models must always be steered to:

- Meet current-year Programme Guide criteria for the relevant action
- Avoid obvious AI traces (generic filler, buzzword stacking, vague impact claims)
- Prefer concrete, reviewable, criteria-aligned wording
- Use failed-grant feedback as negative examples (“do not repeat these failure modes”)

**FR-PASS-3.** Prefer **retrieval of guide excerpts + failed examples** over relying on the base model’s general knowledge. The book changes yearly; frozen model weights will drift.

**FR-PASS-4.** Yearly ops: when the new Programme Guide is published, update the knowledge pack, bump a `guide_year` / version label in the product, and re-validate generation against the new criteria. Document this as a recurring release task.

**FR-PASS-5.** Free and paid both use the same pass-rate constraints; paid mainly gets a stronger model + higher limits — not “unlock the book.”

---

## 3. Current baseline (do not rewrite the stack)

Working today:

- Auth (register / login / refresh)
- Streaming chat, conversation history, attachments
- Token quotas by plan
- Free → OpenAI Luna; paid → Moonshot
- Chat → document generation (MD + DOCX + **PDF**), currently gated to paid
- Minimal profile menu (name, plan, tokens, sign out)

Gaps this document closes: docs on Free, settings area, chat message actions, durable session, and the pass-rate knowledge / prompt foundation.

---

## 4. In scope vs out of scope

### In scope

- Docs on all plans, gated by token quota and monthly doc caps
- **PDF export** of generated applications (primary download; DOCX + Markdown also available)
- Profile / settings / usage / security / documents pages
- Chat controls: copy, regenerate, edit and resend, stop
- Session that survives page refresh
- Upload + analyse files (PDF, TXT, MD) as inputs to chat and generation
- Clear upgrade path: better model + higher limits (not “unlock export”)
- Pass-rate system prompts + knowledge ingestion path (Programme Guide + failed examples with feedback)
- KA1 generation (youth, then education mobility) to the pass-rate bar; KA2 visible as Coming soon

### Action scope (KA1 then KA2)

**FR-ACT-1.** Destination is Key Action 1 (mobility) and Key Action 2 (partnerships). Architecture (`schemaFor(actionCode)`, family packs, picker groups) must already know both.

**FR-ACT-2.** Until the KA1 bar is met, only KA1 actions generate PDFs: youth (KA152 / KA153 / KA154), then education mobility (KA122, KA121, KA131/171). KA210 and KA220 stay in the picker as Coming soon (`supported: false`). Chat may explain KA2; interview and export must refuse it.

**FR-ACT-3.** KA1 is “perfect” when drafts use award-criteria sections (not Who / Where / When), the correct family pack (no KA153 bleed into KA122), correct beneficiary, a needs→objectives→activities chain, and a golden-set / NA-style checklist that would not immediately fail known patterns. Only then open KA2.

### Out of scope for this sprint

- Live billing integration (manual plan change in DB is OK for launch — see `app/api/scripts/set-plan.js`).
  **Not Stripe**: Stripe does not support Armenia-based accounts, so it's not a legally viable
  destination for this product regardless of build order. Ameriabank is the likely replacement
  but is unconfirmed — needs research into their merchant/payment-gateway API before any
  integration work starts. Tracked as PRODUCT-SPEC.md OQ-1.
- Mobile native apps
- AWS migration
- Rewriting away from Supabase
- Fully automated scraping of the Guide each year (manual curated pack for v1 is OK; process must be documented)
- KA2 PDF generation (KA210 / KA220) until FR-ACT-3 is green

---

## 5. Plans, AI routing, and document access

| Plan | Provider / model | Monthly tokens | Can generate docs | Docs / month |
|---|---|---|---|---|
| Free | OpenAI `gpt-5.6-luna` | 20,000 | **Yes** | 3 |
| Basic | Moonshot (configured model) | 500,000 | Yes | 20 |
| Pro | Moonshot (configured model) | 2,000,000 | Yes | 100 |
| Enterprise | Moonshot (configured model) | 10,000,000 | Yes | 100 |

Implementation notes:

- Single source of truth: `app/api/src/lib/plans.js`
- Gate on **quota + monthly doc count**, never on “Free cannot generate”
- Upgrade CTA copy: stronger pass-rate model + higher limits, not unlocking export
- Free doc generation still billed to Luna; cap tightly so Free is a funnel

---

## 6. User profile and settings

**FR-SET-1.** Real routes (not only a dropdown):

```
/                     → chat workspace (default after login)
/settings             → redirect to profile
/settings/profile     → name, email (read-only), save
/settings/preferences → theme, enter-to-send, default agent
/settings/usage       → plan, AI tier, tokens, document caps
/settings/security    → change password, sign out
/settings/documents   → list + download generated docs
```

**FR-SET-2.** Profile menu expands to: Settings, Documents, Usage, Sign out.

**FR-SET-3.** Change password via backend using Supabase Auth APIs; never expose service-role secrets to the client.

---

## 7. Chat behaviors (must feel standard)

All within current visual design (sidebar, agents, existing tokens):

| ID | Behavior | Detail |
|---|---|---|
| FR-CHAT-1 | Copy | Copy assistant (and optionally user) message; toast “Copied” |
| FR-CHAT-2 | Regenerate | Re-answer last user turn; replace last assistant message; charge tokens |
| FR-CHAT-3 | Stop | Abort SSE; keep partial text |
| FR-CHAT-4 | Edit and resend | Edit any prior user message; delete all messages after it; resend; stream new reply |
| FR-CHAT-5 | Retry failed | Keep existing retry on error state |
| FR-CHAT-6 | Refresh-safe session | Login survives page refresh via refresh-token restore |
| FR-CHAT-7 | Refresh-safe chat | Active conversation and messages reload after refresh |
| FR-CHAT-8 | Upload + analyse | Upload PDF / TXT / MD; backend extracts text into agent context |

---

## 8. Guided intake

Specialist sidebar agents may remain for chat help, but document creation should not depend on the user knowing which agent to pick.

**FR-AGENT-1.** Primary CTA: one clear **Generate application** path from the active conversation.

**FR-AGENT-2.** Longer-term (same epic, can follow chat/settings): one Guided Grant Agent that asks ~20–30 structured questions (choices + free text + optional uploads), then generates the doc under the same pass-rate constraints.

---

## 9. Pass-rate knowledge & model preconfiguration (engineering)

v1 does not need a perfect RAG platform, but it must not be “call Luna/Moonshot with a thin prompt.”

**FR-KB-1.** Store a versioned knowledge pack. v1 lives in `app/resources/` (see that folder’s `README.md` and `MAPPING.md`):

- Current Programme Guide excerpts (by action / section where possible) — start with `derived/guide-youth-workers.md`
- Failed applications + structured reviewer feedback — `derived/assessments/` (anonymized); raw PDFs are local-only
- Explicit “must / must-not” rules — `derived/rules.md` (inject into every generation)

Assessments + Guide youth-worker section are **canonical**. Full applications are **negative examples**, not templates. Never commit PDFs that name organisations or project codes.

**FR-KB-2.** Chat and document generation always inject:

1. Base Erasmus+ system prompt (pass criteria, anti-AI-trace rules)
2. Relevant retrieved guide chunks for the user’s action / topic
3. Relevant failure-mode examples when writing or revising sections

**FR-KB-3.** Document a yearly refresh runbook: source URLs, how to update the pack, how to bump `guide_year`, smoke tests on sample sections.

**FR-KB-4.** Never rely on the user pasting the Guide into the chat. The product owns that context.

---

## 10. Session durability

**FR-SESS-1.** Login must survive full page refresh (restore access + refresh tokens; refresh-on-load).

**FR-SESS-2.** Active conversation id and messages must reload after refresh.

**FR-SESS-3.** Prefer httpOnly cookie session if feasible; if tokens stay in web storage, implement silent refresh and document the threat model.

---

## 11. Implementation notes for developers

- Single source of plan truth: `app/api/src/lib/plans.js`
- Chat UI modules: `app/web/src/components/chat/`
- Do not put API keys in `app/web`
- Prefer counting monthly docs from `documents.created_at` over a denormalized counter
- For edit/resend: hard-delete trailing messages after the edited user message
- For Luna requests: do not send custom `temperature` (API rejects non-default)
- Keep pass-rate prompts and knowledge injection server-side only
- Knowledge pack handoff: `app/resources/README.md` (canonical vs example, privacy, yearly refresh)

---

## 12. Suggested implementation order

1. Unlock docs on Free + monthly doc caps + tests  
2. Settings routes + profile / preferences / usage / documents pages  
3. Chat actions: copy, stop, regenerate, edit and resend  
4. Session restore on refresh (if not fully solid)  
5. Pass-rate v1: system prompts + knowledge pack structure keyed by action family (youth pack only on youth)  
6. Perfect KA1 questionnaire + schema (youth, then education mobility); KA2 Coming soon  
7. Guided intake depth; expand Guide + failed-grant corpus per family; yearly refresh runbook  
8. KA2 generation only after the KA1 NA-style checklist is green  

---

## 13. QA checklist

1. Free user: register → chat → generate doc → download PDF  
2. Free user: hit monthly doc cap → clear error  
3. Settings: change name + theme → survive refresh  
4. Usage: tokens and doc counts correct  
5. Edit message → trailing messages removed → new stream  
6. Regenerate last assistant message  
7. Copy + stop generation  
8. Page refresh → still logged in, conversation restored  
9. Pro user in DB → Advanced AI + higher limits  
10. Generated draft reflects Programme Guide criteria (sample checklist by action)  
11. Prompted failure modes from our examples are avoided in a revision test  

---

## 14. Success definition

A Free user can sign up, chat with message controls, open settings, stay logged in after refresh, and download an application PDF **without leaving for ChatGPT** — and that draft is produced under Erasmus+ pass rules (current Guide year + failure feedback), not a generic LLM reply.
