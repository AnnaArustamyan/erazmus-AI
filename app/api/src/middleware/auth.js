import { supabaseAdmin } from '../config/supabase.js';
import { readAccessToken } from '../lib/sessionCookies.js';

/**
 * Accepts Authorization: Bearer <access_token> or the httpOnly access cookie.
 * Prefer cookies for the web app; Bearer remains for curl and tests.
 */
export async function verifyAuth(req, res, next) {
  try {
    const token = readAccessToken(req);

    if (!token) {
      return res.status(401).json({ error: 'Missing bearer token' });
    }

    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = data.user; // { id, email, ... }
    req.userToken = token;
    next();
  } catch (err) {
    console.error('[verifyAuth] unexpected error', err);
    res.status(500).json({ error: 'Auth check failed' });
  }
}
