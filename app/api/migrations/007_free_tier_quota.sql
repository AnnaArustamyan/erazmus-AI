-- Tighten free-tier default quota (OpenAI still costs money per token).
-- New free users get 20k tokens/month. Existing free users still on the old
-- 100k default are brought down to 20k (does not touch paid plans).

alter table public.users
  alter column monthly_token_limit set default 20000;

update public.users
set monthly_token_limit = 20000
where plan = 'free'
  and monthly_token_limit = 100000;
