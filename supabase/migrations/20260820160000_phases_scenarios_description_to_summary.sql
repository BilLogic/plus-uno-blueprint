-- phases.description → summary, scenarios.description → summary.
--
-- Finishes the sweep. cells, paths and steps all say `summary`; phases and
-- scenarios were the two levels left behind, and plan 003's panels label both
-- fields "Summary" — the same label-over-column drift that migration
-- 20260820090000 removed from cells.
--
-- ALSO: `phases.description` had NO update grant at all, so the phase panel
-- could not have written it under either name. The grant is the reason this
-- migration is needed at all; the rename is the reason to do it now.
--
-- THE TRAP, again: `alter table ... rename column` does NOT touch plpgsql
-- bodies. Three functions name a description here, and `description` is also
-- a column on slices inside search_blueprint's body — so every fragment is
-- replaced by its qualified alias, never bare.
--
-- create_phase is the one that cannot be patched in place: its ARGUMENT is
-- named `description`, and Postgres refuses to rename an input parameter
-- through CREATE OR REPLACE. It is dropped and recreated, which means THE ACL
-- TRAP: a recreate restores Postgres's default EXECUTE to PUBLIC. The original
-- ACL is postgres | authenticated | service_role — no PUBLIC, no anon — and it
-- is re-applied and asserted below. This is the same defect that migration
-- 20260820120200 had to repair after the fact.
--
-- The arg rename is safe to make in one repo: PostgREST binds RPC args by
-- name, and `create_phase` has exactly one caller — src/lib/authoringRpc.ts.
-- uno-bot never calls it (it calls search_blueprint only).
--
-- search_blueprint's `description` OUTPUT column is UNCHANGED. That is
-- uno-bot's wire format (blueprintContract.searchBlueprintColumns), and it is
-- a separate decision from what the tables call their columns.

alter table public.phases    rename column description to summary;
alter table public.scenarios rename column description to summary;

grant update (summary) on public.phases to authenticated;

do $do$
declare d text; before_len int;
begin
  -- duplicate_scenario -------------------------------------------------------
  select pg_get_functiondef(p.oid) into d
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'duplicate_scenario';
  if d is null then raise exception 'duplicate_scenario not found'; end if;
  before_len := length(d);
  d := replace(d, '(phase_id, name, description, position, view_type, origin)',
                  '(phase_id, name, summary, position, view_type, origin)');
  d := replace(d, 'select source_phase_id, duplicate_scenario.name, sc.description,',
                  'select source_phase_id, duplicate_scenario.name, sc.summary,');
  if length(d) = before_len then
    raise exception 'duplicate_scenario: no scenarios.description fragment matched';
  end if;
  execute d;

  -- search_blueprint ---------------------------------------------------------
  select pg_get_functiondef(p.oid) into d
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'search_blueprint';
  if d is null then raise exception 'search_blueprint not found'; end if;
  before_len := length(d);
  d := replace(d, 'ph.name as nm, ph.description as descr,',
                  'ph.name as nm, ph.summary as descr,');
  d := replace(d, e'select \'scenario\', sc.id, sc.name, sc.description, sc.updated_at,',
                  e'select \'scenario\', sc.id, sc.name, sc.summary, sc.updated_at,');
  if length(d) = before_len then
    raise exception 'search_blueprint: no phase/scenario description fragment matched';
  end if;
  execute d;

  -- create_phase — drop and recreate, because the ARG is being renamed -------
  select pg_get_functiondef(p.oid) into d
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'create_phase';
  if d is null then raise exception 'create_phase not found'; end if;
  before_len := length(d);
  d := replace(d, 'create_phase(lifecycle_id uuid, name text, description text DEFAULT NULL::text)',
                  'create_phase(lifecycle_id uuid, name text, summary text DEFAULT NULL::text)');
  d := replace(d, 'service_lifecycle_id, name, description, position, origin',
                  'service_lifecycle_id, name, summary, position, origin');
  d := replace(d, e'nullif(trim(create_phase.description), \'\')',
                  e'nullif(trim(create_phase.summary), \'\')');
  if length(d) = before_len then
    raise exception 'create_phase: no description fragment matched';
  end if;
  drop function public.create_phase(uuid, text, text);
  execute d;
end
$do$;

-- The ACL the drop discarded, restored exactly.
--
-- TWO revokes, not one. Postgres restores its own default EXECUTE to PUBLIC,
-- AND Supabase ships an `alter default privileges … grant execute on functions
-- to anon, authenticated, service_role`, so a freshly created function is
-- reachable by anon even after PUBLIC is revoked. The assertion at the bottom
-- of this migration caught exactly that on the first run — the recreate came
-- back `postgres | anon | authenticated | service_role` against an original of
-- `postgres | authenticated | service_role`.
revoke all on function public.create_phase(uuid, text, text) from public, anon;
grant execute on function public.create_phase(uuid, text, text)
  to authenticated, service_role;

do $assert$
declare acl text;
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and pg_get_functiondef(p.oid) ~ '\m(ph|sc)\.description\M'
  ) then
    raise exception 'a function still reads a phase or scenario description';
  end if;

  select array_to_string(p.proacl::text[], ' | ') into acl
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'create_phase';
  -- A bare `=X/` entry (no grantee) is PUBLIC.
  if acl is null or acl ~ '(^| )=X/' then
    raise exception 'create_phase is executable by PUBLIC: %', acl;
  end if;
  if acl like '%anon=X%' then
    raise exception 'create_phase is executable by anon: %', acl;
  end if;
  if acl not like '%authenticated=X%' then
    raise exception 'create_phase lost its authenticated grant: %', acl;
  end if;

  if not exists (
    select 1 from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'phases'
      and column_name = 'summary' and grantee = 'authenticated'
      and privilege_type = 'UPDATE'
  ) then
    raise exception 'phases.summary is not writable by authenticated';
  end if;
end
$assert$;
