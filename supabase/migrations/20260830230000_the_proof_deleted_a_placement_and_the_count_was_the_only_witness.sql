-- Put back the placement the reorder proof deleted.
--
-- `20260830160000` proved its reorder against the first touchpoint cell it
-- found. `sync_cell_touchpoints` is a sync: called with two probe names, it
-- deletes every placement the cell already had, because they are not in the
-- wanted list. The block then removed the probes and the cell was left with
-- nothing. That file's proof is amended in place, with the reasoning for
-- breaking the immutability rule written where the statement is.
--
-- ── How it was found, which is the part worth keeping ──────────────────────
--
-- Nothing reported it. The migration applied cleanly, its assertion passed —
-- it asserted the swap took, which was true — and every check in the
-- repository stayed green. It surfaced because a placement COUNT run for an
-- unrelated reason came back 307 where a note from an hour earlier said 308.
--
-- A count is a witness of last resort. So this migration leaves a better one:
-- an invariant that fails if a touchpoint-bearing cell is ever displaying
-- names with no placements behind them, which is the state the deletion left
-- and the state no existing check had a name for.
--
-- ── What was actually lost ─────────────────────────────────────────────────
--
-- One row, on the cell displaying `Reflection form`. It carried no summary,
-- screenshot or url — `cells.links` for that cell is `[]` — so the repair
-- below is complete rather than approximate. Had `limit 1` chosen a cell
-- whose placement carried authored writing, no migration could have put that
-- writing back, which is the reason the proof is amended and not merely
-- apologised for.

-- ── 1. Re-derive the placements for any bearing cell now showing none ──────
--
-- Written as a general repair rather than as an UPDATE against one id. The
-- id is known, but a file pinned to one production row asserts nothing on a
-- fresh database, and this has to be the statement that closes the hole for
-- whatever the proof damaged wherever it ran.
--
-- The derivation is `20260830140000`'s, narrowed to cells holding no
-- placements at all: same lateral join to the labelled link, same
-- `ordinality` for the order the author typed, same `import` origin, because
-- this is that import being completed rather than an authoring act.

insert into public.cell_touchpoints
  (cell_id, touchpoint_id, position, summary, screenshot, url, origin)
with damaged as (
  select c.id, c.content, c.links, ph.service_id
    from public.cells c
    join public.lanes ln on ln.id = c.lane_id
    join public.paths p on p.id = c.path_id
    join public.scenarios s on s.id = p.scenario_id
    join public.phases ph on ph.id = s.phase_id
   where ln.lane_role in ('frontstage_touchpoints', 'backstage_touchpoints')
     and coalesce(btrim(c.content), '') <> ''
     and not exists (
       select 1 from public.cell_touchpoints ct where ct.cell_id = c.id
     )
)
select
  damaged.id,
  tp.id,
  item.ord::int,
  detail.link ->> 'description',
  detail.link ->> 'picture',
  detail.link ->> 'url',
  'import'
from damaged
cross join lateral unnest(
  string_to_array(replace(damaged.content, E'\n', ','), ',')
) with ordinality as item(name, ord)
join public.touchpoints tp
  on tp.service_id = damaged.service_id and tp.name = btrim(item.name)
left join lateral (
  select l as link
    from jsonb_array_elements(coalesce(damaged.links, '[]'::jsonb)) l
   where l ->> 'type' = 'tech_description'
     and l ->> 'label' = btrim(item.name)
   limit 1
) detail on true
where btrim(item.name) <> ''
on conflict (cell_id, touchpoint_id) do nothing;

-- ── 2. The witness that was missing ────────────────────────────────────────
--
-- An invariant, not a census: a touchpoint-bearing cell whose text names a
-- touchpoint the catalog knows must have a placement for it. Vacuously true
-- on an empty database, and the exact statement that was false for an hour
-- on production.
--
-- It deliberately does not require a placement for every token. A cell may
-- name something the catalog has never seen — that is a different defect,
-- and #180 is where a person resolves the 57 details in that state. This
-- asks only that a name the catalog DOES hold is not silently unplaced.

do $do$
declare unplaced int;
begin
  select count(*) into unplaced
    from public.cells c
    join public.lanes ln on ln.id = c.lane_id
    join public.paths p on p.id = c.path_id
    join public.scenarios s on s.id = p.scenario_id
    join public.phases ph on ph.id = s.phase_id
   cross join lateral unnest(
     string_to_array(replace(coalesce(c.content, ''), E'\n', ','), ',')
   ) as item(name)
    join public.touchpoints tp
      on tp.service_id = ph.service_id and tp.name = btrim(item.name)
   where ln.lane_role in ('frontstage_touchpoints', 'backstage_touchpoints')
     and not exists (
       select 1 from public.cell_touchpoints ct
        where ct.cell_id = c.id and ct.touchpoint_id = tp.id
     );

  if unplaced <> 0 then
    raise exception
      '% touchpoints are named on a cell the catalog knows but have no placement',
      unplaced;
  end if;
end
$do$;
