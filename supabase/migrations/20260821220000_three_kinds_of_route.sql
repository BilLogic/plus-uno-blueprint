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
declare n_happy int; n_variant int; n_exception int; n_multi int;
begin
  select count(*) into n_happy     from paths where path_type = 'happy';
  select count(*) into n_variant   from paths where path_type = 'variant';
  select count(*) into n_exception from paths where path_type = 'exception';
  if n_happy <> 23 then raise exception 'expected 23 happy, got %', n_happy; end if;
  if n_variant <> 10 then raise exception 'expected 10 variant, got %', n_variant; end if;
  if n_exception <> 6 then raise exception 'expected 6 exception, got %', n_exception; end if;

  -- Exactly one happy path per scenario: pickPreferredPath returns the first
  -- `happy` it finds, so a second would make the default arbitrary.
  select count(*) into n_multi from (
    select scenario_id from paths where path_type = 'happy'
    group by scenario_id having count(*) > 1
  ) dupes;
  if n_multi > 0 then raise exception '% scenarios hold more than one happy path', n_multi; end if;
end $$;
