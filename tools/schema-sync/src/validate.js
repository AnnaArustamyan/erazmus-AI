#!/usr/bin/env node
/**
 * validate.js — Sanity-check generated schemas before promoting to app/resources/schemas/.
 *
 * Usage:
 *   node src/validate.js KA152-YOU
 *   node src/validate.js KA154-YOU
 *
 * Requires: tmp/<action>-form.json and tmp/<action>-eval.json
 * Exits 0 if all checks pass, 1 if any fail.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TMP_DIR = path.join(__dirname, '..', 'tmp')

const VALID_FIELD_TYPES = new Set(['text', 'textarea', 'select'])
const VALID_CRITERIA_IDS = new Set(['relevance', 'design', 'management'])

let errors = 0
let warnings = 0

function err(msg) {
  console.error(`  ❌ ${msg}`)
  errors++
}

function warn(msg) {
  console.warn(`  ⚠️  ${msg}`)
  warnings++
}

function ok(msg) {
  console.log(`  ✓  ${msg}`)
}

function validateFormSchema(schema, actionCode) {
  console.log('\n── Form schema ─────────────────────────────────────────────')

  if (!schema.id?.includes(actionCode.split('-')[0])) err(`id should contain action code, got: ${schema.id}`)
  else ok(`id: ${schema.id}`)

  if (!schema.action || typeof schema.action !== 'string') err('action is missing or not a string')
  else ok(`action: ${schema.action}`)

  if (schema.callYear !== 2026) err(`callYear should be 2026, got: ${schema.callYear}`)
  else ok(`callYear: ${schema.callYear}`)

  if (!schema.eligibility) err('eligibility block is missing')
  else {
    if (typeof schema.eligibility.minPartners !== 'number') err('eligibility.minPartners must be a number')
    else ok(`eligibility.minPartners: ${schema.eligibility.minPartners}`)
    if (typeof schema.eligibility.minDurationDays !== 'number') err('eligibility.minDurationDays must be a number')
    else ok(`eligibility.minDurationDays: ${schema.eligibility.minDurationDays}`)
    if (typeof schema.eligibility.maxDurationDays !== 'number') warn('eligibility.maxDurationDays missing')
    if (!schema.eligibility.beneficiary) err('eligibility.beneficiary is missing')
    else ok(`eligibility.beneficiary: ${schema.eligibility.beneficiary}`)
  }

  if (!Array.isArray(schema.sections) || schema.sections.length === 0) {
    err('sections array is missing or empty')
    return
  }
  ok(`sections: ${schema.sections.length}`)

  const allFieldIds = new Set()
  let totalFields = 0

  for (const section of schema.sections) {
    if (!section.id) err(`section missing id: ${JSON.stringify(section).slice(0, 60)}`)
    if (!section.title) err(`section ${section.id} missing title`)
    if (!Array.isArray(section.fields) || section.fields.length === 0) {
      err(`section ${section.id} has no fields`)
      continue
    }

    for (const field of section.fields) {
      totalFields++

      if (!field.id) { err('field missing id'); continue }
      if (allFieldIds.has(field.id)) err(`duplicate field id: ${field.id}`)
      allFieldIds.add(field.id)

      if (!VALID_FIELD_TYPES.has(field.type)) err(`field ${field.id}: invalid type "${field.type}"`)

      if (field.characterLimit !== undefined) {
        if (typeof field.characterLimit !== 'number' || field.characterLimit <= 0) {
          err(`field ${field.id}: characterLimit must be a positive number, got ${field.characterLimit}`)
        } else if (field.characterLimit > 20000) {
          warn(`field ${field.id}: characterLimit ${field.characterLimit} seems very high — verify against PDF`)
        }
      }

      if (field.type === 'select') {
        if (!Array.isArray(field.options) || field.options.length === 0) {
          err(`field ${field.id}: select field has no options`)
        } else {
          for (const opt of field.options) {
            if (!opt.value || !opt.label) err(`field ${field.id}: option missing value or label: ${JSON.stringify(opt)}`)
            if (/\s/.test(opt.value)) err(`field ${field.id}: option value "${opt.value}" contains spaces — use snake_case`)
          }
        }
      }

      if (field.conditionalOn) {
        if (!field.conditionalOn.field || !field.conditionalOn.equals) {
          err(`field ${field.id}: conditionalOn missing field or equals`)
        } else if (!allFieldIds.has(field.conditionalOn.field)) {
          warn(`field ${field.id}: conditionalOn.field "${field.conditionalOn.field}" not yet seen — may be forward reference`)
        }
      }

      if (!field.question) warn(`field ${field.id}: missing question (helpful for users)`)
    }
  }

  ok(`total fields: ${totalFields}`)
  if (totalFields < 10) warn(`only ${totalFields} fields — may be incomplete extraction`)

  if (Array.isArray(schema.minimumFacts)) ok(`minimumFacts: ${schema.minimumFacts.join(', ')}`)
  else warn('minimumFacts array missing')
}

function validateEvalSchema(schema, formSchema, actionCode) {
  console.log('\n── Evaluation schema ───────────────────────────────────────')

  if (!schema.id?.includes(actionCode.split('-')[0])) err(`id should contain action code, got: ${schema.id}`)
  else ok(`id: ${schema.id}`)

  if (schema.callYear !== 2026) err(`callYear should be 2026, got: ${schema.callYear}`)
  else ok(`callYear: ${schema.callYear}`)

  if (typeof schema.overallThreshold !== 'number') err('overallThreshold missing or not a number')
  else ok(`overallThreshold: ${schema.overallThreshold}`)

  if (!Array.isArray(schema.criteria) || schema.criteria.length === 0) {
    err('criteria array is missing or empty')
    return
  }

  const allFormFieldIds = new Set(
    (formSchema?.sections ?? []).flatMap((s) => s.fields.map((f) => f.id)),
  )

  let totalWeight = 0
  for (const criterion of schema.criteria) {
    if (!VALID_CRITERIA_IDS.has(criterion.id)) warn(`unexpected criterion id: ${criterion.id}`)
    if (typeof criterion.maxScore !== 'number') err(`criterion ${criterion.id}: maxScore missing`)
    else totalWeight += criterion.maxScore
    if (typeof criterion.threshold !== 'number') err(`criterion ${criterion.id}: threshold missing`)

    if (!Array.isArray(criterion.subCriteria) || criterion.subCriteria.length === 0) {
      warn(`criterion ${criterion.id}: no subCriteria`)
      continue
    }

    for (const sub of criterion.subCriteria) {
      if (!sub.id) err(`subCriteria missing id in ${criterion.id}`)
      if (!sub.description) err(`subCriteria ${sub.id}: missing description`)
      if (!Array.isArray(sub.evidenceExpected) || sub.evidenceExpected.length === 0) {
        warn(`subCriteria ${sub.id}: no evidenceExpected`)
      }
      if (!Array.isArray(sub.mappedFormFields) || sub.mappedFormFields.length === 0) {
        err(`subCriteria ${sub.id}: mappedFormFields is required (links criterion to form fields)`)
      } else {
        for (const fieldId of sub.mappedFormFields) {
          if (!allFormFieldIds.has(fieldId)) {
            err(`subCriteria ${sub.id}: mappedFormField "${fieldId}" not found in form schema`)
          }
        }
      }
      if (!sub.source) warn(`subCriteria ${sub.id}: missing source citation`)
    }
  }

  if (totalWeight !== 100) warn(`criteria weights sum to ${totalWeight}, expected 100`)
  else ok(`criteria weights sum: ${totalWeight}`)

  ok(`criteria: ${schema.criteria.length}`)
}

function run() {
  const actionCode = process.argv[2]?.toUpperCase()
  if (!actionCode) {
    console.error('Usage: node src/validate.js <ACTION_CODE>')
    process.exit(1)
  }

  const formPath = path.join(TMP_DIR, `${actionCode}-form.json`)
  const evalPath = path.join(TMP_DIR, `${actionCode}-eval.json`)

  if (!fs.existsSync(formPath)) { console.error(`Missing: ${formPath}`); process.exit(1) }
  if (!fs.existsSync(evalPath)) { console.error(`Missing: ${evalPath}`); process.exit(1) }

  const formSchema = JSON.parse(fs.readFileSync(formPath, 'utf8'))
  const evalSchema = JSON.parse(fs.readFileSync(evalPath, 'utf8'))

  console.log(`\nValidating schemas for ${actionCode}`)
  validateFormSchema(formSchema, actionCode)
  validateEvalSchema(evalSchema, formSchema, actionCode)

  console.log('\n────────────────────────────────────────────────────────────')
  if (errors > 0) {
    console.error(`\n❌ ${errors} error(s), ${warnings} warning(s) — fix errors before promoting`)
    console.error('Edit the JSON files in tmp/ and re-run validate.js')
    process.exit(1)
  } else if (warnings > 0) {
    console.warn(`\n⚠️  0 errors, ${warnings} warning(s) — review warnings then promote`)
    console.log(`\nNext step: node src/diff.js ${actionCode}`)
  } else {
    console.log(`\n✓ All checks passed`)
    console.log(`\nNext step: node src/diff.js ${actionCode}`)
  }
}

run()
