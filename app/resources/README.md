# Pass-rate knowledge pack (local)

**Audience:** developing agent + backend  
**Guide year:** 2026  
**Action in this corpus:** KA153-YOU — Mobility of youth workers  
**Status:** v1 curated pack (not live web search)

This folder is the source material for constrained Erasmus+ generation. Do not call Luna/Moonshot with a thin prompt. Do not scrape the internet at request time.

---

## What is canonical vs example

| Priority | Use for | Location |
|---|---|---|
| **1. Canonical** | Award criteria, eligibility, what the Action is for | `guide/` + `derived/guide-youth-workers.md` |
| **1. Canonical** | Why real applications failed (reviewer language) | `assessments/` + `derived/assessments/*.md` |
| **2. Rules to inject** | Always / never constraints in system prompts | `derived/rules.md` |
| **3. Examples only** | Full narrative drafts (negative examples, not templates to copy) | `applications/` |
| **4. Secondary** | Day-by-day activity programmes / APV annexes | `timetables/` |

**Assessments + the Guide youth-worker section are canonical.**  
**Applications are examples of what was submitted — never treat them as a model of a passing grant.**  
**Timetables** illustrate what reviewers expect as an annex; they are not a substitute for the Guide.

---

## How to use this pack in the product

1. Inject `derived/rules.md` into **every** chat and document-generation system prompt (KA153 / youth-worker mobility).
2. Retrieve relevant chunks from `derived/guide-youth-workers.md` (and later a chunked Guide index) for the user’s action.
3. When writing or revising a section, retrieve matching failure modes from `derived/assessments/` (e.g. needs analysis, wrong beneficiary, APV).
4. Do **not** dump full 50–60 page application PDFs or the full 456-page Guide into the model context.
5. Free and paid use the **same** pass-rate constraints. Paid = stronger model + higher limits.

---

## Privacy — do not commit raw PDFs

The PDFs in `guide/`, `assessments/`, `applications/`, and `timetables/` contain **applicant organisation names and official project codes**. They are gitignored.

**Safe to commit (this directory):**

- `README.md`, `MAPPING.md`
- `derived/rules.md`
- `derived/guide-youth-workers.md` (public Guide, paraphrased/excerpted)
- `derived/assessments/*.md` (anonymized; internal IDs only)

**Not safe to commit:**

- Any PDF in this folder
- Text that includes organisation legal names, project codes (`KA153-YOU-000…`), emails, or people’s names

When extracting or logging, replace identities with internal IDs from `MAPPING.md` (`EX-2024-A`, etc.).

---

## Yearly refresh

When the new Programme Guide is published:

1. Replace `guide/programme-guide-2026_en.pdf` with the new year file
2. Update `derived/guide-youth-workers.md` (award criteria + action objectives)
3. Bump `guide_year` in product config
4. Re-check `derived/rules.md` against the new criteria (KA153 may be renamed; follow the Guide’s “Mobility projects for youth workers” section)
