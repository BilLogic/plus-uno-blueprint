-- A resource keeps its id across a save (#270).
--
-- `sync_cell_resources` replaced a cell's list by deleting every row and
-- inserting the list again, so a reorder — or a save that changed nothing —
-- gave every resource a fresh id. Nothing minded while a resource was only a
-- name and a url; the moment anything hangs off a row (featuring it as the
-- cell's preview or its button, #264) a churned id is a lost reference.
--
-- Now the list is reconciled against the rows: a row that arrives with its
-- id is updated in place (name, url, kind, position), a row without an id is
-- inserted, and a row the list no longer names is deleted. An id that is not
-- one of THIS cell's rows is refused rather than adopted — a caller that
-- names another cell's row is a caller with a bug, and moving the row would
-- hide it. The recorded inverse writes the captured rows back with their ids,
-- so a revert restores the same rows, not look-alikes.
--
-- The position swap is what needed `resources_cell_position_unique` to be
-- deferrable: mid-update two kept rows hold each other's position, and the
-- constraint is checked once, at commit, when they no longer do.

create or replace function public.sync_cell_resources(
  p_cell_id uuid,
  p_rows    jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_nameless int;
  v_foreign  int;
begin
  if not exists (select 1 from public.cells c where c.id = p_cell_id) then
    raise exception 'cell % does not exist', p_cell_id;
  end if;

  -- Refused rather than defaulted. The editor already falls back to the
  -- url's host, so a nameless row reaching here means a caller skipped that,
  -- and inventing a name on its behalf hides the bug.
  select count(*) into v_nameless
  from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb))
    as r(id uuid, kind text, name text, url text)
  where nullif(btrim(coalesce(r.name, '')), '') is null;
  if v_nameless <> 0 then
    raise exception '% resource(s) arrived with no name', v_nameless;
  end if;

  -- An id has to be one of this cell's own rows.
  select count(*) into v_foreign
  from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as r(id uuid)
  where r.id is not null
    and not exists (
      select 1 from public.resources x
       where x.id = r.id and x.cell_id = p_cell_id
    );
  if v_foreign <> 0 then
    raise exception '% resource id(s) are not rows of cell %', v_foreign, p_cell_id;
  end if;

  -- Rows the list no longer names.
  delete from public.resources x
   where x.cell_id = p_cell_id
     and x.id not in (
       select r.id
         from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as r(id uuid)
        where r.id is not null
     );

  -- Kept rows, updated in place — position included.
  update public.resources x
     set kind       = coalesce(nullif(btrim(coalesce(r.kind, '')), ''), 'link'),
         name       = btrim(r.name),
         url        = nullif(btrim(coalesce(r.url, '')), ''),
         position   = r.ord::int,
         updated_at = now()
    from rows from (
           jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb))
             as (id uuid, kind text, name text, url text)
         ) with ordinality as r(id, kind, name, url, ord)
   where x.id = r.id
     and x.cell_id = p_cell_id;

  -- New rows.
  insert into public.resources (cell_id, kind, name, url, position, origin)
  select p_cell_id,
         coalesce(nullif(btrim(coalesce(r.kind, '')), ''), 'link'),
         btrim(r.name),
         nullif(btrim(coalesce(r.url, '')), ''),
         r.ord::int,
         'app'
    from rows from (
           jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb))
             as (id uuid, kind text, name text, url text)
         ) with ordinality as r(id, kind, name, url, ord)
   where r.id is null;
end
$function$;

-- ── Proof, against real rows ─────────────────────────────────────────────────
--
-- The same shape as 20260830160000's reorder proof: the first cell with two
-- or more resources has its list written back reversed, then written back as
-- it was, inside this transaction. Every id must survive both writes and the
-- positions must come back where they started. On an empty database there is
-- nothing to run against, and the proof says so instead of passing in
-- silence — an invariant on zero rows is not a census.

do $proof$
declare
  v_cell   uuid;
  v_before jsonb;
  v_ids    uuid[];
  v_after  jsonb;
begin
  select cell_id into v_cell
    from public.resources
   where cell_id is not null
   group by cell_id
  having count(*) >= 2
   order by cell_id
   limit 1;

  if v_cell is null then
    raise notice 'no cell holds two resources, so the id proof has nothing to run against';
    return;
  end if;

  select jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'name', name, 'url', url)
                   order by position),
         array_agg(id order by position)
    into v_before, v_ids
    from public.resources where cell_id = v_cell;

  -- Reversed: every row keeps its id, takes a new position.
  perform public.sync_cell_resources(
    v_cell,
    (select jsonb_agg(value order by ord desc)
       from jsonb_array_elements(v_before) with ordinality as e(value, ord))
  );
  if (select array_agg(id order by position) from public.resources where cell_id = v_cell)
     <> (select array_agg(x order by ord desc) from unnest(v_ids) with ordinality as u(x, ord)) then
    raise exception 'the reversed write did not keep the rows'' ids in reversed order';
  end if;

  -- Back as it was.
  perform public.sync_cell_resources(v_cell, v_before);
  select jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'name', name, 'url', url)
                   order by position)
    into v_after
    from public.resources where cell_id = v_cell;
  if v_after <> v_before then
    raise exception 'the restoring write left cell % different from how it found it', v_cell;
  end if;
end
$proof$;
