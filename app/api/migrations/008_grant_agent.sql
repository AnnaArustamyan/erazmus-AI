-- Allow the single grant-assistant id. Legacy specialist ids stay valid
-- so existing conversation rows do not break.

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
