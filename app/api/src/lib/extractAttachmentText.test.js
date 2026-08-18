import { describe, it, expect } from 'vitest';
import {
  extractPdfText,
  extractTextFromBuffer,
  formatAttachmentExcerpt,
} from './extractAttachmentText.js';

function minimalPdf(text) {
  return Buffer.from(
    `%PDF-1.1
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length 80 >> stream
BT /F1 12 Tf 10 100 Td (${text}) Tj ET
endstream
endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
trailer << /Root 1 0 R >>
%%EOF
`,
    'latin1',
  );
}

describe('extractAttachmentText', () => {
  it('reads UTF-8 text and markdown', () => {
    const md = extractTextFromBuffer(Buffer.from('# Needs\nSurvey of 18 tutors.'), {
      mimeType: 'text/markdown',
      filename: 'notes.md',
    });
    expect(md.skipped).toBe(false);
    expect(md.text).toContain('Survey of 18 tutors');
  });

  it('skips images', () => {
    const img = extractTextFromBuffer(Buffer.from([0x89, 0x50, 0x4e, 0x47]), {
      mimeType: 'image/png',
      filename: 'scan.png',
    });
    expect(img.skipped).toBe(true);
    expect(img.text).toBe('');
  });

  it('extracts Tj strings from a simple PDF', () => {
    const buffer = minimalPdf('Youth workers needs analysis');
    expect(extractPdfText(buffer)).toContain('Youth workers needs analysis');
    const extracted = extractTextFromBuffer(buffer, {
      mimeType: 'application/pdf',
      filename: 'brief.pdf',
    });
    expect(extracted.text).toContain('Youth workers needs analysis');
    expect(formatAttachmentExcerpt('brief.pdf', extracted.text)).toContain('Attached file: brief.pdf');
  });
});
