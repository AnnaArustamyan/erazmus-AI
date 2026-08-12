# Session durability and threat model

Login must survive a full page refresh (`FR-SESS-1`, `FR-SESS-2`).

## How it works

1. **httpOnly cookies** (preferred): `POST /api/auth/login` and `/refresh` set `ea_access_token` and `ea_refresh_token` (`HttpOnly`, `SameSite=Lax`, `Secure` in production). The web app sends `credentials: 'include'` on every API call. `verifyAuth` accepts the cookie **or** `Authorization: Bearer`.
2. **Silent refresh**: on load, if the access token is missing/expired, the client calls `POST /api/auth/refresh` (cookie or stored refresh token) and retries.
3. **Web-storage backup**: the SPA also keeps `{ accessToken, refreshToken, expiresAt, user }` in `localStorage` under `ea.session` so refresh still works if the cross-origin cookie is dropped (Vite dev: UI `:5173`, API `:4000`). Active conversation id is stored separately (`ea.activeConversationId`) — not a secret.

## Why not cookies-only

The API and UI are often **different origins**. Cross-site cookies need a correct `CLIENT_ORIGIN`, CORS `credentials: true`, and (in production) HTTPS. Local HTTP + split ports is a common cookie miss. The Bearer backup keeps refresh-safe login working in that setup.

## Threat model (web storage)

| Threat | What it means | Mitigation |
|---|---|---|
| XSS | Script on our origin can read `localStorage` tokens | Helmet CSP on API; no `dangerouslySetInnerHTML` for model output as HTML; keep tokens out of URLs/logs |
| CSRF | Cookie session could be sent by a hostile site | `SameSite=Lax`; CORS allowlist `CLIENT_ORIGIN` only; state-changing APIs require auth |
| Stolen refresh token | Attacker mints new access tokens until logout | Logout calls Supabase `signOut` and clears cookies + `ea.session` |
| Shared machine | Next user of the browser is still logged in | Sign out; cookies are not `Max-Age` infinite for access |

Do not put API keys in `app/web`. Pass-rate prompts stay server-side.
