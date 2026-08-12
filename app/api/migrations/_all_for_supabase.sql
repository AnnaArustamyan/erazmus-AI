-- Erasmus AI migrations 001-007 (run once in Supabase SQL Editor)
-- Generated for local setup


-- ========== 001_users.sql ==========

-- Run this in Supabase SQL editor (Database -> SQL Editor)
-- Extends Supabase's built-in auth.users with our own app-facing profile table.

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  plan text not null default 'free' check (plan in ('free','basic','pro','enterprise')),
  monthly_token_limit integer not null default 100000,
  tokens_used integer not null default 0,
  created_at timestamptz not null default now()
);

-- Row Level Security: a user can only ever see / edit their own row.
alter table public.users enable row level security;

create policy "Users can view own profile"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.users for update
  using (auth.uid() = id);

-- Inserts happen only via the backend's service_role key (bypasses RLS),
-- right after Supabase Auth creates the account. No public insert policy needed.


-- ========== 002_conversations.sql ==========

-- Run this in Supabase SQL editor (Database -> SQL Editor)
-- Adds conversations + messages for the agent chat feature.

create extension if not exists pgcrypto;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_id text not null check (
    agent_id in ('grant', 'compliance', 'budget', 'partner-search', 'report-writer')
  ),
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  tokens_used integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_id_created_at_idx
  on public.messages (conversation_id, created_at);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

create policy "Users can view own conversations"
  on public.conversations for select
  using (auth.uid() = user_id);

create policy "Users can view own messages"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id and c.user_id = auth.uid()
    )
  );

-- Inserts/updates happen only via the backend's service_role key, right
-- after verifyAuth confirms the caller's identity. No public write policy needed.


-- ========== 003_messages_agent_id.sql ==========

-- Run this in Supabase SQL editor (Database -> SQL Editor)
-- Tags each message with the agent it was sent to/from, so a conversation
-- can be replayed correctly even if the user switched agents mid-thread.

alter table public.messages
  add column if not exists agent_id text
    check (agent_id in ('grant', 'compliance', 'budget', 'partner-search', 'report-writer'));


-- ========== 004_attachments.sql ==========

-- Run this in Supabase SQL editor (Database -> SQL Editor)
-- Adds file attachment support: a private Storage bucket plus the columns
-- on messages that reference an uploaded file.

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

-- Objects are stored at "<user_id>/<uuid>-<filename>", so a user can only
-- reach their own folder. The backend uses the service_role key (bypasses
-- RLS) for all uploads/reads, so this is defense-in-depth, not load-bearing.
create policy "Users can read own attachments"
  on storage.objects for select
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can upload own attachments"
  on storage.objects for insert
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

alter table public.messages
  add column if not exists attachment_path text,
  add column if not exists attachment_name text;


-- ========== 005_disable_rls.sql ==========

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


-- ========== 006_documents.sql ==========

-- Documents generated from chat (Markdown source of truth + DOCX export).
-- Run in Supabase SQL Editor after 001–005.

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  title text not null,
  content_md text not null,
  md_storage_path text not null,
  docx_storage_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists documents_user_id_created_at_idx
  on public.documents (user_id, created_at desc);

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Defense-in-depth: frontend never uses anon key for this bucket.
create policy "Users can read own documents"
  on storage.objects for select
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can upload own documents"
  on storage.objects for insert
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);


-- ========== 007_free_tier_quota.sql ==========

-- Tighten free-tier default quota (OpenAI still costs money per token).
-- New free users get 20k tokens/month. Existing free users still on the old
-- 100k default are brought down to 20k (does not touch paid plans).

alter table public.users
  alter column monthly_token_limit set default 20000;

update public.users
set monthly_token_limit = 20000
where plan = 'free'
  and monthly_token_limit = 100000;


-- ========== 008_grant_agent.sql ==========

alter table public.conversations drop constraint if exists conversations_agent_id_check;
alter table public.conversations
  add constraint conversations_agent_id_check
  check (agent_id in ('grant', 'compliance', 'budget', 'partner-search', 'report-writer'));

alter table public.messages drop constraint if exists messages_agent_id_check;
alter table public.messages
  add constraint messages_agent_id_check
  check (
    agent_id is null
    or agent_id in ('grant', 'compliance', 'budget', 'partner-search', 'report-writer')
  );

