-- Every ordered table calls its ordering column `position`.
--
--   lanes.row_position               → lanes.position
--   path_steps.column_position       → path_steps.position
--   cells.slot_position              → cells.position
--   phases.order_position            → phases.position
--   service_scenarios.order_position → service_scenarios.position
--
-- `row` and `column` name how a lane and a step happen to be DRAWN today. The
-- compare view already draws the same lanes in a different geometry, so the
-- axis is a rendering fact, not a domain one. `order_` and `slot_` were noise
-- in front of the same idea.
--
-- Plan 002 proposed `lanes.lane_position`. Plain `position` instead:
-- `slices.position` and `slice_items.position` already spell it that way and
-- the plan itself called them "already right", so this makes every ordered
-- table agree rather than inventing a sixth spelling. `lanes.lane_position`
-- also stutters.
--
-- `position` is not reserved in Postgres — `slices.position` has worked since
-- it shipped.
--
-- Function bodies do not follow a column rename. Each old name is swept by word
-- boundary; they are distinct strings, so there is no cross-table ambiguity.
-- add_lane's `at_row` PARAMETER needs a drop and recreate, so it is excluded
-- here and handled in the next migration.

alter table public.lanes             rename column row_position    to position;
alter table public.path_steps        rename column column_position to position;
alter table public.cells             rename column slot_position   to position;
alter table public.phases            rename column order_position  to position;
alter table public.service_scenarios rename column order_position  to position;

do $do$
declare r record; d text; n int := 0;
begin
  for r in
    select p.oid, p.proname
    from pg_proc p join pg_namespace nsp on nsp.oid = p.pronamespace
    where nsp.nspname in ('public','semantic_search') and p.prokind = 'f'
      and p.proname not in ('add_lane')
      and pg_get_functiondef(p.oid) ~ '\m(row_position|column_position|slot_position|order_position)\M'
  loop
    d := pg_get_functiondef(r.oid);
    d := regexp_replace(d, '\mrow_position\M',    'position', 'g');
    d := regexp_replace(d, '\mcolumn_position\M', 'position', 'g');
    d := regexp_replace(d, '\mslot_position\M',   'position', 'g');
    d := regexp_replace(d, '\morder_position\M',  'position', 'g');
    execute d;
    n := n + 1;
  end loop;
  raise notice 'rewrote % function bodies', n;
end
$do$;
