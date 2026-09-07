#!/usr/bin/env node
/**
 * sync.js — Promote validated schemas from tmp/ to app/resources/schemas/,
 * update the schema manifest, and generate the TypeScript loader file in
 * app/web/src/lib/grants/schemas/.
 *
 * Usage:
 *   node src/sync.js KA152-YOU
 *   node src/sync.js KA154-YOU
 *
 * Requires: tmp/<action>-form.json and tmp/<action>-eval.json
 * Validates before promoting — will not overwrite with invalid schemas.
 *
 * By the time this runs, you should have already completed the human
 * review checklist in README.md (validate.js passing is necessary, not
 * sufficient). This script marks the action `supported: true` in the
 * manifest on the assumption that review is done — if it isn't, set
 * `supported: false` back in app/resources/schemas/manifest.json before
 * committing.
 *
 * After running this, the API side needs no further wiring (formSchemas.js
 * reads the manifest). The web side still needs two lines added to
 * app/web/src/lib/grants/schemas/registry.ts — this script prints them.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TMP_DIR = path.join(__dirname, '..', 'tmp')
const SCHEMAS_DIR = path.join(__dirname, '..', '..', '..', 'app', 'resources', 'schemas')
const WEB_SCHEMAS_DIR = path.join(__dirname, '..', '..', '..', 'app', 'web', 'src', 'lib', 'grants', 'schemas')
const MANIFEST_PATH = path.join(SCHEMAS_DIR, 'manifest.json')

function loadManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) return {}
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
}

function saveManifest(manifest) {
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
}

function run() {
  const actionCode = process.argv[2]?.toUpperCase()
  if (!actionCode) {
    console.error('Usage: node src/sync.js <ACTION_CODE>')
    process.exit(1)
  }

  // Run validate first
  console.log(`Running validate.js for ${actionCode}…`)
  const validation = spawnSync('node', ['src/validate.js', actionCode], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
  })
  if (validation.status !== 0) {
    console.error('\nValidation failed. Fix errors before promoting.')
    process.exit(1)
  }

  const newFormPath = path.join(TMP_DIR, `${actionCode}-form.json`)
  const newEvalPath = path.join(TMP_DIR, `${actionCode}-eval.json`)
  const formSchema = JSON.parse(fs.readFileSync(newFormPath, 'utf8'))
  const evalSchema = JSON.parse(fs.readFileSync(newEvalPath, 'utf8'))

  // Create the schema dir: e.g. ka152-you-2026
  const callYear = formSchema.callYear ?? 2026
  const dirName = `${actionCode.toLowerCase()}-${callYear}`
  const targetDir = path.join(SCHEMAS_DIR, dirName)
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true })

  // Write form.json and evaluation.json
  const formDest = path.join(targetDir, 'form.json')
  const evalDest = path.join(targetDir, 'evaluation.json')
  fs.writeFileSync(formDest, JSON.stringify(formSchema, null, 2), 'utf8')
  fs.writeFileSync(evalDest, JSON.stringify(evalSchema, null, 2), 'utf8')
  console.log(`\nPromoted:`)
  console.log(`  ${formDest}`)
  console.log(`  ${evalDest}`)

  // Generate TypeScript loader in app/web/src/lib/grants/schemas/
  const actionBase = actionCode.split('-')[0].toLowerCase() // ka152, ka154
  const actionKey = actionCode.split('-')[0] // KA152, KA154 — the manifest/registry key
  const loaderPath = path.join(WEB_SCHEMAS_DIR, `${actionBase}.ts`)
  const loaderContent = generateLoader(actionCode, actionBase, dirName)
  fs.writeFileSync(loaderPath, loaderContent, 'utf8')
  console.log(`  ${loaderPath}`)

  // Update the API-side manifest — formSchemas.js reads this directly, no code change needed there.
  const verifiedAt = new Date().toISOString().slice(0, 10)
  const manifest = loadManifest()
  const previouslySupported = manifest[actionKey]?.supported
  manifest[actionKey] = { callYear, supported: true, dir: dirName, verifiedAt }
  saveManifest(manifest)
  console.log(`  ${MANIFEST_PATH} (${actionKey}: supported=true, verifiedAt=${verifiedAt})`)
  if (previouslySupported === false) {
    console.log(`  (was previously supported=false — confirm the review checklist is actually done)`)
  }

  console.log('\nDone. The API needs no further wiring. One manual step remains for the web app:')
  console.log(`\n  In app/web/src/lib/grants/schemas/registry.ts, add:`)
  console.log(`       import { ${actionBase}FormSchema } from './${actionBase}'`)
  console.log(`    to the imports, then add to SCHEMA_MANIFEST:`)
  console.log(`       ${actionKey}: { callYear: ${callYear}, supported: true, verifiedAt: '${verifiedAt}' },`)
  console.log(`    and to SCHEMA_BY_ACTION:`)
  console.log(`       ${actionKey}: ${actionBase}FormSchema,`)
  console.log(`\n  If the review checklist isn't actually done yet, set supported: false in both`)
  console.log(`  app/resources/schemas/manifest.json and registry.ts's SCHEMA_MANIFEST until it is.`)
}

function generateLoader(actionCode, actionBase, dirName) {
  const varName = `${actionBase}FormSchema`
  const graphName = `${actionBase}Graph`
  return `import ${actionBase}Form from './${dirName}/form.json' with { type: 'json' }
import { formSchemaToGraph, type FormSchema } from './formSchemaToGraph'

export const ${varName} = ${actionBase}Form as FormSchema
export const ${graphName} = formSchemaToGraph(${varName})
`
}

run()
