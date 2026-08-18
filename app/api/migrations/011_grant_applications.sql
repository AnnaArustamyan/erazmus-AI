-- Grant interviews (questionnaire answers). Run after 010_quota_period.sql.

create table if not exists public.grant_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action_code text not null,
  title text not null default 'Untitled application',
  answers jsonb not null default '{}'::jsonb,
  path text[] not null default '{}',
  status text not null default 'draft'
    check (status in ('draft', 'in_review', 'complete')),
  percent_complete integer not null default 0,
  document_id uuid references public.documents(id) on delete set null,
  content_md text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists grant_applications_user_id_updated_at_idx
  on public.grant_applications (user_id, updated_at desc);
