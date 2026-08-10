import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { verifyAuth } from '../middleware/auth.js';
import { authIpLimiter, loginAccountLimiter } from '../middleware/rateLimiters.js';
import { PLANS, planFeatures } from '../lib/plans.js';

const router = Router();

// When true, new accounts must click the confirmation email before they can
// log in (also requires "Confirm email" enabled in Supabase Auth settings).
// Defaults to false so the curl flow in the README keeps working out of the
// box; flip to true — and configure email delivery in Supabase — for prod.
const REQUIRE_EMAIL_CONFIRMATION = process.env.REQUIRE_EMAIL_CONFIRMATION === 'true';

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
 * Returns a Supabase session (access_token) the frontend stores and sends
 * as Authorization: Bearer <access_token> on every subsequent request.
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
  res.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
    user: { id: data.user.id, email: data.user.email },
  });
});

/**
 * POST /api/auth/refresh
 * body: { refresh_token }
 * Exchanges a refresh token for a new session, so the frontend can keep a
 * user signed in past the access token's ~1h expiry without asking for a
 * password again.
 */
router.post('/refresh', authIpLimiter, async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) {
    return res.status(400).json({ error: 'refresh_token is required' });
  }

  const { data, error } = await supabaseAdmin.auth.refreshSession({ refresh_token });
  if (error) {
    console.warn('[auth] refresh failed', { ip: req.ip, reason: error.message });
    return res.status(401).json({ error: error.message });
  }

  res.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
    user: { id: data.user.id, email: data.user.email },
  });
});

/**
 * POST /api/auth/logout
 * Invalidates the given refresh token session.
 */
router.post('/logout', verifyAuth, async (req, res) => {
  await supabaseAdmin.auth.admin.signOut(req.userToken);
  res.status(204).send();
});

/**
 * GET /api/auth/me
 * Returns the current user's profile (from our own users table, not just auth).
 */
router.get('/me', verifyAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, email, name, plan, monthly_token_limit, tokens_used, created_at')
    .eq('id', req.user.id)
    .single();

  if (error) return res.status(404).json({ error: 'Profile not found' });
  res.json({
    ...data,
    features: planFeatures(data.plan),
  });
});

export default router;
