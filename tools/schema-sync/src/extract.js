#!/usr/bin/env node
/**
 * extract.js — Download a call template PDF from the EU website and extract its text.
 *
 * Usage:
 *   node src/extract.js KA152-YOU
 *   node src/extract.js KA154-YOU
 *   node src/extract.js KA153-YOU   (re-extract the reference schema)
 *
 * Output: tools/schema-sync/tmp/<action>-text.txt
 *
 * The PDF URLs follow the EU naming convention for 2026 call templates.
 * Update PDF_URLS below each November when the new guide drops.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TMP_DIR = path.join(__dirname, '..', 'tmp')

// 2026 call template PDFs — public, no auth required.
// Source: https://erasmus-plus.ec.europa.eu/document/template-application-form-*
// Update these URLs each November when the new year's templates are published.
const PDF_URLS = {
  'KA152-YOU': 'https://erasmus-plus.ec.europa.eu/sites/default/files/2025-11/Call%202026%20Mobility%20of%20young%20people%20(KA152-YOU)_watermark.pdf',
  'KA153-YOU': 'https://erasmus-plus.ec.europa.eu/sites/default/files/2025-11/Call%202026%20Mobility%20of%20youth%20workers%20(KA153-YOU)_watermark.pdf',
  'KA154-YOU': 'https://erasmus-plus.ec.europa.eu/sites/default/files/2025-11/Call%202026%20Youth%20participation%20activities%20(KA154-YOU)_watermark_0.pdf',
  'KA121-SCH': 'https://erasmus-plus.ec.europa.eu/sites/default/files/2025-11/Call%202026%20Short-term%20projects%20for%20school%20education%20staff%20mobility%20(KA121-SCH)_watermark.pdf',
  'KA122-SCH': 'https://erasmus-plus.ec.europa.eu/sites/default/files/2025-11/Call%202026%20Projects%20for%20school%20education%20staff%20mobility%20(KA122-SCH)_watermark.pdf',
  'KA210-YOU': 'https://erasmus-plus.ec.europa.eu/sites/default/files/2025-11/Call%202026%20Small-scale%20partnerships%20in%20youth%20(KA210-YOU)_watermark.pdf',
}

async function extractText(pdfBuffer) {
  // Lazy import — only needed at runtime
  const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default
  const data = await pdfParse(pdfBuffer)
  return data.text
}

async function run() {
  const actionCode = process.argv[2]?.toUpperCase()

  if (!actionCode || !PDF_URLS[actionCode]) {
    console.error('Usage: node src/extract.js <ACTION_CODE>')
    console.error('Available:', Object.keys(PDF_URLS).join(', '))
    process.exit(1)
  }

  const url = PDF_URLS[actionCode]
  console.log(`Downloading ${actionCode} call template…`)
  console.log(`  ${url}`)

  const res = await fetch(url)
  if (!res.ok) {
    console.error(`Download failed: HTTP ${res.status}`)
    console.error('The EU may have changed the URL. Check:')
    console.error('  https://erasmus-plus.ec.europa.eu/resources-and-tools/how-to-apply/web-forms-application-process')
    process.exit(1)
  }

  const buffer = Buffer.from(await res.arrayBuffer())
  console.log(`Downloaded ${(buffer.length / 1024).toFixed(0)} KB`)

  console.log('Extracting text from PDF…')
  const text = await extractText(buffer)
  console.log(`Extracted ${text.length} characters, ${text.split('\n').length} lines`)

  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true })

  const outPath = path.join(TMP_DIR, `${actionCode}-text.txt`)
  fs.writeFileSync(outPath, text, 'utf8')
  console.log(`Saved to ${outPath}`)
  console.log()
  console.log(`Next step: node src/generate.js ${actionCode}`)
}

run().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
