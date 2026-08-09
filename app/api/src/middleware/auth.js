import { supabaseAdmin } from '../config/supabase.js';

/**
 * Frontend logs in via Supabase Auth (supabase-js on the client) and gets a JWT.
 * Every request to our API must send it as: Authorization: Bearer <token>
 * This middleware verifies that token against Supabase and loads the user.
 */
export async function verifyAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

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
