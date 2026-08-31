-- #183 (parent #172) — a panel writes its own columns, and nothing else.
--
-- The write boundary this codebase is designed around was a drawing. A panel
-- writes its own columns directly; structure moves only through a SECURITY
-- DEFINER function that records the change. Four tables expressed that in
-- grants. Thirteen granted `authenticated` a TABLE-LEVEL UPDATE, which covers
-- every column there is — `paths.scenario_id` included — so a service account
-- could reparent a path with a plain update and `authoring_changes` would hold
-- nothing about it. #176 made that log durable, which makes the gap more
-- visible rather than less: the record is now permanent, and the write that
-- skips it is still invisible.
--
-- ── This is not an exposure ────────────────────────────────────────────────
--
-- `anon` holds no INSERT/UPDATE/DELETE anywhere in `public` (20260828121000,
-- 20260830240000) and RLS is enabled on every base table, so nobody reached
-- this from outside. It is an integrity boundary between the app's own two
-- write paths, and the account that could cross it is the one the restrictive
-- policy admits on purpose. Read it as a design that was never enforced, not
-- as an incident.
--
-- ── Why the careful column lists were never the operative permission ───────
--
-- Row-level security decides WHO may write, never WHICH COLUMNS, and the app
-- runs as exactly the role `*_service_only` admits. Grants are the only thing
-- in Postgres that speaks about columns at all.
--
-- And a column grant does not narrow a table grant, it widens an empty one.
-- `grant update (name, kind, summary, url, stakeholder_id) on
-- public.touchpoints` reads like a restriction and is an addition: where the
-- table-level UPDATE is also held, every column is writable and the list
-- beside it is decoration. That is the shape the platform keeps producing —
-- it grants the API roles table-level privileges on every relation created in
-- `public`, the same mechanism `check:new-table-grants` collects the anon half
-- of. So the fix is a REVOKE first and the grant second.
--
-- ── The sweep is over every base table, not over a list ────────────────────
--
-- Every base table in `public` loses the table-level UPDATE, including the
-- ones no panel writes and the ones nobody has declared. A table absent from
-- the map below ends with no UPDATE surface at all, which is the safe default
-- and the one a reviewer can act on: the posture check names it, and adding
-- the columns is one line. A map-driven revoke would leave exactly the tables
-- nobody thought about still wide, which is how this started.
--
-- ── UPDATE, deliberately, and not INSERT ───────────────────────────────────
--
-- A row names its parent when it is created — an INSERT into `paths` must set
-- `scenario_id` or there is no path. Identity is CHOSEN once and never changed
-- afterwards, so UPDATE is the privilege that reparents and the only one this
-- file narrows. INSERT stays table-wide; what gates an insert is RLS and the
-- RPC tier guard, as it always has been.
--
-- ── The three key columns that stay, and why none is a reparent ────────────
--
--   public.lanes.stakeholder_id      — an association, not a parent. It names
--     who OWNS the lane; changing it moves no lane anywhere. The lane panel
--     writes it in the same statement as `owner_team` (laneSpecMutations.ts).
--   public.agent_sessions.id         — PostgREST's upsert names every payload
--   public.agent_messages.session_id   column in its ON CONFLICT DO UPDATE set
--     list, and `agent/persistence.ts` upserts a session by its own id and a
--     message by (session_id, seq). The statement sets those columns to the
--     values they already hold; without the grant the chat stops saving.
--
-- Each is asserted in `scripts/check-rls-posture.mjs` rather than merely
-- allowed: an entry whose column stops being a key column, or stops being
-- granted, fails there until somebody deletes it.
--
-- ── The grant that keeps content saves working ─────────────────────────────
--
-- `update (updated_at)` on `touchpoints` and `cell_touchpoints` stays, and it
-- is load-bearing. #187 added it because `sync_cell_touchpoints` and
-- `restore_cell_touchpoints` are SECURITY INVOKER and stamp `updated_at =
-- now()` explicitly, and column privileges are checked against the SET LIST
-- rather than against what a statement changes. #188 then added a trigger
-- BESIDE those stamps rather than replacing them. Both file headers say so.
-- Dropping either the stamps or the grant is a defensible change and it is not
-- this one: this file narrows permissions and re-emits no function body.
--
-- The same rule is why `place_touchpoint_detail`, `restore_touchpoint_detail`
-- and `sync_cell_resources` matter here at all. They are SECURITY INVOKER, so
-- they write under the caller's grants, and every column they SET has to
-- appear below. `sync_cell_resources` sets none — it deletes and re-inserts —
-- which is why `resources` ends with no UPDATE surface, and likewise
-- `unplaced_touchpoint_details`, whose functions only insert and delete.
--
-- ── A partial schema is skipped, never guessed at ──────────────────────────
--
-- The grants below are joined against `information_schema.columns`, so a
-- column that is not there is not granted rather than raising. That is for the
-- replay harness, where 182 files roll back and `stakeholders`, `cells.status`
-- and `services.summary` are simply absent. The post-conditions do not depend
-- on any of them: both are statements about what is NOT granted, so a schema
-- missing pieces cannot satisfy either one by being smaller.

-- ── 1. Every base table loses the table-level UPDATE ───────────────────────

do $$
declare
  v_relation regclass;
begin
  for v_relation in
    select c.oid::regclass
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind in ('r', 'p')
     order by c.relname
  loop
    execute format('revoke update on %s from authenticated', v_relation);
  end loop;
end
$$;

-- ── 2. Each panel gets its own columns back ────────────────────────────────
--
-- One row per (table, column) that a panel — or a SECURITY INVOKER function a
-- panel calls — actually writes. Everything else in the app goes through a
-- SECURITY DEFINER RPC, which bypasses grants entirely and needs no row here.

do $$
declare
  r record;
begin
  for r in
    select p.table_name,
           string_agg(quote_ident(p.column_name), ', ' order by p.column_name) as columns
      from (values
        -- cellContentMutations.ts, and `rename_touchpoint`'s rewrite of the
        -- cell text through `rename_content_item`.
        ('cells', 'content'),
        ('cells', 'summary'),
        ('cells', 'status'),
        ('cells', 'owner'),
        ('cells', 'perceived_owner'),
        -- cellSpecMutations.ts
        ('cells', 'function'),
        ('cells', 'form'),
        ('cells', 'value_props'),
        -- laneSpecMutations.ts
        ('lanes', 'owner_team'),
        ('lanes', 'kpis'),
        ('lanes', 'tools'),
        ('lanes', 'stakeholder_id'),
        -- phaseSpecMutations.ts
        ('phases', 'summary'),
        ('phases', 'business_impact'),
        ('phases', 'operational_requirements'),
        -- scenarioSpecMutations.ts
        ('scenarios', 'summary'),
        ('paths', 'summary'),
        ('paths', 'note'),
        ('paths', 'status'),
        -- stepSpecMutations.ts
        ('steps', 'summary'),
        -- serviceSpecMutations.ts
        ('services', 'summary'),
        ('business_models', 'funding'),
        ('business_models', 'pricing'),
        ('business_models', 'delivery_cost'),
        ('business_models', 'revenue_model'),
        ('business_models', 'partners'),
        -- stakeholderMutations.ts
        ('stakeholders', 'name'),
        ('stakeholders', 'kind'),
        ('stakeholders', 'summary'),
        ('stakeholders', 'aliases'),
        -- evidenceMutations.ts
        ('evidence', 'kind'),
        ('evidence', 'title'),
        ('evidence', 'ref'),
        ('evidence', 'excerpt'),
        -- findingMutations.ts
        ('audit_findings', 'status'),
        ('audit_findings', 'severity'),
        ('audit_findings', 'summary'),
        ('audit_findings', 'run_id'),
        ('audit_findings', 'cell_ids'),
        ('audit_findings', 'cell_keys'),
        ('audit_findings', 'source'),
        -- sliceMutations.ts, and revertChange.ts's `restore_slice_meta`
        ('slices', 'title'),
        ('slices', 'summary'),
        ('slices', 'kind'),
        ('slices', 'actor'),
        ('slices', 'authorship'),
        -- `rename_touchpoint` (SECURITY INVOKER, 20260830220000)
        ('touchpoints', 'name'),
        ('touchpoints', 'updated_at'),
        -- touchpointMutations.ts, plus `sync_cell_touchpoints`,
        -- `restore_cell_touchpoints`, `place_touchpoint_detail` and
        -- `restore_touchpoint_detail`, all SECURITY INVOKER.
        ('cell_touchpoints', 'summary'),
        ('cell_touchpoints', 'screenshot'),
        ('cell_touchpoints', 'url'),
        ('cell_touchpoints', 'prominence'),
        ('cell_touchpoints', 'position'),
        ('cell_touchpoints', 'updated_at'),
        -- agent/persistence.ts — the transcript, upserted by its own key.
        ('agent_sessions', 'id'),
        ('agent_sessions', 'title'),
        ('agent_sessions', 'created_at'),
        ('agent_sessions', 'updated_at'),
        ('agent_messages', 'session_id'),
        ('agent_messages', 'seq'),
        ('agent_messages', 'kind'),
        ('agent_messages', 'payload')
      ) as p(table_name, column_name)
      join information_schema.columns c
        on c.table_schema = 'public'
       and c.table_name = p.table_name
       and c.column_name = p.column_name
      join pg_class rel on rel.relname = p.table_name and rel.relkind in ('r', 'p')
      join pg_namespace ns on ns.oid = rel.relnamespace and ns.nspname = 'public'
     group by p.table_name
     order by p.table_name
  loop
    execute format(
      'grant update (%s) on public.%I to authenticated',
      r.columns, r.table_name
    );
  end loop;
end
$$;

-- ── 3. Prove it ────────────────────────────────────────────────────────────
--
-- Invariants, not a census. Neither of these counts tables or columns, so an
-- empty replay and a full production database read them the same way, and
-- neither can be satisfied by the schema getting smaller.

do $$
declare
  v_wide text;
  v_keys text;
begin
  select string_agg(table_name, ', ' order by table_name)
    into v_wide
    from information_schema.role_table_grants
   where table_schema = 'public'
     and grantee = 'authenticated'
     and privilege_type = 'UPDATE';

  if v_wide is not null then
    raise exception
      'a table-level UPDATE survives for authenticated on: %. It covers every '
      'column, so any column list beside it is decoration.', v_wide;
  end if;

  -- Primary and foreign keys are where a row SITS; everything else about it is
  -- content. `has_column_privilege` is the operative question — it answers
  -- true for a table grant and a column grant alike, so this cannot be
  -- satisfied by moving the grant somewhere the query is not looking.
  select string_agg(format('public.%s.%s', k.rel, k.col), ', ' order by k.rel, k.col)
    into v_keys
    from (
      select distinct c.relname as rel, a.attname as col, c.oid as reloid
        from pg_constraint k
        join pg_class c on c.oid = k.conrelid and c.relkind in ('r', 'p')
        join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
        join lateral unnest(k.conkey) as u(attnum) on true
        join pg_attribute a on a.attrelid = c.oid and a.attnum = u.attnum
       where k.contype in ('p', 'f')
    ) k
   where has_column_privilege('authenticated', k.reloid, k.col, 'UPDATE')
     and (k.rel, k.col) not in (
       ('lanes', 'stakeholder_id'),
       ('agent_sessions', 'id'),
       ('agent_messages', 'session_id')
     );

  if v_keys is not null then
    raise exception
      'authenticated can still UPDATE identifying columns: %. A key column is '
      'where a row sits; moving one is a reparent, and a reparent belongs to '
      'the functions that record it.', v_keys;
  end if;
end
$$;
