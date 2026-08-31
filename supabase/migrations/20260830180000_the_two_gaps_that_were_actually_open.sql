-- 20260830180000 — the two gaps that were actually open, and the one that was not.
--
-- #174 named three integrity gaps. Asked of production on 2026-08-30, one of
-- them was already closed and had been for nine days, and one of the other two
-- was closed in the direction anybody would think to test and wide open in the
-- direction nobody does. Both facts are recorded here, because a migration
-- that quietly did two thirds of what its ticket said would leave the next
-- reader believing the third had been done too.
--
-- ── The gap that was already closed: cells.status and paths.status ─────────
--
-- The ticket says both columns "accept any string, while every sibling
-- classifier in the schema has a CHECK". They do not. Both carry the
-- `public.entity_status` DOMAIN, created by `20260821240000_status_not_maturity.sql`
-- with `check (value in ('proposed','planned','built','live','at_risk','deprecated'))`,
-- and both refuse anything else:
--
--   update public.cells set status = 'banana' where id = (select id from public.cells limit 1);
--   ERROR:  value for domain entity_status violates check constraint "entity_status_check"
--
-- The reason this looked like a gap is worth writing down, because it will
-- look like one again. A domain constraint does not appear in `pg_constraint`
-- against the table — it hangs off the TYPE — so every sweep that enumerates a
-- table's CHECK constraints reports `cells.status` as unconstrained and is
-- telling the truth about the wrong object. `\d public.cells` shows the same
-- thing: three check constraints listed, none of them about status.
--
-- So nothing is added here. A table-level CHECK repeating the domain's six
-- values would enforce nothing that is not already enforced and would give the
-- vocabulary a second home to drift from — which is the failure this whole
-- batch of tickets exists to end, not a way to close it. What IS added is the
-- assertion, below: the domain is proved to reject, and proved to admit
-- exactly the six values `src/lib/entityStatus.ts` offers in the panel's
-- dropdown. Both cells and paths use that dropdown, which is also why the
-- constraint could never have been narrowed to the three and two values
-- production happens to hold today — an author picking `planned` would have
-- been refused by the database for choosing a legal option.
--
-- ── The gap that was half open: a cell's path and its lane's path ──────────
--
-- The ticket says the two are stored side by side "with nothing keeping them
-- in agreement", and that 935 rows agree "by luck". There are 931 cells as of
-- this file, and they do not agree by luck.
-- `cells_validate_path_match`, a BEFORE INSERT OR UPDATE trigger present since
-- the very first migration (`20250603120000_service_blueprint.sql`), refuses
-- any cell whose `path_id` differs from its lane's, and refuses one whose step
-- is not on that path either:
--
--   update public.cells set path_id = <some other path> where id = <any cell>;
--   ERROR:  cells.path_id must match lanes.path_id
--
-- But a trigger on `cells` only ever sees writes to `cells`. Move the LANE and
-- nothing looks at all:
--
--   update public.lanes set path_id = <another path> where id = <a lane with cells>;
--   UPDATE 1
--   select count(*) from public.cells c join public.lanes l on l.id = c.lane_id
--    where c.path_id <> l.path_id;                                          -- 19
--
-- Nineteen cells, silently on a path their lane is not on, from one statement
-- that raised nothing. That is the half this file closes, and it is the half a
-- trigger cannot close without a second trigger on a second table — two
-- objects that have to keep agreeing with each other, which is the shape that
-- produced the drift in the first place. A composite foreign key is one object
-- and the database maintains it in both directions.
--
-- HOW REACHABLE IS IT? Not from the app today, and that is not a reason to
-- leave it. `authenticated` holds column-level UPDATE grants on `lanes` for
-- `name`, `lane_role`, `owner_team`, `kpis`, `tools` and `stakeholder_id`, and
-- `path_id` is not among them, so PostgREST cannot issue this statement. What
-- can is every one of the 21 SECURITY DEFINER authoring RPCs, which bypass RLS
-- and grants by definition, the `postgres` role, the service key, and any
-- future migration. Four of those five are how every other silent write in
-- this repository has happened.
--
-- ON UPDATE IS LEFT AT NO ACTION — the lane move is REFUSED, not cascaded.
-- Cascading would look tidier and would be wrong: it would rewrite the cells'
-- `path_id` behind the author's back, and each rewritten cell would then have
-- to satisfy the other half of `cells_validate_path_match`, which requires its
-- step to be linked to the new path in `path_steps`. A cascade would therefore
-- succeed or fail depending on data the person issuing the UPDATE was not
-- thinking about. Refusing says the true thing: a lane full of cells does not
-- move between paths by having one column edited. Nothing in this repository
-- has ever issued such an UPDATE — no migration in the series writes
-- `lanes.path_id` after the row is created, and no RPC does either — so the
-- refusal costs nothing that exists.
--
-- ── The gap that was open: stakeholders' policy shape ──────────────────────
--
-- Every other table in this schema pairs a PERMISSIVE policy that admits the
-- write with a RESTRICTIVE `is_service_account()` companion that gates it.
-- `stakeholders` has three PERMISSIVE policies with the call inline and no
-- companion at all. Today that is equally closed — permissive policies OR, and
-- there is only one per command, and it carries the gate — and
-- `scripts/check-rls-posture.mjs` knows the shape and does not report it.
--
-- What it is not is durable. Add a second permissive policy for any reason —
-- "let an author fix a typo in a stakeholder's name" — and it ORs with the
-- first, and `stakeholders` is open to every authenticated session while the
-- other seventeen tables stay shut against the identical edit. The restrictive
-- companion is what makes that impossible: restrictive policies AND, so the
-- gate survives any number of permissive policies added later by anyone.
--
-- The rewrite below is exactly effect-neutral. `(true) AND is_service_account()`
-- is `is_service_account()`; the same callers succeed and the same callers are
-- refused, on all three commands. Only the algebra changes, and the algebra is
-- the point.
--
-- INSERT, UPDATE AND DELETE, not just the UPDATE the ticket names. All three
-- carry the same shape and all three would open the same way, and a file that
-- fixed one of three would leave `check-rls-posture.mjs` unable to say whether
-- the remaining two were an oversight or a decision.
--
-- ── Why the policy work is inside a DO block and the foreign key is not ────
--
-- `20260820170000_stakeholders.sql` creates that table, seeds six rows from
-- production-only sources and asserts six, so against an empty database the
-- assertion raises and takes the `create table` with it.
-- `docs/reference/migration-replay-baseline.json` records it as failing for
-- that reason. `create policy` has no `if exists`, and neither does `drop
-- policy … on <table>` where the TABLE is what is missing — verified, it
-- raises 42P01 — so a top-level statement here would be a NEW entry in a
-- baseline that may only shrink.
--
-- `20260830170000_a_stakeholder_definition_is_a_summary.sql` names the cost of
-- the `to_regclass` wrapper and it applies here unchanged:
-- `scripts/migration-replay.mjs` models this series statically and treats every
-- dollar-quoted body as opaque text, so DDL inside a DO block is invisible to
-- it — including its `create policy` tracking. The three policy names added
-- below will not appear in that model. The alternative was not adding them.
--
-- `cells` and `lanes` both survive an empty replay, so the foreign key and the
-- unique key it needs stay at the top level where the model can see them.

-- ── 1. The key a composite foreign key needs ───────────────────────────────
--
-- A foreign key must reference a UNIQUE or PRIMARY key, and (id, path_id) is
-- not one today even though `id` alone is the primary key and therefore makes
-- the pair unique on its own. Postgres will not infer that; it matches the
-- referenced column list against a declared constraint. So this is a redundant
-- index in every sense except the one that matters, which is that without it
-- the next statement cannot be written at all.

alter table public.lanes
  drop constraint if exists lanes_id_path_unique;
alter table public.lanes
  add constraint lanes_id_path_unique unique (id, path_id);

comment on constraint lanes_id_path_unique on public.lanes is
  'Exists only so cells can reference (id, path_id) together. Implied by the primary key on id, which Postgres will not infer for a foreign key''s referenced column list.';

-- ── 2. A cell is on its lane's path, by rule ───────────────────────────────
--
-- ON DELETE CASCADE matches `cells_lane_id_fkey`, which already cascades from
-- the same parent row: deleting a lane deletes its cells today, and this must
-- not be the constraint that starts refusing that. The two cascades agree on
-- every row because they select the same rows.

alter table public.cells
  drop constraint if exists cells_path_matches_lane_fkey;
alter table public.cells
  add constraint cells_path_matches_lane_fkey
    foreign key (lane_id, path_id) references public.lanes (id, path_id)
    on delete cascade;

comment on constraint cells_path_matches_lane_fkey on public.cells is
  'A cell''s path is its lane''s path, enforced from both sides. cells_validate_path_match already refused the cell-side write; nothing refused moving the lane, which silently put 19 cells on a path their lane had left.';

-- ── 3. Stakeholders joins the permissive-plus-restrictive pair ─────────────
--
-- Per command: the old permissive gate goes, a restrictive companion carrying
-- the same call takes its place, and a permissive `true` policy admits the
-- write for the companion to gate. The order is deliberate even though this
-- all commits at once — at no point between statements is the table more open
-- than it was when the block started.

do $policies$
begin
  if to_regclass('public.stakeholders') is null then
    raise notice 'public.stakeholders is absent — the policy pair has nothing to apply to.';
    return;
  end if;

  execute 'drop policy if exists stakeholders_insert_service_only on public.stakeholders';
  execute 'drop policy if exists stakeholders_update_service_only on public.stakeholders';
  execute 'drop policy if exists stakeholders_delete_service_only on public.stakeholders';
  execute 'drop policy if exists stakeholders_insert_auth on public.stakeholders';
  execute 'drop policy if exists stakeholders_update_auth on public.stakeholders';
  execute 'drop policy if exists stakeholders_delete_auth on public.stakeholders';

  execute 'create policy stakeholders_insert_service_only on public.stakeholders'
       || ' as restrictive for insert to authenticated'
       || ' with check (public.is_service_account())';
  execute 'create policy stakeholders_update_service_only on public.stakeholders'
       || ' as restrictive for update to authenticated'
       || ' using (public.is_service_account())'
       || ' with check (public.is_service_account())';
  execute 'create policy stakeholders_delete_service_only on public.stakeholders'
       || ' as restrictive for delete to authenticated'
       || ' using (public.is_service_account())';

  execute 'create policy stakeholders_insert_auth on public.stakeholders'
       || ' for insert to authenticated with check (true)';
  execute 'create policy stakeholders_update_auth on public.stakeholders'
       || ' for update to authenticated using (true) with check (true)';
  execute 'create policy stakeholders_delete_auth on public.stakeholders'
       || ' for delete to authenticated using (true)';
end
$policies$;

-- ── 4. The status vocabulary, proved rather than repeated ──────────────────
--
-- Nothing above touched status. This block is the evidence for the paragraph
-- at the top of the file: the domain rejects, and it admits exactly what the
-- panel offers. Both halves are needed. A domain that rejects everything would
-- pass the first on its own and make every author's save fail.

do $status$
declare
  accepted boolean;
  rejected text[] := '{}';
  offered  text[] := array['proposed','planned','built','live','at_risk','deprecated'];
  rung     text;
begin
  if to_regtype('public.entity_status') is null then
    raise notice 'public.entity_status is absent — 20260821240000 did not replay here.';
    return;
  end if;

  -- 1. IT REJECTS. Performed, not read off the catalog: a constraint whose
  -- text looks right and whose enforcement has been dropped reads identically.
  accepted := true;
  begin
    perform 'banana'::public.entity_status;
  exception when check_violation then
    accepted := false;
  end;
  if accepted then
    raise exception 'public.entity_status accepted a value outside its vocabulary';
  end if;

  -- 2. AND IT ADMITS THE SIX THE PANEL OFFERS. `StatusSelect` renders one
  -- option per entry in ENTITY_STATUS, for cells and for paths alike, so a
  -- value missing here is a dropdown entry that fails at save time — the
  -- reason this constraint was never narrowed to the values production holds.
  foreach rung in array offered loop
    begin
      execute 'select $1::public.entity_status' using rung;
    exception when check_violation then
      rejected := rejected || rung;
    end;
  end loop;
  if array_length(rejected, 1) is not null then
    raise exception
      'public.entity_status rejects %, which src/lib/entityStatus.ts offers in the panel',
      array_to_string(rejected, ', ');
  end if;
end
$status$;

-- ── 5. The lane cannot leave its cells behind ──────────────────────────────
--
-- Shape first, then the behaviour, performed on a fixture built inside this
-- block and rolled back by the sentinel at the end of it. Nothing here touches
-- a real row and nothing survives the migration.
--
-- The fixture is what makes this survive an empty replay without going
-- vacuous. An assertion phrased over existing rows would have nothing to look
-- at on a fresh database and would pass by examining zero cells; this one
-- builds the two paths, the lane and the cell it needs, and is exactly as
-- strong on an empty database as on production.

do $lane$
declare
  cols     text;
  confupd  "char";
  svc      uuid;
  phase    uuid;
  scen     uuid;
  path_a   uuid;
  path_b   uuid;
  stp      uuid;
  lane_a   uuid;
  cell_a   uuid;
  moved    boolean := false;
  refused_lane boolean := false;
  refused_cell boolean := false;
  msg      text;
begin
  -- 1. THE FOREIGN KEY EXISTS, OVER THE RIGHT COLUMNS IN THE RIGHT ORDER.
  -- (path_id, lane_id) referencing (path_id, id) would be a different rule
  -- that happens to hold on the same data.
  select string_agg(a.attname, ',' order by k.ord) into cols
  from pg_constraint c
  join pg_class t     on t.oid = c.conrelid
  join pg_namespace s on s.oid = t.relnamespace
  cross join lateral unnest(c.conkey) with ordinality as k(attnum, ord)
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
  where s.nspname = 'public' and t.relname = 'cells'
    and c.conname = 'cells_path_matches_lane_fkey';
  if cols is distinct from 'lane_id,path_id' then
    raise exception 'cells_path_matches_lane_fkey covers (%), expected (lane_id,path_id)',
      coalesce(cols, 'nothing — the constraint is not there');
  end if;

  select string_agg(a.attname, ',' order by k.ord) into cols
  from pg_constraint c
  cross join lateral unnest(c.confkey) with ordinality as k(attnum, ord)
  join pg_attribute a on a.attrelid = c.confrelid and a.attnum = k.attnum
  where c.conname = 'cells_path_matches_lane_fkey';
  if cols is distinct from 'id,path_id' then
    raise exception 'cells_path_matches_lane_fkey references (%), expected lanes (id,path_id)', cols;
  end if;

  -- 2. AND IT REFUSES THE UPDATE RATHER THAN CASCADING IT. `c` is NO ACTION.
  -- A cascade here would rewrite cells behind the author and is argued against
  -- at the top of this file; it would also pass every shape check above.
  select c.confupdtype into confupd
  from pg_constraint c where c.conname = 'cells_path_matches_lane_fkey';
  if confupd <> 'a' then
    raise exception
      'cells_path_matches_lane_fkey has ON UPDATE %, expected NO ACTION', confupd;
  end if;

  -- 3. THE BEHAVIOUR, PERFORMED.
  begin
    insert into public.services (name)
      values ('issue-174 fixture') returning id into svc;
    insert into public.phases (service_id, name, position)
      values (svc, 'fixture phase', 0) returning id into phase;
    insert into public.scenarios (phase_id, name, position)
      values (phase, 'fixture scenario', 0) returning id into scen;
    insert into public.paths (scenario_id, name, path_type)
      values (scen, 'fixture path A', 'happy') returning id into path_a;
    insert into public.paths (scenario_id, name, path_type)
      values (scen, 'fixture path B', 'variant') returning id into path_b;
    insert into public.steps (scenario_id, name)
      values (scen, 'fixture step') returning id into stp;
    insert into public.path_steps (path_id, step_id, position)
      values (path_a, stp, 0);
    insert into public.lanes (path_id, name, position)
      values (path_a, 'fixture lane', 0) returning id into lane_a;
    insert into public.cells (path_id, lane_id, step_id, content)
      values (path_a, lane_a, stp, 'fixture cell') returning id into cell_a;

    -- 3a. THE CELL SIDE. Already refused before this migration, by
    -- `cells_validate_path_match` — asserted here because #174 asks for it and
    -- because a trigger someone drops in passing would take the rule with it.
    -- The trigger fires BEFORE the foreign key is consulted, so this proves
    -- the rule rather than proving which gate holds it. Hence `when others`
    -- and a flag set on the success path: the trigger raises P0001, which is
    -- also what a `raise exception` inside the handler would be, and a handler
    -- that cannot tell the two apart reports the failure as the pass.
    begin
      update public.cells set path_id = path_b where id = cell_a;
    exception when others then
      refused_cell := true;
    end;
    if not refused_cell then
      raise exception 'a cell moved to a path its lane is not on';
    end if;

    -- 3b. THE LANE SIDE, which is what this migration adds. Before the
    -- foreign key above, this statement reported UPDATE 1 and left the cell
    -- behind on path A with nothing raised anywhere. The error class is
    -- narrowed here because there is exactly one gate to prove.
    begin
      update public.lanes set path_id = path_b where id = lane_a;
    exception when foreign_key_violation then
      refused_lane := true;
    end;
    if not refused_lane then
      raise exception 'a lane with cells on it moved to another path';
    end if;

    -- 3c. AND AN EMPTY LANE STILL MOVES. Without this the two assertions
    -- above are satisfied by a constraint that forbids the column outright,
    -- which is a different and much worse rule.
    delete from public.cells where id = cell_a;
    update public.lanes set path_id = path_b where id = lane_a;
    select exists (
      select 1 from public.lanes where id = lane_a and path_id = path_b
    ) into moved;
    if not moved then
      raise exception 'an empty lane could not move between paths';
    end if;

    raise exception using errcode = 'P0001', message = 'issue-174 fixture rollback';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg <> 'issue-174 fixture rollback' then raise; end if;
  end;

  if not refused_cell then
    raise exception 'the cell-side case never ran';
  end if;
  if not refused_lane then
    raise exception 'the lane-side case never ran';
  end if;
  if not moved then
    raise exception 'the empty-lane case never ran';
  end if;
  if exists (select 1 from public.services where name = 'issue-174 fixture') then
    raise exception 'the fixture survived the rollback';
  end if;
end
$lane$;

-- ── 6. Stakeholders is shut, and stays shut when a permissive policy joins ─
--
-- The shape, then the property the shape exists for. The second assertion is
-- the one worth reading: it adds the exact policy the ticket warns about and
-- shows the table stays closed, which under the previous shape it would not
-- have. That policy is created and dropped inside the fixture subtransaction
-- and never reaches a committed schema.

do $policy_assert$
declare
  n        int;
  svc      uuid;
  holder   uuid;
  touched  int;
  as_owner int;
  after_extra int;
  command  text;
  msg      text;
  done     boolean := false;
begin
  if to_regclass('public.stakeholders') is null then
    raise notice 'public.stakeholders is absent — the assertions below have nothing to examine.';
    return;
  end if;

  -- 1. EVERY WRITE COMMAND HAS BOTH HALVES. `cmd = 'ALL'` counts for each of
  -- the three, because that is how Postgres applies it.
  foreach command in array array['INSERT','UPDATE','DELETE'] loop
    select count(*) into n from pg_policies p
    where p.schemaname = 'public' and p.tablename = 'stakeholders'
      and p.cmd in (command, 'ALL') and p.permissive = 'PERMISSIVE';
    if n <> 1 then
      raise exception
        'stakeholders has % permissive % policies, expected 1 — the write is unreachable with none, and two of them is the shape this migration exists to prevent',
        n, command;
    end if;

    select count(*) into n from pg_policies p
    where p.schemaname = 'public' and p.tablename = 'stakeholders'
      and p.cmd in (command, 'ALL') and p.permissive = 'RESTRICTIVE'
      and coalesce(p.qual, '') || ' ' || coalesce(p.with_check, '') like '%is_service_account%';
    if n <> 1 then
      raise exception
        'stakeholders has % restrictive is_service_account() companions for %, expected 1', n, command;
    end if;
  end loop;

  -- 2. THE PROPERTY, PERFORMED.
  begin
    insert into public.services (name)
      values ('issue-174 policy fixture') returning id into svc;
    insert into public.stakeholders (service_id, name, kind)
      values (svc, 'fixture party', 'staff') returning id into holder;

    -- The statement works when the caller is the owner, so a zero below means
    -- the policy refused it and not that the WHERE clause missed.
    update public.stakeholders set summary = 'owner reached it' where id = holder;
    get diagnostics as_owner = row_count;
    if as_owner <> 1 then
      raise exception 'the fixture update matched % rows as owner; the proof below would be vacuous', as_owner;
    end if;

    execute 'set local role authenticated';
    update public.stakeholders set summary = 'authenticated reached it' where id = holder;
    get diagnostics touched = row_count;
    execute 'reset role';
    if touched <> 0 then
      raise exception 'an authenticated session with no service role updated % stakeholder rows', touched;
    end if;

    -- 3. AND ONE MORE PERMISSIVE POLICY DOES NOT OPEN IT. This is the whole
    -- reason for the rewrite: under the previous shape this policy would have
    -- ORed with the only gate on the table and let the UPDATE through.
    execute 'create policy stakeholders_update_anyone on public.stakeholders'
         || ' for update to authenticated using (true) with check (true)';
    execute 'set local role authenticated';
    update public.stakeholders set summary = 'the second permissive policy' where id = holder;
    get diagnostics after_extra = row_count;
    execute 'reset role';
    execute 'drop policy stakeholders_update_anyone on public.stakeholders';
    if after_extra <> 0 then
      raise exception
        'a second permissive policy reopened stakeholders to % rows; the restrictive companion is not ANDing', after_extra;
    end if;

    done := true;
    raise exception using errcode = 'P0001', message = 'issue-174 policy fixture rollback';
  exception when others then
    execute 'reset role';
    get stacked diagnostics msg = message_text;
    if msg <> 'issue-174 policy fixture rollback' then raise; end if;
  end;

  if not done then
    raise exception 'the stakeholders policy cases never ran';
  end if;
  if exists (select 1 from public.services where name = 'issue-174 policy fixture') then
    raise exception 'the policy fixture survived the rollback';
  end if;
end
$policy_assert$;
