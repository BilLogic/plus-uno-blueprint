-- Explicit-position insertion never upserts the existing goal conversation.
-- Identity keys use the existing descriptive stem plus a server-minted UUID
-- suffix: a key must stay unique even after a cell moves out of its old slot.
create or replace function public.insert_cell_at_position(
  path_id uuid, lane_id uuid, step_id uuid, at_position integer,
  content text, status public.entity_status
)
returns jsonb
language plpgsql security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  scenario uuid;
  lane_path uuid;
  step_scenario uuid;
  created_id uuid := gen_random_uuid();
  written_id uuid;
  created_key text;
  inverse jsonb;
  change_id uuid;
begin
  if not public.is_service_account() or auth.uid() is null
     or (auth.jwt()->>'role') is distinct from 'authenticated'
     or (auth.jwt()->'app_metadata'->>'role') is distinct from 'service' then
    raise exception 'This account cannot edit the blueprint' using errcode='42501';
  end if;
  if at_position is null or at_position < 0
     or insert_cell_at_position.content is null or insert_cell_at_position.content !~ '[^[:space:]]'
     or insert_cell_at_position.status is null then
    raise exception 'Insertion requires a nonnegative position, content and explicit status' using errcode='22023';
  end if;
  select p.scenario_id into scenario from public.paths p where p.id=insert_cell_at_position.path_id for key share;
  if not found then raise exception 'No parent path' using errcode='22023'; end if;
  select l.path_id into lane_path from public.lanes l where l.id=insert_cell_at_position.lane_id for key share;
  if not found or lane_path is distinct from insert_cell_at_position.path_id then
    raise exception 'Cell lane must belong to its path' using errcode='22023';
  end if;
  select s.scenario_id into step_scenario from public.steps s where s.id=insert_cell_at_position.step_id for key share;
  if not found or step_scenario is distinct from scenario then
    raise exception 'Cell step must belong to its scenario' using errcode='22023';
  end if;
  perform 1 from public.path_steps ps where ps.path_id=insert_cell_at_position.path_id and ps.step_id=insert_cell_at_position.step_id for key share;
  if not found then raise exception 'Cell path must already carry the step' using errcode='22023'; end if;

  created_key := public.mint_cell_key(path_id,lane_id,step_id) || '--' || created_id::text;
  if created_key is null then raise exception 'Insertion could not mint a cell key'; end if;
  inverse := jsonb_build_object('fn','delete_cell','args',jsonb_build_object('cell_id',created_id));
  -- The existing unique slot constraint arbitrates concurrent insertions.
  -- No ON CONFLICT UPDATE: a collision must leave the old row untouched.
  insert into public.cells(id,path_id,lane_id,step_id,position,content,status,origin,cell_key)
    values(created_id,insert_cell_at_position.path_id,insert_cell_at_position.lane_id,insert_cell_at_position.step_id,
      at_position,btrim(insert_cell_at_position.content),insert_cell_at_position.status,'app',created_key)
    returning id into written_id;
  if not found then raise exception 'No cell inserted' using errcode='P0002'; end if;
  change_id := public.record_authoring_change('insert_cell_at_position',jsonb_build_object(
    'path_id',path_id,'lane_id',lane_id,'step_id',step_id,'position',at_position,
    'content',btrim(insert_cell_at_position.content),'status',insert_cell_at_position.status,'cell_id',written_id),inverse);
  if change_id is null then raise exception 'Cell insertion produced no durable change id'; end if;
  return jsonb_build_object('id',written_id,'cell_key',created_key,'change_id',change_id,'revert',inverse);
end;
$$;
revoke execute on function public.insert_cell_at_position(uuid,uuid,uuid,integer,text,public.entity_status) from public,anon,service_role;
grant execute on function public.insert_cell_at_position(uuid,uuid,uuid,integer,text,public.entity_status) to authenticated;
comment on function public.insert_cell_at_position(uuid,uuid,uuid,integer,text,public.entity_status) is
  'Insert a new cell into a vacant explicit position at its initial status with a server-minted identity/key and atomic durable inverse. Does not upsert or change path membership. Deletion inverse is human-only; callers do not append another log row.';
