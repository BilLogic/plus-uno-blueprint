-- Superseded within the hour by 20260821240000_status_not_maturity, which moves
-- this into a column. Kept because it ran: a migration history that does not
-- match what was applied is worse than one that records a reversal.
--
-- Both existing prefixes were wrong against the cell ladder, and the cells on
-- those paths said so — Prototype:* was `explored` throughout, Planned:* was
-- `in_progress` throughout. "Planned" sat on the path whose code was furthest
-- along, which is the exact failure the ladder was built to end.

update public.paths set
  name = '(Explored) ' || substring(name from 12), updated_at = now()
where name like 'Prototype: %';

update public.paths set
  name = '(In progress) ' || substring(name from 10), updated_at = now()
where name like 'Planned: %';

alter table public.paths
  add constraint paths_maturity_prefix_check
  check (
    name !~ '^\('
    or name ~ '^\((Explored|Planned|In progress|At risk|Deprecated)\) .'
  );
