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
