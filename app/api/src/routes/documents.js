import { Router } from 'express';
import { verifyAuth } from '../middleware/auth.js';
import { isMoonshotConfigured } from '../config/env.js';
import { completeChat } from '../config/moonshot.js';
import { supabaseAdmin } from '../config/supabase.js';
import {
  APPLICATION_DRAFT_SYSTEM_PROMPT,
  emptyApplicationMarkdown,
} from '../lib/applicationSchema.js';
import {
  createDocumentRecord,
  createDocumentSignedUrl,
  getDocumentForUser,
  listDocumentsForUser,
} from '../services/documents.js';
import { applyTokenUsage, getUserQuota, isQuotaExhausted } from '../services/quota.js';

const router = Router();
const MAX_HISTORY_MESSAGES = 40;

/**
 * POST /api/documents
 * body: { title?, contentMd, conversationId? }
 */
router.post('/', verifyAuth, async (req, res) => {
  const { title, contentMd, conversationId } = req.body ?? {};
  if (typeof contentMd !== 'string' || !contentMd.trim()) {
    return res.status(400).json({ error: 'contentMd is required' });
  }

  try {
    const doc = await createDocumentRecord({
      userId: req.user.id,
      conversationId: conversationId || null,
      title: typeof title === 'string' ? title : undefined,
      contentMd: contentMd.trim(),
    });
    return res.status(201).json({
      id: doc.id,
      title: doc.title,
      conversationId: doc.conversation_id,
      createdAt: doc.created_at,
    });
  } catch (err) {
    console.error('[documents] create failed', err);
    return res.status(500).json({ error: 'Could not create document' });
  }
});

/**
 * GET /api/documents
 */
router.get('/', verifyAuth, async (req, res) => {
  try {
    const rows = await listDocumentsForUser(req.user.id);
    return res.json({
      documents: rows.map((row) => ({
        id: row.id,
        title: row.title,
        conversationId: row.conversation_id,
        createdAt: row.created_at,
      })),
    });
  } catch (err) {
    console.error('[documents] list failed', err);
    return res.status(500).json({ error: 'Could not list documents' });
  }
});

/**
 * POST /api/documents/from-conversation
 * body: { conversationId, title? }
 */
router.post('/from-conversation', verifyAuth, async (req, res) => {
  if (!isMoonshotConfigured()) {
    return res.status(503).json({
      error: 'AI provider is not configured. Set MOONSHOT_API_KEY on the server.',
    });
  }

  const { conversationId, title } = req.body ?? {};
  if (!conversationId || typeof conversationId !== 'string') {
    return res.status(400).json({ error: 'conversationId is required' });
  }

  const profile = await getUserQuota(req.user.id);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  if (isQuotaExhausted(profile)) {
    return res.status(402).json({ error: 'Token quota exhausted. Upgrade your plan to continue.' });
  }

  const { data: conversation, error: conversationError } = await supabaseAdmin
    .from('conversations')
    .select('id, user_id, title')
    .eq('id', conversationId)
    .eq('user_id', req.user.id)
    .single();

  if (conversationError || !conversation) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  const { data: history, error: historyError } = await supabaseAdmin
    .from('messages')
    .select('role, content, agent_id')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: true })
    .limit(MAX_HISTORY_MESSAGES);

  if (historyError) {
    return res.status(500).json({ error: 'Could not load conversation history' });
  }
  if (!history?.length) {
    return res.status(400).json({ error: 'Conversation has no messages to draft from' });
  }

  const transcript = history
    .map((m) => `${m.role}${m.agent_id ? ` (${m.agent_id})` : ''}: ${m.content}`)
    .join('\n\n');

  let contentMd;
  let totalTokens = 0;
  try {
    const result = await completeChat({
      messages: [
        { role: 'system', content: APPLICATION_DRAFT_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Draft an Erasmus+ application from this conversation transcript:\n\n${transcript}`,
        },
      ],
    });
    contentMd = result.content?.trim() || emptyApplicationMarkdown(title || conversation.title || undefined);
    totalTokens = result.totalTokens;
  } catch (err) {
    console.error('[documents] from-conversation AI failed', err);
    return res.status(502).json({ error: 'AI provider request failed. Please try again.' });
  }

  try {
    const doc = await createDocumentRecord({
      userId: req.user.id,
      conversationId: conversation.id,
      title: typeof title === 'string' && title.trim() ? title.trim() : undefined,
      contentMd,
    });

    const tokensUsed = await applyTokenUsage(
      req.user.id,
      profile.tokens_used,
      profile.monthly_token_limit,
      totalTokens,
    );

    const [mdUrl, docxUrl] = await Promise.all([
      createDocumentSignedUrl(doc.md_storage_path),
      createDocumentSignedUrl(doc.docx_storage_path),
    ]);

    return res.status(201).json({
      id: doc.id,
      title: doc.title,
      conversationId: doc.conversation_id,
      createdAt: doc.created_at,
      tokensUsed,
      tokenLimit: profile.monthly_token_limit,
      downloads: {
        md: mdUrl,
        docx: docxUrl,
      },
    });
  } catch (err) {
    console.error('[documents] from-conversation persist failed', err);
    return res.status(500).json({ error: 'Could not save generated document' });
  }
});

/**
 * GET /api/documents/:id/download?format=md|docx
 */
router.get('/:id/download', verifyAuth, async (req, res) => {
  const format = (req.query.format || 'docx').toString().toLowerCase();
  if (format !== 'md' && format !== 'docx') {
    return res.status(400).json({ error: 'format must be md or docx' });
  }

  const doc = await getDocumentForUser(req.user.id, req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const path = format === 'md' ? doc.md_storage_path : doc.docx_storage_path;
  try {
    const url = await createDocumentSignedUrl(path);
    return res.json({
      id: doc.id,
      title: doc.title,
      format,
      url,
    });
  } catch (err) {
    console.error('[documents] signed url failed', err);
    return res.status(500).json({ error: 'Could not create download URL' });
  }
});

export default router;
