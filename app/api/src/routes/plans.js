import { Router } from 'express';
import { verifyAuth } from '../middleware/auth.js';
import {
  completeChatForPlan,
  isProviderConfiguredForPlan,
} from '../services/aiProvider.js';
import { extractTitleFromMarkdown } from '../lib/applicationSchema.js';
import {
  assessBrief,
  assessGeneratedDraft,
  notReadyError,
  stripMarkdownFence,
  toNotReadyPayload,
} from '../lib/draftQuality.js';
import { buildPassRateSystemPrompt } from '../lib/passRate.js';
import { getPlanConfig } from '../lib/plans.js';
import { createDocumentRecord, toGeneratedDocumentPayload } from '../services/documents.js';
import {
  applyTokenUsage,
  countDocumentsThisMonth,
  documentCapError,
  getUserQuota,
  isQuotaExhausted,
} from '../services/quota.js';

const router = Router();

function providerNotConfiguredError(plan) {
  const needed = getPlanConfig(plan).provider === 'openai' ? 'OPENAI_API_KEY' : 'MOONSHOT_API_KEY';
  return `AI provider is not configured for your plan. Set ${needed} on the server.`;
}

/**
 * POST /api/plans
 * body: { prompt }
 * Strategic project plan (not the NA application). Still pass-rate constrained.
 */
router.post('/', verifyAuth, async (req, res) => {
  const { prompt } = req.body ?? {};
  if (typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'prompt is required' });
  }

  const profile = await getUserQuota(req.user.id);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  if (isQuotaExhausted(profile)) {
    return res.status(402).json({ error: 'Token quota exhausted. Upgrade your plan to continue.' });
  }
  const documentsThisMonth = await countDocumentsThisMonth(req.user.id);
  const capError = documentCapError(profile, documentsThisMonth);
  if (capError) return res.status(403).json({ error: capError });

  if (!isProviderConfiguredForPlan(profile.plan)) {
    return res.status(503).json({ error: providerNotConfiguredError(profile.plan) });
  }

  const brief = assessBrief(prompt);
  if (!brief.ready) {
    return res.status(422).json(toNotReadyPayload(brief, 'plan'));
  }

  let contentMd;
  let totalTokens = 0;
  try {
    const result = await completeChatForPlan({
      plan: profile.plan,
      reasoningEffort: 'high',
      messages: [
        {
          role: 'system',
          content: buildPassRateSystemPrompt({
            queryText: prompt,
            mode: 'document',
            skillName: 'project-plan',
          }),
        },
        {
          role: 'user',
          content: `Write a project strategy from this brief. If it is not ready, output the short Not ready to draft note — never a document of blank "—" fields.\n\n${prompt.trim()}`,
        },
      ],
    });
    contentMd = stripMarkdownFence(result.content || '');
    totalTokens = result.totalTokens;
  } catch (err) {
    console.error('[plans] AI failed', err);
    return res.status(502).json({ error: 'AI provider request failed. Please try again.' });
  }

  const quality = assessGeneratedDraft(contentMd, { sourceText: prompt, kind: 'plan' });
  const tokensUsed = await applyTokenUsage(
    req.user.id,
    profile.tokens_used,
    profile.monthly_token_limit,
    totalTokens,
  );
  if (!quality.ready) {
    return res.status(422).json({
      ...toNotReadyPayload(quality, 'plan'),
      error: notReadyError(quality, 'plan'),
      tokensUsed,
      tokenLimit: profile.monthly_token_limit,
    });
  }

  try {
    const doc = await createDocumentRecord({
      userId: req.user.id,
      title: extractTitleFromMarkdown(contentMd, 'Project plan'),
      contentMd,
      plan: profile.plan,
    });
    const payload = await toGeneratedDocumentPayload(doc);
    return res.status(201).json({
      ...payload,
      tokensUsed,
      tokenLimit: profile.monthly_token_limit,
    });
  } catch (err) {
    console.error('[plans] persist failed', err);
    return res.status(500).json({ error: 'Could not save generated plan' });
  }
});

export default router;
