import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cache = new Map();

function resolveSkillsDir() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const fromEnv = process.env.SKILLS_DIR;
  const derived = process.env.KNOWLEDGE_PACK_DIR;
  const candidates = [
    fromEnv,
    derived ? path.resolve(derived, '../skills') : null,
    path.resolve(here, '../../../resources/skills'),
    path.resolve(here, '../../resources/skills'),
  ].filter(Boolean);

  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'chat-coach', 'SKILL.md'))) return dir;
  }
  throw new Error('Product skills not found (skills/chat-coach/SKILL.md)');
}

/**
 * @param {string} raw
 * @returns {{ name: string, description: string, body: string }}
 */
export function parseSkillMarkdown(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { name: '', description: '', body: raw.trim() };
  }
  const fields = {};
  let currentKey = null;
  let folded = false;
  for (const line of match[1].split(/\r?\n/)) {
    const keyMatch = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (keyMatch && !line.startsWith(' ')) {
      currentKey = keyMatch[1];
      const rest = keyMatch[2];
      folded = rest === '>' || rest === '|';
      fields[currentKey] = folded ? '' : rest;
      continue;
    }
    if (currentKey && (folded || /^\s/.test(line))) {
      fields[currentKey] = `${fields[currentKey] || ''} ${line.trim()}`.trim();
    }
  }
  return {
    name: (fields.name || '').trim(),
    description: (fields.description || '').trim(),
    body: match[2].trim(),
  };
}

/**
 * @param {string} skillName
 */
export function loadSkill(skillName) {
  if (cache.has(skillName)) return cache.get(skillName);
  const filePath = path.join(resolveSkillsDir(), skillName, 'SKILL.md');
  if (!fs.existsSync(filePath)) {
    throw new Error(`Unknown skill: ${skillName}`);
  }
  const parsed = parseSkillMarkdown(fs.readFileSync(filePath, 'utf8'));
  cache.set(skillName, parsed);
  return parsed;
}

/**
 * @param {string} skillName
 * @returns {string}
 */
export function loadSkillBody(skillName) {
  return loadSkill(skillName).body;
}
