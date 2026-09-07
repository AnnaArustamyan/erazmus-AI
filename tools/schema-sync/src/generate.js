#!/usr/bin/env node
/**
 * generate.js — Use AI to extract form + evaluation schemas from PDF text.
 *
 * Usage:
 *   node src/generate.js KA152-YOU
 *   node src/generate.js KA154-YOU
 *
 * Requires: tmp/<action>-text.txt (run extract.js first)
 * Output:   tmp/<action>-form.json
 *           tmp/<action>-eval.json
 *
 * Then run validate.js to check the output before promoting it to app/resources/schemas/.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import { complete, parseJsonResponse } from './ai.js'

const require = createRequire(import.meta.url)

// Load .env from the tool directory
const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env')
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TMP_DIR = path.join(__dirname, '..', 'tmp')

// Action-specific metadata the model can't reliably infer from the PDF alone
const ACTION_METADATA = {
  'KA152-YOU': {
    name: 'Youth exchanges',
    beneficiary: 'young_people',
    guideSection: 'Mobility projects for young people — Youth exchanges',
    minPartners: 2,
    minDurationDays: 5,
    maxDurationDays: 21,
    maxParticipants: 60,
    awardCriteriaWeights: { relevance: 30, design: 40, management: 30 },
    overallThreshold: 60,
    keyRejectionPatterns: [
      'Youth workers listed as primary participants instead of young people',
      'Missing needs analysis for young people (not organisations)',
      'No non-formal learning methods described',
      'Participant count inconsistent across sections',
      'Vague impact with no indicator or measurement method',
    ],
  },
  'KA154-YOU': {
    name: 'Youth participation activities',
    beneficiary: 'young_people',
    guideSection: 'Mobility projects for young people — Youth participation activities',
    minPartners: 1,
    minDurationDays: 2,
    maxDurationDays: 60,
    maxParticipants: 50,
    awardCriteriaWeights: { relevance: 30, design: 40, management: 30 },
    overallThreshold: 60,
    keyRejectionPatterns: [
      'Participation activities confused with youth exchanges',
      'Missing link to EU Youth Dialogue or Youth Goals',
      'Young people not involved in design/implementation',
      'No democratic participation or civic engagement element',
      'Impact claims with no indicator or measurement method',
    ],
  },
  'KA121-SCH': {
    name: 'Short-term projects for school education staff mobility',
    beneficiary: 'school_staff',
    guideSection: 'Mobility projects for school education staff — Short-term projects',
    minPartners: 1,
    minDurationDays: 2,
    maxDurationDays: 365,
    maxParticipants: null,
    awardCriteriaWeights: { relevance: 30, design: 40, management: 30 },
    overallThreshold: 60,
    keyRejectionPatterns: [
      'No European Development Plan (EDP) or weak EDP',
      'Staff development needs not linked to school improvement plan',
      'Missing recognition/dissemination of learning outcomes',
    ],
  },
}

const FORM_SCHEMA_EXAMPLE = `{
  "id": "KA153-YOU-2026-form-v1",
  "action": "KA153",
  "callYear": 2026,
  "version": 1,
  "source": "Programme Guide 2026 Part B; form structure from 2026 official application environment.",
  "eligibility": {
    "minPartners": 2, "minDurationDays": 2, "maxDurationDays": 60,
    "maxParticipantsPerActivity": 50, "beneficiary": "youth_workers",
    "source": "Guide 2026, Mobility of Youth Workers"
  },
  "minimumFacts": ["participant_count", "participating_organisations", "countries"],
  "annexes": [
    { "id": "annexes.timetable", "label": "Day-by-day timetable", "required": true, "description": "..." }
  ],
  "sections": [
    {
      "id": "project",
      "title": "Relevance",
      "fields": [
        {
          "id": "project.summary", "label": "Project summary",
          "type": "textarea", "required": true,
          "characterLimit": 2000, "minCharacters": 80,
          "question": "In a few sentences, what is this mobility about?",
          "helpText": "Name the organisations and the professional need it answers."
        },
        {
          "id": "needs.method", "label": "Needs identification method",
          "type": "select", "required": true,
          "factKey": "needs_method",
          "question": "How did you identify the needs?",
          "options": [
            { "value": "survey", "label": "Survey" },
            { "value": "focus_group", "label": "Focus groups" },
            { "value": "mixed", "label": "Mixed methods" },
            { "value": "none", "label": "No formal method" }
          ]
        }
      ]
    }
  ]
}`

const EVAL_SCHEMA_EXAMPLE = `{
  "id": "KA153-YOU-2026-eval-v1",
  "action": "KA153",
  "callYear": 2026,
  "version": 1,
  "source": "Programme Guide 2026, Part B, Award Criteria",
  "overallThreshold": 60,
  "passingCondition": "≥60 total AND ≥50% each criterion",
  "criteria": [
    {
      "id": "relevance", "title": "Relevance, rationale and impact",
      "maxScore": 30, "threshold": 15,
      "subCriteria": [
        {
          "id": "relevance_needs",
          "description": "Needs of participating youth workers with a method",
          "evidenceExpected": ["Named method (survey/focus group)", "What participants said"],
          "mappedFormFields": ["needs.method", "needs.analysis", "needs.evidence"],
          "source": "Guide 2026 § Mobility of youth workers — Award criteria, Relevance"
        }
      ]
    }
  ]
}`

function buildFormPrompt(actionCode, pdfText, meta) {
  return `You are a structured data extractor. Extract the complete form schema for the Erasmus+ ${actionCode} (${meta.name}) 2026 call template.

## Source document (extracted from official EU PDF)

${pdfText.slice(0, 40000)}

## Action metadata (use these exact values — do not infer from text)

- action: "${actionCode.replace('-YOU', '').replace('-SCH', '')}"
- callYear: 2026
- beneficiary: "${meta.beneficiary}"
- minPartners: ${meta.minPartners}
- minDurationDays: ${meta.minDurationDays}
- maxDurationDays: ${meta.maxDurationDays}
${meta.maxParticipants ? `- maxParticipantsPerActivity: ${meta.maxParticipants}` : ''}

## Output format

Return ONLY valid JSON matching this exact structure (no markdown, no explanation):

${FORM_SCHEMA_EXAMPLE}

## Rules

1. Extract ALL sections and fields visible in the PDF.
2. For each field, set the EXACT character limit shown in the PDF. If no limit is shown, omit characterLimit.
3. Set "required": true for fields marked with * or "mandatory" in the PDF. Others are false.
4. For dropdown/radio fields, use type "select" and list all visible options as { value, label } pairs. Use snake_case for values.
5. For conditional fields (e.g. "if yes, describe"), set conditionalOn: { field: "parent.field.id", equals: "yes" }.
6. The "question" is a plain-language question version of the field label (helpful for the user).
7. The "helpText" is a 1–2 sentence coaching note about what makes a strong answer for this field.
8. The "id" for each field uses dot notation matching the section: "section.fieldname" (e.g. "needs.analysis", "participants.number").
9. The "factKey" is only set for fields that map to a minimum fact (participant_count, participating_organisations, countries, activity_duration_days, needs_method, selection_criteria, venue_country).
10. The "minimumFacts" array lists the factKeys that must be confirmed before generation.
11. Set the "source" field to: "Programme Guide 2026 Part B, ${meta.guideSection}; form structure from 2026 official application environment."

Return only the JSON object. No prose before or after.`
}

function buildEvalPrompt(actionCode, pdfText, meta, formSchema) {
  const sectionIds = formSchema.sections
    .flatMap((s) => s.fields.map((f) => f.id))
    .slice(0, 30)
    .join(', ')

  return `You are a structured data extractor. Extract the evaluation schema for the Erasmus+ ${actionCode} (${meta.name}) 2026 award criteria.

## Source document (extracted from official EU PDF — award criteria section)

${pdfText.slice(0, 40000)}

## Available form field IDs (use ONLY these in mappedFormFields)

${sectionIds}

## Award criteria weights

- Relevance: ${meta.awardCriteriaWeights.relevance} points (threshold: ${Math.ceil(meta.awardCriteriaWeights.relevance / 2)})
- Design: ${meta.awardCriteriaWeights.design} points (threshold: ${Math.ceil(meta.awardCriteriaWeights.design / 2)})
- Management: ${meta.awardCriteriaWeights.management} points (threshold: ${Math.ceil(meta.awardCriteriaWeights.management / 2)})
- Overall threshold: ${meta.overallThreshold}

## Known rejection patterns for this action

${meta.keyRejectionPatterns.map((p, i) => `${i + 1}. ${p}`).join('\n')}

## Output format

Return ONLY valid JSON matching this exact structure (no markdown, no explanation):

${EVAL_SCHEMA_EXAMPLE}

## Rules

1. Extract all sub-criteria visible in the PDF under each award criterion.
2. For each sub-criterion, set "mappedFormFields" to the field IDs (from the list above) that carry the evidence for that criterion.
3. "evidenceExpected" is a list of specific things reviewers look for (concrete, not vague).
4. "source" cites the exact Programme Guide section (e.g. "Guide 2026 § ${meta.guideSection} — Award criteria, Relevance").
5. Include horizontalPriorities (inclusion, green, digital, participation) with their bonusCondition.
6. The passingCondition is "≥${meta.overallThreshold} total AND ≥50% each criterion".

Return only the JSON object. No prose before or after.`
}

async function run() {
  const actionCode = process.argv[2]?.toUpperCase()

  if (!actionCode || !ACTION_METADATA[actionCode]) {
    console.error('Usage: node src/generate.js <ACTION_CODE>')
    console.error('Available:', Object.keys(ACTION_METADATA).join(', '))
    process.exit(1)
  }

  const textPath = path.join(TMP_DIR, `${actionCode}-text.txt`)
  if (!fs.existsSync(textPath)) {
    console.error(`Missing: ${textPath}`)
    console.error(`Run first: node src/extract.js ${actionCode}`)
    process.exit(1)
  }

  const pdfText = fs.readFileSync(textPath, 'utf8')
  const meta = ACTION_METADATA[actionCode]
  console.log(`Generating schemas for ${actionCode} (${meta.name})…`)

  // ── Form schema ────────────────────────────────────────────────────────────
  console.log('\n[1/2] Generating form schema…')
  const formPrompt = buildFormPrompt(actionCode, pdfText, meta)
  const { content: formContent, totalTokens: formTokens } = await complete({
    messages: [{ role: 'user', content: formPrompt }],
    temperature: 0.1,
  })
  console.log(`  Used ${formTokens} tokens`)

  let formSchema
  try {
    formSchema = parseJsonResponse(formContent)
  } catch (err) {
    console.error('Failed to parse form schema JSON:', err.message)
    const rawPath = path.join(TMP_DIR, `${actionCode}-form-raw.txt`)
    fs.writeFileSync(rawPath, formContent, 'utf8')
    console.error(`Raw output saved to ${rawPath} for debugging`)
    process.exit(1)
  }

  const formPath = path.join(TMP_DIR, `${actionCode}-form.json`)
  fs.writeFileSync(formPath, JSON.stringify(formSchema, null, 2), 'utf8')
  console.log(`  Saved ${formPath}`)

  // ── Evaluation schema ──────────────────────────────────────────────────────
  console.log('\n[2/2] Generating evaluation schema…')
  const evalPrompt = buildEvalPrompt(actionCode, pdfText, meta, formSchema)
  const { content: evalContent, totalTokens: evalTokens } = await complete({
    messages: [{ role: 'user', content: evalPrompt }],
    temperature: 0.1,
  })
  console.log(`  Used ${evalTokens} tokens`)

  let evalSchema
  try {
    evalSchema = parseJsonResponse(evalContent)
  } catch (err) {
    console.error('Failed to parse eval schema JSON:', err.message)
    const rawPath = path.join(TMP_DIR, `${actionCode}-eval-raw.txt`)
    fs.writeFileSync(rawPath, evalContent, 'utf8')
    console.error(`Raw output saved to ${rawPath} for debugging`)
    process.exit(1)
  }

  const evalPath = path.join(TMP_DIR, `${actionCode}-eval.json`)
  fs.writeFileSync(evalPath, JSON.stringify(evalSchema, null, 2), 'utf8')
  console.log(`  Saved ${evalPath}`)

  console.log('\nDone.')
  console.log(`Total tokens used: ${formTokens + evalTokens}`)
  console.log(`\nNext step: node src/validate.js ${actionCode}`)
}

run().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
