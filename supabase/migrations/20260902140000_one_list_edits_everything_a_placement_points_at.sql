-- One list edits everything a placement points at.
--
-- 20260902130000 made a placement's resources the cell's too, and left the
-- cell's own list (`sync_cell_resources`) refusing a placement's ids: those
-- rows are the touchpoint's to write. This is the write. Two functions, one
-- restore, and the rule the ticket is firm about — featuring a preview
-- clears the previous one IN THE SAME TRANSACTION, so a placement never
-- carries two.
--
--   sync_placement_resources(p_placement_id, p_rows)
--     The placement's list, replaced: rows not named are deleted, rows named
--     by id are updated in place (name, url, position — never kind, never
--     featured), rows with no id are inserted. An id that is not this
--     placement's is refused; a placement that does not exist is refused,
--     which is the "zero rows is a real answer" check. Reordering therefore
--     changes no `featured` value: the column is not in the UPDATE.
--
--   set_featured_resource(p_resource_id, p_featured)
--     One row's `featured`, and — when featuring an ATTACHMENT — the previous
--     featured attachment of the same owner cleared first, under the partial
--     unique index that would otherwise refuse the second. Returns the rows
--     it changed as `{id, featured}` pairs, before-values, which is the
--     inverse: featuring an attachment writes exactly two rows, and undo
--     restores both. Unsetting writes one. A link is never cleared for
--     another link; any number may be buttons.
--
--   restore_featured_resources(p_rows)
--     The inverse, identity-keyed: each `{id, featured}` written back as it
--     was, with no clearing rule — the captured state was legal when it was
--     captured. Refuses an empty list and a row that is gone.
--
-- All three are SECURITY DEFINER behind `is_service_account()`, closed to
-- anon, like the cell's list and every structural write: `authenticated`
-- holds no UPDATE grant on `resources`, and gains none here.
--
-- ── Replaying against an empty database ───────────────────────────────────
--
-- Definitions only. The proof asserts the three exist, are definer-guarded
-- and closed to anon — vacuous about rows, true everywhere.

create or replace function public.sync_placement_resources(
  p_placement_id uuid,
  p_rows         jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $function$
declare
  v_cell_id  uuid;
  v_nameless int;
  v_foreign  int;
begin
  if not public.is_service_account() then
    raise exception 'This account cannot edit the blueprint' using errcode = '42501';
  end if;

  select ct.cell_id into v_cell_id
    from public.cell_touchpoints ct
   where ct.id = p_placement_id;
  if v_cell_id is null then
    raise exception 'touchpoint placement % does not exist', p_placement_id;
  end if;

  select count(*) into v_nameless
  from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb))
    as r(id uuid, kind text, name text, url text)
  where nullif(btrim(coalesce(r.name, '')), '') is null
     or nullif(btrim(coalesce(r.url, '')), '') is null;
  if v_nameless <> 0 then
    raise exception '% resource(s) arrived with no name or no url', v_nameless;
  end if;

  -- An id has to be one of THIS placement's rows.
  select count(*) into v_foreign
  from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as r(id uuid)
  where r.id is not null
    and not exists (
      select 1 from public.resources x
       where x.id = r.id and x.cell_touchpoint_id = p_placement_id
    );
  if v_foreign <> 0 then
    raise exception '% resource id(s) are not rows of placement %', v_foreign, p_placement_id;
  end if;

  delete from public.resources x
   where x.cell_touchpoint_id = p_placement_id
     and x.id not in (
       select r.id
         from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as r(id uuid)
        where r.id is not null
     );

  -- Kept rows: name, url, position. Not kind, not featured.
  update public.resources x
     set name       = btrim(r.name),
         url        = btrim(r.url),
         position   = r.ord::int,
         updated_at = now()
    from rows from (
           jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb))
             as (id uuid, kind text, name text, url text)
         ) with ordinality as r(id, kind, name, url, ord)
   where x.id = r.id
     and x.cell_touchpoint_id = p_placement_id;

  insert into public.resources
    (cell_id, cell_touchpoint_id, kind, name, url, position, origin)
  select v_cell_id, p_placement_id,
         coalesce(nullif(btrim(coalesce(r.kind, '')), ''), 'link'),
         btrim(r.name),
         btrim(r.url),
         r.ord::int,
         'app'
    from rows from (
           jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb))
             as (id uuid, kind text, name text, url text)
         ) with ordinality as r(id, kind, name, url, ord)
   where r.id is null;
end
$function$;

create or replace function public.set_featured_resource(
  p_resource_id uuid,
  p_featured    boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $function$
declare
  v_row      public.resources;
  v_previous jsonb;
begin
  if not public.is_service_account() then
    raise exception 'This account cannot edit the blueprint' using errcode = '42501';
  end if;

  select * into v_row from public.resources where id = p_resource_id for update;
  if v_row.id is null then
    raise exception 'resource % does not exist', p_resource_id;
  end if;

  -- What this call changes, as it was. The row itself, and — when a
  -- preview is being set — the previous preview of the same owner.
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'featured', x.featured)), '[]'::jsonb)
    into v_previous
    from public.resources x
   where x.id = p_resource_id
      or (p_featured and v_row.kind = 'attachment'
          and x.featured and x.kind = 'attachment' and x.id <> p_resource_id
          and x.cell_touchpoint_id is not distinct from v_row.cell_touchpoint_id
          and x.cell_id = v_row.cell_id);

  if p_featured and v_row.kind = 'attachment' then
    update public.resources x
       set featured = false, updated_at = now()
     where x.featured and x.kind = 'attachment' and x.id <> p_resource_id
       and x.cell_touchpoint_id is not distinct from v_row.cell_touchpoint_id
       and x.cell_id = v_row.cell_id;
  end if;

  update public.resources
     set featured = p_featured, updated_at = now()
   where id = p_resource_id;

  return jsonb_build_object('previous', v_previous);
end
$function$;

create or replace function public.restore_featured_resources(p_rows jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $function$
declare
  v_expected int;
begin
  if not public.is_service_account() then
    raise exception 'This account cannot edit the blueprint' using errcode = '42501';
  end if;

  select count(*) into v_expected
    from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as r(id uuid, featured boolean);
  if v_expected = 0 then
    raise exception 'nothing to restore';
  end if;

  if (select count(*) from public.resources x
        join jsonb_to_recordset(p_rows) as r(id uuid, featured boolean) on r.id = x.id)
     <> v_expected then
    raise exception 'some of the % resources to restore no longer exist', v_expected;
  end if;

  -- Clears first, then sets. The partial unique index behind "one preview
  -- per owner" is checked row by row, not at commit, so restoring
  -- {old: true, new: false} in one statement can meet a moment where both
  -- are true and be refused — the capture, run backwards.
  update public.resources x
     set featured = false, updated_at = now()
    from jsonb_to_recordset(p_rows) as r(id uuid, featured boolean)
   where x.id = r.id and not r.featured;
  update public.resources x
     set featured = true, updated_at = now()
    from jsonb_to_recordset(p_rows) as r(id uuid, featured boolean)
   where x.id = r.id and r.featured;
end
$function$;

comment on function public.sync_placement_resources(uuid, jsonb) is
  'The touchpoint''s list at one cell, replaced in order: delete the rows not '
  'named, update the named ones (name, url, position — never kind or '
  'featured), insert the rest. Refuses another placement''s id and a '
  'placement that is gone.';
comment on function public.set_featured_resource(uuid, boolean) is
  'One row''s featured flag. Featuring an attachment clears the owner''s '
  'previous featured attachment in the same transaction and returns both '
  'before-states, which is the inverse.';
comment on function public.restore_featured_resources(jsonb) is
  'The inverse of set_featured_resource: each {id, featured} written back '
  'as captured, no clearing rule.';

revoke execute on function public.sync_placement_resources(uuid, jsonb) from public, anon;
grant execute on function public.sync_placement_resources(uuid, jsonb) to authenticated;
revoke execute on function public.set_featured_resource(uuid, boolean) from public, anon;
grant execute on function public.set_featured_resource(uuid, boolean) to authenticated;
revoke execute on function public.restore_featured_resources(jsonb) from public, anon;
grant execute on function public.restore_featured_resources(jsonb) to authenticated;

-- ── Proof ──────────────────────────────────────────────────────────────────
do $proof$
declare
  fn text;
begin
  foreach fn in array array[
    'public.sync_placement_resources(uuid, jsonb)',
    'public.set_featured_resource(uuid, boolean)',
    'public.restore_featured_resources(jsonb)'
  ] loop
    if not (select prosecdef from pg_proc where oid = fn::regprocedure) then
      raise exception '% is not SECURITY DEFINER', fn;
    end if;
    if has_function_privilege('anon', fn, 'execute') then
      raise exception 'anon can execute %', fn;
    end if;
    if not has_function_privilege('authenticated', fn, 'execute') then
      raise exception 'authenticated cannot execute %', fn;
    end if;
  end loop;
end
$proof$;
