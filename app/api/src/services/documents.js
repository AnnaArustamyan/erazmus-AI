import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { supabaseAdmin } from '../config/supabase.js';
import { extractTitleFromMarkdown } from '../lib/applicationSchema.js';

const DOCUMENTS_BUCKET = 'documents';

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
 * Persist markdown + docx to storage and insert a documents row.
 * @param {{
 *   userId: string,
 *   conversationId?: string | null,
 *   title?: string,
 *   contentMd: string,
 * }} input
 */
export async function createDocumentRecord({
  userId,
  conversationId = null,
  title,
  contentMd,
}) {
  const resolvedTitle = title || extractTitleFromMarkdown(contentMd);
  const docId = crypto.randomUUID();
  const basePath = `${userId}/${docId}`;
  const mdPath = `${basePath}/application.md`;
  const docxPath = `${basePath}/application.docx`;

  const mdBytes = Buffer.from(contentMd, 'utf8');
  const docxBytes = await buildDocxBuffer(contentMd);

  const mdUpload = await supabaseAdmin.storage
    .from(DOCUMENTS_BUCKET)
    .upload(mdPath, mdBytes, { contentType: 'text/markdown; charset=utf-8', upsert: true });
  if (mdUpload.error) {
    throw new Error(`Failed to upload markdown: ${mdUpload.error.message}`);
  }

  const docxUpload = await supabaseAdmin.storage
    .from(DOCUMENTS_BUCKET)
    .upload(docxPath, docxBytes, {
      contentType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      upsert: true,
    });
  if (docxUpload.error) {
    throw new Error(`Failed to upload docx: ${docxUpload.error.message}`);
  }

  const { data, error } = await supabaseAdmin
    .from('documents')
    .insert({
      id: docId,
      user_id: userId,
      conversation_id: conversationId,
      title: resolvedTitle,
      content_md: contentMd,
      md_storage_path: mdPath,
      docx_storage_path: docxPath,
    })
    .select(
      'id, user_id, conversation_id, title, content_md, md_storage_path, docx_storage_path, created_at',
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to save document metadata');
  }

  return data;
}

/**
 * @param {string} userId
 */
export async function listDocumentsForUser(userId) {
  const { data, error } = await supabaseAdmin
    .from('documents')
    .select('id, title, conversation_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * @param {string} userId
 * @param {string} documentId
 */
export async function getDocumentForUser(userId, documentId) {
  const { data, error } = await supabaseAdmin
    .from('documents')
    .select(
      'id, user_id, conversation_id, title, content_md, md_storage_path, docx_storage_path, created_at',
    )
    .eq('id', documentId)
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;
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
