-- Agent chat persistence: sessions + transcript events.
--
-- Both tables are reachable only by the authenticated role (the local dev
-- authoring user). The deployed read-only site runs as anon, which has no
-- policies here — it never sees the agent surface either. Payload rows are
-- the panel's TranscriptEvent JSON, append-only per (session, seq).

create table public.agent_sessions (
  id uuid primary key,
  title text not null default 'New session',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.agent_sessions is
  'One canvas-agent conversation. Ledger entries reference it via agentSessionId (client-side).';

create table public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.agent_sessions (id) on delete cascade,
  seq integer not null,
  kind text not null check (kind in ('user', 'assistant', 'tool', 'status')),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (session_id, seq)
);

comment on table public.agent_messages is
  'Transcript events of an agent session, ordered by seq. Payload mirrors the app''s TranscriptEvent.';

create index agent_messages_session_idx
  on public.agent_messages (session_id, seq);

alter table public.agent_sessions enable row level security;
alter table public.agent_messages enable row level security;

create policy "authenticated manage agent sessions"
  on public.agent_sessions
  for all
  to authenticated
  using (true)
  with check (true);

create policy "authenticated manage agent messages"
  on public.agent_messages
  for all
  to authenticated
  using (true)
  with check (true);
