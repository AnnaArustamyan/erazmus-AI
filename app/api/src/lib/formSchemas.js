import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCHEMAS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../resources/schemas');
const MANIFEST_PATH = path.join(SCHEMAS_DIR, 'manifest.json');

const cache = new Map();

function readJson(abs) {
  if (cache.has(abs)) return cache.get(abs);
  const data = JSON.parse(fs.readFileSync(abs, 'utf8'));
  cache.set(abs, data);
  return data;
}

/**
 * Single source of truth for which actions have a reviewed schema and where
 * it lives. Adding or enabling an action is a manifest edit, not a code
 * change — see tools/schema-sync/src/sync.js, which writes this file after
 * the human review checklist passes.
 * @param {string} actionCode
 * @returns {{ callYear: number, supported: boolean, dir: string, verifiedAt?: string } | null}
 */
export function manifestEntry(actionCode) {
  const manifest = readJson(MANIFEST_PATH);
  const entry = manifest[actionCode];
  return entry && entry.supported ? entry : null;
}

export function isActionSupported(actionCode) {
  return manifestEntry(actionCode) !== null;
}

export function loadFormSchema(actionCode, callYear = 2026) {
  const entry = manifestEntry(actionCode);
  if (!entry) return null;
  const schema = readJson(path.join(SCHEMAS_DIR, entry.dir, 'form.json'));
  if (schema.callYear !== callYear) return schema;
  return schema;
}

export function loadEvaluationSchema(actionCode, callYear = 2026) {
  const entry = manifestEntry(actionCode);
  if (!entry) return null;
  const schema = readJson(path.join(SCHEMAS_DIR, entry.dir, 'evaluation.json'));
  if (schema.callYear !== callYear) return schema;
  return schema;
}

export function flattenFormFields(schema) {
  if (!schema?.sections) return [];
  return schema.sections.flatMap((section) =>
    section.fields.map((field) => ({
      ...field,
      sectionId: section.id,
      sectionTitle: section.title,
    })),
  );
}

export function fieldById(schema, id) {
  return flattenFormFields(schema).find((field) => field.id === id) || null;
}

/**
 * Richer injection for field-by-field generation. Falls back to family headings elsewhere.
 * @param {string} actionCode
 */
export function formSchemaInstruction(actionCode) {
  const schema = loadFormSchema(actionCode);
  if (!schema) return null;
  const lines = flattenFormFields(schema).map((field) => {
    const limits = [
      field.characterLimit ? `${field.characterLimit} chars` : null,
      field.wordLimit ? `${field.wordLimit} words` : null,
      field.required ? 'required' : 'optional',
    ]
      .filter(Boolean)
      .join(', ');
    return `- ${field.id} (${field.sectionTitle} / ${field.label}; ${limits})`;
  });
  return `Form schema ${schema.id}. Fill one field at a time. Use only locked confirmed facts. Never invent partners, dates, counts, or needs evidence.
Fields in order:
${lines.join('\n')}`;
}
