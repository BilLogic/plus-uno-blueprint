-- `upsert_cell` raised on every call. It is the only way a cell is ever
-- created, so nothing could author a grid.
--
--     ERROR 42702: column reference "layer_id" is ambiguous
--     DETAIL: It could refer to either a PL/pgSQL variable or a table column.
--
-- The parameters are named `layer_id` and `step_id`, and `on conflict (…)`
-- takes bare column names that cannot be table-qualified — so `upsert_cell.
-- layer_id` is not available there the way it is everywhere else in the body.
-- plpgsql refuses to guess, which is the one mercy here: the SQL-language
-- functions with the same collision (`slices_referencing`, `mint_cell_key`)
-- silently bound to the column and returned wrong answers instead.
--
-- Fixed by naming the constraint rather than the columns. `on conflict on
-- constraint` takes an identifier, not a column list, so there is nothing left
-- to be ambiguous — and the function keeps its signature, which matters
-- because PostgREST resolves these by parameter name and the app already calls
-- it with `path_id`/`layer_id`/`step_id`.
--
-- Found by running the RPCs rather than reading them. Every earlier check
-- confirmed the function *resolved*; none had made it execute.

create or replace function public.upsert_cell(
  path_id uuid,
  layer_id uuid,
  step_id uuid,
  content text
)
returns uuid
language plpgsql security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  cell_id uuid;
  next_column int;
begin
  if not exists (
    select 1 from public.path_steps ps
    where ps.path_id = upsert_cell.path_id and ps.step_id = upsert_cell.step_id
  ) then
    select coalesce(max(column_position) + 1, 0) into next_column
    from public.path_steps where path_steps.path_id = upsert_cell.path_id;
    insert into public.path_steps (path_id, step_id, column_position)
    values (upsert_cell.path_id, upsert_cell.step_id, next_column);
  end if;

  -- Minted on insert, never on update: a cell's key is its identity for slice
  -- recovery, so renaming a lane must not silently repoint every slice that
  -- referenced the cells in it.
  insert into public.cells (path_id, layer_id, step_id, content, origin, cell_key)
  values (upsert_cell.path_id, upsert_cell.layer_id, upsert_cell.step_id,
          coalesce(content, ''), 'app',
          public.mint_cell_key(upsert_cell.path_id, upsert_cell.layer_id,
                               upsert_cell.step_id))
  on conflict on constraint cells_layer_step_unique
    do update set content = excluded.content
  returning id into cell_id;

  return cell_id;
end;
$$;

grant execute on function public.upsert_cell(uuid, uuid, uuid, text) to authenticated;
