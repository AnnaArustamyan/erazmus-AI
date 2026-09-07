# schema-sync

Automated extraction of Erasmus+ form and evaluation schemas from official EU call template PDFs.

Run once a year when the new Programme Guide and call templates are published (usually November).

## Setup

```bash
cd tools/schema-sync
npm install
cp .env.example .env
# Fill in MOONSHOT_API_KEY (preferred) or OPENAI_API_KEY
```

## Usage — adding a new action

```bash
# Step 1: Download PDF and extract text
node src/extract.js KA152-YOU

# Step 2: Generate form + eval schemas using AI
node src/generate.js KA152-YOU

# Step 3: Validate the output
node src/validate.js KA152-YOU

# Step 4: Review what's new (or what changed vs last year)
node src/diff.js KA152-YOU

# Step 5: Promote to app/resources/schemas/ and generate TS loader
node src/sync.js KA152-YOU
```

Or run all steps in sequence:

```bash
node src/sync.js KA152-YOU   # validates before promoting
```

## Usage — yearly refresh (existing action, new year)

```bash
# Re-extract the new PDF
node src/extract.js KA153-YOU

# Regenerate schemas
node src/generate.js KA153-YOU

# See what changed from last year
node src/diff.js KA153-YOU

# If changes look correct, validate and promote
node src/sync.js KA153-YOU
```

## Supported actions

| Action | PDF available | Status |
|---|---|---|
| KA152-YOU | Yes (2026) | Ready to generate |
| KA153-YOU | Yes (2026) | Already in app — use for re-extraction |
| KA154-YOU | Yes (2026) | Ready to generate |
| KA121-SCH | Yes (2026) | Ready to generate |
| KA122-SCH | Yes (2026) | Ready to generate |
| KA210-YOU | Yes (2026) | Ready to generate |

## After sync.js runs

`sync.js` writes `app/resources/schemas/manifest.json` directly — the API needs no further
wiring (`formSchemas.js` reads the manifest, and `ActionTypePicker`'s `supported` flag is
derived from it, not hand-set).

One manual step remains, because the web bundle can't read the manifest at runtime (Vite
bundles JSON at build time): add two lines to `app/web/src/lib/grants/schemas/registry.ts`
(the tool prints the exact lines) — one import, one `SCHEMA_MANIFEST` entry, one
`SCHEMA_BY_ACTION` entry. Then run `npm run build` in `app/web` to verify.

## Token cost

Each schema generation uses ~15,000–25,000 tokens (Moonshot or GPT-4o).
Both form + eval schemas for one action = ~30,000–50,000 tokens total.

## Human review checklist

After `validate.js` passes, manually check:

- [ ] Character limits match what you see in the actual portal
- [ ] Select field options match the actual portal dropdowns
- [ ] Conditional fields trigger correctly (e.g. APV programme only if APV = yes)
- [ ] Award criteria weights sum to 100 (30 + 40 + 30)
- [ ] Each sub-criterion's mappedFormFields actually exist in the form schema
- [ ] No KA153 rules bleeding into the new action's schema

## PDF URL pattern

```
https://erasmus-plus.ec.europa.eu/sites/default/files/2025-11/Call%202026%20<Action Name>%20(<CODE>)_watermark.pdf
```

The `2025-11` date refers to when the PDF was published (November 2025 for 2026 call).
For 2027 templates, this will be `2026-11`.
