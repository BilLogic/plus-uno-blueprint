-- `maturity` promised a single ladder that orders. It did not: three rungs sat
-- below shipped and two qualified it, with shipped itself unrepresented, so
-- `deprecated` was not "further along" than `at_risk`. `status` promises
-- nothing about order and is the word people use.
--
-- Adding `live` is what makes the list a lifecycle rather than two bands, and
-- it ends the double duty NULL was doing — "how it works today" AND "nobody
-- has assessed this" — on 879 cells at once.
--
--   proposed    designed and discussed, no build card
--   planned     committed and carded, no code
--   built       code exists, in build or QA, nobody using it
--   live        in use today  <- the default
--   at_risk     live and failing in a way somebody measured
--   deprecated  live and being taken away

create domain public.entity_status as text
  check (value in ('proposed','planned','built','live','at_risk','deprecated'));

comment on domain public.entity_status is
  'How far along the thing an entity describes is. One vocabulary shared by cells and paths — a second list would drift from the first within a month.';

alter table public.cells drop constraint if exists cells_maturity_check;
alter table public.cells rename column maturity to status;

-- `explored` was past-tense and passive: it named an activity, not a state,
-- and all 42 meant "designed, not committed".
update public.cells set status = 'proposed' where status = 'explored';
-- `in_progress` reads as "someone is working on it". Its own definition was
-- "code exists and is in build or QA" — finished and waiting, not in progress.
update public.cells set status = 'built' where status = 'in_progress';
update public.cells set status = 'live' where status is null;

alter table public.cells
  alter column status type public.entity_status using status::public.entity_status,
  alter column status set default 'live',
  alter column status set not null;

comment on column public.cells.status is
  'How far along the thing this cell describes is. Defaults to live — a current-state blueprint documents what is in use.';

-- Status moves out of the path NAME and into a column. A regex CHECK over a
-- text prefix was an odd home for a governed vocabulary, and a badge renders
-- from data, not from a string a reader has to parse.
alter table public.paths drop constraint if exists paths_maturity_prefix_check;

alter table public.paths
  add column status public.entity_status not null default 'live';

update public.paths set status = 'proposed', name = substring(name from 12), updated_at = now()
where name like '(Explored) %';

update public.paths set status = 'built', name = substring(name from 15), updated_at = now()
where name like '(In progress) %';

comment on column public.paths.status is
  'How far along this route is. Defaults to live. Replaces the "Prototype: " / "Planned: " name prefixes, which said the same thing where nothing could query it.';

do $$
declare n int;
begin
  select count(*) into n from cells where status is null;
  if n > 0 then raise exception '% cells with no status', n; end if;
  -- AMENDED 2026-08-31. Six censuses stood between here and the prefix check —
  -- `expected 879 live cells`, `42 proposed`, `14 built`, `5 proposed paths`,
  -- `1 built path` — every one of them a count of production's rows on the day.
  -- On an empty database `cells` and `paths` hold nothing, the first raises,
  -- and because a migration is one transaction EVERYTHING ABOVE ROLLS BACK:
  -- the `entity_status` domain, the `maturity` → `status` rename on `cells`,
  -- and the new `paths.status` column. That is why `20260821260000`,
  -- `20260821390000` and `20260821400000` report `column "status" ... does not
  -- exist` on a replay, and why `20260826110000` reports that
  -- `cells_maturity_check` and `paths_maturity_prefix_check` survive — they
  -- survive because the two `drop constraint` statements above rolled back
  -- with them. Six censuses, four files.
  --
  -- The rule is `20260821340000`'s: amend an applied migration only where
  -- leaving it is actively harmful, and an assertion that disables the only
  -- instrument this repository has for #148 is that case. The rename and the
  -- column ran in production long ago; this changes only whether anything can
  -- check.
  --
  -- What replaces them is what they were reaching for: the two updates left no
  -- cell on a retired value. Vacuously true on an empty database, and on
  -- production exactly as strong — 42 `explored` and 14 `in_progress` all had
  -- to move for the counts to come out.
  select count(*) into n from cells where status::text in ('explored', 'in_progress');
  if n > 0 then raise exception '% cells still carry a retired status', n; end if;
  select count(*) into n from paths where name ~ '^\(';
  if n > 0 then raise exception '% paths still carry a status prefix', n; end if;
end $$;
