import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { verifyAuth } from '../middleware/auth.js';
import { AGENTS, isValidAgentId } from '../lib/agents.js';
import { getPlanConfig } from '../lib/plans.js';
import {
  isProviderConfiguredForPlan,
  streamChatForPlan,
} from '../services/aiProvider.js';
import { applyTokenUsage, getUserQuota, isQuotaExhausted } from '../services/quota.js';

const router = Router();

function writeEvent(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

/**
 * POST /api/chat
 * body: { agentId, message, conversationId? }
 * Streams the agent's reply back as Server-Sent Events.
 * Free plan → OpenAI (standard). Paid plans → Moonshot (advanced).
 */
router.post('/', verifyAuth, async (req, res) => {
  const { agentId, message, conversationId, attachmentPath, attachmentName } = req.body;

  if (!agentId || !isValidAgentId(agentId)) {
    return res.status(400).json({ error: 'agentId is required and must be a known agent' });
  }
  if (typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required' });
  }
  if (!message.trim() && !attachmentPath) {
    return res.status(400).json({ error: 'message or an attachment is required' });
  }
  if (attachmentPath && !attachmentPath.startsWith(`${req.user.id}/`)) {
    return res.status(403).json({ error: 'Invalid attachment reference' });
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
      .insert({ user_id: req.user.id, agent_id: agentId, title: message.slice(0, 60) })
      .select('id, agent_id, user_id')
      .single();
    if (error) return res.status(500).json({ error: 'Could not create conversation' });
    conversation = data;
  }

  const { data: history, error: historyError } = await supabaseAdmin
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: true })
    .limit(planConfig.maxHistoryMessages);

  if (historyError) return res.status(500).json({ error: 'Could not load conversation history' });

  const content = message.trim() || `(no message — see attached file: ${attachmentName || 'attachment'})`;

  const agent = AGENTS[agentId];
  const chatMessages = [
    { role: 'system', content: agent.systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content },
  ];

  await supabaseAdmin.from('messages').insert({
    conversation_id: conversation.id,
    role: 'user',
    content,
    agent_id: agentId,
    attachment_path: attachmentPath || null,
    attachment_name: attachmentName || null,
  });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  let fullText = '';
  let totalTokens = 0;
  let providerId = planConfig.provider;

  try {
    const provider = await streamChatForPlan({
      plan: profile.plan,
      messages: chatMessages,
      onDelta: (delta) => {
        fullText += delta;
        writeEvent(res, { delta });
      },
      onUsage: (usage) => {
        totalTokens = usage.total_tokens ?? 0;
      },
    });
    providerId = provider.id;
  } catch (err) {
    console.error('[chat] AI stream failed', err);
    writeEvent(res, { error: 'AI provider request failed. Please try again.' });
    return res.end();
  }

  await supabaseAdmin.from('messages').insert({
    conversation_id: conversation.id,
    role: 'assistant',
    content: fullText,
    tokens_used: totalTokens,
    agent_id: agentId,
  });

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

  writeEvent(res, {
    done: true,
    conversationId: conversation.id,
    tokensUsed,
    tokenLimit: profile.monthly_token_limit,
    provider: providerId,
    aiTier: planConfig.aiTier,
  });
  res.end();
});

export default router;
