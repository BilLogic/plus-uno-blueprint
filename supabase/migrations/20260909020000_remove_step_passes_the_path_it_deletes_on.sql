-- remove_step is raising on every call, and has been since 20260820030000.
--
-- That migration made `deletion_impact('step', ...)` REFUSE without a
-- `scope_id`, because a step count taken across every path is not true of a
-- delete that touches one. It dropped the two-argument signature and added
-- the third argument with a default. What it did not do is look at the one
-- caller: `remove_step`'s body still says
--
--   impact := public.deletion_impact('step', step_id);
--
-- which no longer resolves to a two-argument function — it resolves to the
-- three-argument one with `scope_id` null, which is exactly the case that
-- raises. So the guard fires on the legitimate caller and every step delete
-- ends in
--
--   P0001 deletion_impact('step', ...) needs scope_id = the path_id
--
-- The fix is the argument the guard was asking for. `remove_step` knows the
-- path — it is the first parameter, and every delete below is already scoped
-- by it.
--
-- One thing changes beyond the raise. `affected_slices` is read off the same
-- impact call, so it was being computed (before the drop) over the step on
-- EVERY path while the delete only ever removed one path's cells. The archive
-- now names the slices this delete actually disturbs.
--
-- Body only: signature, grants and the security posture are untouched.

CREATE OR REPLACE FUNCTION public.remove_step(path_id uuid, step_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog', 'pg_temp'
AS $function$
declare
  archive_id uuid;
  impact jsonb;
  payload jsonb;
begin
  if not public.is_service_account() then
    raise exception 'This account cannot edit the blueprint' using errcode = '42501';
  end if;
  impact := public.deletion_impact('step', remove_step.step_id, remove_step.path_id);

  select jsonb_build_object(
    'step', to_jsonb(s),
    'path_id', remove_step.path_id,
    'cells', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb)
              from public.cells c
              where c.step_id = s.id and c.path_id = remove_step.path_id)
  ) into payload
  from public.steps s where s.id = step_id;

  insert into public.authoring_changes (fn, deleted_kind, label, payload, affected_slices)
  values ('remove_step', 'step', impact ->> 'label', payload, impact -> 'affected_slices')
  returning id into archive_id;

  delete from public.cells
    where cells.step_id = remove_step.step_id and cells.path_id = remove_step.path_id;
  delete from public.path_steps
    where path_steps.step_id = remove_step.step_id and path_steps.path_id = remove_step.path_id;

  delete from public.steps s
    where s.id = remove_step.step_id
      and not exists (select 1 from public.path_steps ps where ps.step_id = s.id);

  with ordered as (
    select ps.step_id, row_number() over (order by ps.position) - 1 as position
    from public.path_steps ps where ps.path_id = remove_step.path_id
  )
  update public.path_steps ps
    set position = ordered.position
    from ordered
    where ps.path_id = remove_step.path_id and ps.step_id = ordered.step_id;

  return archive_id;
end;
$function$;
