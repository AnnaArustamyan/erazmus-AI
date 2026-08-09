import { describe, it, expect } from 'vitest';
import {
  emptyApplicationMarkdown,
  extractTitleFromMarkdown,
  APPLICATION_SECTIONS,
} from './applicationSchema.js';
import { markdownToDocxParagraphs } from '../services/documents.js';

describe('applicationSchema', () => {
  it('exposes the four Erasmus sections', () => {
    expect(APPLICATION_SECTIONS.map((s) => s.title)).toEqual([
      'Who',
      'Where',
      'When',
      'What & How',
    ]);
  });

  it('builds an empty skeleton and extracts titles', () => {
    const md = emptyApplicationMarkdown('Demo');
    expect(md).toContain('## Who');
    expect(extractTitleFromMarkdown(md)).toBe('Demo');
  });
});

describe('markdownToDocxParagraphs', () => {
  it('maps headings and bullets', () => {
    const paragraphs = markdownToDocxParagraphs('# Title\n\n## Who\n- Applicant: X');
    expect(paragraphs.length).toBeGreaterThan(2);
  });
});
