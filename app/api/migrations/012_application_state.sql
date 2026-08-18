-- Application Intelligence Engine: typed Application State on grant_applications.
-- Run after 011_grant_applications.sql.

alter table public.grant_applications
  add column if not exists call_year integer not null default 2026,
  add column if not exists action_confirmed boolean not null default true,
  add column if not exists conversation_id uuid references public.conversations(id) on delete set null,
  add column if not exists facts jsonb not null default '[]'::jsonb,
  add column if not exists sections jsonb not null default '{}'::jsonb,
  add column if not exists validation_report jsonb,
  add column if not exists readiness jsonb;

alter table public.grant_applications
  drop constraint if exists grant_applications_status_check;

alter table public.grant_applications
  add constraint grant_applications_status_check
  check (status in ('draft', 'in_review', 'ready', 'complete'));

-- Legacy bundled youth code is no longer selectable; keep rows readable.
-- Do not rewrite KA152-154 to a guessed exact action.

create index if not exists grant_applications_conversation_id_idx
  on public.grant_applications (conversation_id)
  where conversation_id is not null;
