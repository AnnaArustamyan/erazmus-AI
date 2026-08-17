import { Router } from 'express';
import { verifyAuth } from '../middleware/auth.js';
import {
  completeChatForPlan,
  isProviderConfiguredForPlan,
} from '../services/aiProvider.js';
import { supabaseAdmin } from '../config/supabase.js';
import {
  assessGeneratedDraft,
  notReadyError,
  stripMarkdownFence,
  toNotReadyPayload,
} from '../lib/draftQuality.js';
import { buildPassRateSystemPrompt } from '../lib/passRate.js';
import { getPlanConfig } from '../lib/plans.js';
import {
  createDocumentRecord,
  createDocumentSignedUrl,
  ensurePdfUploaded,
  getDocumentForUser,
  getLatestDocumentForConversation,
  listDocumentsForUser,
  toGeneratedDocumentPayload,
} from '../services/documents.js';
import {
  applyTokenUsage,
  countDocumentsThisMonth,
  documentCapError,
  getUserQuota,
  isQuotaExhausted,
} from '../services/quota.js';

const router = Router();

async function assertCanGenerate(profile, userId) {
  if (isQuotaExhausted(profile)) {
    return { status: 402, error: 'Token quota exhausted. Upgrade your plan to continue.' };
  }
  const documentsThisMonth = await countDocumentsThisMonth(userId);
  const capError = documentCapError(profile, documentsThisMonth);
  if (capError) {
    return { status: 403, error: capError };
  }
  return null;
}

function providerNotConfiguredError(plan) {
  const needed = getPlanConfig(plan).provider === 'openai' ? 'OPENAI_API_KEY' : 'MOONSHOT_API_KEY';
  return `AI provider is not configured for your plan. Set ${needed} on the server.`;
}

/**
 * POST /api/documents
 * body: { title?, contentMd, conversationId? }
 * Available on all plans; gated by token quota + monthly document cap.
 */
router.post('/', verifyAuth, async (req, res) => {
  const profile = await getUserQuota(req.user.id);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });

  const blocked = await assertCanGenerate(profile, req.user.id);
  if (blocked) return res.status(blocked.status).json({ error: blocked.error });

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
 * ?conversationId= — latest draft for that conversation (canvas restore)
 */
router.get('/', verifyAuth, async (req, res) => {
  const conversationId =
    typeof req.query.conversationId === 'string' ? req.query.conversationId : '';

  try {
    if (conversationId) {
      const row = await getLatestDocumentForConversation(req.user.id, conversationId);
      if (!row) return res.json({ document: null });
      const document = await toGeneratedDocumentPayload(row);
      return res.json({ document });
    }

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
 * All plans; Free → Luna, paid → Moonshot. Same pass-rate constraints.
 */
router.post('/from-conversation', verifyAuth, async (req, res) => {
  const { conversationId, title } = req.body ?? {};
  if (!conversationId || typeof conversationId !== 'string') {
    return res.status(400).json({ error: 'conversationId is required' });
  }

  const profile = await getUserQuota(req.user.id);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });

  const blocked = await assertCanGenerate(profile, req.user.id);
  if (blocked) return res.status(blocked.status).json({ error: blocked.error });

  const planConfig = getPlanConfig(profile.plan);
  if (!isProviderConfiguredForPlan(profile.plan)) {
    return res.status(503).json({ error: providerNotConfiguredError(profile.plan) });
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
    .limit(planConfig.maxHistoryMessages);

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
    const result = await completeChatForPlan({
      plan: profile.plan,
      messages: [
        {
          role: 'system',
          content: buildPassRateSystemPrompt({
            queryText: transcript,
            mode: 'document',
            skillName: 'application-draft',
          }),
        },
        {
          role: 'user',
          content: `Draft an Erasmus+ application from this conversation transcript. Match the action type discussed (KA1 or KA2). Use only facts in the transcript. If it is not ready, output the short Not ready to draft note — never a document of blank "—" fields.\n\n${transcript}`,
        },
      ],
    });
    contentMd = stripMarkdownFence(result.content || '');
    totalTokens = result.totalTokens;
  } catch (err) {
    console.error('[documents] from-conversation AI failed', err);
    return res.status(502).json({ error: 'AI provider request failed. Please try again.' });
  }

  const quality = assessGeneratedDraft(contentMd, { sourceText: transcript, kind: 'application' });
  const tokensUsed = await applyTokenUsage(
    req.user.id,
    profile.tokens_used,
    profile.monthly_token_limit,
    totalTokens,
  );
  if (!quality.ready) {
    return res.status(422).json({
      ...toNotReadyPayload(quality, 'application'),
      error: notReadyError(quality, 'application'),
      tokensUsed,
      tokenLimit: profile.monthly_token_limit,
    });
  }

  try {
    const doc = await createDocumentRecord({
      userId: req.user.id,
      conversationId: conversation.id,
      title: typeof title === 'string' && title.trim() ? title.trim() : undefined,
      contentMd,
    });

    const payload = await toGeneratedDocumentPayload(doc);

    return res.status(201).json({
      ...payload,
      tokensUsed,
      tokenLimit: profile.monthly_token_limit,
    });
  } catch (err) {
    console.error('[documents] from-conversation persist failed', err);
    return res.status(500).json({ error: 'Could not save generated document' });
  }
});

/**
 * POST /api/documents/from-interview
 * body: { actionCode, title, contentMd }
 * Turns questionnaire answers into a pass-rate application PDF.
 */
router.post('/from-interview', verifyAuth, async (req, res) => {
  const { actionCode, title, contentMd: interviewMd } = req.body ?? {};
  if (typeof interviewMd !== 'string' || !interviewMd.trim()) {
    return res.status(400).json({ error: 'contentMd is required' });
  }
  if (typeof actionCode !== 'string' || !actionCode.trim()) {
    return res.status(400).json({ error: 'actionCode is required' });
  }

  const profile = await getUserQuota(req.user.id);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });

  const blocked = await assertCanGenerate(profile, req.user.id);
  if (blocked) return res.status(blocked.status).json({ error: blocked.error });

  if (!isProviderConfiguredForPlan(profile.plan)) {
    return res.status(503).json({ error: providerNotConfiguredError(profile.plan) });
  }

  const resolvedTitle =
    typeof title === 'string' && title.trim() ? title.trim() : `${actionCode} application`;
  let contentMd = interviewMd.trim();
  let totalTokens = 0;

  try {
    const result = await completeChatForPlan({
      plan: profile.plan,
      messages: [
        {
          role: 'system',
          content: buildPassRateSystemPrompt({
            queryText: interviewMd,
            mode: 'document',
            skillName: 'application-draft',
          }),
        },
        {
          role: 'user',
          content:
            `Draft an Erasmus+ ${actionCode} application from this structured interview. ` +
            `Use only these answers. If it is not ready, output the short Not ready to draft note — never blank "—" fields. Do not invent partners, dates, or needs evidence.\n\n${interviewMd}`,
        },
      ],
    });
    contentMd = stripMarkdownFence(result.content || '') || interviewMd.trim();
    totalTokens = result.totalTokens;
  } catch (err) {
    console.error('[documents] from-interview AI failed', err);
    return res.status(502).json({ error: 'AI provider request failed. Please try again.' });
  }

  const quality = assessGeneratedDraft(contentMd, { sourceText: interviewMd, kind: 'application' });
  const tokensUsed = await applyTokenUsage(
    req.user.id,
    profile.tokens_used,
    profile.monthly_token_limit,
    totalTokens,
  );
  if (!quality.ready) {
    return res.status(422).json({
      ...toNotReadyPayload(quality, 'application'),
      error: notReadyError(quality, 'application'),
      tokensUsed,
      tokenLimit: profile.monthly_token_limit,
    });
  }

  try {
    const doc = await createDocumentRecord({
      userId: req.user.id,
      title: resolvedTitle,
      contentMd,
    });
    const payload = await toGeneratedDocumentPayload(doc);
    return res.status(201).json({
      ...payload,
      tokensUsed,
      tokenLimit: profile.monthly_token_limit,
    });
  } catch (err) {
    console.error('[documents] from-interview persist failed', err);
    return res.status(500).json({ error: 'Could not save generated document' });
  }
});

/**
 * GET /api/documents/:id/download?format=pdf|docx|md
 */
router.get('/:id/download', verifyAuth, async (req, res) => {
  const format = (req.query.format || 'pdf').toString().toLowerCase();
  if (format !== 'pdf' && format !== 'md' && format !== 'docx') {
    return res.status(400).json({ error: 'format must be pdf, docx, or md' });
  }

  const doc = await getDocumentForUser(req.user.id, req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  try {
    let path;
    if (format === 'md') path = doc.md_storage_path;
    else if (format === 'docx') path = doc.docx_storage_path;
    else path = await ensurePdfUploaded(doc);

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
