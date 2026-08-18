import { describe, it, expect } from 'vitest';
import {
  emptyApplicationMarkdown,
  extractTitleFromMarkdown,
  APPLICATION_SECTIONS,
  schemaFor,
  schemaInstruction,
  familyForAction,
  inferActionCode,
} from './applicationSchema.js';
import { markdownToDocxParagraphs } from '../services/documents.js';

describe('applicationSchema', () => {
  it('exposes KA1 youth award-criteria sections', () => {
    expect(APPLICATION_SECTIONS.map((s) => s.title)).toEqual([
      'Relevance',
      'Quality of project design',
      'Quality of project management',
      'Annexes',
    ]);
  });

  it('maps each action family to the matching headings', () => {
    expect(familyForAction('KA122')?.id).toBe('ka1_education');
    expect(schemaFor('KA220')?.map((s) => s.title)).toEqual([
      'Relevance',
      'Quality of partnership',
      'Design and work packages',
      'Impact',
      'Management',
    ]);
    expect(schemaInstruction('KA153')).toContain('## Relevance');
    expect(schemaInstruction('KA122')).not.toContain('## Who');
    expect(schemaInstruction('KA210')).toContain('work packages');
  });

  it('infers action codes from free text', () => {
    expect(inferActionCode('Draft a KA220 cooperation partnership')).toBe('KA220');
    expect(inferActionCode('youth workers training course')).toBe('KA153');
    expect(inferActionCode('I want a youth project about the environment')).toBeNull();
  });

  it('builds an empty skeleton and extracts titles', () => {
    const md = emptyApplicationMarkdown('Demo', 'KA153');
    expect(md).toContain('## Relevance');
    expect(md).not.toContain('—');
    expect(extractTitleFromMarkdown(md)).toBe('Demo');
  });
});

describe('markdownToDocxParagraphs', () => {
  it('maps headings and bullets', () => {
    const paragraphs = markdownToDocxParagraphs('# Title\n\n## Relevance\n- Applicant: X');
    expect(paragraphs.length).toBeGreaterThan(2);
  });
});
