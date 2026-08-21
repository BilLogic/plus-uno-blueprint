-- `planned` and `prototype` did not order, and one of them was mislabelled.
--
-- Both meant "not built" and neither said how close. Worse, the case marked
-- `planned` was Card 2452 — merged on the dev branch and sitting in QA, which
-- is the most built a thing can be without being live — while the 42 cells
-- marked `prototype` were Figma specs with no card, which may never happen.
-- Two words for one idea, applied to two states three rungs apart.
--
-- One axis now, ordered by the only question a reader asks — can I rely on
-- this today — and answered in both directions, because a working surface
-- that is failing or being withdrawn is not one you can build on either:
--
--   explored     designed, no card, may never happen        (was `prototype`)
--   planned      committed, has a card, no code yet
--   in_progress  code exists, in build or QA, not deployed  (was `planned`)
--   NULL         shipped and working
--   at_risk      shipped, and failing in a measured way
--   deprecated   shipped, still working, being taken away
--
-- Nothing is at_risk or deprecated yet. Both exist because the board already
-- holds candidates — the reflection form with 80% empty notes, the orphaned
-- TutorCoach route — and neither had anywhere to go.
--
-- Recorded here because it happened in this window: 20260821130000 stripped
-- 'Planned — ' with `substring(content from 12)`. That prefix is TEN
-- characters — the em dash is one character however many bytes it takes — so
-- it took the first letter of fifty labels with it. The migration is fixed at
-- source and now asserts against the shapes the bug produced; the live rows
-- were restored by hand from the migration text and each cell's own summary.

begin;

alter table cells drop constraint if exists cells_maturity_check;

update cells set maturity = 'in_progress' where maturity = 'planned';
update cells set maturity = 'explored'    where maturity = 'prototype';

alter table cells add constraint cells_maturity_check
  check (maturity is null or maturity in ('explored','planned','in_progress','at_risk','deprecated'));

comment on column cells.maturity is
  'How far along the thing this cell describes is. NULL means shipped and working. Unbuilt, in order: ''explored'' (designed, no card, may never happen), ''planned'' (committed, has a card, no code yet), ''in_progress'' (code exists, in build or QA, not deployed). Shipped but qualified: ''at_risk'' (working but failing in a known way), ''deprecated'' (still there, on the way out).';

do $$
declare n int;
begin
  select count(*) into n from cells where maturity = 'in_progress';
  if n <> 14 then raise exception 'expected 14 in_progress, found %', n; end if;
  select count(*) into n from cells where maturity = 'explored';
  if n <> 42 then raise exception 'expected 42 explored, found %', n; end if;
  select count(*) into n from cells where maturity in ('planned','prototype');
  if n > 0 then raise exception '% cells still carry a retired value', n; end if;
end $$;

commit;
