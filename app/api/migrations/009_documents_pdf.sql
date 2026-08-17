-- PDF is the primary download for generated applications.
-- Run in Supabase SQL Editor after 001–008.

alter table public.documents
  add column if not exists pdf_storage_path text;
