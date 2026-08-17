import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { verifyAuth } from '../middleware/auth.js';
import { AGENTS, DEFAULT_AGENT_ID, isValidAgentId, persistAgentId } from '../lib/agents.js';
import { detectDocumentAction, documentChatNotice } from '../lib/documentIntent.js';
import {
  assessGeneratedDraft,
  notReadyChatNotice,
  stripMarkdownFence,
} from '../lib/draftQuality.js';
import { buildPassRateSystemPrompt } from '../lib/passRate.js';
import { getPlanConfig } from '../lib/plans.js';
import { estimateTokensFromText, readUsageTotalTokens } from '../lib/tokenUsage.js';
import {
  isProviderConfiguredForPlan,
  streamChatForPlan,
} from '../services/aiProvider.js';
import {
  createDocumentRecord,
  getDocumentForUser,
  toGeneratedDocumentPayload,
  updateDocumentRecord,
} from '../services/documents.js';
import {
  applyTokenUsage,
  countDocumentsThisMonth,
  documentCapError,
  getUserQuota,
  isQuotaExhausted,
} from '../services/quota.js';

const router = Router();

function writeEvent(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function isAbortError(err) {
  return err?.name === 'AbortError' || err?.code === 'ABORT_ERR';
}

/**
 * POST /api/chat
 * body: {
 *   agentId, message, conversationId?,
 *   attachmentPath?, attachmentName?,
 *   regenerate?, editMessageId?
 * }
 * Streams the agent's reply as SSE.
 * Free plan → OpenAI (standard). Paid plans → Moonshot (advanced).
 */
router.post('/', verifyAuth, async (req, res) => {
  const {
    agentId: rawAgentId,
    message,
    conversationId,
    attachmentPath,
    attachmentName,
    regenerate,
    editMessageId,
    documentId,
  } = req.body ?? {};

  const agentId = rawAgentId ? rawAgentId : DEFAULT_AGENT_ID;
  if (!isValidAgentId(agentId)) {
    return res.status(400).json({ error: 'agentId must be a known agent' });
  }
  const storedAgentId = persistAgentId(agentId);
  if (typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required' });
  }
  if (!message.trim() && !attachmentPath && !regenerate) {
    return res.status(400).json({ error: 'message or an attachment is required' });
  }
  if (attachmentPath && !attachmentPath.startsWith(`${req.user.id}/`)) {
    return res.status(403).json({ error: 'Invalid attachment reference' });
  }
  if ((regenerate || editMessageId) && !conversationId) {
    return res.status(400).json({ error: 'conversationId is required to edit or regenerate' });
  }

  const profile = await getUserQuota(req.user.id);
  if (!profile) {
    return res.status(404).json({ error: 'Profile not found' });
  }
  if (isQuotaExhausted(profile)) {
    console.warn('[chat] quota exceeded', { userId: req.user.id, agentId, plan: profile.plan });
    return res.status(402).json({ error: 'Token quota exhausted. Upgrade your plan to continue.' });
  }

  const planConfig = getPlanConfig(profile.plan);
  if (!isProviderConfiguredForPlan(profile.plan)) {
    const needed =
      planConfig.provider === 'openai' ? 'OPENAI_API_KEY' : 'MOONSHOT_API_KEY';
    return res.status(503).json({
      error: `AI provider is not configured for your plan. Set ${needed} on the server.`,
    });
  }

  let conversation;
  if (conversationId) {
    const { data, error } = await supabaseAdmin
      .from('conversations')
      .select('id, agent_id, user_id')
      .eq('id', conversationId)
      .eq('user_id', req.user.id)
      .single();
    if (error || !data) return res.status(404).json({ error: 'Conversation not found' });
    conversation = data;
  } else {
    const { data, error } = await supabaseAdmin
      .from('conversations')
      .insert({ user_id: req.user.id, agent_id: storedAgentId, title: message.slice(0, 60) })
      .select('id, agent_id, user_id')
      .single();
    if (error) return res.status(500).json({ error: 'Could not create conversation' });
    conversation = data;
  }

  let existingDoc = null;
  if (typeof documentId === 'string' && documentId) {
    existingDoc = await getDocumentForUser(req.user.id, documentId);
    if (
      existingDoc?.conversation_id &&
      existingDoc.conversation_id !== conversation.id
    ) {
      existingDoc = null;
    }
  }

  const documentAction = detectDocumentAction(message, {
    hasDocument: Boolean(existingDoc),
  });

  if (documentAction === 'create') {
    const documentsThisMonth = await countDocumentsThisMonth(req.user.id);
    const capError = documentCapError(profile, documentsThisMonth);
    if (capError) {
      return res.status(403).json({ error: capError });
    }
  }

  if (editMessageId) {
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('messages')
      .select('id, role, created_at, conversation_id')
      .eq('id', editMessageId)
      .eq('conversation_id', conversation.id)
      .single();

    if (existingError || !existing || existing.role !== 'user') {
      return res.status(404).json({ error: 'Message not found' });
    }

    const { data: trailing } = await supabaseAdmin
      .from('messages')
      .select('id')
      .eq('conversation_id', conversation.id)
      .gt('created_at', existing.created_at);

    const trailingIds = (trailing ?? []).map((row) => row.id);
    if (trailingIds.length) {
      await supabaseAdmin.from('messages').delete().in('id', trailingIds);
    }

    const content =
      message.trim() ||
      `(no message — see attached file: ${attachmentName || 'attachment'})`;
    await supabaseAdmin
      .from('messages')
      .update({
        content,
        agent_id: storedAgentId,
        attachment_path: attachmentPath || null,
        attachment_name: attachmentName || null,
      })
      .eq('id', editMessageId);
  } else if (regenerate) {
    const { data: historyForRegen } = await supabaseAdmin
      .from('messages')
      .select('id, role')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true });

    const last = historyForRegen?.[historyForRegen.length - 1];
    if (last?.role === 'assistant') {
      await supabaseAdmin.from('messages').delete().eq('id', last.id);
    }
  } else {
    const content =
      message.trim() ||
      `(no message — see attached file: ${attachmentName || 'attachment'})`;
    await supabaseAdmin.from('messages').insert({
      conversation_id: conversation.id,
      role: 'user',
      content,
      agent_id: storedAgentId,
      attachment_path: attachmentPath || null,
      attachment_name: attachmentName || null,
    });
  }

  const { data: history, error: historyError } = await supabaseAdmin
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: true })
    .limit(planConfig.maxHistoryMessages);

  if (historyError) return res.status(500).json({ error: 'Could not load conversation history' });

  const agent = AGENTS[agentId];
  const queryText = [
    ...(history ?? []).map((m) => m.content),
    message,
  ].join('\n');
  const draftingDocument = documentAction === 'create' || documentAction === 'revise';
  const chatMessages = draftingDocument
    ? [
        {
          role: 'system',
          content: buildPassRateSystemPrompt({
            queryText,
            latestUserMessage: message,
            mode: 'document',
            skillName: 'application-draft',
          }),
        },
        ...(history ?? []).map((m) => ({ role: m.role, content: m.content })),
        {
          role: 'user',
          content:
            documentAction === 'revise' && existingDoc
              ? `Here is the current application draft to revise:\n\n${existingDoc.content_md}\n\nRevise the FULL Markdown document according to the latest user instruction. Keep sections that should not change. Output Markdown only — no preamble.`
              : 'Draft the complete Erasmus+ application from this conversation. Match the action type discussed (KA1 or KA2). Output Markdown only — no preamble. If it is not ready, output the short Not ready to draft note — never blank "—" fields.',
        },
      ]
    : [
        {
          role: 'system',
          content: buildPassRateSystemPrompt({
            agentSystemPrompt: agent.systemPrompt,
            queryText,
            latestUserMessage: message,
            mode: 'chat',
          }),
        },
        ...(history ?? []).map((m) => ({ role: m.role, content: m.content })),
      ];

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const abortController = new AbortController();
  const onClientClose = () => {
    if (!res.writableEnded) abortController.abort();
  };
  req.on('close', onClientClose);

  let fullText = '';
  let streamedDocument = '';
  let totalTokens = 0;
  let providerId = planConfig.provider;
  let documentPayload = null;

  const emitLiveUsage = (turnTokens) => {
    totalTokens = turnTokens;
    if (res.writableEnded) return;
    const used = Math.min(
      profile.monthly_token_limit,
      profile.tokens_used + Math.max(0, turnTokens),
    );
    writeEvent(res, {
      tokensUsed: used,
      tokenLimit: profile.monthly_token_limit,
    });
  };

  try {
    if (draftingDocument) {
      writeEvent(res, { documentStart: true, mode: documentAction });
      let contentMd = '';
      const provider = await streamChatForPlan({
        plan: profile.plan,
        messages: chatMessages,
        signal: abortController.signal,
        onDelta: (delta) => {
          contentMd += delta;
          streamedDocument = contentMd;
          writeEvent(res, { documentDelta: delta });
        },
        onUsage: (usage) => {
          emitLiveUsage(readUsageTotalTokens(usage));
        },
      });
      providerId = provider.id;
      contentMd = stripMarkdownFence(contentMd);
      streamedDocument = contentMd;
      const quality = assessGeneratedDraft(contentMd, { sourceText: queryText, kind: 'application' });
      if (!quality.ready) {
        fullText = notReadyChatNotice(quality);
        writeEvent(res, { documentRejected: true, gaps: quality.gaps });
        writeEvent(res, { delta: fullText });
      } else {
        const saved =
          documentAction === 'revise' && existingDoc
            ? await updateDocumentRecord({ existing: existingDoc, contentMd })
            : await createDocumentRecord({
                userId: req.user.id,
                conversationId: conversation.id,
                contentMd,
              });
        documentPayload = await toGeneratedDocumentPayload(saved);
        writeEvent(res, { document: documentPayload });
        fullText = documentChatNotice(documentAction);
        writeEvent(res, { delta: fullText });
      }
    } else {
      const provider = await streamChatForPlan({
        plan: profile.plan,
        messages: chatMessages,
        signal: abortController.signal,
        onDelta: (delta) => {
          fullText += delta;
          writeEvent(res, { delta });
        },
        onUsage: (usage) => {
          emitLiveUsage(readUsageTotalTokens(usage));
        },
      });
      providerId = provider.id;
    }
  } catch (err) {
    if (!(isAbortError(err) || abortController.signal.aborted)) {
      console.error('[chat] AI stream failed', err);
      writeEvent(res, { error: 'AI provider request failed. Please try again.' });
      req.off('close', onClientClose);
      return res.end();
    }
  }

  req.off('close', onClientClose);

  const outputForBilling = streamedDocument || fullText;
  if (!totalTokens && outputForBilling) {
    totalTokens = estimateTokensFromText(outputForBilling);
  }

  if (fullText || streamedDocument) {
    if (fullText) {
      await supabaseAdmin.from('messages').insert({
        conversation_id: conversation.id,
        role: 'assistant',
        content: fullText,
        tokens_used: totalTokens,
        agent_id: storedAgentId,
      });
    }

    await supabaseAdmin
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversation.id);

    const tokensUsed = await applyTokenUsage(
      req.user.id,
      profile.tokens_used,
      profile.monthly_token_limit,
      totalTokens,
    );

    if (!res.writableEnded) {
      writeEvent(res, {
        done: true,
        conversationId: conversation.id,
        tokensUsed,
        tokenLimit: profile.monthly_token_limit,
        provider: providerId,
        aiTier: planConfig.aiTier,
        ...(documentPayload ? { documentId: documentPayload.id } : {}),
      });
    }
  }

  if (!res.writableEnded) res.end();
});

export default router;
