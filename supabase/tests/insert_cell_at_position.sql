-- Public SQL/read-back proof on a disposable local database, never hosted.
\set ON_ERROR_STOP on
begin;
create temporary table insert_fixture(path_id uuid,lane_id uuid,step_id uuid,existing_id uuid,existing jsonb,step_membership jsonb,unused_step_id uuid,other_lane_id uuid);
grant select on insert_fixture to authenticated;
do $$
declare svc uuid; phase uuid; scenario uuid; path uuid; other_path uuid; lane uuid; other_lane uuid; moment uuid; unused uuid; existing_cell uuid;
begin
  insert into public.services(name) values('cell insertion fixture') returning id into svc;
  insert into public.phases(service_id,name) values(svc,'fixture') returning id into phase;
  insert into public.scenarios(phase_id,name) values(phase,'fixture') returning id into scenario;
  insert into public.paths(scenario_id,name,kind) values(scenario,'one','happy') returning id into path;
  insert into public.paths(scenario_id,name,kind) values(scenario,'two','variant') returning id into other_path;
  insert into public.lanes(path_id,name,position) values(path,'Regular Tutor',0) returning id into lane;
  insert into public.lanes(path_id,name,position) values(other_path,'Regular Tutor',0) returning id into other_lane;
  insert into public.steps(scenario_id,name) values(scenario,'Goal conversation') returning id into moment;
  insert into public.steps(scenario_id,name) values(scenario,'Not carried') returning id into unused;
  insert into public.path_steps(path_id,step_id,position) values(path,moment,0);
  insert into public.cells(path_id,lane_id,step_id,content,status,cell_key)
    values(path,lane,moment,'Existing goal conversation','live',public.mint_cell_key(path,lane,moment)) returning id into existing_cell;
  insert into insert_fixture select path,lane,moment,existing_cell,to_jsonb(c),
    (select jsonb_agg(to_jsonb(ps)) from public.path_steps ps where ps.path_id=path),unused,other_lane
    from public.cells c where c.id=existing_cell;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","app_metadata":{"role":"service"}}',true);
select set_config('request.jwt.claim.sub','d7640000-0000-4000-8000-000000000001',true);
do $$
declare f insert_fixture%rowtype; outcome jsonb; inserted public.cells%rowtype;
begin
  select * into strict f from insert_fixture;
  outcome := public.insert_cell_at_position(f.path_id,f.lane_id,f.step_id,1,'Checks sessions left','built');
  select * into strict inserted from public.cells where id=(outcome->>'id')::uuid;
  if inserted.path_id <> f.path_id or inserted.lane_id <> f.lane_id or inserted.step_id <> f.step_id
      or inserted.position <> 1 or inserted.content <> 'Checks sessions left' or inserted.status <> 'built'
      or inserted.cell_key is null or inserted.cell_key=f.existing->>'cell_key'
      or outcome->>'cell_key' is distinct from inserted.cell_key then
    raise exception 'insert read-back has wrong parents, content, status, position or identity key';
  end if;
  if (select to_jsonb(c) from public.cells c where id=f.existing_id) is distinct from f.existing
      or (select count(*) from public.cells where path_id=f.path_id) <> 2
      or (select jsonb_agg(to_jsonb(ps)) from public.path_steps ps where ps.path_id=f.path_id) is distinct from f.step_membership then
    raise exception 'insertion overwrote existing conversation or changed step membership';
  end if;
  if (select revert from public.authoring_changes where id=(outcome->>'change_id')::uuid)
      is distinct from jsonb_build_object('fn','delete_cell','args',jsonb_build_object('cell_id',inserted.id)) then
    raise exception 'creation has no exact identity-keyed durable inverse';
  end if;
end $$;
reset role;
do $$
begin
  if has_function_privilege('anon','public.insert_cell_at_position(uuid,uuid,uuid,integer,text,public.entity_status)','EXECUTE')
     or has_function_privilege('service_role','public.insert_cell_at_position(uuid,uuid,uuid,integer,text,public.entity_status)','EXECUTE')
     or not has_function_privilege('authenticated','public.insert_cell_at_position(uuid,uuid,uuid,integer,text,public.entity_status)','EXECUTE') then
    raise exception 'insert execution permissions are wrong';
  end if;
end $$;
set local role anon;
do $$ begin
  begin
    perform public.insert_cell_at_position(null,null,null,0,'forbidden','built');
    raise exception 'anonymous insertion allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
do $$
declare f insert_fixture%rowtype; claim text; slot integer; invalid_text text;
begin
  select * into strict f from insert_fixture;
  foreach claim in array array['{"role":"authenticated","app_metadata":{}}',
      '{"role":"authenticated","app_metadata":{"role":"rpc_writer"}}',
      '{"role":"service_role","app_metadata":{"role":"service"}}'] loop
    perform set_config('request.jwt.claims',claim,true);
    begin
      perform public.insert_cell_at_position(f.path_id,f.lane_id,f.step_id,2,'Forbidden','built');
      raise exception 'unauthorized insertion allowed';
    exception when insufficient_privilege then null; end;
  end loop;
  perform set_config('request.jwt.claims','{"role":"authenticated","app_metadata":{"role":"service"}}',true);
  foreach slot in array array[0,1] loop
    begin
      perform public.insert_cell_at_position(f.path_id,f.lane_id,f.step_id,slot,'Overwrite','live');
      raise exception 'occupied slot was overwritten';
    exception when unique_violation then null; end;
  end loop;
  foreach slot in array array[-1,null] loop
    begin
      perform public.insert_cell_at_position(f.path_id,f.lane_id,f.step_id,slot,'Invalid','built');
      raise exception 'invalid position allowed';
    exception when invalid_parameter_value then null; end;
  end loop;
  foreach invalid_text in array array['',E' \t\n ',null] loop
    begin
      perform public.insert_cell_at_position(f.path_id,f.lane_id,f.step_id,2,invalid_text,'built');
      raise exception 'blank content allowed';
    exception when invalid_parameter_value then null; end;
  end loop;
  begin
    perform public.insert_cell_at_position(f.path_id,f.lane_id,f.step_id,2,'No status',null);
    raise exception 'missing status allowed';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.insert_cell_at_position(f.path_id,f.lane_id,f.step_id,2,'Invalid status','unknown'::public.entity_status);
    raise exception 'invalid status allowed';
  exception when check_violation then null; end;
  begin
    perform public.insert_cell_at_position(f.path_id,f.other_lane_id,f.step_id,2,'Wrong lane','live');
    raise exception 'lane from another path allowed';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.insert_cell_at_position(f.path_id,f.lane_id,f.unused_step_id,2,'Nonmember','live');
    raise exception 'step membership was invented';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.insert_cell_at_position('d7640000-0000-4000-8000-000000000099',f.lane_id,f.step_id,2,'Missing parent','live');
    raise exception 'missing parent allowed';
  exception when invalid_parameter_value then null; end;
end $$;
reset role;

create function public.insert_proof_fail_log() returns trigger language plpgsql as $$
begin
  if new.fn='insert_cell_at_position' then
    if current_setting('insert_proof.fail',true)='error' then
      raise exception 'fixture ledger failure' using errcode='23514';
    end if;
    return null;
  end if;
  return new;
end $$;
create trigger insert_proof_fail_log before insert on public.authoring_changes
  for each row execute function public.insert_proof_fail_log();
set local role authenticated;
do $$
declare f insert_fixture%rowtype;
begin
  select * into strict f from insert_fixture;
  perform set_config('insert_proof.fail','error',true);
  begin
    perform public.insert_cell_at_position(f.path_id,f.lane_id,f.step_id,2,'Fail log','built');
    raise exception 'ledger exception did not abort insertion';
  exception when check_violation then null; end;
  perform set_config('insert_proof.fail','zero',true);
  begin
    perform public.insert_cell_at_position(f.path_id,f.lane_id,f.step_id,2,'Fail log','built');
    raise exception 'zero-row ledger did not abort insertion';
  exception when raise_exception then
    if sqlerrm <> 'Cell insertion produced no durable change id' then raise; end if;
  end;
  if (select count(*) from public.cells where path_id=f.path_id) <> 2
      or (select count(*) from public.authoring_changes where fn='insert_cell_at_position' and args->>'path_id'=f.path_id::text) <> 1
      or (select to_jsonb(c) from public.cells c where id=f.existing_id) is distinct from f.existing then
    raise exception 'refused insertion changed conversation, counts or ledger';
  end if;
end $$;
reset role;
rollback;
\echo insert_cell_at_position public read-back proof PASS (fixture rolled back)
