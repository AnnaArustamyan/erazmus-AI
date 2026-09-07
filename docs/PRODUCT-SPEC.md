# EU Grantwriter — Product Specification

**Version:** 1.1  
**Date:** 2026-08-20  
**Status:** Decisions locked — all open questions resolved, ready for implementation  
**Source:** Product definition session, 2026-08-19; follow-up resolution session, 2026-08-20  
**Depends on:** REQUIREMENTS.md v1.2, APPLICATION-ENGINE.md v1.3

---

## 1. What the product is

EU Grantwriter is an intelligent grant co-author for Erasmus+ applications.

The user describes their project idea. The product guides them through completing a structurally correct, evaluation-ready application — the kind that doesn't get rejected for the reasons most AI-generated drafts do (wrong beneficiary, no needs evidence, slogan impact claims, internal contradictions).

The end result is copy-paste-ready text that matches the official portal fields one-to-one, so the user can open the webgate form and paste each answer directly in.

**We are not a writing assistant. We are an application expert.**  
Generic prose is the wrong product. Correctly structured, evidence-backed, criteria-aligned answers are the right product.

---

## 2. Users

Any individual or organisation that is legally eligible to submit an Erasmus+ application:

- NGOs and their staff members
- Youth organisations
- Schools and education institutions
- Individual applicants (where the action allows)

No eligibility filtering at registration. The product trusts the user to know whether they are eligible. If the action they pick requires an organisation, the Application Form will surface that.

---

## 3. Three interfaces

The product has three views of the same application. They are not sequential steps — the user can enter from any of them. They share one Application State (facts, answers, generated sections, validation report).

### 3.1 Chat — `/chat`

**Purpose:** Develop your idea, ask questions about Erasmus+, get coached on what makes a strong application.

- Free-form conversation with an AI coach constrained to Erasmus+ knowledge
- Facts extracted from conversation are saved as `inferred` / `pending` in Application State
- The user confirms facts to lock them — locked facts feed Application Form and My Application
- **Locked facts are never silently overwritten.** If Chat infers a value that contradicts an already-`locked` fact, the new value is surfaced as a `stale` conflict (see APPLICATION-ENGINE.md §3) next to the locked one — the Consistency gate flags it, and only an explicit user re-confirmation changes the locked value
- Never generates the full application from chat alone
- If the user asks for the full application: lists what's missing and points to Application Form
- Chat is always linked to the active application

**Route:** `/chat`  
**Icon:** MessageSquare

---

### 3.2 Application Form — `/grants/builder`

**Purpose:** Guided, field-by-field completion that mirrors the exact portal questions for the selected action type.

- Starts with action type picker (KA153, KA152, KA121, etc.)
- Once action is confirmed, shows questions **in the same order as the official webgate portal**
- Question types mirror the portal: text fields, textareas with character limits, choice/select questions, conditional fields
- Each field shows: the question, the character limit, inline validation (too short, too generic, contradicts another answer), and a [Improve with AI] button
- Confirmed answers write `locked` facts to Application State
- AI may propose answers from existing facts — proposed values are shown as suggestions until the user confirms
- Completeness indicator per section (matches portal section status)

**Route:** `/grants/builder`  
**Icon:** ClipboardCheck  
**Renamed from:** "Requirements" (too internal — users didn't understand it)

---

### 3.3 Evaluate — `/evaluate`

**Purpose:** Full validation report on the active application. Replaces the Generator interface.

- **Available to all plans** — deterministic checks cost zero tokens
- Two-panel layout:
  - Left: gate status summary (Schema / Compliance / Consistency / Evidence / Quality)
  - Right: issue list with severity (🔴 Critical / 🟠 Major / 🟡 Minor), location, and [Fix with AI] per issue
- AI quality scoring (Gate 4–5) costs tokens — shown before running, user confirms
- **No numerical score until calibrated** (see APPLICATION-ENGINE.md §10)
- Status copy (verbatim): *"Ready means the draft satisfies known structural, compliance, and evidence requirements for this action and programme year. It does not predict funding."*
- Runs automatically on entry; re-runs after any [Fix with AI] action
- Accessible from all three interfaces via the persistent status bar at the top

**Route:** `/evaluate`  
**Icon:** ShieldCheck (or similar — replaces Sparkles/Generator icon)  
**Replaces:** Generator (`/generator`) — that route is removed

---

### 3.4 My Application — `/application`

**Purpose:** The generated application document, structured to match the portal.

Two views, switchable from a tab within the page:

| View | What it shows | Priority |
|---|---|---|
| **Portal View** | Section headers → field labels → generated answer text, exactly matching the portal structure and field order. Character count shown per field. | **Primary** |
| **Document View** | A flowing, readable narrative covering the same content — for review and sharing. | Secondary |

Portal View is the primary deliverable. The user opens the portal, opens Portal View side by side, and pastes each field.

Downloads available: PDF (primary), DOCX, Markdown — all reflect the Portal View structure.

**Route:** `/application`  
**Icon:** FileStack

---

## 4. Navigation

Left icon rail (desktop) / bottom tab bar (mobile):

```
[Brand mark]
[+ New]         ← starts a new application
──────
[Chat]          /chat
[App Form]      /grants/builder
[Evaluate]      /evaluate  ← NEW (replaces Generator)
[My App]        /application
```

The Generator route (`/generator`) is removed entirely. The "describe a project → get a plan" flow is absorbed into Chat (the chat-coach skill already does this).

---

## 5. KA1 rollout order

### Phase 1 — Youth actions (build and validate first)

Actions in the order they appear in the Erasmus+ portal:

| # | Action code | Name | Status |
|---|---|---|---|
| 1 | KA152-YOU | Mobility of young people (youth exchanges) | Coming soon |
| 2 | **KA153-YOU** | **Mobility of youth workers** | **Active — build first** |
| 3 | KA154-YOU | Youth participation activities | Coming soon |

KA153-YOU is the first because:
- We have 5 real assessment examples for it
- Form + evaluation schemas are already encoded for 2026
- It's the action our negative examples cover
- Getting it right proves the engine works

KA152 and KA154 follow after KA153 passes the golden eval test set (APPLICATION-ENGINE.md §19).

### Phase 2 — Education mobility

| # | Action code | Name | Status |
|---|---|---|---|
| 4 | KA121-SCH | Short-term projects for school education staff mobility | Coming soon |
| 5 | KA122-SCH | Projects for school education staff mobility | Coming soon |
| 6 | KA131-HED | Mobility projects for higher education students and staff | Coming soon |

### Phase 3 — KA2 Partnerships (after KA1 gates are green)

| # | Action code | Name | Status |
|---|---|---|---|
| 7 | KA210-YOU | Small-scale partnerships in youth | Coming soon |
| 8 | KA220-YOU | Cooperation partnerships in youth | Coming soon |

KA2 opens only after FR-ACT-3 is satisfied (APPLICATION-ENGINE.md §4).

### How an action moves from "Coming soon" to "Active"

A single schema manifest (`app/resources/schemas/manifest.json` or equivalent) is the source of truth for which actions are live. Each entry names the action code, call year, path to its reviewed form + evaluation schema, and a `supported` flag. `schemaForAction()`, `fieldsForAction()`, and `ActionTypePicker` all read this manifest instead of hardcoding a per-action branch.

Shipping a new action is then: run `tools/schema-sync` → human completes the review checklist → `sync.js` writes the reviewed JSON and flips the manifest entry to `supported: true`. No frontend code change and no redeploy is required to turn an action on. This is also the resolution to the "Coming soon" toggle mechanism (formerly OQ-7, see §11) — it's the same `supported` flag, not a separate feature-flag system.

Until an action has a manifest entry with `supported: true`, it must render as disabled/"Coming soon" in the picker — regardless of what any hardcoded list currently says.

---

## 6. Portal-view vs document-view output

### Decision

Portal View is the primary output. Document View is secondary. Both live inside My Application.

### Why this matters

The official webgate portal (`webgate.ec.europa.eu/app-forms/`) has a multi-section form with individual text fields, choice questions, and character limits. The user must paste each field separately. A flowing document does not help them do this.

### Portal View structure (KA153-YOU example)

Follows the exact section and field order from the 2026 official application form:

```
CONTEXT
  Project Title
  Project Start Date / Duration / End Date
  National Agency / Language

PROJECT SUMMARY
  Project summary (2000 chars)

PARTICIPATING ORGANISATIONS
  Applicant organisation (1500 chars)
  Partner organisations (2500 chars)
  Countries

PARTICIPANTS
  Primary participants [select]
  Participant count
  Participant profile (2000 chars)
  Selection criteria (2000 chars)
  Fewer opportunities (2000 chars)

PROJECT RATIONALE
  Needs analysis (5000 chars)
  Needs identification method [select]
  Needs evidence (3000 chars)
  EU priorities / Youth Goals (2000 chars)
  Objectives (3000 chars)

DESCRIPTION OF ACTIVITIES
  Venue (1500 chars)
  Duration (days)
  Dates
  Activity programme (5000 chars)
  Non-formal methods (2000 chars)
  Preparatory visit [select]
  APV programme (4000 chars, conditional)
  Learning outcomes (3000 chars)
  Recognition / Youthpass (1500 chars)
  Preparation, implementation, follow-up (4000 chars)

PROJECT MANAGEMENT
  Impact and dissemination (4000 chars)
  Safety and insurance (2000 chars)
  Evaluation (2000 chars)
  Management and communication (2500 chars)

ANNEXES
  Day-by-day timetable (8000 chars)
  APV session programme (4000 chars, conditional)
```

Each field in Portal View shows:
- The field label (matching portal wording)
- The generated answer
- Character count / limit (green if under, red if over)
- A copy button
- An edit / regenerate button

Choice questions (select fields like "Primary participants") show the selected value and a note: *"Select this option in the portal."*

### Schema freshness

Portal View header shows: *"Schema verified against the official portal on `<date>`."* — the date the underlying form schema was last synced and human-reviewed (see APPLICATION-ENGINE.md §5, §21). The EU portal can change mid-cycle even though schema refresh is a deliberate once-a-year process; this badge lets the user judge staleness themselves rather than the product silently assuming its structure is still correct.

### Mobile

The live-paste workflow (portal open side by side, paste each field) is desktop-shaped. Portal View still renders on mobile for reading and review, but shows a banner: *"For the best experience pasting into the official portal, use a desktop."* No mobile-specific paste flow is built for v1.

---

## 7. Evaluation — what users see and when

### The confusion to avoid

Users land on Evaluate expecting a score. We don't give them a number. This needs to be communicated clearly and early.

### Onboarding copy (show once, on first visit to Evaluate)

> **How Evaluate works**
>
> We check your application against the structural rules, eligibility criteria, and evidence requirements for your action type.
>
> You get a gate-by-gate status (pass/fail), a list of issues by severity, and AI-powered suggestions to fix them.
>
> We don't give you a percentage score. A score without calibration would be read as a funding probability — and that's not something any tool can honestly give you.

### Gate display

```
APPLICATION STATUS: NOT READY

🔴 2 Critical issues    🟠 3 Major    🟡 5 Minor
✅ 24 requirements satisfied

Schema        PASS
Compliance    PASS
Consistency   FAIL  ──→ [View 2 issues]
Evidence      FAIL  ──→ [View 3 issues]
Quality       REVIEW NEEDED (costs tokens to run)
```

### Token awareness for AI gates

Before running Gates 4–5 (evidence tracing + quality):
> *"AI quality scoring uses ~800 tokens from your monthly balance (450 remaining). Run anyway?"*

Deterministic gates (1–3) are always free.

---

## 8. Upgrade / token flow

### Token exhaustion prompt

When a user runs out of tokens mid-session (inline, ChatGPT-style — not a blocking modal):

```
You've used your 20,000 monthly tokens.

Upgrade to Basic for 500,000 tokens/month, a stronger AI model,
and 20 application drafts — instead of 3.

[Upgrade]   [Not now]
```

Shown:
- Inline in Chat when the next message would exceed quota
- In Application Form when [Improve with AI] would exceed quota
- In Evaluate before running AI gates

### Upgrade location

- Profile menu → "Usage" shows token bar + upgrade CTA
- Top-right corner: compact token indicator (used / limit) that pulses when below 20%
- Never a blocking paywall on any core feature — the copy always frames it as "more capacity + better model"

### Plan table (source of truth: `app/api/src/lib/plans.js`)

| Plan | Model | Monthly tokens | Docs/month | Price | Doc retention |
|---|---|---|---|---|---|
| Free | GPT-5.6 Luna | 20,000 | 3 | — | 30 days, then generated docs expire |
| Basic | Moonshot | 500,000 | 20 | $19/mo | Indefinite |
| Pro | Moonshot | 2,000,000 | 100 | $49/mo | Indefinite |
| Enterprise | Moonshot | 10,000,000 | 100 | Custom (contact sales) | Indefinite |

Free users get the same pass-rate constraints as paid. Paid = stronger model + higher limits, not unlocked features.

Doc retention applies to generated exports (PDF/DOCX/MD) only — the underlying Application State (facts, answers) is never deleted on expiry, so a Free user who loses an export can regenerate it from their still-intact application.

---

## 9. Application entry point — decision

**Q: Should a new user be able to jump straight to Application Form, or must they go through Chat first?**

**Decision: Application Form is a direct entry point.** No forced onboarding sequence.

- New user → lands on Chat (default after login, as today)
- Action type picker lives at `/grants/builder` — user can go there directly
- The + New button in the icon rail starts a new application from wherever the user is
- Application Form shows a contextual prompt at the top for first-time users: *"Not sure which action to pick? Start in Chat and describe your project — we'll help you choose."*

This respects experienced applicants (who know their action code) while giving first-timers a path.

---

## 10. Removed / renamed

| Old | New | Reason |
|---|---|---|
| `/generator` route | Removed | Redundant with Chat; "describe project → get plan" is absorbed into chat-coach skill |
| `GeneratorPage.tsx` | Deleted | — |
| "Requirements" nav label | "Application Form" | "Requirements" reads as internal jargon; users didn't know what it did |
| `IconRail` Generator item | Evaluate item | Same slot, new purpose |

---

## 11. Open questions

All questions from the 2026-08-19 session are now resolved as of the 2026-08-20 follow-up. OQ-8
was added in a later session — see below.

| # | Question | Why it matters | Who decides |
|---|---|---|---|
| ~~OQ-1~~ | ~~What are the exact prices for Basic / Pro / Enterprise?~~ | **Resolved: Basic $19/mo, Pro $49/mo, Enterprise custom/contact sales. The price points stand regardless of processor — see OQ-8 for which processor charges them.** See §8. | — |
| ~~OQ-2~~ | ~~Do we support team/organisation accounts (multiple users on one grant)?~~ | **Resolved: Out of scope for this build. Single-user only. Revisit after KA1 drafts pass the golden-eval bar (FR-ACT-3) — multi-user editing would touch the same fact-locking model just designed for §3.1's conflict rule, so it competes for the same engineering time as the pass-rate work.** | — |
| ~~OQ-3~~ | ~~Should Evaluate show a numerical score after KA153 golden-test calibration, or keep gate-pass-only permanently?~~ | **Resolved: Permanently gate-pass-only. Never a numerical score, calibrated or not — §7's copy is final product truth, not a placeholder. APPLICATION-ENGINE.md §10's "when a numerical score is introduced later" contingency has been removed to match.** | — |
| ~~OQ-4~~ | ~~What language(s) does the product support at launch?~~ | **Resolved: English only for MVP. Armenian/Russian added post-launch.** | — |
| ~~OQ-5~~ | ~~KA150-YOU in scope?~~ | **Resolved: Out of scope. KA150 link was reference only. KA150 is an accreditation, not a project application.** | — |
| ~~OQ-6~~ | ~~Document storage: how long do generated PDFs stay in the user's account? Is there a limit per plan?~~ | **Resolved: 30 days on Free, indefinite on all paid plans. See §8.** | — |
| ~~OQ-7~~ | ~~What does "turn off KA2 Coming soon" look like in production? A feature flag? A config value?~~ | **Resolved: the schema manifest's `supported` flag (§5) — not a separate feature-flag system. Flipping an action live means promoting a reviewed schema into the manifest, no redeploy.** | — |
| OQ-8 | What payment processor actually charges the OQ-1 prices? **Stripe is ruled out** — Stripe does not support Armenia-based accounts, which this product is. Ameriabank is the current best guess but is unconfirmed (added 2026-09-03). | Blocks any real billing work — until this is resolved, plan changes stay manual (`app/api/scripts/set-plan.js`), matching REQUIREMENTS.md §4. | Business, needs Ameriabank (or alternative) merchant-API research first |

---

## 12. Implementation priority from this spec

Building on REQUIREMENTS.md §12 order, additions from this session:

1. Remove `/generator` route and `GeneratorPage.tsx`
2. Rename "Requirements" → "Application Form" in nav, routes, and copy
3. Add `/evaluate` route — wire to existing `validateApplication.js` deterministic layers
4. Update `IconRail` and `MobileTabBar` (Generator → Evaluate)
5. Portal View in My Application — field-by-field output matching portal structure
6. Document View in My Application — secondary, toggled tab
7. Token exhaustion inline prompt (inline, not modal)
8. Evaluate onboarding copy (shown once on first visit)
9. KA153-YOU portal-view field order audit against the 2026 official template
10. Build the schema manifest and switch `schemaForAction()`, `fieldsForAction()`, and `ActionTypePicker` to read it instead of their hardcoded per-action branches (§5)
11. Fix `actionTypes.ts`: `KA121`, `KA122`, `KA131/171`, `KA152`, `KA154` are currently `supported: true` with no backing schema anywhere in the repo — a live bug where picking any of them silently returns a null schema. Once the manifest lands, `supported` must derive from "does a reviewed schema exist," not be hand-set
12. Add the "schema verified as of `<date>`" badge to Portal View (§6)
13. Add the desktop-nudge banner to mobile Portal View (§6)
14. Wire the fact-conflict rule (§3.1): Chat inference against a `locked` fact must surface as `stale`, never silently overwrite
15. KA152-YOU and KA154-YOU action schemas via `tools/schema-sync` (after KA153 golden eval passes)
16. Add Basic/Pro/Enterprise pricing to `app/api/src/lib/plans.js` (done) and wire real billing once
    OQ-8 (payment processor — not Stripe, Ameriabank pending confirmation) resolves. Until then,
    plan changes are manual via `app/api/scripts/set-plan.js`.
17. Implement the 30-day Free-tier document expiry job (§8)
