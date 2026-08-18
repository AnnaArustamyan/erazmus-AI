import { Router } from 'express';
import { verifyAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../config/supabase.js';
import { requireConfirmedAction } from '../lib/actionLock.js';
import { factsFromAnswers, normalizeFacts } from '../lib/facts.js';
import { flattenFormFields, loadFormSchema } from '../lib/formSchemas.js';
import { validateApplication } from '../lib/validateApplication.js';

const router = Router();

const STATUSES = new Set(['draft', 'in_review', 'ready', 'complete']);
const GRANT_SELECT =
  'id, user_id, action_code, call_year, title, answers, path, facts, sections, validation_report, readiness, action_confirmed, conversation_id, status, percent_complete, document_id, content_md, created_at, updated_at';

function normalizeStatus(status) {
  if (status === 'complete') return 'ready';
  return status;
}

function toGrantPayload(row) {
  return {
    id: row.id,
    actionCode: row.action_code,
    callYear: row.call_year ?? 2026,
    title: row.title,
    status: normalizeStatus(row.status),
    percentComplete: row.percent_complete ?? 0,
    answers: row.answers && typeof row.answers === 'object' ? row.answers : {},
    path: Array.isArray(row.path) ? row.path : [],
    facts: normalizeFacts(row.facts),
    sections: row.sections && typeof row.sections === 'object' ? row.sections : {},
    validationReport: row.validation_report || undefined,
    readiness: row.readiness || undefined,
    actionConfirmed: row.action_confirmed === true && row.action_code !== 'PENDING',
    conversationId: row.conversation_id || undefined,
    contentMd: row.content_md || undefined,
    documentId: row.document_id || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function deriveFacts(actionCode, answers, incomingFacts) {
  if (Array.isArray(incomingFacts)) return normalizeFacts(incomingFacts);
  const schema = loadFormSchema(actionCode);
  if (!schema || !answers) return [];
  return factsFromAnswers(flattenFormFields(schema), answers);
}

/**
 * GET /api/grants
 */
router.get('/', verifyAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('grant_applications')
    .select(GRANT_SELECT)
    .eq('user_id', req.user.id)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[grants] list failed', error);
    return res.status(500).json({ error: 'Could not list grant applications' });
  }
  return res.json({ grants: (data ?? []).map(toGrantPayload) });
});

/**
 * POST /api/grants
 * body: { actionCode, title?, answers?, path?, status?, percentComplete? }
 */
router.post('/', verifyAuth, async (req, res) => {
  const { actionCode, title, answers, path, status, percentComplete, callYear, facts, conversationId } =
    req.body ?? {};
  const hasCode = typeof actionCode === 'string' && actionCode.trim() && actionCode.trim() !== 'PENDING';
  let resolvedCode = 'PENDING';
  let confirmed = false;
  if (hasCode) {
    const lock = requireConfirmedAction(actionCode);
    if (!lock.ok) {
      return res.status(lock.status).json({ error: lock.error, code: lock.code });
    }
    resolvedCode = lock.actionCode;
    confirmed = true;
  }
  if (status && !STATUSES.has(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const now = new Date().toISOString();
  const resolvedAnswers = answers && typeof answers === 'object' ? answers : {};
  const { data, error } = await supabaseAdmin
    .from('grant_applications')
    .insert({
      user_id: req.user.id,
      action_code: resolvedCode,
      call_year: Number.isFinite(callYear) ? callYear : 2026,
      title: typeof title === 'string' && title.trim() ? title.trim() : 'Untitled application',
      answers: resolvedAnswers,
      path: Array.isArray(path) ? path : [],
      facts: confirmed ? deriveFacts(resolvedCode, resolvedAnswers, facts) : [],
      action_confirmed: confirmed,
      conversation_id: typeof conversationId === 'string' && conversationId ? conversationId : null,
      status: STATUSES.has(status) ? normalizeStatus(status) : 'draft',
      percent_complete: Number.isFinite(percentComplete) ? percentComplete : 0,
      created_at: now,
      updated_at: now,
    })
    .select(GRANT_SELECT)
    .single();

  if (error) {
    console.error('[grants] create failed', error);
    return res.status(500).json({ error: 'Could not create grant application' });
  }
  return res.status(201).json({ grant: toGrantPayload(data) });
});

/**
 * GET /api/grants/:id
 */
router.get('/:id', verifyAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('grant_applications')
    .select(GRANT_SELECT)
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Grant application not found' });
  return res.json({ grant: toGrantPayload(data) });
});

/**
 * POST /api/grants/:id/validate
 */
router.post('/:id/validate', verifyAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('grant_applications')
    .select(GRANT_SELECT)
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();
  if (error || !data) return res.status(404).json({ error: 'Grant application not found' });

  const report = validateApplication({
    actionCode: data.action_code,
    answers: data.answers,
    facts: data.facts,
    callYear: data.call_year,
  });
  const { data: saved, error: saveError } = await supabaseAdmin
    .from('grant_applications')
    .update({
      validation_report: report,
      readiness: report.readiness,
      updated_at: new Date().toISOString(),
    })
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .select(GRANT_SELECT)
    .single();
  if (saveError || !saved) return res.status(500).json({ error: 'Could not save validation report' });
  return res.json({ grant: toGrantPayload(saved), report });
});

/**
 * PATCH /api/grants/:id
 */
router.patch('/:id', verifyAuth, async (req, res) => {
  const patch = {};
  const body = req.body ?? {};
  if (typeof body.title === 'string') patch.title = body.title.trim() || 'Untitled application';
  if (body.answers && typeof body.answers === 'object') patch.answers = body.answers;
  if (Array.isArray(body.path)) patch.path = body.path;
  if (typeof body.status === 'string') {
    if (!STATUSES.has(body.status)) return res.status(400).json({ error: 'Invalid status' });
    patch.status = normalizeStatus(body.status);
  }
  if (Number.isFinite(body.percentComplete)) patch.percent_complete = body.percentComplete;
  if (typeof body.contentMd === 'string') patch.content_md = body.contentMd;
  if (body.sections && typeof body.sections === 'object') patch.sections = body.sections;
  if (Array.isArray(body.facts)) patch.facts = normalizeFacts(body.facts);
  if (Number.isFinite(body.callYear)) patch.call_year = body.callYear;
  if (typeof body.conversationId === 'string') patch.conversation_id = body.conversationId || null;
  if (typeof body.actionCode === 'string') {
    const code = body.actionCode.trim();
    if (!code || code === 'PENDING') {
      patch.action_code = 'PENDING';
      patch.action_confirmed = false;
    } else {
      const lock = requireConfirmedAction(code);
      if (!lock.ok) return res.status(lock.status).json({ error: lock.error, code: lock.code });
      patch.action_code = lock.actionCode;
      patch.action_confirmed = true;
    }
  }
  if (body.documentId === null) patch.document_id = null;
  else if (typeof body.documentId === 'string' && body.documentId) patch.document_id = body.documentId;

  if (patch.answers && !patch.facts && typeof body.actionCode === 'string') {
    patch.facts = deriveFacts(body.actionCode, patch.answers, body.facts);
  }

  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }
  patch.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('grant_applications')
    .update(patch)
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .select(GRANT_SELECT)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Grant application not found' });
  return res.json({ grant: toGrantPayload(data) });
});

/**
 * DELETE /api/grants/:id
 */
router.delete('/:id', verifyAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('grant_applications')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .select('id')
    .single();

  if (error || !data) return res.status(404).json({ error: 'Grant application not found' });
  return res.status(204).end();
});

export default router;
