import { createRequire } from 'node:module';
import PDFDocument from 'pdfkit';

const require = createRequire(import.meta.url);
const FONT_REGULAR = require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans.ttf');
const FONT_BOLD = require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf');

const PAGE = {
  size: 'A4',
  margins: { top: 56, bottom: 56, left: 56, right: 56 },
};

/**
 * Convert simple markdown (headings, paragraphs, bullets, **bold**) into a PDF.
 * @param {string} markdown
 * @returns {Promise<Buffer>}
 */
export function buildPdfBuffer(markdown) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: PAGE.size,
      margins: PAGE.margins,
      bufferPages: true,
      info: {
        Title: extractTitle(markdown),
        Author: 'Erasmus AI',
      },
    });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.registerFont('Body', FONT_REGULAR);
    doc.registerFont('Body-Bold', FONT_BOLD);

    const contentWidth =
      doc.page.width - PAGE.margins.left - PAGE.margins.right;
    const lines = (markdown || '').replace(/\r\n/g, '\n').split('\n');

    for (const raw of lines) {
      const line = raw.trimEnd();
      if (!line.trim()) {
        doc.moveDown(0.35);
        continue;
      }
      if (line.startsWith('# ')) {
        writeHeading(doc, line.slice(2), 18, contentWidth);
        continue;
      }
      if (line.startsWith('## ')) {
        doc.moveDown(0.45);
        writeHeading(doc, line.slice(3), 13.5, contentWidth);
        continue;
      }
      if (line.startsWith('### ')) {
        doc.moveDown(0.2);
        writeHeading(doc, line.slice(4), 11.5, contentWidth);
        continue;
      }
      if (line.startsWith('- ')) {
        writeBullet(doc, line.slice(2), contentWidth);
        continue;
      }
      writeParagraph(doc, line, contentWidth);
    }

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i += 1) {
      doc.switchToPage(range.start + i);
      doc.font('Body').fontSize(8).fillColor('#6b7280');
      doc.text(
        `Erasmus+ application draft  ·  ${i + 1} / ${range.count}`,
        PAGE.margins.left,
        doc.page.height - PAGE.margins.bottom + 18,
        { width: contentWidth, align: 'left', lineBreak: false },
      );
    }

    doc.end();
  });
}

function extractTitle(markdown) {
  const match = (markdown || '').match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() || 'Erasmus+ Application';
}

function writeHeading(doc, text, size, width) {
  doc.fillColor('#111827').font('Body-Bold').fontSize(size);
  doc.text(text, PAGE.margins.left, doc.y, { width, lineGap: 2 });
}

function writeBullet(doc, text, width) {
  const indent = 14;
  doc.fillColor('#111827').fontSize(10.5);
  writeRichText(doc, `•  ${text}`, PAGE.margins.left + indent, doc.y, width - indent);
}

function writeParagraph(doc, text, width) {
  doc.fillColor('#111827').fontSize(10.5);
  writeRichText(doc, text, PAGE.margins.left, doc.y, width);
}

/**
 * @param {PDFKit.PDFDocument} doc
 * @param {string} text
 * @param {number} x
 * @param {number} y
 * @param {number} width
 */
function writeRichText(doc, text, x, y, width) {
  const segments = splitInline(text);
  if (segments.length === 0) {
    doc.moveDown(0.3);
    return;
  }
  segments.forEach((segment, index) => {
    doc.font(segment.bold ? 'Body-Bold' : 'Body');
    const continued = index < segments.length - 1;
    if (index === 0) {
      doc.text(segment.text, x, y, { width, continued, lineGap: 2.5 });
    } else {
      doc.text(segment.text, { width, continued, lineGap: 2.5 });
    }
  });
}

function splitInline(text) {
  /** @type {{ text: string, bold: boolean }[]} */
  const segments = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let match = re.exec(text);
  while (match) {
    if (match.index > last) {
      segments.push({ text: text.slice(last, match.index), bold: false });
    }
    segments.push({ text: match[1], bold: true });
    last = match.index + match[0].length;
    match = re.exec(text);
  }
  if (last < text.length) {
    segments.push({ text: text.slice(last), bold: false });
  }
  return segments.filter((segment) => segment.text.length > 0);
}
