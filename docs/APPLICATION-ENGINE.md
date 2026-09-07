# EU Grantwriter — Application Intelligence Engine

**Version:** 1.3  
**Date:** 2026-08-20  
**Status:** Ready for engineering review  
**Audience:** AI development team  
**Depends on:** REQUIREMENTS.md v1.2 (SaaS shell, plans, chat controls, session), PRODUCT-SPEC.md v1.1  
**Codebase:** `app/web`, `app/api`, `app/resources/`, `tools/schema-sync/`

---

## 1. Product principle

We are not building an AI writing assistant. We are building an **Erasmus+ application expert** that understands the exact application being completed, collects the right information, validates compliance, identifies weaknesses, and helps fix them before submission.

Optimise for correctness, compliance, evidence, consistency, and evaluation readiness — not for beautiful prose.

The user should not need to understand Erasmus+ terminology. The system guides them step by step toward a structurally correct, compliant, coherent application for their exact action.

---

## 2. Architecture: one state, three interfaces

```text
              ┌─────────────────────────────────────────┐
              │         APPLICATION STATE (DB)           │
              │  action · facts · answers · sections ·   │
              │  validation report · readiness           │
              └────────┬──────────┬──────────┬──────────┘
                       │          │          │
                     CHAT    REQUIREMENTS   MY APPLICATION
```

The three interfaces are:

| Nav label | What it is |
|---|---|
| **Chat** | Talk to AI about your project — develop ideas, ask questions, get guidance |
| **Requirements** | See what's required for your application and fill the gaps |
| **My Application** | Your generated application document, assembled as you go |

These are not steps in a sequence. They are three views of the same project. The user can start anywhere. They read and write the **same typed Application State**. Facts extracted in Chat appear in Requirements. Answers from Requirements feed My Application. Validation runs against the whole state regardless of which interface triggered the change.

### Application State (minimum schema)

| Field | Description |
|---|---|
| `id` | Grant application record |
| `actionCode` | Confirmed action (e.g. `KA153`) — never guessed |
| `callYear` | Programme year (e.g. 2026) |
| `facts` | Structured facts with provenance (see §3) |
| `answers` | Question→answer map from the questionnaire |
| `sections` | Generated prose per schema field |
| `validationReport` | Latest deterministic + AI validation result |
| `readiness` | Pass/fail of quality gates — no numerical score until calibrated (see §9) |
| `status` | `draft` · `in_review` · `ready` |

**Rule:** Generated prose is always derived from facts. If a fact is missing, the system asks — it never invents partners, dates, counts, or needs evidence.

**Plan vs facts:** the AI may invent a **plan**. It may not invent **facts**. A working scenario is a hypothesis until the user confirms it and, where required, supplies evidence. Generation still uses only `locked` + `confirmed` facts.

---

## 3. Facts model: provenance and confidence

Facts are not just key-value pairs. Each fact carries provenance so the generator and validator always know where a value came from and how certain it is.

```json
{
  "key": "participant_count",
  "value": 24,
  "source": "questionnaire",
  "sourceField": "participants.number",
  "confidence": "confirmed",
  "status": "locked"
}
```

### Confidence levels

| Level | Meaning |
|---|---|
| `confirmed` | User explicitly provided this value through a questionnaire answer or direct chat confirmation |
| `inferred` | System extracted from a chat message but user has not confirmed |
| `suggested` | AI proposed a default value; user has not responded |

### Status

| Status | Meaning |
|---|---|
| `locked` | Confirmed by user. Used in generation without question. |
| `pending` | Inferred or suggested. Must be confirmed before generation uses it. |
| `stale` | A downstream answer has changed and this fact may no longer be valid. |

### Why this matters

- A `confirmed` participant count of 24 came from the user's explicit questionnaire answer. The generator uses it as ground truth.
- An `inferred` participant count of 24 came from a Chat message ("we plan to bring 24 people"). It must be confirmed before the generator treats it as a fact.
- If a `confirmed` fact conflicts with a later answer (e.g. user enters 30 participants in a different field), the system flags `stale` and asks the user to resolve it — it does not silently pick one value.

**This is the primary defence against hallucination.** The model cannot fill in or invent facts that are `pending` or missing. It must surface the gap instead.

### Fill states (how a requirement is obtained)

The schema defines **what must be known**. The AI decides **how** to obtain, propose, or validate it. Each requirement is in one of:

| State | Meaning | Generation |
|---|---|---|
| Known | User or source supplied this. Confidence `confirmed`, status `locked`. | Used |
| Proposed | AI recommendation or inference. Confidence `suggested` or `inferred`, status `pending`. | Not used |
| Must confirm | Cannot be invented (host school, accreditation, dates, evidence). | Not used |
| Missing | No value yet. | Not used |

Epistemic kinds on a candidate value:

| Kind | Meaning |
|---|---|
| Fact | Supplied by the user or a source |
| Inference | Logically derived (e.g. two-month learner stay → individual mobility) |
| Recommendation | AI’s proposed choice (e.g. 2 learners as a first-time scale) |
| Missing | Genuinely unknown |
| Unsupported | Claimed without evidence — cannot be used as a needs analysis |

Pipeline: **requirement → candidate answer → evidence → feasibility → confirmation**.

A conservative first-time plan is allowed. It is recalculated when budget or capacity arrives. Feasibility uses a planning estimate, not official unit costs. Suggestions never become application truth until the user confirms them.

### Minimum fact set before generation (KA153)

| Fact | Minimum confidence |
|---|---|
| `participant_count` | confirmed |
| `participating_organisations` | confirmed (count) |
| `countries` | confirmed |
| `activity_duration_days` | confirmed |
| `needs_method` | confirmed (method name + target group) |
| `selection_criteria` | confirmed |
| `venue_country` | confirmed |

Generation is refused (not degraded) if any of these are missing or `pending`.

---

## 4. Action lock (highest priority)

Before any generation or questionnaire creation, the system must identify the **exact application type**.

```text
Programme → KA1 / KA2 → Exact Action → Call Year → Schema
```

The AI may recommend an action from conversation context, but generation is refused until the user **explicitly confirms** the action code.

"I want to create a youth project about environmental awareness" is not enough to choose KA152 vs KA153 vs KA154. The system must ask.

### Current state (what to fix)

- `KA210` / `KA220` are correctly `supported: false` in `actionTypes.ts` today — that part of the original note is resolved.
- Live bug: `KA121`, `KA122`, `KA131/171`, `KA152`, and `KA154` are marked `supported: true` in `actionTypes.ts`, but only `KA153` has a reviewed schema anywhere in `app/resources/schemas/`. Picking any of the other five currently returns a `null` schema from `schemaForAction()`.
- Fix: move `supported` off the hand-set boolean entirely. Once the schema manifest (§5) exists, `supported` is derived from "does this action have a reviewed schema entry in the manifest" — not set by hand per action.

---

## 5. Two schemas per action

"Application schema" means two distinct objects:

### A. Form schema — what the applicant fills

Partners, activities, dates, participant tables, budget lumpsums, annexes, required/optional/conditional fields, character limits, word limits.

Encoded by hand from the observed 2026 official form + Programme Guide. Versioned: `KA153-YOU / 2026 / form-v1`.

```text
FormSchema
├── action: "KA153"
├── callYear: 2026
├── version: 1
├── sections[]
│   ├── id, title
│   ├── fields[]
│   │   ├── id, label, type, required, characterLimit, wordLimit
│   │   ├── conditionalOn?: { field, equals }
│   │   └── helpText
│   └── repeatableGroup? (e.g. partners, activities)
├── eligibility: { minPartners, countries, duration, ... }
└── annexes: [{ id, label, required, description }]
```

### B. Evaluation schema — what the Agency scores

Award criteria, weights, threshold, evidence expected per criterion.

```text
EvaluationSchema
├── action: "KA153"
├── callYear: 2026
├── criteria[]
│   ├── id: "relevance" | "design" | "management"
│   ├── maxScore: 30 | 40 | 30
│   ├── threshold: 50%
│   ├── subCriteria[]
│   │   ├── description
│   │   ├── evidenceExpected: string[]
│   │   └── source: "Guide 2026 §3.1.2"
├── overallThreshold: 60
├── horizontalPriorities: [{ id, label, bonusCondition }]
└── passingCondition: "≥60 total AND ≥50% each criterion"
```

### C. Schema manifest — how schemas get loaded

A single manifest (`app/resources/schemas/manifest.json` or equivalent) lists every action's schema location and its `supported` flag:

```json
{
  "KA153": { "callYear": 2026, "supported": true,  "dir": "ka153-you-2026" },
  "KA152": { "callYear": 2026, "supported": false, "dir": "ka152-you-2026" }
}
```

`formSchemas.js` (API), and `schemaForAction()` / `fieldsForAction()` / `ActionTypePicker` (web) all read this manifest instead of hardcoding a per-action branch. Adding or updating an action never requires a frontend code change — only a manifest entry, written by `tools/schema-sync/src/sync.js` after human review passes (§21).

### Source policy

- **Programme Guide** (public, yearly): the rule source. Cite section + year on every rule.
- **Official application environment** (webgate.ec.europa.eu): schema generation is AI-assisted, not live-scraped and not purely hand-authored. `tools/schema-sync` downloads the official call-template PDF, extracts its text, and uses a model to draft the form + evaluation schema JSON. That draft is never trusted directly — it goes through the human review checklist in `tools/schema-sync/README.md` (character limits, select options, conditional-field logic, criteria weights summing to 100, no cross-action rule bleed) before `sync.js` promotes it into `app/resources/schemas/` and the manifest. The product never ingests the portal live at request time, and never shows a user anything the pipeline generated but a human hasn't reviewed. The user still copies our coaching draft into the official portal by hand — we never submit on their behalf.

*(This supersedes the "encode by hand, do NOT scrape, automated ingestion is a non-goal" language in earlier drafts of this document — that described the intended v1 process before `tools/schema-sync` was built. The AI-assisted-with-mandatory-human-review pipeline is what actually ships; the discipline is in the review step, not in banning automation of the first draft.)*

---

## 6. Chat

Chat is an AI project-development and coaching interface.

Behaviours:

1. Help the user develop a vague idea into a strong project concept.
2. If they have no plan, propose a conservative working scenario (fact / inference / recommendation / missing). Do not bounce a questionnaire.
3. Recalculate when they give a budget, capacity, or other constraint. Do not keep an infeasible plan.
4. Extract facts into Application State as the conversation progresses. Extracted values stay `pending` until confirmed.
5. Never paste a full application or template from chat. If they ask, list missing facts and point to Requirements or Generate from this thread.

Chat already has a `chat-coach` skill (`app/resources/skills/chat-coach/SKILL.md`). KA121 first-time defaults live in `proposals` (web + API). The questionnaire list is not the intelligence.

---

## 7. Requirements

Once the action is locked, the Requirements view is generated from the form schema.

```text
Locked Action → Form Schema → Required fields → Questionnaire
```

Current state: question banks in `app/web/src/lib/grants/banks/` are hand-written per family. These become schema-driven — the requirements list is generated from the form schema, not maintained as a parallel data structure. Field `ai` metadata (`canPropose`, `requiresEvidence`, `feasibilityCheck`, `cannotInvent`) tells the engine how a gap may be filled. KA121 shows a **Proposed project setup** the user can confirm or change. Proposed values do not count as complete.

### Intelligent answer assessment

For each answer, run a lightweight check:

| Check | Type | Example |
|---|---|---|
| Empty / too short | Deterministic | "This field requires at least 200 characters" |
| Too generic | AI | "You mention 'develop skills' but don't specify which skills or how you'll measure improvement" |
| Contradicts another answer | Deterministic | "You said 5 participants earlier but 8 here" |

Offer **[Improve with AI]** — the AI suggests a better answer from the existing facts, never inventing new ones.

---

## 8. My Application

My Application transforms the Application State into the exact application structure.

```text
Application State
      ↓
Form Schema (field order, limits)
      ↓
Evaluation Schema (what evidence this field needs)
      ↓
Generate per field (not one monolithic document)
      ↓
Validate
```

For each field, the model knows:
- which form field it is filling
- the character/word limit
- what the evaluation criteria expect in this section
- what the user's facts say
- what neighbouring sections already say (consistency)

### Current state (what to extend)

`applicationSchema.js` has family-level headings (Relevance / Design / Management for `ka1_youth`). This becomes field-level from the form schema. `schemaInstruction()` remains the injection point but receives richer context.

---

## 9. Validation engine

### Layer A — Deterministic (code, no model)

| Check | Example |
|---|---|
| Required fields present | "Partner organisation 2 is missing" |
| Character / word limits | "Needs section exceeds 5000 character limit" |
| Beneficiary mismatch | KA153 + "young people as primary participants" |
| Participant count consistency | Different numbers across sections |
| Date / duration contradictions | 7-day activity but 3-day timetable |
| APV without session plan | Required annex missing |
| Missing needs method | No survey, focus group, or evidence source named |

Implemented as pure functions. Unit-tested. No model call.

### Layer B — Programme compliance (rules + model)

Check against the relevant Programme Guide requirements for the locked action:

- Eligibility (min partners, countries, duration)
- Correct objectives for the action
- Required horizontal priorities addressed (not as slogans)
- Activities match action type (not tourism, not academic study for KA153)

Rules sourced from `derived/rules.md` + `derived/families/`. Each rule cites Guide section + year.

### Layer C — Evidence tracing (deterministic + model)

For every evaluation sub-criterion that expects evidence, the system must:

1. **Identify** which form field(s) are expected to carry that evidence
2. **Locate** what the user wrote in those fields (or confirm they are empty)
3. **Assess** whether the content is sufficiently specific

```text
Evaluation sub-criterion
         ↓
Evidence expected (from evaluation schema)
         ↓
Which form field carries this evidence?
         ↓
What did the user write there?
         ↓
Is it strong enough? (deterministic threshold + model judgment)
         ↓
Finding with location
```

This makes the validator behave like an auditor, not a reader. It can tell the user exactly where evidence is missing:

```
Criterion: Quality of project design

🔴 Missing evidence: Participant selection methodology

We found no sufficiently specific explanation in:
  Participants → Selection criteria

Expected: Named criteria, weightings, and who applies them.
Found: "Participants will be selected carefully."

[Fix this field]
```

The evaluation schema's `subCriteria` entries must therefore include:

```json
{
  "id": "design_selection",
  "description": "Participant selection methodology",
  "evidenceExpected": [
    "Named selection criteria",
    "Weightings or priority order",
    "Who conducts selection"
  ],
  "mappedFormFields": ["participants.selection_criteria"],
  "source": "Guide 2026 §3.1.3"
}
```

`mappedFormFields` is the new required property. Each sub-criterion must be mapped to at least one form field. If no form field exists for a requirement, that is a schema gap — not a user problem.

### Layer D — Content quality (model)

Evaluate using the evidence-traced sub-criteria after Layer C runs:

- Relevance: does the project address a real need with evidence?
- Design: are objectives SMART? Do activities support them?
- Impact: are outcomes measurable? Is there an indicator + method?
- Logic chain: does need→objective→activity→outcome→impact hold consistently?

### Layer E — Internal consistency (deterministic + model)

Detect contradictions across the whole application:

- Different participant numbers between sections
- Activities that don't support stated objectives
- Claims unsupported elsewhere in the application
- Budget assumptions conflicting with project description

---

## 10. Quality gates and application status

### Gates

An application passes through gates sequentially:

| Gate | Validation layer | Passes when |
|---|---|---|
| 1. Schema | Deterministic | All required fields present, limits respected, correct structure |
| 2. Compliance | Rules + model | No critical eligibility or action-type violations |
| 3. Consistency | Deterministic + model | No major contradictions between sections |
| 4. Evidence | Evidence tracing (Layer C) | All mapped sub-criteria have sufficiently specific evidence |
| 5. Quality | Model rubric (Layer D) | No critical weaknesses against applicable award criteria |

### Status display — no numerical score, permanently

The readiness result is a **status + gate summary**, not a number — and this is a permanent product decision, not a placeholder pending calibration (resolved 2026-08-20; see PRODUCT-SPEC.md §11 OQ-3).

```
APPLICATION STATUS

🔴 Not ready

2 Critical issues
4 Major issues
6 Minor improvements

Schema:      PASS
Compliance:  PASS
Consistency: FAIL
Evidence:    FAIL
Quality:     REVIEW NEEDED
```

**Never ship a numerical score (e.g. "74/100").** Not after the golden test set exists (§19), not after calibration, not with a disclaimer attached. A number will be read as "74% chance of funding" regardless of any caveat next to it — that risk doesn't go away with calibration, so there is no threshold that unlocks a score. The gate-pass display communicates the same completeness/compliance information without that risk, permanently.

### What "ready" means (UI copy, put this verbatim)

*Ready means the draft satisfies known structural, compliance, and evidence requirements for this action and programme year. It does not predict funding.*

---

## 11. Severity levels

| Level | Meaning | Example |
|---|---|---|
| 🔴 Critical | Blocks submission or likely fails a gate outright | Required field missing; wrong beneficiary |
| 🟠 Major | Significantly weakens against award criteria | Impact claims with no measurement mechanism |
| 🟡 Minor | Recommended improvement | Target group could be more specific |

---

## 12. Improvement system

Every problem has an actionable fix:

```text
PROBLEM: Impact needs improvement
WHY: You said participants will benefit, but no indicator or measurement method.
ADD: expected change · indicator · measurement method · timeline
[Improve with AI]
```

**Constraints on Improve-with-AI:**
- Patches ONE field at a time
- Shows a diff of what changed
- Never invents facts (partners, dates, counts, evidence)
- If a fact is needed, asks the user instead of generating
- Re-runs validators after the patch
- Budget: cap at 3 automatic improvement passes per field per session

---

## 13. Readiness as persistent state

No separate fourth section. Readiness is a **persistent property of the application**, accessible from Chat, Requirements, and My Application.

```text
┌──────────────────────────────────────────────┐
│  APPLICATION STATUS: NOT READY               │
│  🔴 2 Critical  🟠 4 Major  🟡 6 Minor      │
│  🟢 28 Requirements satisfied                │
│  Schema: PASS · Compliance: PASS ·           │
│  Consistency: FAIL · Evidence: FAIL          │
│  [View full report]                          │
└──────────────────────────────────────────────┘
```

Do NOT build this UI until the KA153 validators actually exist. A fake score is worse than no score.

---

## 14. Deterministic vs AI — the boundary

| Deterministic (code) | AI (model call) |
|---|---|
| Required field presence | Evidence quality judgment |
| Character / word limits | Relevance assessment |
| Participant count matches | Vagueness detection |
| Date arithmetic | Objective → activity alignment |
| Beneficiary type mismatch | Rubric scoring |
| APV session plan exists | Improvement suggestions |
| Partner count vs eligibility | Needs analysis adequacy |

**Principle:** Run all deterministic checks BEFORE any model call. Fail fast and cheap. AI validates only what code cannot.

---

## 15. Cost and token budget

The generate → validate → improve loop can exhaust a Free plan (20k tokens) in one session.

Mitigations:
- Deterministic validation is free — run it first, surface all code-detectable issues before spending tokens
- Field-by-field generation is cheaper than monolithic regeneration
- Cap improvement loops: max 3 AI-improvement passes per field
- Show token cost before "Improve all with AI"
- Validate locally before calling the model for quality scoring

---

## 16. Non-goals

Do NOT do these:

| Non-goal | Reason |
|---|---|
| Live scraping of webgate.ec.europa.eu | Authenticated portal, potential ToS violation, brittle |
| Numerical quality score before calibration | Without golden-test calibration, any number is read as a funding probability regardless of disclaimers. Ship gate status first. |
| Funding probability score | We cannot predict Agency decisions under any framing |
| KA2 generation before KA153 gates are green | Per REQUIREMENTS.md FR-ACT-2 |
| One giant Programme Guide prompt | Context window abuse; poor accuracy; untestable |
| Fourth product section | Readiness is a state, not a page |
| Country-specific legal eligibility in v1 | Rules vary by NA; action + programme year only |
| "Independent" AI judge for Gate 5 | Same model reviewing itself is circular; use frozen rubric + golden tests |
| Automatic yearly Guide ingestion | Manual curated pack for v1; document the refresh process |

---

## 17. Slice 1: KA153-YOU, Guide 2026

Everything below must be proven on KA153 (Mobility of Youth Workers) before expanding to other actions.

### Must catch (validators)

- Young people listed as primary participants (wrong beneficiary)
- Missing needs method (no survey, focus group, or evidence)
- Participant count changing between sections
- APV without a session plan
- Slogan impact with no indicator ("participants will become more aware")
- Youth-exchange logic in a youth-worker draft
- Objectives that don't chain to activities

### Must not do

- Invent a host organisation or partner
- Fill unknown fields with dashes or placeholders
- Apply KA153 rules to KA122 or KA220
- Mark application as Ready with critical issues open
- Show a percentage that reads as funding probability

### Reuse from current codebase

| Module | Role in the engine |
|---|---|
| `passRate.js` + `derived/rules.md` | Rule source for Layer B compliance |
| `derived/assessments/EX-2024-A…E` | Golden test cases + negative examples |
| `applicationSchema.js` | Base for evaluation-schema headings |
| `draftQuality.js` | Seed of Gate 1 deterministic checks |
| `grants/banks/kaYouth.ts` | Current Requirements view (becomes schema-driven) |
| `chat-coach/SKILL.md` | Chat behaviour constraints |

---

## 18. Implementation order

| # | Layer | Done when | Depends on |
|---|---|---|---|
| 0 | **Application State + action lock** | Chat, Requirements, and My Application read/write one grant record. Action is confirmed by user, never inferred. Facts have provenance (source, confidence, status). | DB migration |
| 1 | **KA153-YOU 2026 form schema** | Form fields, character limits, conditionals in versioned JSON. KA152 and KA154 are separate codes. | Manual form observation |
| 2 | **KA153-YOU 2026 evaluation schema** | Award criteria + sub-criteria + `mappedFormFields` + evidence expected, each citing Guide section. | Programme Guide 2026 |
| 3 | **Deterministic validators** | Required fields, counts, dates, beneficiary mismatch, missing timetable, contradictions. All unit-tested. | Steps 1–2 |
| 4 | **Evidence tracing (Layer C)** | Each sub-criterion traces to its mapped field. Validator reports exact location of missing evidence, not just criterion name. | Steps 1–2 |
| 5 | **Requirements binds to form schema** | Grant graphs generated from schema. Weak-answer detection with structured gaps. Confirmed answers write `locked` facts. | Step 1 |
| 6 | **Chat writes facts with provenance** | Coach extracts structured facts (with `source: "chat"`, `confidence: "inferred"`) into Application State. User confirms to lock them. Full-app paste stays forbidden. | Step 0 |
| 7 | **Field-by-field generation** | Generator fills one schema field at a time respecting limits and neighbouring context. Only `locked` facts used. | Steps 1–2 |
| 8 | **AI quality evaluation + Improve** | Layer D rubric from evaluation schema. Improve patches one field, shows diff, re-validates. | Steps 3, 4, 7 |
| 9 | **Status UI + golden eval** | Persistent status display (gate pass/fail, no score). Tests include five NA cases + synthetic drafts. Score introduced only after calibration. | Steps 3, 8 |
| 10 | **Expand to KA152, KA154** | Clone schema + adapt rules. Confirm no KA153 rule bleed. | Step 9 green |
| 11 | **KA1 education families** | KA121, KA122, KA131/171 schemas + validators. | Step 10 |
| 12 | **KA2 partnerships** | KA210, KA220. Only after KA1 gates are green per FR-ACT-3. | Step 11 |

---

## 19. Testing and evaluation

### Golden test set (v1)

| Source | Count | Tests |
|---|---|---|
| NA assessments (EX-2024-A…EX-2025-E) | 5 | Validator must flag the same issues the NA flagged |
| Synthetic: structurally invalid | 5+ | Missing fields, wrong action, limit violations |
| Synthetic: contradictory | 5+ | Conflicting counts, dates, objectives |
| Synthetic: sounds good but violates rules | 5+ | Fluent prose, wrong beneficiary, no evidence |

### Metrics

- Schema compliance detection rate (deterministic — must be 100%)
- Critical-error recall (must catch what the NA caught)
- False positive rate (don't flag correct applications)
- Quality score stability (same draft → same rubric result ±5%)
- Token cost per full validate cycle

---

## 20. Rule provenance

Every rule in the system must have a source:

```text
{
  "id": "ka153_beneficiary",
  "level": "critical",
  "check": "deterministic",
  "rule": "Primary participants of KA153 must be youth workers, not young people",
  "source": "Programme Guide 2026, Part B, Mobility of Youth Workers, Award Criteria",
  "negativeExample": "EX-2024-A, EX-2024-B"
}
```

Untestable rules do not ship. If you cannot write a test case that would fail without the rule, the rule is not concrete enough.

---

## 21. Yearly refresh

When the new Programme Guide and call templates are published (usually November, for the following year's calls):

1. Run `tools/schema-sync`: `extract.js` → `generate.js` → `validate.js` → `diff.js` against the new PDF for each action
2. Complete the human review checklist (`tools/schema-sync/README.md`) on the AI-drafted schema — character limits, select options, conditional logic, criteria weights, cross-action bleed
3. `sync.js` promotes the reviewed schema into `app/resources/schemas/` and updates the manifest entry (§5), bumping `callYear`
4. Re-run golden tests against the new schemas (§19)
5. Update `derived/rules.md` and family packs
6. Document changes in a changelog, including the schema-sync `diff.js` output showing what changed vs. last year

Schema generation is AI-assisted and human-reviewed, not fully manual and not fully automated — see §5's source policy. The Programme Guide knowledge pack (`derived/guide-youth-workers.md`, `derived/rules.md` — REQUIREMENTS.md FR-KB-1) is a separate artifact from the form/evaluation schemas and stays a manually curated pack for v1, per REQUIREMENTS.md §4's "out of scope" list.

---

## 22. Success definition

A user who knows nothing about Erasmus+ can:

1. Describe a vague project idea in Chat
2. Have the AI ask the right questions and extract facts
3. Confirm their exact action type
4. Complete a schema-driven questionnaire with intelligent gap detection
5. Generate a field-by-field application that respects limits and structure
6. See a validation report with actionable fixes
7. Improve weak sections one at a time
8. Reach "Ready" status with all gates passing

And the resulting draft, when copied into the official application environment, does not immediately fail on structural compliance, beneficiary mismatch, missing evidence, or internal contradictions — the patterns our five NA assessments document as real rejection reasons.
