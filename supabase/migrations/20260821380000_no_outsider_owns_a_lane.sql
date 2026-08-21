-- lane-vocabulary.md settled this question and the data did not follow.
--
--   "No external body owns a lane, because no lane is theirs... external
--    bodies are actors inside cells, never lane owners."
--
-- Three lanes carry an owner_team that is not on the closed list at all:
--
--   Employment & Access › Standard › CMU HR   owner_team = 'CMU HR'
--   Employment & Access › Standard › CPO      owner_team = 'CPO'
--   Interview & Offer   › Standard › CPO      owner_team = 'CPO'
--
-- 20260821290000 filled owner_team by rule and reached for the lane's own name
-- where no team was obvious. For a partner_actions lane the name IS the outside
-- body, so the rule wrote exactly what the vocabulary forbids. Its closing
-- assertion counted filled rows, not legal ones, so it passed.
--
-- The lane names stay. A partner_actions lane called CPO is correct and is the
-- point of 20260821260000 — the tutor deals with the CPO directly and that work
-- is visible to them. What is wrong is only the claim that a body PLUS cannot
-- direct is accountable for the row. NULL is the true value: nobody at PLUS
-- owns it, which is precisely what makes those two lanes the hardest
-- dependencies on the board.
--
-- Acceptance, run after: zero rows.
--   select l.id from public.lanes l
--   where l.owner_team is not null and l.owner_team not in (
--     'Design','Product Design','Design Ops','Instructional Design','Marketing',
--     'Dev','Product','Research','Tutor Supervisors','Partnership');

update public.lanes
set owner_team = null
where owner_team in ('CMU HR', 'CPO');

do $do$
declare leftover text;
begin
  select string_agg(distinct l.owner_team, ', ') into leftover
  from public.lanes l
  where l.owner_team is not null
    and l.owner_team not in (
      'Design', 'Product Design', 'Design Ops', 'Instructional Design',
      'Marketing', 'Dev', 'Product', 'Research', 'Tutor Supervisors',
      'Partnership');

  if leftover is not null then
    raise exception 'owner_team values outside the closed list survive: %', leftover;
  end if;

  -- The lanes themselves must still be there. This migration retires a claim,
  -- not a row.
  if (select count(*) from public.lanes where name in ('CMU HR', 'CPO')) <> 3 then
    raise exception 'expected the 3 partner lanes to survive, found %',
      (select count(*) from public.lanes where name in ('CMU HR', 'CPO'));
  end if;
end
$do$;
