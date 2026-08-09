-- Run this in Supabase SQL editor (Database -> SQL Editor)
-- Tags each message with the agent it was sent to/from, so a conversation
-- can be replayed correctly even if the user switched agents mid-thread.

alter table public.messages
  add column if not exists agent_id text
    check (agent_id in ('compliance', 'budget', 'partner-search', 'report-writer'));
