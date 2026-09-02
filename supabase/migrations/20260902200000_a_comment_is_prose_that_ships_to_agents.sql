-- A comment is prose that ships to agents.
--
-- The live contract check probes identifiers: a doc naming `cells.links`
-- fails the day the column goes. It could not probe a claim about which
-- VALUES a column accepts, which is the class the 2026-09-01 audit paid most
-- for — `scenarios.layout` taught as single/side-by-side/integrated against a
-- CHECK of single|stacked; the Planned:/Prototype: convention taught eleven
-- days after its deletion. And the catalog's own comments were never swept
-- at all, although #260 renders the agent-facing schema section from them:
-- the `paths` table comment still read "(happy, unhappy, exception,
-- alternative)" while `kind` accepts happy|variant|exception, and
-- `cell_dependencies.kind`'s still glossed trigger/needs, a pair this
-- database has refused since 20260820110000.
--
-- PostgREST exposes `pg_catalog` to no role — not anon, not service_role —
-- so the check has no way to read a constraint under any key. These two
-- functions are that way. Both read the catalog and nothing else, both are
-- SECURITY INVOKER (the catalog is readable by every role already; there is
-- nothing to escalate), and both are granted to anon because the check runs
-- in CI under the anon key and a constraint's definition is not a secret —
-- the columns it constrains are public-read and the docs that state it are
-- in this repository.
--
--   value_sets()       one row per single-column CHECK, per domain, and per
--                      column typed by a domain: source, relation, column,
--                      name, and the deparsed definition. The check parses
--                      the definition; the function does not interpret it.
--   schema_comments()  every table, view and column comment in public.
--
-- The four comments below are the ones the sweep found stale on
-- 2026-09-02, fixed here so the check can be green from its first run:
-- `paths` (the value list), `cell_dependencies.kind` (trigger/needs),
-- `resources` ("exactly one of cell_id and cell_touchpoint_id" — every
-- resource carries cell_id since 20260902100000) and `resources.kind` ("a
-- site-relative image path" — an object in the bucket since 20260902180000).
--
-- ── Replaying against an empty database ───────────────────────────────────
--
-- Function definitions and comments only. The proof is an INVARIANT: each
-- function is callable by anon, `value_sets()` reports the domain and a
-- CHECK the schema has, and no comment this file rewrites still carries the
-- value it removed.

create or replace function public.value_sets()
returns table (source text, relation text, column_name text, name text, definition text)
language sql
stable
set search_path = pg_catalog
as $$
  select 'check',
         rel.relname::text,
         a.attname::text,
         c.conname::text,
         pg_get_constraintdef(c.oid)
    from pg_constraint c
    join pg_class rel on rel.oid = c.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    left join pg_attribute a
      on a.attrelid = c.conrelid
     and cardinality(c.conkey) = 1
     and a.attnum = c.conkey[1]
   where n.nspname = 'public'
     and c.contype = 'c'
  union all
  select 'domain',
         null,
         null,
         t.typname::text,
         pg_get_constraintdef(c.oid)
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    join pg_constraint c on c.contypid = t.oid
   where n.nspname = 'public'
     and t.typtype = 'd'
  union all
  select 'domain',
         rel.relname::text,
         a.attname::text,
         t.typname::text,
         pg_get_constraintdef(c.oid)
    from pg_attribute a
    join pg_class rel on rel.oid = a.attrelid
    join pg_namespace n on n.oid = rel.relnamespace
    join pg_type t on t.oid = a.atttypid and t.typtype = 'd'
    join pg_constraint c on c.contypid = t.oid
   where n.nspname = 'public'
     and rel.relkind = 'r'
     and a.attnum > 0
     and not a.attisdropped
$$;

comment on function public.value_sets() is
  'The value lists the schema enforces, read off the catalog: one row per single-column CHECK, per domain, and per column typed by a domain. The definition is deparsed, not interpreted; check-blueprint-contract parses it and holds every documented value set and every catalog comment to it. PostgREST exposes pg_catalog to no role, which is why this is a function.';

create or replace function public.schema_comments()
returns table (relation text, column_name text, comment text)
language sql
stable
set search_path = pg_catalog
as $$
  select c.relname::text,
         null,
         obj_description(c.oid, 'pg_class')
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind in ('r', 'v', 'm')
     and obj_description(c.oid, 'pg_class') is not null
  union all
  select c.relname::text,
         a.attname::text,
         col_description(c.oid, a.attnum)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
   where n.nspname = 'public'
     and c.relkind in ('r', 'v', 'm')
     and col_description(c.oid, a.attnum) is not null
$$;

comment on function public.schema_comments() is
  'Every table, view and column comment in public. A comment is prose that ships to agents — #260 renders the schema section from it — so check-blueprint-contract sweeps it for retired identifiers and stale value sets exactly as it sweeps markdown.';

grant execute on function public.value_sets() to anon, authenticated, service_role;
grant execute on function public.schema_comments() to anon, authenticated, service_role;

-- The four comments the first sweep found stale.

comment on table public.paths is
  'One route through a scenario: happy, variant or exception (kind), and how far along it is (status). Nothing connects across paths; a path is a detour, not a stage.';

comment on column public.cell_dependencies.kind is
  'leads_to = temporal (this cell makes the other happen; drawn as an arrow); enables = functional (the other must already be in place). enables renders in the panel only.';

comment on table public.resources is
  'Things a cell, or one touchpoint placement, points at. A link is one kind of resource and `kind` carries the subtype. cell_id is always set; cell_touchpoint_id is set as well when the resource is a placement''s, so a design link can belong to the tool it documents while staying the cell''s.';

comment on column public.resources.kind is
  'link = a place on the web; attachment = a file the cell points at, an object in the cell-attachments bucket reached by its public URL (#274). Both carry a url. Host and file type are read at render, never stored.';

do $proof$
declare
  v_rows integer;
begin
  if not has_function_privilege('anon', 'public.value_sets()', 'execute') then
    raise exception 'proof: anon cannot execute value_sets()';
  end if;
  if not has_function_privilege('anon', 'public.schema_comments()', 'execute') then
    raise exception 'proof: anon cannot execute schema_comments()';
  end if;

  select count(*) into v_rows
    from public.value_sets() v
   where v.source = 'check'
     and v.relation = 'scenarios'
     and v.column_name = 'layout'
     and v.definition like '%''stacked''%'
     and v.definition like '%''merged''%';
  if v_rows <> 1 then
    raise exception 'proof: value_sets() does not report scenarios.layout as stacked|merged (% rows)', v_rows;
  end if;

  select count(*) into v_rows
    from public.value_sets() v
   where v.source = 'domain'
     and v.name = 'entity_status'
     and v.relation = 'paths'
     and v.column_name = 'status';
  if v_rows <> 1 then
    raise exception 'proof: value_sets() does not report paths.status as typed by entity_status (% rows)', v_rows;
  end if;

  select count(*) into v_rows
    from public.schema_comments() s
   where (s.relation = 'paths' and s.column_name is null and s.comment ~* '\munhappy\M')
      or (s.relation = 'cell_dependencies' and s.column_name = 'kind' and s.comment ~* '\mtrigger\M|\mneeds\M')
      or (s.relation = 'resources' and s.column_name is null and s.comment ~* 'exactly one of')
      or (s.relation = 'resources' and s.column_name = 'kind' and s.comment ~* 'site-relative');
  if v_rows <> 0 then
    raise exception 'proof: % comment(s) this file rewrote still carry the value it removed', v_rows;
  end if;
end
$proof$;
