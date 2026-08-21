-- 20260821340000 renamed service_lifecycles → services and service_lifecycle_id
-- → service_id, and asserted the result against information_schema.columns.
-- That assertion cannot see function bodies, so it passed while three functions
-- broke.
--
-- THE TRAP, for the fifth time in this series: `alter table ... rename` does
-- NOT rewrite plpgsql bodies. They are stored as text, resolved at call time,
-- and stay deployable-and-broken until someone calls them. Every prior rename
-- in this series (20260820080000, 090000, 120000, 140000) carried a
-- pg_get_functiondef sweep; 340000 did not.
--
-- Broken on the live database right now:
--   mint_cell_key   — joins public.service_lifecycles. Called by upsert_cell,
--                     which is the write path for EVERY cell, from the panel
--                     editor and from the agent's update_cell alike.
--   create_phase    — three fragments: the "Unknown service" existence check,
--                     the duplicate-name check, the max(position) probe, and
--                     the insert column list.
--   rename_phase    — the sibling-name check reads phases.service_lifecycle_id
--                     twice.
--   upsert_cell     — a SECOND, older break, from a different migration:
--                     `on conflict on constraint cells_layer_step_slot_unique`.
--                     20260820120000 renamed that constraint to
--                     cells_lane_step_slot_unique, and 20260820120100's sweep
--                     rewrote function bodies with word-boundary patterns
--                     (\mlayer_id\M and friends). Underscore IS a word
--                     character, so `cells_layer_step_slot_unique` has no
--                     boundary before "layer" and the literal was never
--                     matched. A whole-word pattern cannot see a word buried
--                     in an identifier.
--
-- So upsert_cell was already broken before 340000 landed, and stayed broken
-- through it — two independent renames, two different blind spots, one
-- function that no cell write can avoid.
--
-- create_phase's PARAMETER stays `lifecycle_id`. It is the wire name
-- authoringRpc.ts:248 passes (`lifecycle_id: input.lifecycleId`) and the agent
-- registry mirrors; renaming it is a cross-file change, not a repair, and it
-- belongs with the filter_layer_role → filter_lane_role rename in plan 007.
--
-- Acceptance, run after: zero rows.
--   select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname in ('public','semantic_search') and p.prosrc ~ 'service_lifecycle';

do $do$
declare d text; before_len int;
begin
  -- mint_cell_key ------------------------------------------------------------
  select pg_get_functiondef(p.oid) into d
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'mint_cell_key';
  if d is null then raise exception 'mint_cell_key not found'; end if;
  before_len := length(d);
  d := replace(d,
    'join public.service_lifecycles sl on sl.id = ph.service_lifecycle_id',
    'join public.services sl on sl.id = ph.service_id');
  if length(d) = before_len then
    raise exception 'mint_cell_key: the service_lifecycles join did not match';
  end if;
  execute d;

  -- create_phase -------------------------------------------------------------
  select pg_get_functiondef(p.oid) into d
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'create_phase';
  if d is null then raise exception 'create_phase not found'; end if;
  before_len := length(d);
  d := replace(d,
    'select 1 from public.service_lifecycles sl where sl.id = lifecycle_id',
    'select 1 from public.services sl where sl.id = lifecycle_id');
  d := replace(d,
    'where p.service_lifecycle_id = lifecycle_id',
    'where p.service_id = lifecycle_id');
  d := replace(d,
    'from public.phases p where p.service_lifecycle_id = lifecycle_id',
    'from public.phases p where p.service_id = lifecycle_id');
  d := replace(d,
    'service_lifecycle_id, name, summary, position, origin',
    'service_id, name, summary, position, origin');
  if d ~ 'service_lifecycle' then
    raise exception 'create_phase: a service_lifecycle fragment survived the sweep';
  end if;
  if length(d) = before_len then
    raise exception 'create_phase: no fragment matched';
  end if;
  execute d;

  -- rename_phase -------------------------------------------------------------
  select pg_get_functiondef(p.oid) into d
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'rename_phase';
  if d is null then raise exception 'rename_phase not found'; end if;
  before_len := length(d);
  d := replace(d,
    'where p.service_lifecycle_id = (',
    'where p.service_id = (');
  d := replace(d,
    'select service_lifecycle_id from public.phases where id = phase_id',
    'select service_id from public.phases where id = phase_id');
  if d ~ 'service_lifecycle' then
    raise exception 'rename_phase: a service_lifecycle fragment survived the sweep';
  end if;
  if length(d) = before_len then
    raise exception 'rename_phase: no fragment matched';
  end if;
  execute d;

  -- upsert_cell --------------------------------------------------------------
  select pg_get_functiondef(p.oid) into d
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'upsert_cell';
  if d is null then raise exception 'upsert_cell not found'; end if;
  before_len := length(d);
  d := replace(d, 'cells_layer_step_slot_unique', 'cells_lane_step_slot_unique');
  if length(d) = before_len then
    raise exception 'upsert_cell: the stale constraint name did not match';
  end if;
  execute d;
end
$do$;

-- The constraint upsert_cell now names must actually be there. This is the
-- check the 20260820120100 sweep could have run and did not.
do $do$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.cells'::regclass
      and contype = 'u'
      and conname = 'cells_lane_step_slot_unique'
  ) then
    raise exception 'cells_lane_step_slot_unique is not a unique constraint on cells';
  end if;
end
$do$;

-- No function may name any identifier these renames retired. Substring match,
-- deliberately — the whole lesson of upsert_cell is that a word-boundary
-- pattern misses a word buried inside an identifier.
do $do$
declare leftover text;
begin
  select string_agg(distinct p.proname, ', ') into leftover
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'semantic_search')
    and (p.prosrc like '%service_lifecycle%'
      or p.prosrc like '%cells_layer_step_slot%'
      or p.prosrc like '%_layer_id%'
      or p.prosrc like '%public.layers%');
  if leftover is not null then
    raise exception 'functions still naming a retired identifier: %', leftover;
  end if;
end
$do$;

-- mint_cell_key must actually run against a real row, not merely compile.
-- upsert_cell's whole job depends on it and a broken body is invisible until
-- called, which is how this defect survived a migration that asserted success.
do $do$
declare probe text; sample record;
begin
  select c.path_id, c.lane_id, c.step_id into sample
  from public.cells c limit 1;
  if sample.path_id is null then return; end if;
  probe := public.mint_cell_key(sample.path_id, sample.lane_id, sample.step_id);
  if coalesce(probe, '') = '' then
    raise exception 'mint_cell_key returned nothing for a real cell';
  end if;
end
$do$;
