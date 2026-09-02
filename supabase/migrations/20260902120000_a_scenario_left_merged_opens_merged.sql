-- A scenario left merged opens merged.
--
-- `scenarios.layout` held `single | stacked`, and `merged` — the comparison
-- lens the header toggle offers beside Stacked — was a display state chosen
-- per session and thrown away on reload. #264 settled that a reader who
-- leaves a scenario merged should find it merged, so the toggle now WRITES:
-- the column admits `stacked | merged`, and `single` goes.
--
-- `single` goes because it was never a different board. A one-path scenario
-- drawn "single" and the same scenario drawn "stacked" differ only in which
-- renderer draws the one band; twenty-two of twenty-three rows already said
-- `stacked`, and the one that said `single` reads `stacked` after this file.
-- A one-path scenario is stacked with one band.
--
-- Three things move together, because a constraint, a default and a creator
-- that disagree about the vocabulary are three ways to be refused:
--
--   * the CHECK, renamed nothing, re-issued as `stacked | merged`;
--   * the column default, `stacked` — the reading view and the one every
--     existing row is in;
--   * `create_scenario`, whose body refused `merged` in prose that is now
--     wrong, and whose default was `single`. The body below is the CURRENT
--     definition from `pg_get_functiondef` with only those two things
--     changed; `create or replace` keeps its ACL.
--
-- And one new thing: `update_scenario_layout`, the recorded write behind the
-- toggle. SECURITY DEFINER behind `is_service_account()`, like every other
-- structural write — `authenticated` holds no UPDATE grant on this column and
-- gains none here, so a viewer's toggle has no path to the row. The app keeps
-- a session-only override for anon and view-only sessions; editors write.
--
-- ── Replaying against an empty database ───────────────────────────────────
--
-- The data fix touches zero rows on an empty database and one on production.
-- The proof is an INVARIANT: the CHECK admits exactly `stacked` and `merged`,
-- no row says `single`, the default is `stacked`, and the function exists.

update public.scenarios set layout = 'stacked' where layout = 'single';

alter table public.scenarios drop constraint scenarios_layout_check;
alter table public.scenarios
  add constraint scenarios_layout_check check (layout in ('stacked', 'merged'));
alter table public.scenarios alter column layout set default 'stacked';

comment on column public.scenarios.layout is
  'How the board is drawn: the paths stacked as bands on a shared step axis, '
  'or merged into one grid where the paths agree and split where they '
  'diverge. A display setting rather than a kind, which is why it is '
  '`layout` and not `kind`. Written by the header toggle through '
  'update_scenario_layout, so a scenario left merged opens merged. A '
  'one-path scenario is stacked with one band.';

CREATE OR REPLACE FUNCTION public.create_scenario(phase_id uuid, name text, layout text DEFAULT 'stacked'::text, lane_source_path_id uuid DEFAULT NULL::uuid, lane_set jsonb DEFAULT '[]'::jsonb, step_count integer DEFAULT 5, path_name text DEFAULT 'Happy Path'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog', 'pg_temp'
AS $function$
declare
  scenario_id uuid;
  new_path_id uuid;
  next_order int;
  lane jsonb;
  step_id uuid;
  i int;
begin
  if not public.is_service_account() then
    raise exception 'This account cannot edit the blueprint' using errcode = '42501';
  end if;
  if coalesce(trim(name), '') = '' then
    raise exception 'A blueprint needs a name';
  end if;
  if layout not in ('stacked', 'merged') then
    raise exception 'Unknown layout %', layout
      using hint = 'One of: stacked, merged.';
  end if;

  select coalesce(max(position), -1) + 1 into next_order
  from public.scenarios where scenarios.phase_id = create_scenario.phase_id;

  insert into public.scenarios (phase_id, name, position, layout, origin)
  values (create_scenario.phase_id, create_scenario.name, next_order, create_scenario.layout, 'app')
  returning id into scenario_id;

  insert into public.paths (scenario_id, name, kind, origin)
  values (scenario_id, path_name, 'happy', 'app')
  returning id into new_path_id;

  if lane_source_path_id is not null then
    insert into public.lanes (path_id, name, lane_role, position, origin)
    select new_path_id, l.name, l.lane_role, l.position, 'app'
    from public.lanes l where l.path_id = lane_source_path_id;
  else
    for lane in select * from jsonb_array_elements(lane_set) loop
      insert into public.lanes (path_id, name, lane_role, position, origin)
      values (
        new_path_id,
        lane ->> 'name',
        nullif(lane ->> 'lane_role', ''),
        coalesce((lane ->> 'position')::int, 0),
        'app'
      );
    end loop;
  end if;

  for i in 0 .. greatest(step_count, 1) - 1 loop
    insert into public.steps (scenario_id, name, origin)
    values (scenario_id, 'Step ' || (i + 1), 'app')
    returning id into step_id;
    insert into public.path_steps (path_id, step_id, position)
    values (new_path_id, step_id, i);
  end loop;

  return jsonb_build_object('scenario_id', scenario_id, 'path_id', new_path_id);
end;
$function$;

create or replace function public.update_scenario_layout(scenario_id uuid, layout text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_catalog', 'pg_temp'
as $function$
begin
  if not public.is_service_account() then
    raise exception 'This account cannot edit the blueprint' using errcode = '42501';
  end if;
  if layout not in ('stacked', 'merged') then
    raise exception 'Unknown layout %', layout
      using hint = 'One of: stacked, merged.';
  end if;

  update public.scenarios s set layout = update_scenario_layout.layout
  where s.id = update_scenario_layout.scenario_id;
  if not found then
    raise exception 'Unknown scenario';
  end if;
end;
$function$;

comment on function public.update_scenario_layout(uuid, text) is
  'The header toggle''s write: how this scenario''s board is drawn, stacked '
  'or merged. Its inverse is itself with the previous value.';

revoke execute on function public.update_scenario_layout(uuid, text) from public, anon;
grant execute on function public.update_scenario_layout(uuid, text) to authenticated;

-- ── Proof ──────────────────────────────────────────────────────────────────
do $proof$
declare
  bad int;
  def text;
begin
  -- 1. THE CHECK ADMITS STACKED AND MERGED, AND NOTHING ELSE.
  select pg_get_constraintdef(c.oid) into def
    from pg_constraint c
   where c.conrelid = 'public.scenarios'::regclass
     and c.conname = 'scenarios_layout_check';
  if def is null then
    raise exception 'scenarios.layout has no CHECK constraint';
  end if;
  if def not like '%stacked%' or def not like '%merged%' or def like '%single%' then
    raise exception 'scenarios_layout_check is not stacked | merged: %', def;
  end if;

  -- 2. NO ROW SAYS SINGLE. The constraint refuses it now; this asserts the
  --    data fix above ran before the constraint was re-issued.
  select count(*) into bad from public.scenarios where layout = 'single';
  if bad <> 0 then
    raise exception '% scenarios still say single', bad;
  end if;

  -- 3. THE DEFAULT IS STACKED.
  if (select column_default from information_schema.columns
       where table_schema = 'public' and table_name = 'scenarios'
         and column_name = 'layout') not like '''stacked''%' then
    raise exception 'scenarios.layout does not default to stacked';
  end if;

  -- 4. THE TOGGLE HAS A WRITE, AND ANON CANNOT CALL IT.
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'update_scenario_layout'
  ) then
    raise exception 'update_scenario_layout is missing';
  end if;
  if has_function_privilege('anon', 'public.update_scenario_layout(uuid, text)', 'execute') then
    raise exception 'anon can execute update_scenario_layout';
  end if;
end
$proof$;
