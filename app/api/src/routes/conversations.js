import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { verifyAuth } from '../middleware/auth.js';

const router = Router();
const MAX_CONVERSATIONS = 30;
const SIGNED_URL_TTL_SECONDS = 60 * 60;

async function withAttachmentUrls(messages) {
  return Promise.all(
    messages.map(async (message) => {
      if (!message.attachment_path) return message;
      const { data } = await supabaseAdmin.storage
        .from('attachments')
        .createSignedUrl(message.attachment_path, SIGNED_URL_TTL_SECONDS);
      return { ...message, attachment_url: data?.signedUrl ?? null };
    }),
  );
}

/**
 * GET /api/conversations
 * Lists the current user's conversations, most recently active first.
 */
router.get('/', verifyAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('conversations')
    .select('id, agent_id, title, updated_at, created_at')
    .eq('user_id', req.user.id)
    .order('updated_at', { ascending: false })
    .limit(MAX_CONVERSATIONS);

  if (error) return res.status(500).json({ error: 'Could not load conversations' });
  res.json({ conversations: data });
});

/**
 * GET /api/conversations/:id/messages
 * Returns the full message history for one of the current user's conversations.
 */
router.get('/:id/messages', verifyAuth, async (req, res) => {
  const { data: conversation, error: conversationError } = await supabaseAdmin
    .from('conversations')
    .select('id, agent_id')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();

  if (conversationError || !conversation) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  const { data: messages, error: messagesError } = await supabaseAdmin
    .from('messages')
    .select('id, role, content, agent_id, attachment_path, attachment_name, created_at')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: true });

  if (messagesError) return res.status(500).json({ error: 'Could not load messages' });
  res.json({ conversation, messages: await withAttachmentUrls(messages) });
});

/**
 * DELETE /api/conversations/:id
 */
router.delete('/:id', verifyAuth, async (req, res) => {
  const { error, count } = await supabaseAdmin
    .from('conversations')
    .delete({ count: 'exact' })
    .eq('id', req.params.id)
    .eq('user_id', req.user.id);

  if (error) return res.status(500).json({ error: 'Could not delete conversation' });
  if (!count) return res.status(404).json({ error: 'Conversation not found' });
  res.status(204).send();
});

export default router;
