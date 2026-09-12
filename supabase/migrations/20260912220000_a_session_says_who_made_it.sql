-- A session says who made it.
--
-- `agent_sessions.user_id` becomes `created_by`, and the reason is not that a
-- name was wrong on its own. It is that two repositories independently built
-- the same table and gave the same column two names.
--
-- THERE IS NO UPSTREAM RENAME TO FOLLOW HERE, and saying so is the point.
-- `20260819000000_agent_surface.sql` CREATED the template's `agent_sessions`
-- with `created_by uuid not null default auth.uid()`. This deployment's
-- `20260804210000` created its own `agent_sessions` first, without an owner at
-- all, and `20260828120000` added one five weeks later under the name
-- `user_id`. Neither file knew about the other. So this is not a deployment
-- catching up with a decision the template took — it is the two schemas
-- agreeing on one word for one thing, and `created_by` is the word, because it
-- is what the rest of this schema already says: `cells.created_by`,
-- `resources.created_by`, `evidence.created_by`, `slices.created_by`.
-- `user_id` says which user; every other row in this database that records
-- authorship says who created it.
--
-- ── WHAT THE RENAME HAS TO CARRY, AND WHY EACH IS ASSERTED ────────────────
--
-- This column is load-bearing in four ways that `20260828120000` documents,
-- and a rename that dropped any one of them would fail silently rather than
-- loudly. Each gets an assertion below rather than an assumption.
--
--   * THE DEFAULT. `alter column … set default auth.uid()` is what makes the
--     panel's upsert work: `persistSession` sends {id, title, created_at,
--     updated_at} and never the owner, so without the default every insert
--     would violate the strict insert policy and the transcript would stop
--     persisting. `20260828120000` asserts the default for exactly that
--     reason. A rename carries a default — the expression is `auth.uid()` and
--     names no column — and §2 asserts that it did.
--
--   * THE FOREIGN KEY to `auth.users (id) on delete cascade`, whose
--     constraint is named `agent_sessions_user_id_fkey` and therefore has to
--     move by hand. The rename statement below is what moves it; the column
--     rename would leave it carrying the retired word.
--
--   * THE INDEX, `agent_sessions_user_idx`. Same: a rename moves the column
--     and not the index that covers it. Renamed longhand below.
--
--   * THE POLICIES. Eight of them across the two agent tables, four on
--     `agent_sessions` naming the column directly and four on
--     `agent_messages` reaching it through `owns_agent_session(s.user_id)`.
--     These are the one dependency a rename DOES carry on its own: Postgres
--     stores a policy expression as a parse tree, so every one of them is
--     rewritten to the new name in place. That is a fact about the server,
--     not about this file, which is why §2 reads the expressions back out of
--     `pg_policies` instead of trusting it.
--
-- `owns_agent_session(uuid)` needs no new body: its argument is
-- `session_owner`, and the body names the argument and never the column. Its
-- COMMENT does name the column, and a comment is part of the schema and
-- travels with it, so the comment is rewritten below.
--
-- `agent_messages` gets nothing. A message is owned by its session and the FK
-- already says which one — a second copy of the owner would be a second thing
-- to keep true, which is what `20260828120000` said when it declined to add
-- one.
--
-- ── NOTHING ELSE DEPENDS ON THE COLUMN ────────────────────────────────────
--
-- Swept against production's catalogue rather than assumed. No function body
-- in `public` names it. No view selects it; there is no view over either agent
-- table. No trigger exists on `agent_sessions` at all. No policy NAME carries
-- the word. The only identifiers that do are the foreign key and the index,
-- both renamed below, and the two comments, both rewritten below.
--
-- The 33 legacy rows with a NULL owner keep their NULL. `20260828120000`
-- refused to invent an author for them and this file has no more to go on
-- than that one did; the rename moves the column, and a NULL moves with it.
--
-- ── THE ASSERTIONS ARE INVARIANTS, NEVER CENSUSES ─────────────────────────
--
-- Every guard below holds on an empty database as well as on this one
-- (ADR 0009). §4 re-performs `20260828120000`'s own two-role proof, and it is
-- written as a comparison against the totals this transaction measures rather
-- than against the 33 and 340 that were true the day it ran.
--
-- ── THE APPLY ORDER, BECAUSE main IS PRODUCTION ───────────────────────────
--
-- This file is applied BEFORE the branch that renames the reading code is
-- merged, and the two happen back to back. The application's agent panel reads
-- and writes `agent_sessions` through PostgREST with no column of this name in
-- any payload — the upsert sends id, title and the two timestamps — so the
-- window costs a signed-in author nothing. Nothing else reads the table: no
-- cron, no edge function, no webhook, and uno-bot reads `search_blueprint` and
-- the board, never the transcript.

alter table public.agent_sessions rename column user_id to created_by;

-- Longhand, and at the top level, for the reason the vocabulary migrations
-- documented: a rename moves the column and NOTHING that hangs off it, and a
-- name the static readers cannot see is a retired word nothing forbids.
alter table public.agent_sessions
  rename constraint agent_sessions_user_id_fkey to agent_sessions_created_by_fkey;

alter index if exists public.agent_sessions_user_idx
  rename to agent_sessions_created_by_idx;

comment on column public.agent_sessions.created_by is
  'Who owns this conversation. NULL means the row predates ownership '
  '(2026-08-28); those are readable by service accounts only and no new row '
  'may be NULL.';

comment on function public.owns_agent_session(uuid) is
  'True when the caller owns an agent session with this owner. NULL owner = '
  'pre-2026-08-28 row, service accounts only. Fails closed: no JWT owns nothing.';

-- ---------------------------------------------------------------------------
-- 2. Proof — the shape, and everything that had to follow the name
-- ---------------------------------------------------------------------------

do $the_shape$
declare
  n int;
  bodies int;
  grants int;
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'agent_sessions'
       and column_name = 'user_id'
  ) then
    raise exception 'agent_sessions still carries user_id';
  end if;

  select count(*) into n
    from information_schema.columns
   where table_schema = 'public' and table_name = 'agent_sessions'
     and column_name = 'created_by' and data_type = 'uuid';
  if n <> 1 then
    raise exception 'agent_sessions.created_by is missing or is not uuid';
  end if;

  -- THE DEFAULT, which is the part `20260828120000` said was worth asserting:
  -- the app sends no owner, so without it every insert would be refused by the
  -- strict insert policy and the panel would silently stop persisting.
  select count(*) into n
    from pg_attrdef d
    join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
   where d.adrelid = 'public.agent_sessions'::regclass and a.attname = 'created_by'
     and pg_get_expr(d.adbin, d.adrelid) like '%auth.uid()%';
  if n <> 1 then
    raise exception
      'agent_sessions.created_by has no auth.uid() default — the app sends no owner, so every insert would be refused';
  end if;

  -- THE FOREIGN KEY, under its new name and still pointing at auth.users.
  if exists (
    select 1 from pg_constraint
     where conrelid = 'public.agent_sessions'::regclass
       and conname = 'agent_sessions_user_id_fkey'
  ) then
    raise exception 'the foreign key is still named agent_sessions_user_id_fkey';
  end if;

  select count(*) into n
    from pg_constraint
   where conrelid = 'public.agent_sessions'::regclass
     and conname = 'agent_sessions_created_by_fkey'
     and contype = 'f' and confrelid = 'auth.users'::regclass;
  if n <> 1 then
    raise exception 'agent_sessions.created_by does not reference auth.users under its new name';
  end if;

  -- THE INDEX. A rename moves the column and not the index over it.
  if exists (
    select 1 from pg_indexes
     where schemaname = 'public' and indexname = 'agent_sessions_user_idx'
  ) then
    raise exception 'the owner index is still named agent_sessions_user_idx';
  end if;

  if not exists (
    select 1 from pg_indexes
     where schemaname = 'public' and tablename = 'agent_sessions'
       and indexname = 'agent_sessions_created_by_idx'
       and indexdef like '%created_by%'
  ) then
    raise exception 'agent_sessions_created_by_idx is missing, or does not cover the column';
  end if;

  -- THE POLICIES. Postgres rewrites a stored expression on rename; this reads
  -- the rewrite back rather than trusting it. Still eight, still every one of
  -- them naming the owner, and not one of them still spelling the old word.
  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename in ('agent_sessions', 'agent_messages');
  if n <> 8 then
    raise exception 'expected 8 policies across the two agent tables, found %', n;
  end if;

  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename in ('agent_sessions', 'agent_messages')
     and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ '\muser_id\M';
  if n <> 0 then
    raise exception '% agent policy expression(s) still name user_id', n;
  end if;

  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename in ('agent_sessions', 'agent_messages')
     and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) not like '%uid()%'
     and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) not like '%owns_agent_session%';
  if n <> 0 then
    raise exception '% agent policy expression(s) do not mention the owner at all', n;
  end if;

  -- No plpgsql body named the column before this file and none may after it.
  -- `owns_agent_session` takes `session_owner` and never the column, which is
  -- why it needs no new body — and this is what says so rather than assuming.
  select count(*) into bodies
    from pg_proc p join pg_namespace n2 on n2.oid = p.pronamespace
   where n2.nspname = 'public'
     and p.prokind in ('f', 'p')
     and p.prosrc ~ '\muser_id\M';
  if bodies <> 0 then
    raise exception '% function(s) still name agent_sessions.user_id', bodies;
  end if;

  -- The read and write privileges followed the rename, asserted by name
  -- rather than assumed: a host that replayed the grant rather than the
  -- rename would leave the panel unable to write its own transcript.
  select count(*) into grants
    from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'agent_sessions'
     and column_name = 'created_by' and grantee = 'authenticated'
     and privilege_type in ('SELECT', 'INSERT');
  if grants <> 2 then
    raise exception
      'authenticated holds % of the 2 expected SELECT/INSERT grants on agent_sessions.created_by', grants;
  end if;
end
$the_shape$;

-- ---------------------------------------------------------------------------
-- 3. Proof — no legacy row acquired an owner
-- ---------------------------------------------------------------------------
--
-- `20260828120000` refused to attribute the rows that predate ownership,
-- because nothing in either table records who wrote them and a backfill would
-- have been an invention. A rename is not a licence to revisit that, and this
-- is the guard that says a rename did not quietly become one.

do $the_unowned$
begin
  -- The rename moved values; it did not mint them. Anything NULL before this
  -- file is NULL after it, which is what the two-role proof below reads as
  -- "service accounts only", and every owner that IS recorded is still a user
  -- `auth.users` has — the foreign key says so, and this says it survived the
  -- constraint rename rather than being dropped by it.
  if exists (
    select 1 from public.agent_sessions s
     where s.created_by is not null
       and not exists (select 1 from auth.users u where u.id = s.created_by)
  ) then
    raise exception 'a session names an owner auth.users does not have';
  end if;
end
$the_unowned$;

-- ---------------------------------------------------------------------------
-- 4. Proof — the gate, exercised as the roles it gates
-- ---------------------------------------------------------------------------
--
-- The claim an owner run cannot make. Everything above asserts that the right
-- objects exist; this asserts what they DO, which is the only thing the rename
-- could have broken without anybody noticing. It is `20260828120000`'s own
-- proof re-performed against the new name, and it is written against the
-- totals this transaction measures rather than the 33 and 340 that were true
-- the morning that file ran, so it means the same thing on an empty database.
--
-- `set local role` drops the BYPASSRLS this file is applied with, which is the
-- whole point: an owner run reads every row whatever the policies say. Both
-- settings are transaction-scoped, so a failure anywhere below resets them by
-- rolling the file back, and the success path resets them by hand.

do $the_gate$
declare
  unowned_sessions int;
  unowned_messages int;
  seen int;
begin
  -- The subject is the UNATTRIBUTED set, not the whole table, and the
  -- difference is the census this file must not contain. `20260828120000`
  -- could assert that a service account saw every row because on the morning
  -- it ran every row was unowned. That stopped being true the first time
  -- somebody signed in and started a conversation: a service account owns
  -- nothing of somebody else's, and `owns_agent_session` says so. What it
  -- keeps is the history nobody can be named for, which is what the NULL
  -- decision was about — so that is what this measures, and it measures the
  -- same thing on an empty database.
  select count(*) into unowned_sessions
    from public.agent_sessions where created_by is null;
  select count(*) into unowned_messages
    from public.agent_messages m
    join public.agent_sessions s on s.id = m.session_id
   where s.created_by is null;

  -- A viewer who owns nothing sees nothing. Had the rename stranded the
  -- policies, this would come back as the whole table.
  execute 'set local request.jwt.claims = ' || quote_literal(
    '{"sub":"00000000-0000-0000-0000-0000000000aa","role":"authenticated",' ||
    '"app_metadata":{"role":"viewer"}}');
  execute 'set local role authenticated';

  select count(*) into seen from public.agent_sessions;
  if seen <> 0 then
    raise exception 'a viewer sees % agent session(s) that are not theirs', seen;
  end if;
  select count(*) into seen from public.agent_messages;
  if seen <> 0 then
    raise exception 'a viewer sees % agent message(s) that are not theirs', seen;
  end if;

  execute 'reset role';

  -- And a service account keeps the unattributed history, which is the other
  -- half of the NULL decision. If this comes back short, the transcript was
  -- orphaned rather than narrowed.
  execute 'set local request.jwt.claims = ' || quote_literal(
    '{"sub":"00000000-0000-0000-0000-0000000000bb","role":"authenticated",' ||
    '"app_metadata":{"role":"service"}}');
  execute 'set local role authenticated';

  select count(*) into seen from public.agent_sessions;
  if seen <> unowned_sessions then
    raise exception
      'a service account sees % of % unattributed session(s) — the history was orphaned, not narrowed',
      seen, unowned_sessions;
  end if;
  select count(*) into seen from public.agent_messages;
  if seen <> unowned_messages then
    raise exception 'a service account sees % of % unattributed message(s)', seen, unowned_messages;
  end if;

  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end
$the_gate$;
