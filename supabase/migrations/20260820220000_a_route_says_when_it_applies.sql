/*
  A path's Route says WHEN that route applies.

  Four happy paths repeated their scenario's summary word for word, so the
  panel showed one sentence twice under two labels — Route, then Summary — and
  the reader learned nothing from the second. One alternative path had no
  route at all, which is worse: an alternative exists precisely because
  something puts you on it.

  The scenario says what the situation is. The route says which way through
  it you are on.
*/
begin;

update public.paths as p set summary = v.summary
from (values
  ('a0000000-0000-4000-8000-000000000809', 'The default route — setup goes to plan and the session opens before students arrive.'),
  ('a0000000-0000-4000-8000-00000000080d', 'The default route — the tutor is free to take the request and can resolve it in the room.'),
  ('a0000000-0000-4000-8000-00000000080b', 'The default route — students arrive and are placed into their breakout room without a hitch.'),
  ('a0000000-0000-4000-8000-00000000080e', 'The default route — rooms close on time and every tutor files their reflection.'),
  ('ac2d57dd-da12-43b0-ab7e-2be92816a244', 'PROTOTYPE (not shipped as of Aug 2026): the same close, with the lead tutor working from a dashboard of room attendance and a live submission matrix.')
) as v(id, summary)
where p.id = v.id::uuid;

do $$
declare
  echoes int;
begin
  select count(*) into echoes
  from public.paths p
  join public.scenarios sc on sc.id = p.scenario_id
  where btrim(coalesce(p.summary, '')) = btrim(coalesce(sc.summary, ''))
     or coalesce(p.summary, '') = '';
  if echoes <> 0 then
    raise exception 'route fill: % paths still echo their scenario or say nothing', echoes;
  end if;
end $$;

commit;
