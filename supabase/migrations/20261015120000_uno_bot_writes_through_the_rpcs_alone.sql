-- 20261015120000 — uno-bot writes through the authoring RPCs, and nowhere else.
--
-- THE SLACK BOT IS GETTING A PEN, AND THE PEN HAS TO BE NARROWER THAN A HUMAN'S.
--
-- uno-bot (the plus-uno Slack Worker) drafts blueprint revisions when a Roadmap
-- card ships, and drafts an idea as `proposed` rows once its requester says
-- yes. Until now it could only read, with the anon key. Writing needs an
-- identity, and the two identities this project already has are both wrong:
--
--   * the SERVICE-ROLE KEY bypasses every policy and every guard below. It
--     belongs on no Worker, and nothing it writes says who wrote it.
--   * a SERVICE ACCOUNT (`app_metadata.role = 'service'`) passes the RPC tier
--     guards AND the restrictive `*_service_only` policies, so it could also
--     write any panel column straight into a table, unrecorded.
--
-- So uno-bot gets a third tier, `app_metadata.role = 'rpc_writer'`: an
-- ordinary Auth user whose JWT opens the SECURITY DEFINER authoring RPCs and
-- nothing else. Every write it makes is an operation, every operation is in
-- `authoring_changes`, and the row says `author = 'uno-bot'` with the bot's
-- own account as `author_id`.
--
-- ---------------------------------------------------------------------------
-- HOW ONE CLAIM OPENS THE RPCS AND NOT THE TABLES
-- ---------------------------------------------------------------------------
--
-- `is_service_account()` is the one gate both walls ask: every authoring RPC
-- body asserts it (20260805170000), and every restrictive write policy is
-- AND-ed on it (20260805150000). The two callers differ in one observable
-- way. A policy is evaluated as the requesting role — `current_user` is
-- `authenticated`. An RPC body is SECURITY DEFINER — `current_user` is the
-- function's owner. So for an `rpc_writer` the gate answers true only when it
-- is asked from inside a definer function:
--
--   PATCH /rest/v1/cells        current_user = authenticated  → false, 0 rows
--   POST  /rest/v1/rpc/add_step current_user = postgres       → true
--
-- That covers every authoring RPC this database has, today and as they are
-- added, without rewriting forty bodies. It fails CLOSED in both directions
-- that matter: a SECURITY INVOKER write path refuses the bot (its body runs
-- as `authenticated`), and a later migration that redefines
-- `is_service_account()` without this clause takes the bot's pen away rather
-- than widening it. Storage policies run as `authenticated` too, so the bot
-- uploads nothing.
--
-- ---------------------------------------------------------------------------
-- WHAT ELSE IT ADDS, AND WHY EACH IS HERE
-- ---------------------------------------------------------------------------
--
-- THE BOT DELETES, AND SAYS SO. Bill's call (2026-10-15): uno-bot may delete,
-- as a human service account may, through the same delete RPCs. Those six
-- functions write their own `authoring_changes` row and have always stamped it
-- `author = 'human'`, because they cannot see who called. So the log gets a
-- third author, `uno-bot`, and a BEFORE INSERT trigger stamps it on every row
-- appended under an `rpc_writer` JWT — the delete functions' rows, the two
-- RPCs below, and the bot's own `record_authoring_change` calls alike. The
-- same trigger refuses `uno-bot` from anyone else, so the tier cannot be
-- claimed by passing the word. A bot row may name an agent session (the Slack
-- card it belongs to) and need not: a delete RPC has no way to pass one.

-- A STATUS IS WRITTEN BY AN RPC. No authoring RPC writes `status` today — the
-- panel sets it through a column grant — and `upsert_cell` inserts at the
-- column default, `live`. A bot that drafted a `proposed` cell with it would
-- publish it as live for the length of a second request, and for ever if the
-- second request failed. `upsert_cell_at_status` writes content and status in
-- one statement; `set_path_status` does the same for a path, whose create
-- RPC also defaults to `live`.
--
-- BOTH NEW RPCS RECORD THEMSELVES. A client RPC is recorded by the client
-- calling `record_authoring_change` afterwards. The Worker runs under a
-- 50-subrequest cap, and a write whose record is a second request is a write
-- that can land unrecorded. So these two append their own row in the same
-- transaction: `agent` when a session id is passed, `human` when not, and the
-- trigger turns either into `uno-bot` under the bot's JWT. No caller appends
-- for them; were the canvas ever to call them, they belong in its
-- `ARCHIVED_BY_THE_DATABASE` set.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS DELIBERATELY DOES NOT DO
-- ---------------------------------------------------------------------------
--
-- IT STAYS IN THIS DEPLOYMENT. The `uno-bot` author, the tier and the two
-- RPCs are this deployment's (Bill, 2026-10-15: not the template's yet). The
-- application never reads `authoring_changes` — its change list is the
-- in-memory session stack — so a third author value reaches no code it ships.
--
-- IT DOES NOT RECORD THE OLDER RPCS FOR THE BOT. `add_step`, `create_path`
-- and the rest still leave their record to the caller, so a Worker that calls
-- one also calls `record_authoring_change`, exactly as the canvas does.
--
-- IT DOES NOT CREATE THE ACCOUNT. Auth users are made in the dashboard, by a
-- person. The update at the end grants the claim to the address the setup
-- wizard (plus-uno, `agents/uno-bot/scripts/blueprint-writer-wizard.sh`)
-- creates; on a database without that user it updates nothing.

-- ---------------------------------------------------------------------------
-- The gate.
-- ---------------------------------------------------------------------------
create or replace function public.is_service_account()
returns boolean
language sql
stable
set search_path = pg_catalog, pg_temp
as $$
  select case (auth.jwt() -> 'app_metadata' ->> 'role')
    when 'service' then true
    -- Inside a SECURITY DEFINER body current_user is the owner; in a policy
    -- it is the requesting role. Only the first may pass an rpc_writer.
    when 'rpc_writer' then current_user not in ('authenticated', 'anon')
    else false
  end
$$;

comment on function public.is_service_account() is
  'True when the JWT app_metadata.role is service, or is rpc_writer and the caller is a SECURITY DEFINER body (current_user is not a client role). So an rpc_writer passes every authoring RPC guard and no write policy. Set via auth.users.raw_app_meta_data — users cannot self-assign (user_metadata is ignored on purpose).';

-- Only the write policies for `authenticated` and the definer bodies ask it.
-- A new function in `public` arrives executable by anon, and `from public`
-- does not take that away, so anon is named.
revoke execute on function public.is_service_account() from public, anon;
grant execute on function public.is_service_account() to authenticated;

-- ---------------------------------------------------------------------------
-- The log's third author.
-- ---------------------------------------------------------------------------
alter table public.authoring_changes
  drop constraint authoring_changes_author_check,
  add constraint authoring_changes_author_check
    check (author in ('human', 'agent', 'uno-bot'));

-- Was a biconditional, author = 'agent' iff a session. It still holds for
-- those two; a `uno-bot` row may carry the Slack card's session or none,
-- because the delete functions that append for it cannot pass one.
alter table public.authoring_changes
  drop constraint authoring_changes_agent_session_check,
  add constraint authoring_changes_agent_session_check
    check (case author
             when 'agent' then agent_session_id is not null
             when 'human' then agent_session_id is null
             else true
           end);

comment on column public.authoring_changes.author is
  'Who wrote it: human, agent (the in-app agent, under a human''s session), or uno-bot (the plus-uno Slack Worker, its rpc_writer account). uno-bot is stamped by a trigger from the JWT and cannot be claimed by anyone else.';

create or replace function public.authoring_changes_name_uno_bot()
returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $$
begin
  if (auth.jwt() -> 'app_metadata' ->> 'role') = 'rpc_writer' then
    new.author := 'uno-bot';
    new.author_id := auth.uid();
  elsif new.author = 'uno-bot' then
    raise exception 'Only the uno-bot account writes as uno-bot'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

comment on function public.authoring_changes_name_uno_bot() is
  'Stamps author = uno-bot (and author_id) on every authoring_changes row appended under an rpc_writer JWT, whichever function appends it, and refuses uno-bot from any other caller.';

drop trigger if exists authoring_changes_name_uno_bot on public.authoring_changes;
create trigger authoring_changes_name_uno_bot
  before insert on public.authoring_changes
  for each row execute function public.authoring_changes_name_uno_bot();

-- A trigger fires whatever the caller's EXECUTE; nobody calls this directly.
revoke execute on function public.authoring_changes_name_uno_bot() from public, anon;

-- ---------------------------------------------------------------------------
-- A cell at a status, in one write.
-- ---------------------------------------------------------------------------
create or replace function public.upsert_cell_at_status(
  path_id uuid,
  lane_id uuid,
  step_id uuid,
  content text,
  status public.entity_status,
  agent_session_id uuid default null
)
returns jsonb
language plpgsql security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  previous public.cells;
  written_id uuid;
  was_inserted boolean;
  next_column int;
  change_id uuid;
begin
  if not public.is_service_account() then
    raise exception 'This account cannot edit the blueprint'
      using errcode = '42501';
  end if;
  if upsert_cell_at_status.status is null then
    raise exception 'A cell written at a status has to name the status'
      using errcode = '22004';
  end if;

  -- The same placement `upsert_cell` makes: a step the path does not yet show
  -- joins it at the end.
  if not exists (
    select 1 from public.path_steps ps
    where ps.path_id = upsert_cell_at_status.path_id
      and ps.step_id = upsert_cell_at_status.step_id
  ) then
    select coalesce(max(position) + 1, 0) into next_column
    from public.path_steps where path_steps.path_id = upsert_cell_at_status.path_id;
    insert into public.path_steps (path_id, step_id, position)
    values (upsert_cell_at_status.path_id, upsert_cell_at_status.step_id, next_column);
  end if;

  -- Before the write, and locked, for the reason `upsert_cell` gives.
  select c.* into previous
    from public.cells c
   where c.lane_id = upsert_cell_at_status.lane_id
     and c.step_id = upsert_cell_at_status.step_id
     and c.position = 0
   for update;

  insert into public.cells (path_id, lane_id, step_id, position, content, status, origin, cell_key)
  values (upsert_cell_at_status.path_id, upsert_cell_at_status.lane_id,
          upsert_cell_at_status.step_id, 0,
          coalesce(upsert_cell_at_status.content, ''), upsert_cell_at_status.status, 'app',
          public.mint_cell_key(upsert_cell_at_status.path_id, upsert_cell_at_status.lane_id,
                               upsert_cell_at_status.step_id))
  on conflict on constraint cells_lane_step_slot_unique
    do update set content = excluded.content, status = excluded.status
  returning id, (xmax = 0) into written_id, was_inserted;

  insert into public.authoring_changes (fn, args, revert, author, agent_session_id)
  values (
    'upsert_cell_at_status',
    jsonb_build_object(
      'path_id', upsert_cell_at_status.path_id,
      'lane_id', upsert_cell_at_status.lane_id,
      'step_id', upsert_cell_at_status.step_id,
      'content', coalesce(upsert_cell_at_status.content, ''),
      'status', upsert_cell_at_status.status),
    case
      -- A new cell is undone by deleting it, which a human does.
      when was_inserted or previous.id is null then
        jsonb_build_object('fn', 'delete_cell', 'args', jsonb_build_object('cell_id', written_id))
      -- The two columns this write set, and no others.
      else jsonb_build_object('fn', 'upsert_cell_at_status', 'args', jsonb_build_object(
        'path_id', upsert_cell_at_status.path_id,
        'lane_id', upsert_cell_at_status.lane_id,
        'step_id', upsert_cell_at_status.step_id,
        'content', previous.content,
        'status', previous.status))
    end,
    case when upsert_cell_at_status.agent_session_id is null then 'human' else 'agent' end,
    upsert_cell_at_status.agent_session_id
  )
  returning id into change_id;

  return jsonb_build_object(
    'id', written_id,
    'inserted', was_inserted,
    'change_id', change_id,
    'previous',
    case
      when was_inserted or previous.id is null then null
      else jsonb_build_object('id', previous.id, 'content', previous.content, 'status', previous.status)
    end);
end;
$$;

comment on function public.upsert_cell_at_status(uuid, uuid, uuid, text, public.entity_status, uuid) is
  'upsert_cell plus the status, in one statement, so a drafted cell is never live for a moment. Appends its own authoring_changes row in the same transaction (agent with a session id, human without; uno-bot under its JWT) — callers do not record it.';

-- ---------------------------------------------------------------------------
-- A path's status, in one write.
-- ---------------------------------------------------------------------------
create or replace function public.set_path_status(
  path_id uuid,
  status public.entity_status,
  agent_session_id uuid default null
)
returns jsonb
language plpgsql security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  previous_status text;
  change_id uuid;
begin
  if not public.is_service_account() then
    raise exception 'This account cannot edit the blueprint'
      using errcode = '42501';
  end if;
  if set_path_status.status is null then
    raise exception 'A path written at a status has to name the status'
      using errcode = '22004';
  end if;

  select p.status into previous_status
    from public.paths p where p.id = set_path_status.path_id
    for update;
  if not found then
    raise exception 'No path %', set_path_status.path_id using errcode = 'P0002';
  end if;

  update public.paths p
     set status = set_path_status.status, updated_at = now()
   where p.id = set_path_status.path_id;

  insert into public.authoring_changes (fn, args, revert, author, agent_session_id)
  values (
    'set_path_status',
    jsonb_build_object('path_id', set_path_status.path_id, 'status', set_path_status.status),
    jsonb_build_object('fn', 'set_path_status', 'args',
      jsonb_build_object('path_id', set_path_status.path_id, 'status', previous_status)),
    case when set_path_status.agent_session_id is null then 'human' else 'agent' end,
    set_path_status.agent_session_id
  )
  returning id into change_id;

  return jsonb_build_object(
    'id', set_path_status.path_id,
    'change_id', change_id,
    'previous', jsonb_build_object('status', previous_status));
end;
$$;

comment on function public.set_path_status(uuid, public.entity_status, uuid) is
  'Sets one path''s status. Appends its own authoring_changes row in the same transaction (agent with a session id, human without; uno-bot under its JWT) — callers do not record it.';

revoke execute on function public.upsert_cell_at_status(uuid, uuid, uuid, text, public.entity_status, uuid)
  from public, anon;
revoke execute on function public.set_path_status(uuid, public.entity_status, uuid)
  from public, anon;
grant execute on function public.upsert_cell_at_status(uuid, uuid, uuid, text, public.entity_status, uuid)
  to authenticated;
grant execute on function public.set_path_status(uuid, public.entity_status, uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- The account. Vacuous on a database without it.
-- ---------------------------------------------------------------------------
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || '{"role":"rpc_writer"}'::jsonb
where email = 'uno-bot@uno-blueprint.local';

-- ---------------------------------------------------------------------------
-- The gate, asked both ways. No row is read, so this holds on an empty replay.
-- ---------------------------------------------------------------------------
do $$
declare
  as_definer boolean;
  as_client boolean;
  service_as_client boolean;
begin
  perform set_config('request.jwt.claims', '{"app_metadata":{"role":"rpc_writer"}}', true);
  as_definer := public.is_service_account();
  execute 'set local role authenticated';
  as_client := public.is_service_account();
  perform set_config('request.jwt.claims', '{"app_metadata":{"role":"service"}}', true);
  service_as_client := public.is_service_account();
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);

  if not as_definer then
    raise exception 'an rpc_writer must pass the gate inside a definer body';
  end if;
  if as_client then
    raise exception 'an rpc_writer must not pass the gate a write policy asks';
  end if;
  if not service_as_client then
    raise exception 'a service account must still pass the gate a write policy asks';
  end if;
end $$;
