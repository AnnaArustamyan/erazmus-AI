import { env } from '../config/env.js';

const ACCESS_COOKIE = 'ea_access_token';
const REFRESH_COOKIE = 'ea_refresh_token';

function cookieBase() {
  return {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/',
  };
}

/**
 * @param {import('express').Response} res
 * @param {{ access_token: string, refresh_token: string, expires_at?: number }} session
 */
export function setAuthCookies(res, session) {
  const accessMaxAgeMs = session.expires_at
    ? Math.max(60_000, session.expires_at * 1000 - Date.now())
    : 60 * 60 * 1000;
  res.cookie(ACCESS_COOKIE, session.access_token, {
    ...cookieBase(),
    maxAge: accessMaxAgeMs,
  });
  res.cookie(REFRESH_COOKIE, session.refresh_token, {
    ...cookieBase(),
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

/**
 * @param {import('express').Response} res
 */
export function clearAuthCookies(res) {
  const base = cookieBase();
  res.clearCookie(ACCESS_COOKIE, { path: base.path });
  res.clearCookie(REFRESH_COOKIE, { path: base.path });
}

/**
 * @param {import('express').Request} req
 * @returns {string | null}
 */
export function readAccessToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  const cookieToken = req.cookies?.[ACCESS_COOKIE];
  return typeof cookieToken === 'string' && cookieToken ? cookieToken : null;
}

/**
 * @param {import('express').Request} req
 * @returns {string | null}
 */
export function readRefreshToken(req) {
  const bodyToken = req.body?.refresh_token;
  if (typeof bodyToken === 'string' && bodyToken) return bodyToken;
  const cookieToken = req.cookies?.[REFRESH_COOKIE];
  return typeof cookieToken === 'string' && cookieToken ? cookieToken : null;
}
