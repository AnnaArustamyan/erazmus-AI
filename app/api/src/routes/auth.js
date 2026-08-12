import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { verifyAuth } from '../middleware/auth.js';
import { authIpLimiter, loginAccountLimiter } from '../middleware/rateLimiters.js';
import { PLANS, planFeatures } from '../lib/plans.js';
import { GUIDE_YEAR } from '../lib/passRate.js';
import {
  clearAuthCookies,
  readRefreshToken,
  setAuthCookies,
} from '../lib/sessionCookies.js';
import { countDocumentsThisMonth } from '../services/quota.js';

const router = Router();

// When true, new accounts must click the confirmation email before they can
// log in (also requires "Confirm email" enabled in Supabase Auth settings).
// Defaults to false so the curl flow in the README keeps working out of the
// box; flip to true — and configure email delivery in Supabase — for prod.
const REQUIRE_EMAIL_CONFIRMATION = process.env.REQUIRE_EMAIL_CONFIRMATION === 'true';

function sessionPayload(session, user) {
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    user: { id: user.id, email: user.email },
  };
}

/**
 * POST /api/auth/register
 * body: { email, password, name }
 */
router.post('/register', authIpLimiter, async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: !REQUIRE_EMAIL_CONFIRMATION,
    user_metadata: { name: name || null },
  });

  if (error) return res.status(400).json({ error: error.message });

  // Also create the row in our own public.users profile table. If this
  // fails we'd otherwise be left with an auth user that can never load a
  // profile via /me — roll the auth user back so registration is atomic.
  const { error: profileError } = await supabaseAdmin.from('users').insert({
    id: data.user.id,
    email: data.user.email,
    name: name || null,
    plan: 'free',
    monthly_token_limit: PLANS.free.monthlyTokenLimit,
    tokens_used: 0,
  });

  if (profileError) {
    console.error('[auth] profile insert failed, rolling back auth user', {
      userId: data.user.id,
      error: profileError.message,
    });
    await supabaseAdmin.auth.admin.deleteUser(data.user.id);
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  }

  console.info('[auth] registered', { email: data.user.email, ip: req.ip });
  res.status(201).json({ user: { id: data.user.id, email: data.user.email } });
});

/**
 * POST /api/auth/login
 * body: { email, password }
 * Sets httpOnly cookies and also returns the session so API clients / curl
 * can still send Authorization: Bearer.
 */
router.post('/login', authIpLimiter, loginAccountLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });
  if (error) {
    console.warn('[auth] failed login attempt', { email, ip: req.ip, reason: error.message });
    return res.status(401).json({ error: error.message });
  }

  console.info('[auth] login success', { email, ip: req.ip });
  setAuthCookies(res, data.session);
  res.json(sessionPayload(data.session, data.user));
});

/**
 * POST /api/auth/refresh
 * body: { refresh_token? } — token may also come from the httpOnly cookie.
 */
router.post('/refresh', authIpLimiter, async (req, res) => {
  const refreshToken = readRefreshToken(req);
  if (!refreshToken) {
    return res.status(400).json({ error: 'refresh_token is required' });
  }

  const { data, error } = await supabaseAdmin.auth.refreshSession({ refresh_token: refreshToken });
  if (error) {
    console.warn('[auth] refresh failed', { ip: req.ip, reason: error.message });
    return res.status(401).json({ error: error.message });
  }

  setAuthCookies(res, data.session);
  res.json(sessionPayload(data.session, data.user));
});

/**
 * POST /api/auth/logout
 * Invalidates the given refresh token session.
 */
router.post('/logout', verifyAuth, async (req, res) => {
  await supabaseAdmin.auth.admin.signOut(req.userToken);
  clearAuthCookies(res);
  res.status(204).send();
});

async function profileResponse(userId) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, email, name, plan, monthly_token_limit, tokens_used, created_at')
    .eq('id', userId)
    .single();

  if (error || !data) return { error: 'Profile not found' };

  let documentsUsedThisMonth = 0;
  try {
    documentsUsedThisMonth = await countDocumentsThisMonth(userId);
  } catch (err) {
    console.error('[auth] document count failed', err);
  }

  return {
    profile: {
      ...data,
      documents_used_this_month: documentsUsedThisMonth,
      guide_year: GUIDE_YEAR,
      features: planFeatures(data.plan),
    },
  };
}

/**
 * GET /api/auth/me
 */
router.get('/me', verifyAuth, async (req, res) => {
  const result = await profileResponse(req.user.id);
  if (result.error) return res.status(404).json({ error: result.error });
  res.json(result.profile);
});

/**
 * PATCH /api/auth/me
 * body: { name }
 */
router.patch('/me', verifyAuth, async (req, res) => {
  const { name } = req.body ?? {};
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }

  const trimmed = name.trim().slice(0, 80);
  const { error } = await supabaseAdmin
    .from('users')
    .update({ name: trimmed })
    .eq('id', req.user.id);

  if (error) return res.status(500).json({ error: 'Could not update profile' });

  await supabaseAdmin.auth.admin.updateUserById(req.user.id, {
    user_metadata: { name: trimmed },
  });

  const result = await profileResponse(req.user.id);
  if (result.error) return res.status(404).json({ error: result.error });
  res.json(result.profile);
});

/**
 * POST /api/auth/password
 * body: { currentPassword, newPassword }
 */
router.post('/password', verifyAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  }
  if (String(newPassword).length < 6) {
    return res.status(400).json({ error: 'Password should be at least 6 characters' });
  }

  const email = req.user.email;
  if (!email) {
    return res.status(400).json({ error: 'Account has no email' });
  }

  const { error: verifyError } = await supabaseAdmin.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (verifyError) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(req.user.id, {
    password: newPassword,
  });
  if (error) return res.status(400).json({ error: error.message });

  res.status(204).send();
});

export default router;
