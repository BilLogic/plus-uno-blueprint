-- set_cell_dependency: the writer can say why the edge exists.
--
-- 20260908200000 added `cell_dependencies.note` and the panel reads it, but
-- the only write path never gained the argument — so a note could be shown,
-- and could only ever be put there by hand. The read shipped ahead of the
-- write.
--
-- The signature grows by one, so the four-argument form is dropped by its
-- exact signature rather than left as an overload: an overload that ignores
-- `note` is a live call away from silently discarding it, which is the same
-- class of failure as a dead column in a body.
--
-- `name` and `note` answer different questions and both survive the upsert:
-- name says what the edge is CALLED, note says why it is THERE.

drop function if exists public.set_cell_dependency(uuid, uuid, text, text);

CREATE OR REPLACE FUNCTION public.set_cell_dependency(source_cell_id uuid, target_cell_id uuid, kind text DEFAULT 'leads_to'::text, name text DEFAULT NULL::text, note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog', 'pg_temp'
AS $function$
declare
  dependency_id uuid;
  source_path uuid;
  target_path uuid;
begin
  if not public.is_service_account() then
    raise exception 'This account cannot edit the blueprint'
      using errcode = '42501';
  end if;

  if set_cell_dependency.source_cell_id = set_cell_dependency.target_cell_id then
    raise exception 'A cell cannot depend on itself';
  end if;
  if set_cell_dependency.kind not in ('leads_to', 'enables') then
    raise exception 'Unknown dependency kind %', set_cell_dependency.kind;
  end if;

  select c.path_id into source_path from public.cells c
    where c.id = set_cell_dependency.source_cell_id;
  select c.path_id into target_path from public.cells c
    where c.id = set_cell_dependency.target_cell_id;
  if source_path is null or target_path is null then
    raise exception 'Both cells must exist';
  end if;
  -- Arrows are drawn within one path's grid; a cross-path arrow has nowhere to
  -- render and is what validate_ir.py rejects on import.
  if source_path <> target_path then
    raise exception 'Both cells must be in the same path of the journey';
  end if;

  insert into public.cell_dependencies (source_cell_id, target_cell_id, kind, name, note)
  values (set_cell_dependency.source_cell_id, set_cell_dependency.target_cell_id,
          set_cell_dependency.kind,
          nullif(trim(set_cell_dependency.name), ''),
          nullif(trim(set_cell_dependency.note), ''))
  on conflict on constraint cell_dependencies_source_target_kind_unique
    do update set name = excluded.name, note = excluded.note
  returning id into dependency_id;

  return dependency_id;
end;
$function$;

revoke all on function public.set_cell_dependency(uuid, uuid, text, text, text) from public;
grant execute on function public.set_cell_dependency(uuid, uuid, text, text, text)
  to authenticated, service_role;
