-- Public RPC/read-back proof against a DISPOSABLE local migration replay.
-- PGHOST=/tmp psql -X -v ON_ERROR_STOP=1 -d <disposable-db> -f this-file
-- Everything, including fixture scaffolding, rolls back. Never run on hosted data.
\set ON_ERROR_STOP on
begin;

create temporary table rename_fixture (
  step_id uuid, original_step jsonb, memberships jsonb, cells jsonb
);
grant select on rename_fixture to authenticated;

do $$
declare
  svc uuid; phase uuid; scenario uuid; path_one uuid; path_two uuid;
  lane_one uuid; lane_two uuid; moment uuid;
begin
  insert into public.services(name) values ('step rename fixture') returning id into svc;
  insert into public.phases(service_id, name) values (svc, 'fixture') returning id into phase;
  insert into public.scenarios(phase_id, name) values (phase, 'fixture') returning id into scenario;
  insert into public.paths(scenario_id, name, kind) values (scenario, 'one', 'happy') returning id into path_one;
  insert into public.paths(scenario_id, name, kind) values (scenario, 'two', 'variant') returning id into path_two;
  insert into public.steps(scenario_id, name, summary) values (scenario, 'Old step', 'Keep summary') returning id into moment;
  insert into public.path_steps(path_id, step_id, position) values (path_one, moment, 0), (path_two, moment, 0);
  insert into public.lanes(path_id, name, position) values (path_one, 'Tutor', 0) returning id into lane_one;
  insert into public.lanes(path_id, name, position) values (path_two, 'Tutor', 0) returning id into lane_two;
  insert into public.cells(path_id, lane_id, step_id, content, status)
    values (path_one, lane_one, moment, 'Keep live conversation', 'live'),
           (path_two, lane_two, moment, '', 'built');
  insert into rename_fixture
    select moment, to_jsonb(s),
      (select jsonb_agg(to_jsonb(ps) order by ps.path_id) from public.path_steps ps where ps.step_id = moment),
      (select jsonb_agg(to_jsonb(c) order by c.id) from public.cells c where c.step_id = moment)
    from public.steps s where s.id = moment;
end $$;

set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","app_metadata":{"role":"service"}}', true);
select set_config('request.jwt.claim.sub', 'd7620000-0000-4000-8000-000000000001', true);

do $$
declare
  fixture rename_fixture%rowtype;
  outcome jsonb;
  logged public.authoring_changes%rowtype;
begin
  select * into strict fixture from rename_fixture;
  outcome := public.rename_step(fixture.step_id, 'Old step', 'New step');
  if outcome->>'id' is distinct from fixture.step_id::text or outcome->>'change_id' is null then
    raise exception 'rename returned no row identity or durable change id';
  end if;
  if (select name from public.steps where id = fixture.step_id) is distinct from 'New step' then
    raise exception 'read-back: step was not renamed';
  end if;
  if (select to_jsonb(s) - 'name' - 'updated_at' from public.steps s where id = fixture.step_id)
      is distinct from fixture.original_step - 'name' - 'updated_at' then
    raise exception 'read-back: rename changed another step field';
  end if;
  if (select jsonb_agg(to_jsonb(ps) order by ps.path_id) from public.path_steps ps where ps.step_id = fixture.step_id)
      is distinct from fixture.memberships
      or (select jsonb_agg(to_jsonb(c) order by c.id) from public.cells c where c.step_id = fixture.step_id)
      is distinct from fixture.cells then
    raise exception 'read-back: rename changed memberships or cells';
  end if;
  select * into strict logged from public.authoring_changes where id = (outcome->>'change_id')::uuid;
  if logged.fn <> 'rename_step' or logged.args->>'step_id' <> fixture.step_id::text
      or logged.revert is distinct from jsonb_build_object('fn', 'rename_step', 'args',
        jsonb_build_object('step_id', fixture.step_id, 'expected_name', 'New step', 'new_name', 'Old step'))
      or outcome->'revert' is distinct from logged.revert then
    raise exception 'read-back: inverse does not restore the actual prior name';
  end if;
  if (select count(*) from public.authoring_changes where fn = 'rename_step' and args->>'step_id' = fixture.step_id::text) <> 1 then
    raise exception 'read-back: rename did not log exactly once';
  end if;
end $$;

reset role;

-- The platform grants functions directly to anon as well as PUBLIC. Check
-- effective privileges so revoking only PUBLIC cannot make this proof pass.
do $$
begin
  if has_function_privilege('anon', 'public.rename_step(uuid,text,text)', 'EXECUTE')
      or has_function_privilege('service_role', 'public.rename_step(uuid,text,text)', 'EXECUTE')
      or not has_function_privilege('authenticated', 'public.rename_step(uuid,text,text)', 'EXECUTE') then
    raise exception 'rename_step effective execution grants are wrong';
  end if;
end $$;

set local role anon;
do $$
begin
  begin
    perform public.rename_step('d7620000-0000-4000-8000-000000000099', 'old', 'bad');
    raise exception 'anonymous caller was allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

set local role authenticated;
do $$
declare
  fixture rename_fixture%rowtype;
  claims text;
begin
  select * into strict fixture from rename_fixture;
  foreach claims in array array[
    '{"role":"authenticated","app_metadata":{}}',
    '{"role":"authenticated","app_metadata":{"role":"rpc_writer"}}',
    '{"role":"service_role","app_metadata":{"role":"service"}}'
  ] loop
    perform set_config('request.jwt.claims', claims, true);
    begin
      perform public.rename_step(fixture.step_id, 'New step', 'Forbidden');
      raise exception 'unauthorized caller was allowed: %', claims;
    exception when insufficient_privilege then null;
    end;
  end loop;
  perform set_config('request.jwt.claims', '{"role":"authenticated","app_metadata":{"role":"service"}}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform public.rename_step(fixture.step_id, 'New step', 'Forbidden');
    raise exception 'missing user identity was allowed';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub', 'd7620000-0000-4000-8000-000000000001', true);
  begin
    perform public.rename_step(fixture.step_id, 'Old step', 'Stale overwrite');
    raise exception 'stale expected name was allowed';
  exception when serialization_failure then null;
  end;
  begin
    perform public.rename_step('d7620000-0000-4000-8000-000000000099', 'Old step', 'Missing');
    raise exception 'zero-row rename was allowed';
  exception when no_data_found then null;
  end;
  foreach claims in array array['', '   ', 'New step', null] loop
    begin
      perform public.rename_step(fixture.step_id, 'New step', claims);
      raise exception 'blank or no-op name was allowed';
    exception when invalid_parameter_value then null;
    end;
  end loop;
  begin
    perform public.rename_step(fixture.step_id, null, 'Missing expectation');
    raise exception 'missing expectation was allowed';
  exception when invalid_parameter_value then null;
  end;
  if (select name from public.steps where id = fixture.step_id) <> 'New step'
      or (select count(*) from public.authoring_changes where fn = 'rename_step' and args->>'step_id' = fixture.step_id::text) <> 1 then
    raise exception 'a refused call changed the step or ledger';
  end if;
end $$;
reset role;

-- Force both kinds of ledger failure. A durable append that returns no row
-- must roll back the rename just as an exception does.
create function public.rename_proof_fail_log() returns trigger language plpgsql as $$
begin
  if new.fn = 'rename_step' then
    if new.args->>'new_name' = 'Ledger exception' then
      raise exception 'fixture ledger failure' using errcode = '23514';
    end if;
    return null;
  end if;
  return new;
end $$;
create trigger rename_proof_fail_log before insert on public.authoring_changes
  for each row execute function public.rename_proof_fail_log();
set local role authenticated;
do $$
declare fixture rename_fixture%rowtype;
begin
  select * into strict fixture from rename_fixture;
  begin
    perform public.rename_step(fixture.step_id, 'New step', 'Ledger exception');
    raise exception 'ledger error did not abort';
  exception when check_violation then null;
  end;
  begin
    perform public.rename_step(fixture.step_id, 'New step', 'Ledger zero rows');
    raise exception 'zero-row ledger append did not abort';
  exception when raise_exception then
    if sqlerrm <> 'Step rename produced no durable change id' then raise; end if;
  end;
  if (select name from public.steps where id = fixture.step_id) <> 'New step'
      or (select count(*) from public.authoring_changes where fn = 'rename_step' and args->>'step_id' = fixture.step_id::text) <> 1 then
    raise exception 'ledger failure left an unrecorded rename';
  end if;
end $$;
reset role;
drop trigger rename_proof_fail_log on public.authoring_changes;
drop function public.rename_proof_fail_log();

-- Known session inverse, constructed from this fixture's expected before and
-- after values. This is not replaying arbitrary durable JSON.
set local role authenticated;
do $$
declare fixture rename_fixture%rowtype;
begin
  select * into strict fixture from rename_fixture;
  perform public.rename_step(fixture.step_id, 'New step', 'Old step');
  if (select to_jsonb(s) - 'updated_at' from public.steps s where id = fixture.step_id)
      is distinct from fixture.original_step - 'updated_at' then
    raise exception 'inverse did not restore the original step';
  end if;
end $$;
reset role;
rollback;
\echo rename_step public read-back proof PASS (all fixture writes rolled back)
