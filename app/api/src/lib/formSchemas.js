import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCHEMAS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../resources/schemas');

const FORM_FILES = {
  KA153: 'ka153-you-2026/form.json',
};

const EVAL_FILES = {
  KA153: 'ka153-you-2026/evaluation.json',
};

const cache = new Map();

function readJson(rel) {
  const abs = path.join(SCHEMAS_DIR, rel);
  if (cache.has(abs)) return cache.get(abs);
  const data = JSON.parse(fs.readFileSync(abs, 'utf8'));
  cache.set(abs, data);
  return data;
}

export function loadFormSchema(actionCode, callYear = 2026) {
  const rel = FORM_FILES[actionCode];
  if (!rel) return null;
  const schema = readJson(rel);
  if (schema.callYear !== callYear) return schema;
  return schema;
}

export function loadEvaluationSchema(actionCode, callYear = 2026) {
  const rel = EVAL_FILES[actionCode];
  if (!rel) return null;
  const schema = readJson(rel);
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
