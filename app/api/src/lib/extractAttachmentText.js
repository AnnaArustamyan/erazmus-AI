const MAX_EXCERPT = 8000;

function clip(text) {
  const trimmed = (text || '').replace(/\0/g, '').trim();
  if (trimmed.length <= MAX_EXCERPT) return trimmed;
  return `${trimmed.slice(0, MAX_EXCERPT).trimEnd()}\n…`;
}

function unescapePdfString(raw) {
  let s = raw;
  if (s.startsWith('(') && s.endsWith(')')) s = s.slice(1, -1);
  return s
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\');
}

/**
 * Best-effort extraction of text operators from simple PDFs (no extra dependency).
 * @param {Buffer} buffer
 */
export function extractPdfText(buffer) {
  const raw = buffer.toString('latin1');
  const parts = [];
  const tjRe = /\((?:\\.|[^\\)])*\)\s*Tj/g;
  let match;
  while ((match = tjRe.exec(raw))) {
    parts.push(unescapePdfString(match[0].replace(/\s*Tj$/, '')));
  }
  if (parts.length) return parts.join(' ');

  const litRe = /\((?:\\.|[^\\)]){4,}\)/g;
  while ((match = litRe.exec(raw))) {
    const text = unescapePdfString(match[0]);
    if (/[A-Za-z]/.test(text)) parts.push(text);
  }
  return parts.join(' ');
}

/**
 * @param {Buffer | Uint8Array} buffer
 * @param {{ mimeType?: string, filename?: string }} [meta]
 * @returns {{ skipped: boolean, reason?: string, text: string }}
 */
export function extractTextFromBuffer(buffer, meta = {}) {
  const mime = (meta.mimeType || '').toLowerCase();
  const name = (meta.filename || '').toLowerCase();
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

  if (mime.startsWith('image/')) {
    return { skipped: true, reason: 'image', text: '' };
  }

  const isText =
    mime.startsWith('text/') ||
    mime === 'application/json' ||
    /\.(txt|md|markdown|csv|json)$/.test(name);
  if (isText) {
    return { skipped: false, text: clip(bytes.toString('utf8')) };
  }

  const isPdf = mime.includes('pdf') || name.endsWith('.pdf');
  if (isPdf) {
    return { skipped: false, text: clip(extractPdfText(bytes)) };
  }

  return { skipped: true, reason: 'unsupported', text: '' };
}

/**
 * @param {string} name
 * @param {string} text
 */
export function formatAttachmentExcerpt(name, text) {
  if (!text?.trim()) return '';
  return `--- Attached file: ${name || 'attachment'} ---\n${text.trim()}`;
}

/**
 * @param {{ arrayBuffer: () => Promise<ArrayBuffer> } | Buffer | Uint8Array} data
 * @param {{ mimeType?: string, filename?: string }} [meta]
 */
export async function extractTextFromStorageObject(data, meta = {}) {
  let buffer;
  if (Buffer.isBuffer(data) || data instanceof Uint8Array) {
    buffer = Buffer.from(data);
  } else if (data && typeof data.arrayBuffer === 'function') {
    buffer = Buffer.from(await data.arrayBuffer());
  } else {
    return { skipped: true, reason: 'empty', text: '' };
  }
  return extractTextFromBuffer(buffer, meta);
}

/**
 * Download an attachment and return a prompt excerpt (empty on failure / images).
 * @param {{ storage: { from: (bucket: string) => { download: Function } } }} supabase
 * @param {string} path
 * @param {{ mimeType?: string, filename?: string }} [meta]
 */
export async function loadAttachmentExcerpt(supabase, path, meta = {}) {
  try {
    const { data, error } = await supabase.storage.from('attachments').download(path);
    if (error || !data) return '';
    const extracted = await extractTextFromStorageObject(data, {
      mimeType: meta.mimeType || data.type,
      filename: meta.filename || path,
    });
    return formatAttachmentExcerpt(meta.filename || path.split('/').pop(), extracted.text);
  } catch {
    return '';
  }
}
