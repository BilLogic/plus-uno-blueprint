-- 20260828120000 — the agent transcript stops being everybody's.
--
-- `agent_sessions` and `agent_messages` are the two tables the service-account
-- tier never reached. Every other write surface in `public` is gated: 27
-- RESTRICTIVE policies AND `is_service_account()` into the permissive ones, and
-- the ~21 SECURITY DEFINER authoring RPCs raise 42501 without it. These two
-- carried exactly ONE policy each —
--
--   create policy "authenticated manage agent sessions"
--     on public.agent_sessions for all to authenticated
--     using (true) with check (true);
--
-- — PERMISSIVE, no RESTRICTIVE companion, and no owner column to gate on. So
-- any authenticated session could read, edit or delete every row of both:
-- 33 sessions and 340 messages, everybody's.
--
-- IT IS NOT HYPOTHETICAL ANY MORE. `20260805150000_service_account_tier.sql`
-- reasoned that the gap was unreachable because "today every account is a
-- service account". That stopped being true on 2026-08-07:
-- `emiliezh@andrew.cmu.edu` exists in `auth.users` with
-- `raw_app_meta_data->>'role'` NULL. One viewer-tier account is all the
-- blanket policy needs.
--
-- THE SHAPE IS AN OWNER COLUMN, NOT A SERVICE GATE, and the code is what
-- decides that. `src/contexts/SupabaseProvider.tsx:160` sets
-- `canAgent = configured && (session !== null || isDevAuthoring)` — ANY
-- authenticated session reaches the agent, service or not. `AgentPanel.tsx:220`
-- says so in a comment ("viewers included — chat is their whole surface") and
-- the tier migration's own header says it ("chatting is exactly what a
-- non-service account is for"). A viewer with their own conversations is the
-- design. `is_service_account()` here would delete the viewer tier's only
-- surface to close a confidentiality hole; per-user ownership closes the same
-- hole and leaves the surface standing.
--
-- THE 33 LEGACY ROWS ARE NOT BACKFILLED, and that is a decision rather than an
-- omission. Nothing in either table records who wrote it — no `created_by`, no
-- session claim in the payload — so any backfill would be an invention. What
-- IS knowable, and was measured:
--
--   * the viewer account signed in exactly once, 2026-08-07 18:47:59 → 18:50:51
--   * ZERO of the 33 sessions were created inside that window
--
-- so no legacy row can be hers, and leaving them unattributed takes nothing
-- from a viewer. NULL therefore means "written before ownership was recorded",
-- and `owns_agent_session` reads it as service-account-only — the three service
-- accounts could already read all of it, so this narrows access without losing
-- the dogfood history. The unowned set cannot GROW: the insert policy is the
-- strict `user_id = auth.uid()`, with no NULL branch, and the column defaults
-- to `auth.uid()` so the app's existing upsert (which sends no `user_id`)
-- stamps itself.
--
-- `agent_messages` gets no column of its own. A message is owned by its
-- session, and the FK already says which one — a second copy of the owner is a
-- second thing to keep true.

alter table public.agent_sessions
  add column user_id uuid references auth.users (id) on delete cascade;

alter table public.agent_sessions
  alter column user_id set default auth.uid();

comment on column public.agent_sessions.user_id is
  'Who owns this conversation. NULL means the row predates ownership (2026-08-28); those are readable by service accounts only and no new row may be NULL.';

-- The policy predicate lives in one place because it is one rule, stated four
-- times per table. `stable`, not `immutable` — it reads the JWT.
create or replace function public.owns_agent_session(session_owner uuid)
returns boolean
language sql
stable
set search_path = public, pg_catalog, pg_temp
as $$
  select coalesce(session_owner = auth.uid(), false)
      or (session_owner is null and public.is_service_account())
$$;

comment on function public.owns_agent_session(uuid) is
  'True when the caller owns an agent session with this user_id. NULL owner = pre-2026-08-28 row, service accounts only. Fails closed: no JWT owns nothing.';

create index agent_sessions_user_idx on public.agent_sessions (user_id);

drop policy "authenticated manage agent sessions" on public.agent_sessions;
drop policy "authenticated manage agent messages" on public.agent_messages;

create policy agent_sessions_select_own on public.agent_sessions
  for select to authenticated
  using (public.owns_agent_session(user_id));

-- Strict, and deliberately not `owns_agent_session`: an insert may only claim
-- the caller, never the NULL bucket. This is what keeps the unattributed set
-- from growing back.
create policy agent_sessions_insert_own on public.agent_sessions
  for insert to authenticated
  with check (user_id = auth.uid());

create policy agent_sessions_update_own on public.agent_sessions
  for update to authenticated
  using (public.owns_agent_session(user_id))
  with check (public.owns_agent_session(user_id));

create policy agent_sessions_delete_own on public.agent_sessions
  for delete to authenticated
  using (public.owns_agent_session(user_id));

-- The message policies reach through the FK. The subquery is written out in
-- full rather than leaning on `agent_sessions`' own RLS applying to it — it
-- does apply, but a predicate that is only correct because of a policy on
-- another table is a predicate that breaks silently when that policy changes.
create policy agent_messages_select_own on public.agent_messages
  for select to authenticated
  using (exists (
    select 1 from public.agent_sessions s
    where s.id = agent_messages.session_id
      and public.owns_agent_session(s.user_id)
  ));

create policy agent_messages_insert_own on public.agent_messages
  for insert to authenticated
  with check (exists (
    select 1 from public.agent_sessions s
    where s.id = agent_messages.session_id
      and public.owns_agent_session(s.user_id)
  ));

create policy agent_messages_update_own on public.agent_messages
  for update to authenticated
  using (exists (
    select 1 from public.agent_sessions s
    where s.id = agent_messages.session_id
      and public.owns_agent_session(s.user_id)
  ))
  with check (exists (
    select 1 from public.agent_sessions s
    where s.id = agent_messages.session_id
      and public.owns_agent_session(s.user_id)
  ));

create policy agent_messages_delete_own on public.agent_messages
  for delete to authenticated
  using (exists (
    select 1 from public.agent_sessions s
    where s.id = agent_messages.session_id
      and public.owns_agent_session(s.user_id)
  ));

do $assert$
declare
  n int;
begin
  -- 1. The column, its type, its default and its FK. The DEFAULT is the part
  -- worth asserting: `src/lib/agent/persistence.ts` upserts {id, title,
  -- created_at, updated_at} and never sends user_id, so without the default
  -- every insert would violate the strict insert policy and the panel would
  -- silently stop persisting — the exact failure mode this table already has
  -- (`persistSession` discards its promise).
  select count(*) into n
  from information_schema.columns
  where table_schema = 'public' and table_name = 'agent_sessions'
    and column_name = 'user_id' and data_type = 'uuid';
  if n <> 1 then
    raise exception 'agent_sessions.user_id is missing or is not uuid';
  end if;

  select count(*) into n
  from pg_attrdef d
  join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
  where d.adrelid = 'public.agent_sessions'::regclass and a.attname = 'user_id'
    and pg_get_expr(d.adbin, d.adrelid) like '%auth.uid()%';
  if n <> 1 then
    raise exception 'agent_sessions.user_id has no auth.uid() default — the app sends no user_id, so every insert would be refused';
  end if;

  select count(*) into n
  from pg_constraint
  where conrelid = 'public.agent_sessions'::regclass and contype = 'f'
    and confrelid = 'auth.users'::regclass;
  if n <> 1 then
    raise exception 'agent_sessions.user_id does not reference auth.users';
  end if;

  -- 2. The blanket policies are GONE. A drop that silently did nothing would
  -- leave `using (true)` sitting permissively beside the new ones, and
  -- PERMISSIVE policies OR together — the four new policies would be decoration.
  select count(*) into n from pg_policies
  where schemaname = 'public' and policyname like 'authenticated manage agent %';
  if n <> 0 then
    raise exception '% blanket "authenticated manage agent" policy/policies survive, and permissive policies OR', n;
  end if;

  -- 3. Four policies per table, every one of them naming the owner. Matched on
  -- the expression text rather than on the count alone: a fifth policy spelled
  -- `using (true)` would satisfy a count and undo the whole file.
  select count(*) into n from pg_policies
  where schemaname = 'public' and tablename in ('agent_sessions', 'agent_messages');
  if n <> 8 then
    raise exception 'expected 8 policies across the two agent tables, found %', n;
  end if;

  --
  -- Two spellings, because the two tables own differently and only one of them
  -- says `uid()` in its stored text: `agent_messages` reaches the owner through
  -- `owns_agent_session(s.user_id)`, and `user_id` is not `uid()`. Matching on
  -- one spelling would have passed this table by.
  select count(*) into n from pg_policies
  where schemaname = 'public' and tablename in ('agent_sessions', 'agent_messages')
    and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) not like '%uid()%'
    and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) not like '%owns_agent_session%';
  if n <> 0 then
    raise exception '% agent policy expression(s) do not mention the owner at all', n;
  end if;

  select count(*) into n from pg_policies
  where schemaname = 'public' and tablename in ('agent_sessions', 'agent_messages')
    and (permissive <> 'PERMISSIVE' or roles <> '{authenticated}');
  if n <> 0 then
    raise exception '% agent policy/policies are not permissive-to-authenticated as intended', n;
  end if;

  -- 4. Nothing was attributed. A backfill would have been an invention (no row
  -- records its author), so the post-condition is that no row acquired one.
  select count(*) into n from public.agent_sessions where user_id is not null;
  if n <> 0 then
    raise exception '% legacy session(s) were given an owner this migration cannot know', n;
  end if;

  -- 5. The predicate fails CLOSED. Run as postgres there is no JWT, so
  -- auth.uid() is null and is_service_account() is false — and both branches
  -- must still say no. `coalesce` is what makes the first one false rather than
  -- NULL, and RLS treats NULL as a denial only by accident of three-valued
  -- logic; relying on that accident is how a predicate ends up meaning
  -- something else the day it is edited.
  if public.owns_agent_session(null) then
    raise exception 'owns_agent_session(null) is true with no JWT — the legacy rows are open to anyone';
  end if;
  if public.owns_agent_session('00000000-0000-0000-0000-0000000000aa'::uuid) then
    raise exception 'owns_agent_session(<stranger>) is true with no JWT';
  end if;
end
$assert$;

-- 6. The gate, exercised as the roles it gates. Everything above asserts that
-- the right objects exist; this asserts what they DO, which is the only claim
-- the issue actually made. Two callers, one transaction, RLS on for both
-- because `set role authenticated` drops the BYPASSRLS the migration runs with.
do $assert$
declare
  sessions_total int;
  messages_total int;
  seen int;
begin
  select count(*) into sessions_total from public.agent_sessions;
  select count(*) into messages_total from public.agent_messages;

  -- A viewer who owns nothing sees nothing. Before this file the same two
  -- counts came back 33 and 340.
  -- `set role`, not `set local role`, and set_config with is_local false: SET
  -- LOCAL outside a transaction block is a warning and a no-op, and this file
  -- is applied over MCP, where whether a transaction wraps it is not this
  -- file's to know. Both are reset at the end.
  execute 'set role authenticated';
  perform set_config('request.jwt.claims', json_build_object(
    'sub', '00000000-0000-0000-0000-0000000000aa',
    'role', 'authenticated',
    'app_metadata', json_build_object('role', 'viewer')
  )::text, false);

  select count(*) into seen from public.agent_sessions;
  if seen <> 0 then
    raise exception 'a viewer still sees % agent session(s) that are not theirs', seen;
  end if;
  select count(*) into seen from public.agent_messages;
  if seen <> 0 then
    raise exception 'a viewer still sees % agent message(s) that are not theirs', seen;
  end if;

  -- And a service account keeps the unattributed history, which is the other
  -- half of the NULL decision. If this ever returns 0 while sessions_total is
  -- not, the legacy transcript has been orphaned rather than narrowed.
  perform set_config('request.jwt.claims', json_build_object(
    'sub', '00000000-0000-0000-0000-0000000000bb',
    'role', 'authenticated',
    'app_metadata', json_build_object('role', 'service')
  )::text, false);

  select count(*) into seen from public.agent_sessions;
  if seen <> sessions_total then
    raise exception 'a service account sees % of % legacy session(s) — the history was orphaned, not narrowed', seen, sessions_total;
  end if;
  select count(*) into seen from public.agent_messages;
  if seen <> messages_total then
    raise exception 'a service account sees % of % legacy message(s)', seen, messages_total;
  end if;

  perform set_config('request.jwt.claims', '', false);
  execute 'reset role';
end
$assert$;
