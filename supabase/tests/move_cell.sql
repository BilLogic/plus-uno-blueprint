-- Disposable local public-operation/read-back proof; every fixture rolls back.
\set ON_ERROR_STOP on
begin;
create temporary table move_fixture(cell_id uuid, independent_id uuid, source jsonb, destination jsonb,
  across_path jsonb, independent_source jsonb, original_cell jsonb, linked jsonb, occupied_id uuid,
  unused_step_id uuid, foreign_destination jsonb);
grant select on move_fixture to authenticated;
do $$
declare
  svc uuid; phase uuid; scenario uuid; path_one uuid; path_two uuid;
  lane_one uuid; lane_two uuid; step_one uuid; step_two uuid;
  moving uuid; independent uuid; occupied uuid; placement uuid;
  unused_step uuid; foreign_scenario uuid; foreign_path uuid; foreign_lane uuid; foreign_step uuid;
begin
  insert into public.services(name) values ('cell move fixture') returning id into svc;
  insert into public.phases(service_id,name) values(svc,'fixture') returning id into phase;
  insert into public.scenarios(phase_id,name) values(phase,'fixture') returning id into scenario;
  insert into public.paths(scenario_id,name,kind) values(scenario,'one','happy') returning id into path_one;
  insert into public.paths(scenario_id,name,kind) values(scenario,'two','variant') returning id into path_two;
  insert into public.steps(scenario_id,name) values(scenario,'one') returning id into step_one;
  insert into public.steps(scenario_id,name) values(scenario,'two') returning id into step_two;
  insert into public.steps(scenario_id,name) values(scenario,'not carried') returning id into unused_step;
  insert into public.scenarios(phase_id,name) values(phase,'other scenario') returning id into foreign_scenario;
  insert into public.paths(scenario_id,name,kind) values(foreign_scenario,'other path','happy') returning id into foreign_path;
  insert into public.lanes(path_id,name,position) values(foreign_path,'Tutor',0) returning id into foreign_lane;
  insert into public.steps(scenario_id,name) values(foreign_scenario,'other moment') returning id into foreign_step;
  insert into public.path_steps(path_id,step_id,position) values(foreign_path,foreign_step,0);
  insert into public.path_steps(path_id,step_id,position) values
    (path_one,step_one,0),(path_one,step_two,1),(path_two,step_one,0),(path_two,step_two,1);
  insert into public.lanes(path_id,name,position) values(path_one,'Tutor',0) returning id into lane_one;
  insert into public.lanes(path_id,name,position) values(path_two,'Tutor',0) returning id into lane_two;
  insert into public.cells(path_id,lane_id,step_id,content,status,cell_key,summary)
    values(path_one,lane_one,step_one,'Move this','live',gen_random_uuid()::text,'Keep this') returning id into moving;
  insert into public.cells(path_id,lane_id,step_id,position,content,status)
    values(path_one,lane_one,step_one,1,'Independent','built') returning id into independent;
  insert into public.cells(path_id,lane_id,step_id,content,status)
    values(path_one,lane_one,step_two,'Existing destination','live') returning id into occupied;
  insert into public.cell_dependencies(source_cell_id,target_cell_id) values(moving,occupied);
  insert into public.cell_touchpoints(cell_id,name,position,origin)
    values(moving,'Preserved placement',0,'app') returning id into placement;
  insert into public.resources(cell_id,cell_touchpoint_id,name,url,position,origin)
    values(moving,placement,'Preserved resource','https://example.com/fixture',0,'app');
  insert into public.evidence(service_id,cell_id,cell_key,kind,title)
    select svc,id,cell_key,'doc','Preserved evidence' from public.cells where id=moving;
  insert into move_fixture select moving,independent,
    jsonb_build_object('path_id',path_one,'lane_id',lane_one,'step_id',step_one,'position',0),
    jsonb_build_object('path_id',path_one,'lane_id',lane_one,'step_id',step_two,'position',1),
    jsonb_build_object('path_id',path_two,'lane_id',lane_two,'step_id',step_two,'position',0),
    jsonb_build_object('path_id',path_one,'lane_id',lane_one,'step_id',step_one,'position',1),
    to_jsonb(c), jsonb_build_object(
      'placements',(select jsonb_agg(to_jsonb(t) order by id) from public.cell_touchpoints t where cell_id=moving),
      'resources',(select jsonb_agg(to_jsonb(r) order by id) from public.resources r where cell_id=moving),
      'evidence',(select jsonb_agg(to_jsonb(e) order by id) from public.evidence e where cell_id=moving),
      'edges',(select jsonb_agg(to_jsonb(d) order by id) from public.cell_dependencies d where source_cell_id=moving)), occupied,
    unused_step,jsonb_build_object('path_id',foreign_path,'lane_id',foreign_lane,'step_id',foreign_step,'position',0)
    from public.cells c where c.id=moving;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","app_metadata":{"role":"service"}}',true);
select set_config('request.jwt.claim.sub','d7630000-0000-4000-8000-000000000001',true);
do $$
declare f move_fixture%rowtype; outcome jsonb; current_slot jsonb; linked jsonb;
begin
  select * into strict f from move_fixture;
  outcome := public.move_cell(f.cell_id,f.source,f.destination);
  select jsonb_build_object('path_id',path_id,'lane_id',lane_id,'step_id',step_id,'position',position)
    into current_slot from public.cells where id=f.cell_id;
  if current_slot is distinct from f.destination or outcome->>'id' is distinct from f.cell_id::text then
    raise exception 'cell did not move by identity to the exact secondary slot';
  end if;
  if (select to_jsonb(c)-array['path_id','lane_id','step_id','position','updated_at'] from public.cells c where id=f.cell_id)
      is distinct from f.original_cell-array['path_id','lane_id','step_id','position','updated_at'] then
    raise exception 'move changed text, status, key or another nonstructural field';
  end if;
  select jsonb_build_object(
    'placements',(select jsonb_agg(to_jsonb(t) order by id) from public.cell_touchpoints t where cell_id=f.cell_id),
    'resources',(select jsonb_agg(to_jsonb(r) order by id) from public.resources r where cell_id=f.cell_id),
    'evidence',(select jsonb_agg(to_jsonb(e) order by id) from public.evidence e where cell_id=f.cell_id),
    'edges',(select jsonb_agg(to_jsonb(d) order by id) from public.cell_dependencies d where source_cell_id=f.cell_id)) into linked;
  if linked is distinct from f.linked or not exists(select 1 from public.cells where id=f.occupied_id and content='Existing destination' and position=0) then
    raise exception 'move changed provenance, incident edges or the occupied destination';
  end if;
  if (select revert from public.authoring_changes where id=(outcome->>'change_id')::uuid)
      is distinct from jsonb_build_object('fn','move_cell','args',jsonb_build_object(
        'cell_id',f.cell_id,'expected_source',f.destination,'destination',f.source)) then
    raise exception 'move did not capture its actual coordinates as durable inverse';
  end if;
end $$;
reset role;

do $$
begin
  if has_function_privilege('anon','public.move_cell(uuid,jsonb,jsonb)','EXECUTE')
     or has_function_privilege('service_role','public.move_cell(uuid,jsonb,jsonb)','EXECUTE')
     or not has_function_privilege('authenticated','public.move_cell(uuid,jsonb,jsonb)','EXECUTE') then
    raise exception 'move execution permissions are wrong';
  end if;
end $$;
set local role anon;
do $$ begin
  begin
    perform public.move_cell(null,'{}','{}');
    raise exception 'anonymous caller was allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
do $$
declare f move_fixture%rowtype; claim text; bad jsonb; edge uuid;
begin
  select * into strict f from move_fixture;
  foreach claim in array array['{"role":"authenticated","app_metadata":{}}',
    '{"role":"authenticated","app_metadata":{"role":"rpc_writer"}}',
    '{"role":"service_role","app_metadata":{"role":"service"}}'] loop
    perform set_config('request.jwt.claims',claim,true);
    begin
      perform public.move_cell(f.cell_id,f.destination,f.source);
      raise exception 'unauthorized move was allowed';
    exception when insufficient_privilege then null; end;
  end loop;
  perform set_config('request.jwt.claims','{"role":"authenticated","app_metadata":{"role":"service"}}',true);
  begin
    perform public.move_cell(f.cell_id,f.source,f.destination);
    raise exception 'stale source was allowed';
  exception when serialization_failure then null; end;
  begin
    perform public.move_cell('d7630000-0000-4000-8000-000000000099',f.source,f.destination);
    raise exception 'missing cell was allowed';
  exception when no_data_found then null; end;
  begin
    perform public.move_cell(f.cell_id,f.destination,f.destination||'{"position":0}');
    raise exception 'occupied slot was overwritten';
  exception when unique_violation then null; end;
  for bad in select value from jsonb_array_elements(jsonb_build_array(
      null,'{}'::jsonb,f.destination,f.destination||'{"position":-1}',
      f.destination||'{"position":null}',f.destination||'{"unknown":1}',
      f.across_path||jsonb_build_object('path_id',f.source->>'path_id'),
      f.destination||jsonb_build_object('step_id',f.unused_step_id),f.foreign_destination,
      f.destination||'{"step_id":"d7630000-0000-4000-8000-000000000099"}',
      f.destination||'{"path_id":"d7630000-0000-4000-8000-000000000099"}')) loop
    begin
      perform public.move_cell(f.cell_id,f.destination,bad);
      raise exception 'invalid destination was allowed: %',bad;
    exception when invalid_parameter_value then null; end;
  end loop;
  -- A cross-path move is allowed when there are no incident edges.
  perform public.move_cell(f.independent_id,f.independent_source,f.across_path);
  if not exists(select 1 from public.cells where id=f.independent_id and path_id=(f.across_path->>'path_id')::uuid and status='built') then
    raise exception 'independent cross-path move failed';
  end if;
  perform public.move_cell(f.independent_id,f.across_path,f.independent_source);
  -- And when there are: a link may cross paths within one service, and a
  -- move never leaves its scenario, so the edge stays as it was.
  edge:=(public.set_cell_dependency(f.independent_id,f.occupied_id)->>'id')::uuid;
  perform public.move_cell(f.independent_id,f.independent_source,f.across_path);
  if not exists(select 1 from public.cell_dependencies d where d.id=edge
      and d.source_cell_id=f.independent_id and d.target_cell_id=f.occupied_id) then
    raise exception 'cross-path move lost its incident dependency';
  end if;
  perform public.move_cell(f.independent_id,f.across_path,f.independent_source);
  perform public.clear_cell_dependency(edge);
  if (select count(*) from public.authoring_changes where fn='move_cell' and args->>'cell_id'=f.cell_id::text) <> 1 then
    raise exception 'refused move appended a ledger row';
  end if;
end $$;
reset role;

create function public.move_proof_fail_log() returns trigger language plpgsql as $$
begin
  if new.fn='move_cell' then
    if current_setting('move_proof.fail',true)='error' then
      raise exception 'fixture ledger failure' using errcode='23514';
    end if;
    return null;
  end if;
  return new;
end $$;
create trigger move_proof_fail_log before insert on public.authoring_changes
  for each row execute function public.move_proof_fail_log();
set local role authenticated;
do $$
declare f move_fixture%rowtype;
begin
  select * into strict f from move_fixture;
  perform set_config('move_proof.fail','error',true);
  begin
    perform public.move_cell(f.cell_id,f.destination,f.source);
    raise exception 'ledger error did not abort move';
  exception when check_violation then null; end;
  perform set_config('move_proof.fail','zero',true);
  begin
    perform public.move_cell(f.cell_id,f.destination,f.source);
    raise exception 'zero-row ledger did not abort move';
  exception when raise_exception then
    if sqlerrm <> 'Cell move produced no durable change id' then raise; end if;
  end;
  if not exists(select 1 from public.cells where id=f.cell_id and step_id=(f.destination->>'step_id')::uuid and position=1)
     or (select count(*) from public.authoring_changes where fn='move_cell' and args->>'cell_id'=f.cell_id::text) <> 1 then
    raise exception 'failed ledger left a partial move';
  end if;
end $$;
reset role;
drop trigger move_proof_fail_log on public.authoring_changes;
drop function public.move_proof_fail_log();

set local role authenticated;
do $$
declare f move_fixture%rowtype;
begin
  select * into strict f from move_fixture;
  perform public.move_cell(f.cell_id,f.destination,f.source);
  if (select to_jsonb(c)-'updated_at' from public.cells c where id=f.cell_id) is distinct from f.original_cell-'updated_at' then
    raise exception 'known inverse did not restore original cell';
  end if;
end $$;
reset role;
rollback;
\echo move_cell public read-back proof PASS (fixture rolled back)
