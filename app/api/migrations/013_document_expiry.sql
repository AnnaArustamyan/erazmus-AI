-- Free-tier generated documents expire after 30 days (PRODUCT-SPEC.md §8);
-- paid plans keep them indefinitely (expires_at stays null).
-- Run in Supabase SQL Editor after 001–012.

alter table public.documents
  add column if not exists expires_at timestamptz;

create index if not exists documents_expires_at_idx
  on public.documents (expires_at)
  where expires_at is not null;

-- Cleanup is a manual/scheduled ops task for v1 (matches the yearly-refresh
-- pattern already used elsewhere in this project — see APPLICATION-ENGINE.md
-- §21). Run periodically, e.g. via a cron-triggered call to the Supabase SQL
-- editor or a scheduled function once one exists:
--
--   delete from public.documents where expires_at < now();
--
-- Deleting the row does not remove the associated storage objects (md/docx/pdf
-- under storage.objects) — those must be removed separately via the Supabase
-- Storage API using each row's *_storage_path before the delete, since the
-- path information is lost once the row is gone.
