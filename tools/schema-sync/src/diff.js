#!/usr/bin/env node
/**
 * diff.js — Show what changed between the generated schema and the current one.
 *
 * Usage:
 *   node src/diff.js KA152-YOU   (no existing schema → shows "new schema")
 *   node src/diff.js KA153-YOU   (compare with existing → shows field-level diff)
 *
 * Requires: tmp/<action>-form.json and tmp/<action>-eval.json
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TMP_DIR = path.join(__dirname, '..', 'tmp')
const SCHEMAS_DIR = path.join(__dirname, '..', '..', '..', 'app', 'resources', 'schemas')

function flattenFields(schema) {
  const map = {}
  for (const section of schema.sections ?? []) {
    for (const field of section.fields ?? []) {
      map[field.id] = {
        label: field.label,
        type: field.type,
        required: field.required,
        characterLimit: field.characterLimit,
        section: section.title,
      }
    }
  }
  return map
}

function diffFields(oldFields, newFields) {
  const added = []
  const removed = []
  const changed = []

  for (const [id, newField] of Object.entries(newFields)) {
    if (!oldFields[id]) {
      added.push({ id, ...newField })
    } else {
      const old = oldFields[id]
      const changes = []
      if (old.label !== newField.label) changes.push(`label: "${old.label}" → "${newField.label}"`)
      if (old.characterLimit !== newField.characterLimit) changes.push(`characterLimit: ${old.characterLimit} → ${newField.characterLimit}`)
      if (old.required !== newField.required) changes.push(`required: ${old.required} → ${newField.required}`)
      if (old.type !== newField.type) changes.push(`type: ${old.type} → ${newField.type}`)
      if (changes.length) changed.push({ id, changes })
    }
  }

  for (const id of Object.keys(oldFields)) {
    if (!newFields[id]) removed.push(id)
  }

  return { added, removed, changed }
}

function run() {
  const actionCode = process.argv[2]?.toUpperCase()
  if (!actionCode) {
    console.error('Usage: node src/diff.js <ACTION_CODE>')
    process.exit(1)
  }

  const newFormPath = path.join(TMP_DIR, `${actionCode}-form.json`)
  const newEvalPath = path.join(TMP_DIR, `${actionCode}-eval.json`)

  if (!fs.existsSync(newFormPath)) {
    console.error(`Missing: ${newFormPath} — run generate.js first`)
    process.exit(1)
  }

  const newForm = JSON.parse(fs.readFileSync(newFormPath, 'utf8'))
  const newEval = JSON.parse(fs.readFileSync(newEvalPath, 'utf8'))

  // Find existing schema dir (e.g. ka153-you-2026)
  const actionSlug = actionCode.toLowerCase().replace('_', '-')
  const existingDir = fs.readdirSync(SCHEMAS_DIR).find((d) => d.startsWith(actionSlug))

  if (!existingDir) {
    console.log(`\n${actionCode} — NEW schema (no existing version found)\n`)
    console.log(`Form sections: ${newForm.sections?.length ?? 0}`)
    console.log(`Form fields:   ${Object.keys(flattenFields(newForm)).length}`)
    console.log(`Eval criteria: ${newEval.criteria?.length ?? 0}`)
    console.log(`Eval sub-criteria: ${newEval.criteria?.flatMap((c) => c.subCriteria ?? []).length ?? 0}`)
    console.log(`\nNo diff to show — this is a new action.`)
    console.log(`\nNext step: node src/sync.js ${actionCode}`)
    return
  }

  const existingFormPath = path.join(SCHEMAS_DIR, existingDir, 'form.json')
  const existingEvalPath = path.join(SCHEMAS_DIR, existingDir, 'evaluation.json')

  if (!fs.existsSync(existingFormPath)) {
    console.error(`Existing dir found (${existingDir}) but form.json missing`)
    process.exit(1)
  }

  const oldForm = JSON.parse(fs.readFileSync(existingFormPath, 'utf8'))

  console.log(`\n${actionCode} — diff vs ${existingDir}\n`)

  // Form diff
  const oldFields = flattenFields(oldForm)
  const newFields = flattenFields(newForm)
  const { added, removed, changed } = diffFields(oldFields, newFields)

  if (added.length === 0 && removed.length === 0 && changed.length === 0) {
    console.log('Form schema: no changes')
  } else {
    console.log(`Form schema changes:`)
    if (added.length) {
      console.log(`\n  + Added fields (${added.length}):`)
      for (const f of added) console.log(`    + ${f.id} (${f.section}) — ${f.label}`)
    }
    if (removed.length) {
      console.log(`\n  - Removed fields (${removed.length}):`)
      for (const id of removed) console.log(`    - ${id}`)
    }
    if (changed.length) {
      console.log(`\n  ~ Changed fields (${changed.length}):`)
      for (const { id, changes } of changed) {
        console.log(`    ~ ${id}:`)
        for (const c of changes) console.log(`        ${c}`)
      }
    }
  }

  // Eval diff (simple — just sub-criteria count)
  if (fs.existsSync(existingEvalPath)) {
    const oldEval = JSON.parse(fs.readFileSync(existingEvalPath, 'utf8'))
    const oldSubCount = oldEval.criteria?.flatMap((c) => c.subCriteria ?? []).length ?? 0
    const newSubCount = newEval.criteria?.flatMap((c) => c.subCriteria ?? []).length ?? 0
    if (oldSubCount !== newSubCount) {
      console.log(`\nEval schema: sub-criteria ${oldSubCount} → ${newSubCount}`)
    } else {
      console.log('\nEval schema: no change in sub-criteria count')
    }
  }

  console.log(`\nNext step: node src/sync.js ${actionCode}`)
}

run()
