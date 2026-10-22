-- A step is shared by its path memberships. Renaming its identity changes
-- only its name; moving cells or replacing the step would lose that meaning.
-- This operation records its own inverse atomically. Callers must not append
-- a second durable row. This migration defines the capability, not content.
create or replace function public.rename_step(
  step_id uuid,
  expected_name text,
  new_name text
)
returns jsonb
language plpgsql security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  previous_name text;
  written_id uuid;
  change_id uuid;
  inverse jsonb;
begin
  -- is_service_account also recognizes rpc_writer inside a definer. These
  -- audit capabilities are deliberately restricted to the dev authoring tier.
  if not public.is_service_account()
     or auth.uid() is null
     or (auth.jwt() ->> 'role') is distinct from 'authenticated'
     or (auth.jwt() -> 'app_metadata' ->> 'role') is distinct from 'service' then
    raise exception 'This account cannot edit the blueprint' using errcode = '42501';
  end if;
  if rename_step.expected_name is null or nullif(btrim(rename_step.new_name), '') is null then
    raise exception 'A step rename requires its expected name and nonempty new name' using errcode = '22023';
  end if;

  -- Capture after locking: a competing rename cannot pass the same expected
  -- value, and the inverse always names what THIS write actually replaced.
  select s.name into previous_name from public.steps s
    where s.id = rename_step.step_id for update;
  if not found then
    raise exception 'No step %', rename_step.step_id using errcode = 'P0002';
  end if;
  if previous_name is distinct from rename_step.expected_name then
    raise exception 'Step name changed; refresh before renaming' using errcode = '40001';
  end if;
  if previous_name = btrim(rename_step.new_name) then
    raise exception 'A step rename must change the name' using errcode = '22023';
  end if;

  inverse := jsonb_build_object('fn', 'rename_step', 'args', jsonb_build_object(
    'step_id', rename_step.step_id, 'expected_name', btrim(rename_step.new_name), 'new_name', previous_name));
  update public.steps s set name = btrim(rename_step.new_name), updated_at = now()
    where s.id = rename_step.step_id returning s.id into written_id;
  if not found then
    raise exception 'No step written' using errcode = 'P0002';
  end if;
  change_id := public.record_authoring_change('rename_step', jsonb_build_object(
    'step_id', rename_step.step_id, 'expected_name', previous_name, 'new_name', btrim(rename_step.new_name)), inverse);
  if change_id is null then
    raise exception 'Step rename produced no durable change id';
  end if;
  return jsonb_build_object('id', written_id, 'change_id', change_id, 'revert', inverse);
end;
$$;

revoke execute on function public.rename_step(uuid, text, text) from public, anon, service_role;
grant execute on function public.rename_step(uuid, text, text) to authenticated;
comment on function public.rename_step(uuid, text, text) is
  'Rename one shared step by identity with an expected-name guard and atomic durable inverse. Dev authenticated authoring only; callers do not append another log row.';
