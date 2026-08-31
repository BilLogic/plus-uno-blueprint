-- Five path types collapse to three.
--
-- `unhappy`, `exception` and `alternative` were not distinguishable in
-- practice, and the drift is on the record: Prototype: Lead Dashboard Wrap-Up
-- carried `alternative` while every other prototype carried `named`. `custom`
-- (and `named` before it) had become the drawer everything unclassifiable went
-- into — 11 of 39 paths.
--
-- A reader asks two things: is this the normal route, and if not, did it
-- diverge by choice or by trouble. Three values answer both.
--
--   happy      the main route, everything works
--   variant    equally normal, chosen by CONDITION
--   exception  a rule or a failure DIVERTS it

alter table public.paths drop constraint if exists paths_path_type_check;

alter table public.paths
  add constraint paths_path_type_check
  check (path_type in ('happy','unhappy','exception','alternative','custom','variant'));

update public.paths set path_type = 'exception', updated_at = now()
where path_type = 'unhappy'
   or name = 'Escalation'
   or name in ('Set Goals Edge Case', 'Update Goals Edge Case');

update public.paths set path_type = 'variant', updated_at = now()
where path_type in ('alternative', 'custom');

alter table public.paths drop constraint paths_path_type_check;

alter table public.paths
  add constraint paths_path_type_check
  check (path_type in ('happy','variant','exception'));

comment on column public.paths.path_type is
  'How this route relates to the scenario''s main one: happy (it IS the main route), variant (equally normal, chosen by condition), exception (a rule or a failure diverts it).';

do $$
declare n_retired int; n_multi int;
begin
  -- AMENDED 2026-08-31. Three censuses stood here — `expected 23 happy`, `10
  -- variant`, `6 exception` — counting production's rows on the day. On an
  -- empty database `paths` holds nothing, the first raises, and because a
  -- migration is one transaction the CONSTRAINT SWAP ABOVE ROLLS BACK with it,
  -- leaving `paths_path_type_check` on the wrong vocabulary for everything
  -- after.
  --
  -- The rule is `20260821340000`'s: amend an applied migration only where
  -- leaving it is actively harmful, and an assertion that disables the only
  -- instrument this repository has for #148 is that case. The collapse ran in
  -- production long ago; this changes only whether anything can check.
  --
  -- What replaces them is what they were reaching for: the collapse left
  -- nothing on a retired value. Vacuously true on an empty database, and on
  -- production exactly as strong — 39 paths, three values, and no fourth.
  select count(*) into n_retired from paths
   where path_type in ('unhappy', 'alternative', 'custom', 'named');
  if n_retired > 0 then
    raise exception '% paths still carry a retired path_type', n_retired;
  end if;

  -- Exactly one happy path per scenario: pickPreferredPath returns the first
  -- `happy` it finds, so a second would make the default arbitrary.
  select count(*) into n_multi from (
    select scenario_id from paths where path_type = 'happy'
    group by scenario_id having count(*) > 1
  ) dupes;
  if n_multi > 0 then raise exception '% scenarios hold more than one happy path', n_multi; end if;
end $$;
