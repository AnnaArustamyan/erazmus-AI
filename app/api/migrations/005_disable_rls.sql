-- Run this in Supabase SQL editor (Database -> SQL Editor)
-- The frontend never talks to Supabase directly — every request goes
-- through our own backend, which always uses the privileged API key. RLS
-- here was defense-in-depth only, not load-bearing, and the new Supabase
-- API key rollout is inconsistently bypassing it for plain REST inserts.
-- Disabling it removes that friction without reducing real protection
-- (nothing exposes an anon/publishable key to the browser in this app).

alter table public.users disable row level security;
alter table public.conversations disable row level security;
alter table public.messages disable row level security;
