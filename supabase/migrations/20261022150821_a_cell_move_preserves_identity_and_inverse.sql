-- A move preserves the cell's identity and every row that points to it.
-- All three structural writers take the dependency-table lock before reading
-- parents. Cell-row locking alone would permit an edge/move race: the older
-- edge writers validated parents before their INSERT acquired a table lock.
create or replace function public.move_cell(cell_id uuid, expected_source jsonb, destination jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  previous public.cells%rowtype;
  source_slot record;
  target_slot record;
  source_scenario uuid;
  target_scenario uuid;
  target_lane_path uuid;
  target_step_scenario uuid;
  actual_source jsonb;
  actual_target jsonb;
  inverse jsonb;
  written_id uuid;
  change_id uuid;
begin
  if not public.is_service_account() or auth.uid() is null
     or (auth.jwt()->>'role') is distinct from 'authenticated'
     or (auth.jwt()->'app_metadata'->>'role') is distinct from 'service' then
    raise exception 'This account cannot edit the blueprint' using errcode = '42501';
  end if;
  if jsonb_typeof(expected_source) is distinct from 'object'
     or jsonb_typeof(destination) is distinct from 'object' then
    raise exception 'A move requires full expected and destination coordinates' using errcode = '22023';
  end if;
  if expected_source-array['path_id','lane_id','step_id','position'] <> '{}'::jsonb
     or destination-array['path_id','lane_id','step_id','position'] <> '{}'::jsonb then
    raise exception 'Move coordinates contain unknown fields' using errcode = '22023';
  end if;
  select * into source_slot from jsonb_to_record(expected_source) as x(path_id uuid,lane_id uuid,step_id uuid,position integer);
  select * into target_slot from jsonb_to_record(destination) as x(path_id uuid,lane_id uuid,step_id uuid,position integer);
  if source_slot.path_id is null or source_slot.lane_id is null or source_slot.step_id is null or source_slot.position is null
     or target_slot.path_id is null or target_slot.lane_id is null or target_slot.step_id is null or target_slot.position is null
     or source_slot.position < 0 or target_slot.position < 0 then
    raise exception 'Move coordinates require parents and nonnegative positions' using errcode = '22023';
  end if;

  lock table public.cell_dependencies in share row exclusive mode;
  select c.* into previous from public.cells c where c.id=move_cell.cell_id for update;
  if not found then raise exception 'No cell %', cell_id using errcode='P0002'; end if;
  if row(previous.path_id,previous.lane_id,previous.step_id,previous.position)
      is distinct from row(source_slot.path_id,source_slot.lane_id,source_slot.step_id,source_slot.position) then
    raise exception 'Cell coordinates changed; refresh before moving' using errcode='40001';
  end if;
  if row(source_slot.path_id,source_slot.lane_id,source_slot.step_id,source_slot.position)
      is not distinct from row(target_slot.path_id,target_slot.lane_id,target_slot.step_id,target_slot.position) then
    raise exception 'A move must change coordinates' using errcode='22023';
  end if;

  select p.scenario_id into source_scenario from public.paths p where p.id=previous.path_id for key share;
  select p.scenario_id into target_scenario from public.paths p where p.id=target_slot.path_id for key share;
  if not found or source_scenario is distinct from target_scenario then
    raise exception 'Move parents must belong to the same scenario' using errcode='22023';
  end if;
  select l.path_id into target_lane_path from public.lanes l where l.id=target_slot.lane_id for key share;
  if not found or target_lane_path is distinct from target_slot.path_id then
    raise exception 'Destination lane must belong to its path' using errcode='22023';
  end if;
  select s.scenario_id into target_step_scenario from public.steps s where s.id=target_slot.step_id for key share;
  if not found or target_step_scenario is distinct from target_scenario then
    raise exception 'Destination step must belong to its scenario' using errcode='22023';
  end if;
  perform 1 from public.path_steps ps where ps.path_id=target_slot.path_id and ps.step_id=target_slot.step_id for key share;
  if not found then raise exception 'Destination path must carry the step' using errcode='22023'; end if;
  if exists(select 1 from public.cells c where c.lane_id=target_slot.lane_id and c.step_id=target_slot.step_id and c.position=target_slot.position) then
    raise exception 'Destination cell slot is occupied' using errcode='23505';
  end if;
  if exists(select 1 from public.cell_dependencies d
      join public.cells other on other.id=case when d.source_cell_id=previous.id then d.target_cell_id else d.source_cell_id end
      where (d.source_cell_id=previous.id or d.target_cell_id=previous.id) and other.path_id<>target_slot.path_id) then
    raise exception 'Move would separate an incident dependency across paths' using errcode='23514';
  end if;

  actual_source := jsonb_build_object('path_id',previous.path_id,'lane_id',previous.lane_id,'step_id',previous.step_id,'position',previous.position);
  actual_target := jsonb_build_object('path_id',target_slot.path_id,'lane_id',target_slot.lane_id,'step_id',target_slot.step_id,'position',target_slot.position);
  inverse := jsonb_build_object('fn','move_cell','args',jsonb_build_object('cell_id',previous.id,'expected_source',actual_target,'destination',actual_source));
  update public.cells c set path_id=target_slot.path_id,lane_id=target_slot.lane_id,step_id=target_slot.step_id,position=target_slot.position,updated_at=now()
    where c.id=previous.id returning c.id into written_id;
  if not found then raise exception 'No cell written' using errcode='P0002'; end if;
  change_id := public.record_authoring_change('move_cell',jsonb_build_object('cell_id',previous.id,'expected_source',actual_source,'destination',actual_target),inverse);
  if change_id is null then raise exception 'Cell move produced no durable change id'; end if;
  return jsonb_build_object('id',written_id,'change_id',change_id,'revert',inverse);
end;
$$;
revoke execute on function public.move_cell(uuid,jsonb,jsonb) from public,anon,service_role;
grant execute on function public.move_cell(uuid,jsonb,jsonb) to authenticated;
comment on function public.move_cell(uuid,jsonb,jsonb) is
  'Move an existing cell to a vacant explicit slot in the same scenario, preserving identity and incident dependencies. Expected coordinates and atomic durable inverse required; callers do not append another log row.';

-- Preserve both existing RPC bodies and grants; add only lock coordination.
-- Fail on an unexpected definition instead of silently patching the wrong
-- shape. The guard remains first, before any lock or parent read.
do $coordinate_locks$
declare
  operation regprocedure;
  definition text;
  guard text := $guard$  if not public.is_service_account() then
    raise exception 'This account cannot edit the blueprint'
      using errcode = '42501';
  end if;$guard$;
  lock_statement text := 'lock table public.cell_dependencies in share row exclusive mode;';
begin
  foreach operation in array array[
    'public.set_cell_dependency(uuid,uuid,text,text,text)'::regprocedure,
    'public.update_cell_dependency(uuid,text,uuid,text)'::regprocedure
  ] loop
    definition := pg_get_functiondef(operation);
    if position(lock_statement in definition) > 0 then continue; end if;
    if position(guard in definition) = 0 then
      raise exception 'Expected authorization guard missing from %', operation;
    end if;
    execute replace(definition, guard, guard || E'\n\n  ' || lock_statement);
  end loop;
end;
$coordinate_locks$;
