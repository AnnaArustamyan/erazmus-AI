-- Monthly token window. tokens_used resets when quota_period_start is a prior UTC month.

alter table public.users
  add column if not exists quota_period_start date not null default (date_trunc('month', timezone('utc', now())))::date;

update public.users
set quota_period_start = (date_trunc('month', timezone('utc', now())))::date
where quota_period_start is null;
