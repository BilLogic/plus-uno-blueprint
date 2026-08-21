-- A maturity is not part of a touchpoint's name.
--
-- Fifty cells carried their state in `content`, as a `Planned — ` prefix. The
-- effect on the vocabulary was that the blueprint gained products called
-- "Planned — swap flow UI" and "Planned — AI generates one follow-up question
-- per section": a reader searching for the swap flow found a name that starts
-- with a project-management word, and the pill spent a third of its width
-- saying something that is true of the whole path it sits on.
--
-- Two values, because the distinction is real and people act on it
-- differently:
--   planned    committed work, in build or QA, with a card behind it
--   prototype  design exploration, no card, may never be built
-- NULL means shipped.
--
-- The prefix had one virtue this column has to earn back: the canvas said it
-- for free. src/lib/cellMaturityContract.test.ts holds the renderer to it.

begin;

alter table cells add column if not exists maturity text
  check (maturity is null or maturity in ('planned','prototype'));

comment on column cells.maturity is
  'Whether this cell describes something built. NULL means shipped. ''planned'' is committed work in build or QA; ''prototype'' is design exploration with no card. Before this column the state was carried by a "Planned — " prefix on content, which put a maturity inside a touchpoint NAME.';

update cells set maturity = 'prototype' where summary like 'PROTOTYPE (exploratory%';
update cells set maturity = 'planned'
where maturity is null and (summary like '%PLANNED (Card%' or content like 'Planned — %');

update cells set content = overlay(content placing upper(substring(content from 12 for 1)) from 12 for 1)
where content like 'Planned — %';
update cells set content = substring(content from 12) where content like 'Planned — %';

do $$
declare n int;
begin
  select count(*) into n from cells where content like 'Planned — %';
  if n > 0 then raise exception '% cells still carry the maturity in their label', n; end if;
  select count(*) into n from cells where maturity is not null;
  if n <> 54 then raise exception 'expected 54 unbuilt cells, found %', n; end if;
  select count(*) into n from cells where maturity is not null and coalesce(summary,'') = '';
  if n > 0 then raise exception '% unbuilt cells say nothing about why', n; end if;
  select count(*) into n from cells c join lanes l on l.id=c.lane_id join paths p on p.id=l.path_id
   where p.name like 'Prototype:%' and c.maturity is null and c.content <> 'Zoom/Pencil';
  if n > 0 then raise exception '% cells on a prototype path read as shipped', n; end if;
end $$;

commit;
