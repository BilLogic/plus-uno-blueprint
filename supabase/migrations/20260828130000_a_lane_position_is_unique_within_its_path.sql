-- 20260828130000 — a lane's position is unique within its path, and deferred.
--
-- TWO PLACES IN THE TREE ALREADY BELIEVED THIS CONSTRAINT EXISTED. Neither was
-- right, and the collision it would have refused happened anyway.
--
--   `src/lib/authoringErrors.ts` matched a constraint name to say "Two lanes
--   ended up in the same position." No constraint has ever carried that name;
--   the object on those two columns is `lanes_path_row_idx`, a plain
--   non-unique index, so the branch could never fire. #117 deleted it rather
--   than rename it, on the grounds that renaming would imply a rule the schema
--   did not have. This migration is that rule, so the message comes back.
--
--   `20260821270000_employment_and_access_and_a_lane_repair.sql` orders its
--   three lane UPDATEs one per statement and justifies the ordering with
--   "`unique (path_id, position)` is not deferred, so a single UPDATE could
--   collide mid-flight". The ordering is harmless; the constraint it names is
--   not there. Migrations are append-only, so that comment stays as written
--   and this file is where it stops being wrong — after this, the sentence
--   describes the schema except for the word "not".
--
-- AND WARM-UP'S SECOND PATH DID COLLIDE. Regular Tutor and Front Stage Tech
-- both landed on position 4, and `repairWarmUpAlternatePathBlueprint` re-sorted
-- the board client-side on every load until 20260821270000 fixed it at source.
-- The failure mode is not hypothetical: it is a write nothing refused, hidden
-- for weeks by a repair function that ran on every page load.
--
-- MEASURED ON PRODUCTION BEFORE WRITING THIS, 2026-08-28:
--
--   select path_id, position, count(*) from public.lanes
--    group by path_id, position having count(*) > 1;   -- 0 rows
--
--   316 lanes across 40 paths, 0 colliding (path_id, position) pairs, 0 paths
--   whose lane count differs from its distinct-position count. The rule holds
--   over live data today, which is the only reason it can be added as a rule
--   rather than proposed as a repair.
--
-- ---------------------------------------------------------------------------
-- DEFERRABLE INITIALLY DEFERRED, BECAUSE EVERY REORDER TRANSIENTLY COLLIDES.
-- ---------------------------------------------------------------------------
--
-- This is not belt and braces. An immediate constraint would break the two
-- write paths that move lanes, and both break on ordinary use:
--
--   `reorder_lanes(scenario_id, lane_names[])` is a plpgsql loop issuing one
--   `update … set position = i - 1` per name, all inside the single
--   transaction of the function call. Swap two adjacent lanes and the first
--   statement writes a position the second has not vacated yet. Immediate, it
--   fails there — on the ordinary move a person makes by dragging a lane.
--
--   `add_lane(…, at_position)` opens the slot with one statement, `update
--   public.lanes set position = position + 1 … where position >= target`. A
--   plain UPDATE is checked as each row is written, not at the end, so an
--   n-row shift collides with itself at the first row even though its final
--   state is unique. One statement is not one check.
--
-- `path_steps_path_column_unique` is the precedent and was made deferrable by
-- 20260731000000 for this exact reason — "the RPCs do the shifting in one
-- transaction, and a deferrable constraint makes that safe rather than lucky".
-- `slice_items_position_unique` was born deferrable. Lanes are the third table
-- with an editor that renumbers, and the only one without the rule.
--
-- WHAT IT DOES NOT ASSERT: contiguity. Two live paths carry gaps left by lane
-- deletes — Discovery / "Standard" runs 0,3,4,5,6,7,8 and Interview & Offer /
-- "Supervisor-registered clearance" runs 0,1,2,3,5,6,7. Both are unique, both
-- stay legal, and `remove_lane` still does not renumber. A gap is a display
-- ordering with a hole in it; a duplicate is two lanes claiming one slot.
--
-- ONE COST, NAMED: a deferrable unique index cannot be an `on conflict`
-- arbiter. Nothing infers on (path_id, position) — every upsert on lanes in
-- `supabase/seeds/` conflicts on `id`, and the five RPCs that insert lanes
-- (`add_lane`, `create_path`, `create_scenario`, `duplicate_path`,
-- `duplicate_scenario`) carry no `on conflict` at all. The four that copy a
-- lane set copy the source positions, and `DEFAULT_LANE_SET` in
-- `src/lib/blueprintValidation.ts` numbers its seven lanes 0..6, so no caller
-- offers a duplicate to reject.

-- ---------------------------------------------------------------------------
-- Precondition. The ALTER would fail on its own with a bare unique_violation
-- naming one pair; this says how many and stops before the DDL.
-- ---------------------------------------------------------------------------
do $precondition$
declare
  dupes int;
  worst text;
begin
  select count(*) into dupes from (
    select path_id, position from public.lanes
    group by path_id, position having count(*) > 1
  ) d;

  if dupes > 0 then
    select string_agg(format('%s@%s×%s', path_id, position, n), ', ')
      into worst
    from (
      select path_id, position, count(*) as n from public.lanes
      group by path_id, position having count(*) > 1
      order by count(*) desc limit 5
    ) d;
    raise exception '% colliding (path_id, position) pairs: %', dupes, worst
      using hint = 'Repair the data first — which lane keeps the slot is an authoring decision, not a schema one.';
  end if;
end
$precondition$;

alter table public.lanes
  drop constraint if exists lanes_path_position_unique;
alter table public.lanes
  add constraint lanes_path_position_unique
    unique (path_id, position) deferrable initially deferred;

comment on constraint lanes_path_position_unique on public.lanes is
  'One lane per slot in a path. Deferred because reorder_lanes renumbers one statement per lane and add_lane opens a slot with a single self-colliding UPDATE; both are checked at commit, not mid-flight.';

-- `lanes_path_row_idx` goes: the constraint's own index covers (path_id,
-- position) leading-first, so the old one is a second copy of the same tree
-- for every lane write to maintain — and it is the object whose name was twice
-- mistaken for a constraint. `lanes_path_id_idx` stays; a leading-column index
-- is a size trade-off that predates this file, not a duplicate of it.
drop index if exists public.lanes_path_row_idx;

-- ---------------------------------------------------------------------------
-- Post-conditions. The shape, then the behaviour — the behaviour proved by
-- performing it on a fixture that is rolled back before this block returns.
-- ---------------------------------------------------------------------------
do $assert$
declare
  con      record;
  cols     text;
  n        int;
  svc      uuid;
  phase    uuid;
  scen     uuid;
  pth      uuid;
  lane_a   uuid;
  lane_b   uuid;
  refused  boolean := false;
  msg      text;
begin
  -- 1. IT EXISTS, AS A UNIQUE CONSTRAINT ON EXACTLY (path_id, position).
  select c.conname, c.contype, c.condeferrable, c.condeferred
    into con
  from pg_constraint c
  join pg_class t     on t.oid = c.conrelid
  join pg_namespace s on s.oid = t.relnamespace
  where s.nspname = 'public' and t.relname = 'lanes'
    and c.conname = 'lanes_path_position_unique';

  if not found then
    raise exception 'lanes_path_position_unique is not on public.lanes';
  end if;
  if con.contype <> 'u' then
    raise exception 'lanes_path_position_unique is contype %, not a unique constraint', con.contype;
  end if;

  -- Column ORDER, not just membership: (position, path_id) would be a
  -- different index and the same constraint, and the wrong one for the
  -- path-scoped reads every board load makes.
  select string_agg(a.attname, ',' order by k.ord) into cols
  from pg_constraint c
  join pg_class t     on t.oid = c.conrelid
  join pg_namespace s on s.oid = t.relnamespace
  cross join lateral unnest(c.conkey) with ordinality as k(attnum, ord)
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
  where s.nspname = 'public' and t.relname = 'lanes'
    and c.conname = 'lanes_path_position_unique';
  if cols is distinct from 'path_id,position' then
    raise exception 'lanes_path_position_unique covers (%), expected (path_id,position)', cols;
  end if;

  -- 2. IT IS DEFERRABLE, AND DEFERRED BY DEFAULT. Deferrable-but-immediate
  -- would pass every shape check above and still fail every drag of a lane,
  -- because nothing in the RPCs issues `set constraints`.
  if not con.condeferrable then
    raise exception 'lanes_path_position_unique is not deferrable: reorder_lanes would fail on its first swap';
  end if;
  if not con.condeferred then
    raise exception 'lanes_path_position_unique is deferrable but not INITIALLY DEFERRED, and no caller defers it';
  end if;

  -- The index says the same thing from the other side: a deferrable unique
  -- constraint is backed by a unique index that is not immediate.
  select count(*) into n
  from pg_index i
  join pg_class ix on ix.oid = i.indexrelid
  where ix.relname = 'lanes_path_position_unique'
    and i.indisunique and not i.indimmediate;
  if n <> 1 then
    raise exception 'expected one non-immediate unique index named lanes_path_position_unique, found %', n;
  end if;

  -- 3. THE DUPLICATE INDEX IS GONE, and exactly one index now covers the pair.
  select count(*) into n
  from pg_index i
  join pg_class t on t.oid = i.indrelid
  join pg_namespace s on s.oid = t.relnamespace
  where s.nspname = 'public' and t.relname = 'lanes'
    and (select string_agg(a.attname, ',' order by k.ord)
         from unnest(i.indkey::int[]) with ordinality as k(attnum, ord)
         join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum)
        = 'path_id,position';
  if n <> 1 then
    raise exception 'expected exactly one index on (path_id, position), found %', n;
  end if;

  -- 4. NO LIVE ROW VIOLATES IT. The ALTER validated the table or it would not
  -- have returned, so this is the statement of the fact rather than the test
  -- of it — and it is here because a replay onto dirty data is the case where
  -- this file must be read, not trusted.
  select count(*) into n from (
    select path_id, position from public.lanes
    group by path_id, position having count(*) > 1
  ) d;
  if n <> 0 then
    raise exception '% colliding lane positions survived the constraint', n;
  end if;

  -- 5. THE BEHAVIOUR, PERFORMED. Everything below happens on a fixture built
  -- here and rolled back by the sentinel at the end of the block — nothing
  -- touches a real lane, and nothing survives this migration.
  begin
    insert into public.services (name)
      values ('issue-118 fixture') returning id into svc;
    insert into public.phases (service_id, name)
      values (svc, 'fixture phase') returning id into phase;
    insert into public.scenarios (phase_id, name)
      values (phase, 'fixture scenario') returning id into scen;
    insert into public.paths (scenario_id, name, path_type)
      values (scen, 'fixture path', 'happy') returning id into pth;
    insert into public.lanes (path_id, name, position)
      values (pth, 'A', 0) returning id into lane_a;
    insert into public.lanes (path_id, name, position)
      values (pth, 'B', 1) returning id into lane_b;

    -- 5a. A REORDER THAT COLLIDES MID-FLIGHT SUCCEEDS. This is the exact shape
    -- of `reorder_lanes`: one UPDATE per lane, in the loop's order, inside one
    -- transaction. After the first statement both lanes hold position 0.
    update public.lanes set position = 0 where id = lane_b;

    select count(*) into n from public.lanes
    where path_id = pth and position = 0;
    if n <> 2 then
      raise exception 'the fixture did not collide (% lanes at position 0): the proof below would be vacuous', n;
    end if;

    update public.lanes set position = 1 where id = lane_a;

    -- `set constraints … immediate` runs the deferred check now. Reaching the
    -- next line is the proof: the transient duplicate above was tolerated and
    -- the settled state is accepted.
    set constraints public.lanes_path_position_unique immediate;

    select string_agg(name, '' order by position) into msg
    from public.lanes where path_id = pth;
    if msg <> 'BA' then
      raise exception 'the swap did not settle as B,A but as %', msg;
    end if;

    -- 5b. AND `add_lane`'S SHIFT — one UPDATE moving both rows at once, which
    -- is the shape an immediate constraint refuses row-by-row.
    set constraints public.lanes_path_position_unique deferred;
    update public.lanes set position = position + 1 where path_id = pth;
    set constraints public.lanes_path_position_unique immediate;

    -- 5c. A GENUINE DUPLICATE AT COMMIT STILL FAILS. Same statements, same
    -- deferral — the only difference is that this one does not settle.
    set constraints public.lanes_path_position_unique deferred;
    begin
      update public.lanes set position = 1 where id in (lane_a, lane_b);
      set constraints public.lanes_path_position_unique immediate;
      raise exception 'two lanes committed to the same position: the constraint is not enforcing';
    exception when unique_violation then
      refused := true;
    end;
    if not refused then
      raise exception 'the deferred check accepted two lanes in one slot';
    end if;

    -- Roll the fixture back. Everything since the BEGIN above goes with it;
    -- the DDL is outside this subtransaction and stays.
    raise exception using errcode = 'P0001', message = 'issue-118 fixture rollback';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg <> 'issue-118 fixture rollback' then raise; end if;
  end;

  if not refused then
    raise exception 'the duplicate-at-commit case never ran';
  end if;

  if exists (select 1 from public.services where name = 'issue-118 fixture') then
    raise exception 'the fixture survived the rollback';
  end if;
end
$assert$;
