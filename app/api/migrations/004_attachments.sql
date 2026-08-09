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
