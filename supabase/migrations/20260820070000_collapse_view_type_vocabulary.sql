-- One vocabulary for scenario view type — the one the product speaks.
--
--   DB      single | side-by-side | integrated     (historical)
--   Client  single | stacked      | merged         (Compare v3)
--
-- `src/lib/viewTypeVocabulary.ts` existed only to map between them. Its own
-- comment said a migration was avoided because persisted `integrated` rows
-- coerce harmlessly to stacked. Checked the data before touching it: all 22
-- scenarios held 'side-by-side' and BOTH other tokens were unused, so the
-- deferred migration costs three statements and loses nothing. The module and
-- both seams are deleted in the same commit.
--
-- TWO DELIBERATE DEPARTURES FROM PLAN 002 PHASE 8:
--
-- 1. The constraint is ('single','stacked'), NOT ('single','stacked','merged').
--    `merged` is session-only — types/nav.ts says "never persisted", and
--    clientToDbViewType existed to stop it reaching a write by mapping it to
--    'side-by-side'. Letting the database accept it would replace a
--    translation seam with a standing lie. A write path holding a
--    SlideViewType must now decide what merged means rather than being
--    silently coerced.
--
-- 2. create_scenario is PATCHED IN PLACE rather than rewritten. It returns
--    jsonb, not uuid; a hand-retyped body would have silently changed its
--    contract with the app (Postgres refused the first attempt, which is the
--    only reason this was caught). Only the guard clause moves.
--
-- Order matters: drop the constraint FIRST. The old CHECK rejects 'stacked',
-- so updating before dropping fails on the first row.

alter table public.service_scenarios drop constraint service_scenarios_view_type_check;

update public.service_scenarios
set view_type = 'stacked'
where view_type in ('side-by-side', 'integrated');

alter table public.service_scenarios add constraint service_scenarios_view_type_check
  check (view_type in ('single', 'stacked'));

-- create_scenario carried the old vocabulary inline. Rejecting 'merged' by name
-- gives the caller the reason instead of "Unknown view type merged".
do $do$
declare d text; before_len int;
begin
  select pg_get_functiondef(p.oid) into d
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'create_scenario';
  if d is null then raise exception 'create_scenario not found'; end if;

  before_len := length(d);
  d := replace(d,
$old$  if view_type not in ('single', 'side-by-side', 'integrated') then
    raise exception 'Unknown view type %', view_type;
  end if;$old$,
$new$  if view_type = 'merged' then
    raise exception 'view_type ''merged'' is a display state, not a stored one'
      using hint = 'Store ''stacked''; merged is chosen per session in the compare control.';
  end if;
  if view_type not in ('single', 'stacked') then
    raise exception 'Unknown view type %', view_type
      using hint = 'One of: single, stacked.';
  end if;$new$);
  if length(d) = before_len then raise exception 'create_scenario view_type guard did not match'; end if;

  execute d;
end
$do$;
