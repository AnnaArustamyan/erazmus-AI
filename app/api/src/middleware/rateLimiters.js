import rateLimit from 'express-rate-limit';

// Throttles a single network from hammering register/login regardless of
// which account it targets.
export const authIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts from this network. Please try again later.' },
});

// Throttles login attempts against a single account regardless of source IP,
// so credential-stuffing spread across many IPs still gets capped.
export const loginAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.body?.email || '').trim().toLowerCase() || 'anonymous',
  message: { error: 'Too many login attempts for this account. Please try again later.' },
});
