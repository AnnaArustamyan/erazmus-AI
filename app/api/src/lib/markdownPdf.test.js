import { describe, it, expect } from 'vitest';
import { emptyApplicationMarkdown } from './applicationSchema.js';
import { buildPdfBuffer } from './markdownPdf.js';

describe('buildPdfBuffer', () => {
  it('renders an application draft as a PDF', async () => {
    const pdf = await buildPdfBuffer(emptyApplicationMarkdown('Youth workers TC'));
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(800);
  });
});
