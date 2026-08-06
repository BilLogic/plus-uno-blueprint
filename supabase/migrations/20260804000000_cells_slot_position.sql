-- Stage 2 of the tech-cell split (docs/plans/2026-08-04-001): a slot may
-- hold several cells, ordered by slot_position. Every existing cell is 0,
-- so nothing changes until the stage-3 data migration populates siblings.
alter table public.cells add column slot_position int not null default 0;

alter table public.cells
  drop constraint cells_layer_step_unique,
  add constraint cells_layer_step_slot_unique
    unique (layer_id, step_id, slot_position);

-- upsert_cell keeps its exact contract — create on empty, update on click —
-- by always addressing slot 0. Siblings are created only by the split
-- migration (and later by dedicated touchpoint operations), never here.
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

  insert into public.cells (path_id, layer_id, step_id, slot_position, content, origin, cell_key)
  values (upsert_cell.path_id, upsert_cell.layer_id, upsert_cell.step_id, 0,
          coalesce(content, ''), 'app',
          public.mint_cell_key(upsert_cell.path_id, upsert_cell.layer_id,
                               upsert_cell.step_id))
  on conflict on constraint cells_layer_step_slot_unique
    do update set content = excluded.content
  returning id into cell_id;

  return cell_id;
end;
$$;

revoke execute on function public.upsert_cell(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.upsert_cell(uuid, uuid, uuid, text) to authenticated;
