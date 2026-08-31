-- The platform's grants arrive with the OBJECT, and a view is an object.
--
-- `20260830240000` revokes anon's writes on the two touchpoint tables and then
-- asks the catalog whether ANY anon write grant survives anywhere in `public`.
-- Applied to production on 2026-08-31 it refused:
--
--   ERROR:  anon still holds 4 write grants in public
--
-- Four, not the eight it went in expecting, and the fourth table was not a
-- table:
--
--   anon  trash  DELETE INSERT TRUNCATE UPDATE
--
-- `public.trash` is the view `20260830200000` creates over `authoring_changes`.
-- The mechanism 240000's header describes — "the platform grants the API roles
-- on relations created in `public`" — says RELATIONS, and every word of it is
-- true of a view. 200000 grants `select on public.trash to anon, authenticated`
-- and revokes nothing, exactly as 140000 did for the two tables before it.
--
-- So 240000 could never have passed in the series it sits in: 200000 creates
-- the view, 230000 and 220000 land, and then 240000 asserts a schema-wide zero
-- that the view breaks. This file is the missing revoke, numbered into the gap
-- at 210000 so it sorts after the view that needs it and before the assertion
-- that counts it.
--
-- `scripts/check-new-table-grants.mjs` is the rule that was supposed to collect
-- this debt at the point it was incurred, and it did not, because it reads
-- `create table` and nothing else. That hole is closed in the same change.
--
-- ── The same mechanism, one role over ─────────────────────────────────────
--
-- `20260830250000` asserts that `authenticated` may update exactly six columns
-- of `cell_touchpoints`. Applied to production it refused too:
--
--   ERROR:  authenticated may update {cell_id,created_at,id,origin,position,
--           prominence,screenshot,summary,touchpoint_id,updated_at,url} on
--           cell_touchpoints; expected exactly (position, prominence,
--           screenshot, summary, updated_at, url)
--
-- Eleven columns, which is every column, which is the table-level grant the
-- platform wrote when `20260830140000` created the table. 140000's careful
-- `grant update (position, summary, screenshot, url, prominence)` added
-- nothing: a column grant beneath a table-level grant is not a narrowing, it
-- is a no-op, and the surface it was written to describe was never the surface
-- the database had.
--
-- That is #183's subject and #183 has not landed. What lands here is only the
-- two tables 250000 names, narrowed to the lists 140000 and 220000 already
-- wrote down — nothing invented, nothing widened. The rest of the schema is
-- left for the ticket that owns it.
--
-- A table-level REVOKE takes the column grants with it, so each list has to be
-- re-granted after the revoke rather than before:
--
--   revoke update on public.cell_touchpoints from authenticated;
--   -- authenticated's UPDATE columns: (none)
--
-- INSERT and DELETE stay table-level and stay granted. `sync_cell_touchpoints`
-- is `security invoker` and runs as its caller, so the grants cannot say "only
-- through the sync" — 250000 says that itself, and asserts instead that
-- `cell_id` and `touchpoint_id` are not updatable, which is what stops an
-- admitted placement being moved onto a cell the gate would have refused.
--
-- TRUNCATE goes. It bypasses RLS, so for TRUNCATE the grant is not one of two
-- gates, it is the only one.

-- ---------------------------------------------------------------------------
-- 1. The view.
-- ---------------------------------------------------------------------------
do $trash$
begin
  if to_regclass('public.trash') is null then
    raise notice 'public.trash is absent — 20260830200000 did not replay here.';
    return;
  end if;
  execute 'revoke insert, update, delete, truncate on public.trash from anon';
  execute 'revoke insert, update, delete, truncate on public.trash from authenticated';
end
$trash$;

-- SELECT stays for both roles. 200000 granted it on purpose: the trash panel
-- reads the view.

-- ---------------------------------------------------------------------------
-- 2. The two touchpoint tables, narrowed for `authenticated` to the column
--    lists 20260830140000 and 20260830220000 already wrote.
-- ---------------------------------------------------------------------------
revoke insert, update, delete, truncate on public.touchpoints from authenticated;
grant insert, delete on public.touchpoints to authenticated;
grant update (name, kind, summary, url, stakeholder_id, updated_at)
  on public.touchpoints to authenticated;

revoke insert, update, delete, truncate on public.cell_touchpoints from authenticated;
grant insert, delete on public.cell_touchpoints to authenticated;
grant update (position, summary, screenshot, url, prominence, updated_at)
  on public.cell_touchpoints to authenticated;

-- ---------------------------------------------------------------------------
-- Post-conditions. Each one holds on an empty database, where the objects it
-- names do not exist and the guarded blocks return early.
-- ---------------------------------------------------------------------------
do $assert$
declare
  surviving int;
  granted   text[];
  expected  text[];
  relation  text;
begin
  if to_regclass('public.trash') is not null then
    select count(*) into surviving
      from information_schema.role_table_grants
     where table_schema = 'public' and table_name = 'trash'
       and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
       and grantee in ('anon', 'authenticated');
    if surviving <> 0 then
      raise exception 'public.trash still hands out % write grants', surviving;
    end if;

    if not has_table_privilege('anon', 'public.trash', 'SELECT') then
      raise exception 'anon lost its read on public.trash — the trash panel is served as anon';
    end if;
  end if;

  foreach relation in array array['touchpoints', 'cell_touchpoints'] loop
    if to_regclass('public.' || relation) is null then
      continue;
    end if;

    expected := case relation
      when 'touchpoints' then
        array['kind','name','stakeholder_id','summary','updated_at','url']
      else
        array['position','prominence','screenshot','summary','updated_at','url']
    end;

    select coalesce(array_agg(column_name order by column_name), array[]::text[])
      into granted
      from information_schema.column_privileges
     where table_schema = 'public' and table_name = relation
       and grantee = 'authenticated' and privilege_type = 'UPDATE';

    if granted <> expected then
      raise exception
        'authenticated may update % on %; expected exactly (%)',
        granted, relation, array_to_string(expected, ', ');
    end if;

    if not has_table_privilege('authenticated', 'public.' || relation, 'INSERT')
       or not has_table_privilege('authenticated', 'public.' || relation, 'DELETE') then
      raise exception
        'authenticated lost INSERT or DELETE on %, which 20260830140000 granted on purpose',
        relation;
    end if;

    if has_table_privilege('authenticated', 'public.' || relation, 'TRUNCATE') then
      raise exception 'authenticated may TRUNCATE %, which bypasses RLS entirely', relation;
    end if;
  end loop;
end
$assert$;
