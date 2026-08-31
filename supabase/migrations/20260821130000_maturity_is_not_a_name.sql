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

-- 'Planned — ' is TEN characters, not eleven: the em dash is one character
-- however many bytes it takes. Stripping from 12 removed the prefix AND the
-- first letter of every label under it — "Planned — completes…" came out as
-- "Ompletes…" across fifty cells. From 11.
update cells set content = overlay(content placing upper(substring(content from 11 for 1)) from 11 for 1)
where content like 'Planned — %';
update cells set content = substring(content from 11) where content like 'Planned — %';

do $$
declare n int;
begin
  select count(*) into n from cells where content like 'Planned — %';
  if n > 0 then raise exception '% cells still carry the maturity in their label', n; end if;
  -- AMENDED 2026-08-31. This was a census — `expected 54 unbuilt cells` —
  -- measured against production on the day. On an empty database `cells` holds
  -- nothing, the count is 0, and this raises; because a migration is one
  -- transaction, `alter table cells add column maturity` ABOVE ROLLS BACK WITH
  -- IT. That is why `20260821170000`, `20260821190000` and `20260821240000`
  -- report `column "maturity" does not exist` on a replay, and why the `status`
  -- column `20260821240000` renames it to is missing from three files after
  -- that. One census, six files.
  --
  -- The rule is `20260821340000`'s: amend an applied migration only where
  -- leaving it is actively harmful, and an assertion that disables the only
  -- instrument this repository has for #148 is that case. The column has long
  -- since been added in production; this changes only whether anything can
  -- check.
  --
  -- What replaces it is the invariant it was reaching for: the backfill missed
  -- nothing it was written to catch. Vacuously true on an empty database, and
  -- exactly as strong on production, where all 54 such cells had to be marked.
  select count(*) into n from cells
   where maturity is null
     and (summary like 'PROTOTYPE (exploratory%'
          or summary like '%PLANNED (Card%'
          or content like 'Planned — %');
  if n > 0 then raise exception '% unbuilt cells were never marked', n; end if;
  select count(*) into n from cells where maturity is not null and coalesce(summary,'') = '';
  if n > 0 then raise exception '% unbuilt cells say nothing about why', n; end if;
  -- The off-by-one above left labels like 'Ompletes', 'Econfirmation',
  -- 'Rap-up dashboard'. A label whose first two characters are an upper
  -- followed by a lower is normal; one that is ALSO not a word is not
  -- checkable in SQL, so assert the shapes the bug actually produced.
  select count(*) into n from cells
   where maturity is not null
     and content ~ '^(Ompletes|Econfirmation|Rap-up|Utomated|Scalation|Hanks|Uns|Loses|Hecks|Eminds|Edesigned|Ession|Adence|Atch|Ans|Reates|Igns|Eviews|Roposal|He named|0-minute|Oft-conflict|Cknowledges|Andidate|Ills|Leared|Nvite|Un 2026|Upervisor|Ccepts|Esign|Oth|Wap|Icks|Hooses|Ees|Navailable|I debrief|I generates)';
  if n > 0 then raise exception '% labels lost their first character', n; end if;
  select count(*) into n from cells c join lanes l on l.id=c.lane_id join paths p on p.id=l.path_id
   where p.name like 'Prototype:%' and c.maturity is null and c.content <> 'Zoom/Pencil';
  if n > 0 then raise exception '% cells on a prototype path read as shipped', n; end if;
end $$;

commit;
