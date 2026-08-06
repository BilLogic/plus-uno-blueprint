-- The same ambiguity as `upsert_cell`, in the two other functions that upsert.
--
-- `on conflict (col, …)` takes bare column names that cannot be qualified, so
-- a plpgsql parameter sharing a column's name makes the target unresolvable:
--
--     ERROR 42702: column reference "source_cell_id" is ambiguous
--
-- Every drawn link and every column reconciliation raised. Both are named-
-- constraint conflicts now, which take an identifier rather than a column list
-- and so cannot be ambiguous. Signatures are unchanged — PostgREST resolves
-- these by parameter name and the app already calls them as they are.
--
-- Worth noting what was *not* wrong. The audit also flagged bare parameters in
-- `INSERT … VALUES (…)` in `create_scenario`, `add_step` and `create_path`.
-- Those are fine: the target table's columns are not in scope for a VALUES
-- expression, so the name unambiguously means the parameter. Only the conflict
-- targets genuinely break, which is why `create_scenario` ran clean while
-- `set_cell_dependency` did not.

create or replace function public.set_cell_dependency(
  source_cell_id uuid,
  target_cell_id uuid,
  kind text default 'trigger',
  label text default null,
  note text default null
)
returns uuid
language plpgsql security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  dependency_id uuid;
  source_path uuid;
  target_path uuid;
begin
  if set_cell_dependency.source_cell_id = set_cell_dependency.target_cell_id then
    raise exception 'A cell cannot depend on itself';
  end if;
  if set_cell_dependency.kind not in ('trigger', 'needs') then
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

  insert into public.cell_triggers (source_cell_id, target_cell_id, kind, label, note)
  values (set_cell_dependency.source_cell_id, set_cell_dependency.target_cell_id,
          set_cell_dependency.kind,
          nullif(trim(set_cell_dependency.label), ''),
          nullif(trim(set_cell_dependency.note), ''))
  on conflict on constraint cell_triggers_source_target_kind_unique
    do update set label = excluded.label, note = excluded.note
  returning id into dependency_id;

  return dependency_id;
end;
$$;

create or replace function public.set_path_steps(path_id uuid, step_ids uuid[])
returns void
language plpgsql security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  i int;
begin
  delete from public.path_steps ps
    where ps.path_id = set_path_steps.path_id
      and not (ps.step_id = any(set_path_steps.step_ids));

  for i in 1 .. coalesce(array_length(set_path_steps.step_ids, 1), 0) loop
    insert into public.path_steps (path_id, step_id, column_position)
    values (set_path_steps.path_id, set_path_steps.step_ids[i], i - 1)
    on conflict on constraint path_steps_pkey
      do update set column_position = excluded.column_position;
  end loop;
end;
$$;

grant execute on function public.set_cell_dependency(uuid, uuid, text, text, text) to authenticated;
grant execute on function public.set_path_steps(uuid, uuid[]) to authenticated;
