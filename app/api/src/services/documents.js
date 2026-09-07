import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { supabaseAdmin } from '../config/supabase.js';
import { extractTitleFromMarkdown } from '../lib/applicationSchema.js';
import { buildPdfBuffer } from '../lib/markdownPdf.js';
import { getPlanConfig } from '../lib/plans.js';

const DOCUMENTS_BUCKET = 'documents';
const DOCX_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const DOCUMENT_COLUMNS_CORE =
  'id, user_id, conversation_id, title, content_md, md_storage_path, docx_storage_path, created_at';
const DOCUMENT_COLUMNS = `${DOCUMENT_COLUMNS_CORE}, pdf_storage_path, expires_at`;

/**
 * @param {string | null | undefined} plan
 * @returns {string | null} ISO timestamp, or null for unlimited retention
 */
export function expiryForPlan(plan) {
  const days = getPlanConfig(plan).documentRetentionDays;
  if (!days) return null;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function isMissingPdfColumn(error) {
  return /pdf_storage_path/i.test(error?.message ?? '');
}

/**
 * Older Supabase projects that ran 006 before PDF existed still work:
 * the file lives next to application.md even if the column is missing.
 * @param {object | null} row
 */
function withPdfPath(row) {
  if (!row) return row;
  return { ...row, pdf_storage_path: row.pdf_storage_path || resolvePdfStoragePath(row) };
}

/**
 * Convert simple markdown (headings + paragraphs + list lines) into docx paragraphs.
 * @param {string} markdown
 * @returns {Paragraph[]}
 */
export function markdownToDocxParagraphs(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  /** @type {Paragraph[]} */
  const paragraphs = [];

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      paragraphs.push(new Paragraph({ text: '' }));
      continue;
    }
    if (line.startsWith('### ')) {
      paragraphs.push(
        new Paragraph({
          text: line.slice(4),
          heading: HeadingLevel.HEADING_3,
        }),
      );
      continue;
    }
    if (line.startsWith('## ')) {
      paragraphs.push(
        new Paragraph({
          text: line.slice(3),
          heading: HeadingLevel.HEADING_2,
        }),
      );
      continue;
    }
    if (line.startsWith('# ')) {
      paragraphs.push(
        new Paragraph({
          text: line.slice(2),
          heading: HeadingLevel.HEADING_1,
        }),
      );
      continue;
    }
    if (line.startsWith('- ')) {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun(line.slice(2))],
          bullet: { level: 0 },
        }),
      );
      continue;
    }
    paragraphs.push(
      new Paragraph({
        children: [new TextRun(line)],
      }),
    );
  }

  return paragraphs;
}

/**
 * @param {string} markdown
 * @returns {Promise<Buffer>}
 */
export async function buildDocxBuffer(markdown) {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: markdownToDocxParagraphs(markdown),
      },
    ],
  });
  return Packer.toBuffer(doc);
}

/**
 * @param {{
 *   md_storage_path?: string,
 *   pdf_storage_path?: string | null,
 *   user_id?: string,
 *   id?: string,
 * }} doc
 */
export function resolvePdfStoragePath(doc) {
  if (doc.pdf_storage_path) return doc.pdf_storage_path;
  if (typeof doc.md_storage_path === 'string' && doc.md_storage_path.endsWith('.md')) {
    return doc.md_storage_path.replace(/\.md$/, '.pdf');
  }
  return `${doc.user_id}/${doc.id}/application.pdf`;
}

/**
 * @param {string} storagePath
 * @param {Buffer} bytes
 * @param {string} contentType
 */
async function uploadBytes(storagePath, bytes, contentType) {
  const result = await supabaseAdmin.storage.from(DOCUMENTS_BUCKET).upload(storagePath, bytes, {
    contentType,
    upsert: true,
  });
  if (result.error) {
    throw new Error(`Failed to upload ${storagePath}: ${result.error.message}`);
  }
}

/**
 * @param {{ mdPath: string, docxPath: string, pdfPath: string, contentMd: string }} input
 */
async function uploadDocumentExports({ mdPath, docxPath, pdfPath, contentMd }) {
  const mdBytes = Buffer.from(contentMd, 'utf8');
  const [docxBytes, pdfBytes] = await Promise.all([
    buildDocxBuffer(contentMd),
    buildPdfBuffer(contentMd),
  ]);
  await Promise.all([
    uploadBytes(mdPath, mdBytes, 'text/markdown; charset=utf-8'),
    uploadBytes(docxPath, docxBytes, DOCX_TYPE),
    uploadBytes(pdfPath, pdfBytes, 'application/pdf'),
  ]);
}

/**
 * @param {(columns: string) => import('@supabase/supabase-js').PostgrestFilterBuilder} build
 */
async function queryDocuments(build) {
  const withPdf = await build(DOCUMENT_COLUMNS);
  if (!withPdf.error) {
    return {
      ...withPdf,
      data: Array.isArray(withPdf.data) ? withPdf.data.map(withPdfPath) : withPdfPath(withPdf.data),
    };
  }
  if (!isMissingPdfColumn(withPdf.error)) return withPdf;
  const legacy = await build(DOCUMENT_COLUMNS_CORE);
  return {
    ...legacy,
    data: Array.isArray(legacy.data) ? legacy.data.map(withPdfPath) : withPdfPath(legacy.data),
  };
}

/**
 * @param {Record<string, unknown>} row
 */
async function insertDocumentRow(row) {
  const first = await supabaseAdmin.from('documents').insert(row).select(DOCUMENT_COLUMNS).single();
  if (!first.error) return { ...first, data: withPdfPath(first.data) };
  if (!isMissingPdfColumn(first.error)) return first;

  const { pdf_storage_path: pdfPath, ...legacy } = row;
  const retry = await supabaseAdmin
    .from('documents')
    .insert(legacy)
    .select(DOCUMENT_COLUMNS_CORE)
    .single();
  return {
    ...retry,
    data: retry.data ? { ...retry.data, pdf_storage_path: pdfPath } : retry.data,
  };
}

/**
 * Persist markdown + PDF (primary) + docx to storage and insert a documents row.
 * @param {{
 *   userId: string,
 *   conversationId?: string | null,
 *   title?: string,
 *   contentMd: string,
 *   plan?: string | null,
 * }} input
 */
export async function createDocumentRecord({
  userId,
  conversationId = null,
  title,
  contentMd,
  plan = null,
}) {
  const resolvedTitle = title || extractTitleFromMarkdown(contentMd);
  const docId = crypto.randomUUID();
  const basePath = `${userId}/${docId}`;
  const mdPath = `${basePath}/application.md`;
  const docxPath = `${basePath}/application.docx`;
  const pdfPath = `${basePath}/application.pdf`;

  await uploadDocumentExports({ mdPath, docxPath, pdfPath, contentMd });

  const { data, error } = await insertDocumentRow({
    id: docId,
    user_id: userId,
    conversation_id: conversationId,
    title: resolvedTitle,
    content_md: contentMd,
    md_storage_path: mdPath,
    docx_storage_path: docxPath,
    pdf_storage_path: pdfPath,
    expires_at: expiryForPlan(plan),
  });

  if (error || !data) {
    throw new Error(error?.message || 'Failed to save document metadata');
  }

  return data;
}

/**
 * Overwrite markdown + PDF + docx for an existing document (does not count against the monthly cap).
 * @param {{
 *   existing: {
 *     id: string,
 *     user_id: string,
 *     md_storage_path: string,
 *     docx_storage_path: string,
 *     pdf_storage_path?: string | null,
 *   },
 *   contentMd: string,
 *   title?: string,
 * }} input
 */
export async function updateDocumentRecord({ existing, contentMd, title }) {
  const resolvedTitle = title || extractTitleFromMarkdown(contentMd);
  const pdfPath = resolvePdfStoragePath(existing);

  await uploadDocumentExports({
    mdPath: existing.md_storage_path,
    docxPath: existing.docx_storage_path,
    pdfPath,
    contentMd,
  });

  const patch = {
    title: resolvedTitle,
    content_md: contentMd,
    pdf_storage_path: pdfPath,
  };
  let { data, error } = await supabaseAdmin
    .from('documents')
    .update(patch)
    .eq('id', existing.id)
    .eq('user_id', existing.user_id)
    .select(DOCUMENT_COLUMNS)
    .single();

  if (error && isMissingPdfColumn(error)) {
    const { pdf_storage_path: _pdf, ...legacyPatch } = patch;
    const retry = await supabaseAdmin
      .from('documents')
      .update(legacyPatch)
      .eq('id', existing.id)
      .eq('user_id', existing.user_id)
      .select(DOCUMENT_COLUMNS_CORE)
      .single();
    data = retry.data ? { ...retry.data, pdf_storage_path: pdfPath } : retry.data;
    error = retry.error;
  }

  if (error || !data) {
    throw new Error(error?.message || 'Failed to update document');
  }

  return data;
}

/**
 * @param {string} userId
 * @param {string} conversationId
 */
export async function getLatestDocumentForConversation(userId, conversationId) {
  const { data, error } = await queryDocuments((columns) =>
    supabaseAdmin
      .from('documents')
      .select(columns)
      .eq('user_id', userId)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  );

  if (error) throw new Error(error.message);
  return data ?? null;
}

/**
 * @param {{
 *   id: string,
 *   title: string,
 *   conversation_id: string | null,
 *   content_md: string,
 *   md_storage_path: string,
 *   docx_storage_path: string,
 *   pdf_storage_path?: string | null,
 *   created_at: string,
 * }} doc
 */
export async function toGeneratedDocumentPayload(doc) {
  const pdfPath = await ensurePdfUploaded(doc);
  const [pdf, md, docx] = await Promise.all([
    createDocumentSignedUrl(pdfPath),
    createDocumentSignedUrl(doc.md_storage_path),
    createDocumentSignedUrl(doc.docx_storage_path),
  ]);
  return {
    id: doc.id,
    title: doc.title,
    conversationId: doc.conversation_id,
    contentMd: doc.content_md,
    createdAt: doc.created_at,
    downloads: { pdf, md, docx },
  };
}

/**
 * Generate and store a PDF for older rows that predate pdf_storage_path.
 * @param {{
 *   content_md: string,
 *   md_storage_path: string,
 *   pdf_storage_path?: string | null,
 *   user_id?: string,
 *   id?: string,
 * }} doc
 */
export async function ensurePdfUploaded(doc) {
  const pdfPath = resolvePdfStoragePath(doc);
  if (!doc.pdf_storage_path) {
    await uploadBytes(pdfPath, await buildPdfBuffer(doc.content_md), 'application/pdf');
  }
  return pdfPath;
}

/**
 * @param {string} userId
 */
export async function listDocumentsForUser(userId) {
  const { data, error } = await supabaseAdmin
    .from('documents')
    .select('id, title, conversation_id, created_at, expires_at')
    .eq('user_id', userId)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * @param {string} userId
 * @param {string} documentId
 */
export async function getDocumentForUser(userId, documentId) {
  const { data, error } = await queryDocuments((columns) =>
    supabaseAdmin
      .from('documents')
      .select(columns)
      .eq('id', documentId)
      .eq('user_id', userId)
      .single(),
  );

  if (error || !data) return null;
  if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) return null;
  return data;
}

/**
 * @param {string} storagePath
 * @param {number} [expiresIn]
 */
export async function createDocumentSignedUrl(storagePath, expiresIn = 3600) {
  const { data, error } = await supabaseAdmin.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, expiresIn);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message || 'Could not create download URL');
  }
  return data.signedUrl;
}
