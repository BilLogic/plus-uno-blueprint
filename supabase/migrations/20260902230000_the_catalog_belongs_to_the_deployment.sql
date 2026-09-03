-- The catalog belongs to the deployment, not to the service.
--
-- #334 (parent #303), the one data-model change ADR 0014 forces. A deployment
-- can now hold more than one service, and that split the domain in two: the
-- JOURNEY — phase, scenario, path, step, lane, cell, slice — is a hard
-- per-service boundary, while the CATALOG of nouns a journey references —
-- `touchpoints` (the tools) and `stakeholders` (the actors) — is one
-- deployment-level pool. The name is the identity, and a service's membership
-- is implicit: it "has" a catalog entry exactly when its journey references it.
-- ADR 0014 is where the reasoning lives; this migration is where it lands, per
-- ADR 0009 (the migration that drops `service_id` carries the argument).
--
-- ── What changes ───────────────────────────────────────────────────────────
--
-- Both `touchpoints` (born 20260830140000) and `stakeholders` (born
-- 20260820170000) drop their `service_id` owner and its FK to `services`, and
-- uniqueness moves from `(service_id, name)` to `(name)` across the whole
-- deployment. `touchpoints.stakeholder_id` STAYS and is coherent again: both
-- ends of it are deployment-level now, so a shared touchpoint's owner is no
-- longer forced to point at one service's actor.
--
-- `sync_cell_touchpoints` minted a catalog row scoped to the cell's service —
-- `insert … (service_id, name, origin) … on conflict (service_id, name)`,
-- deriving the id from the cell's phase. It stops deriving it: a touchpoint is
-- minted by name alone, `on conflict (name)`. `set_placement_touchpoint`
-- checked a chosen registry id against the cell's service; it now checks that
-- the id is in the registry at all, because the registry is the deployment's.
-- Both keep every other line, their SECURITY DEFINER posture and their guard
-- (20260902190000). The other three placement functions never named
-- `service_id`, so they are left exactly as they are.
--
-- ── Why re-uniquing on (name) cannot collide on today's data ────────────────
--
-- Current production is single-service — one `services` row — so every
-- touchpoint and every stakeholder already carries that one `service_id`, which
-- makes `unique (service_id, name)` and `unique (name)` the SAME constraint on
-- the rows that exist. Dropping the service column and re-uniquing on `(name)`
-- therefore cannot find a duplicate to reject: the names were already unique
-- deployment-wide because there was only ever one service to be scoped to.
--
-- ── The grant surface is untouched ─────────────────────────────────────────
--
-- `authenticated` never held UPDATE on either `service_id` column — the panel
-- sweep (20260830290000) granted `touchpoints (name, updated_at)` and
-- `stakeholders (name, kind, summary, aliases)` and nothing else — so a dropped
-- column leaves no stale grant behind, and `PANEL_COLUMNS` in
-- `scripts/check-rls-posture.mjs` needs no edit. `keyColumns` simply loses two
-- foreign keys it was already forbidding UPDATE on.
--
-- ── Replaying against an empty database ────────────────────────────────────
--
-- Both tables exist in an empty replay (neither birth migration is in the
-- unable-to-replay baseline), so the alters apply and the re-unique lands on
-- zero rows. The proof is an INVARIANT, not a census: neither table carries a
-- `service_id` any more, each carries a single-column `unique (name)`, and
-- neither carries the old `(service_id, name)` — every one of which reads the
-- same on an empty replay as on production.

-- ── The touchpoint catalog loses its service owner ─────────────────────────

alter table public.touchpoints drop constraint if exists touchpoints_service_id_name_key;
alter table public.touchpoints drop constraint if exists touchpoints_service_id_fkey;
alter table public.touchpoints drop column if exists service_id;
alter table public.touchpoints add constraint touchpoints_name_key unique (name);

comment on table public.touchpoints is
  'Deployment-level catalog of the tools, documents, channels and artifacts the '
  'services use. One row per real thing, unique by name across the deployment; '
  'a service references it, no service owns it (ADR 0014).';
comment on column public.touchpoints.name is
  'The identity: unique across the deployment, so a second service reuses an '
  'entry by naming the same tool the same way rather than minting its own.';

-- ── The stakeholder cast loses its service owner ───────────────────────────

alter table public.stakeholders drop constraint if exists stakeholders_service_id_name_key;
alter table public.stakeholders drop constraint if exists stakeholders_service_id_fkey;
alter table public.stakeholders drop column if exists service_id;
alter table public.stakeholders add constraint stakeholders_name_key unique (name);

comment on table public.stakeholders is
  'Deployment-level cast list: one pool of actors a lane picks from, unique by '
  'name across the deployment. A lane references a stakeholder; no service owns '
  'one (ADR 0014). The unscoped read this registry always did is now correct.';
comment on column public.stakeholders.name is
  'The identity: unique across the deployment, so the same actor recurs across '
  'services by name rather than as one row per service.';

-- ── The sync stops deriving a service, and minting is by name ──────────────
--
-- Byte-for-byte 20260902190000's body but for the three places `service_id`
-- appeared: the phase lookup no longer reads it (the cell must still resolve
-- to a phase, which is what attaches it to a service), the mint is
-- `(name) … on conflict (name)`, and the two joins to the catalog match on
-- name alone.

create or replace function public.sync_cell_touchpoints(p_cell_id uuid, p_names text[])
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_lane_role  text;
  v_bearing    boolean;
  v_removed    jsonb;
  v_wanted     jsonb;
begin
  if not public.is_service_account() then
    raise exception 'only the service account names a placement''s touchpoint';
  end if;
  -- The cell must resolve all the way up to a phase, which is what attaches it
  -- to a service. The service id is no longer read: the catalog is the
  -- deployment's, so a touchpoint is minted by name alone (ADR 0014).
  select ln.lane_role
    into v_lane_role
    from public.cells c
    join public.lanes ln on ln.id = c.lane_id
    join public.paths p on p.id = c.path_id
    join public.scenarios s on s.id = p.scenario_id
    join public.phases ph on ph.id = s.phase_id
   where c.id = p_cell_id;

  if not found then
    raise exception 'cell % is not attached to a service', p_cell_id;
  end if;

  select v_lane_role in ('frontstage_touchpoints', 'backstage_touchpoints')
         or exists (select 1 from public.cell_touchpoints where cell_id = p_cell_id)
    into v_bearing;

  if not v_bearing then
    return jsonb_build_object('skipped', true, 'removed', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('name', name, 'position', position)), '[]'::jsonb)
    into v_wanted
    from (
      select name, min(ord)::int as position
        from unnest(p_names) with ordinality as t(name, ord)
       where btrim(name) <> ''
       group by name
    ) deduped;

  insert into public.touchpoints (name, origin)
  select w.name, 'app'
    from jsonb_to_recordset(v_wanted) as w(name text, position int)
  on conflict (name) do nothing;

  -- A name typed back links the name-only row that was keeping its
  -- writing, rather than inserting a second row beside it.
  update public.cell_touchpoints ct
     set touchpoint_id = tp.id,
         name          = null,
         updated_at    = now()
    from jsonb_to_recordset(v_wanted) as w(name text, position int)
    join public.touchpoints tp
      on tp.name = w.name
   where ct.cell_id = p_cell_id
     and ct.touchpoint_id is null
     and lower(ct.name) = lower(w.name)
     and not exists (select 1 from public.cell_touchpoints x
                      where x.cell_id = p_cell_id and x.touchpoint_id = tp.id);

  -- What leaves the text: linked rows whose name is not wanted. Handed back
  -- with everything on them, so the inverse can put the words back.
  select coalesce(jsonb_agg(jsonb_build_object(
           'name', tp.name,
           'position', ct.position,
           'summary', ct.summary,
           'role', ct.role,
           'resources', (select coalesce(jsonb_agg(jsonb_build_object(
                             'kind', r.kind, 'name', r.name, 'url', r.url,
                             'position', r.position, 'featured', r.featured, 'origin', r.origin
                           ) order by r.position), '[]'::jsonb)
                           from public.resources r where r.cell_touchpoint_id = ct.id)
         )), '[]'::jsonb)
    into v_removed
    from public.cell_touchpoints ct
    join public.touchpoints tp on tp.id = ct.touchpoint_id
   where ct.cell_id = p_cell_id
     and tp.name not in (
       select w.name from jsonb_to_recordset(v_wanted) as w(name text, position int)
     );

  -- A removed placement with anything on it stays as a name-only row —
  -- words, role and resources intact, drawn dashed — unless the cell already
  -- keeps a name-only row under that name. One with nothing on it goes.
  update public.cell_touchpoints ct
     set touchpoint_id = null,
         name          = tp.name,
         updated_at    = now()
    from public.touchpoints tp
   where ct.touchpoint_id = tp.id
     and ct.cell_id = p_cell_id
     and tp.name not in (
       select w.name from jsonb_to_recordset(v_wanted) as w(name text, position int)
     )
     and (coalesce(btrim(ct.summary), '') <> ''
          or ct.role is not null
          or exists (select 1 from public.resources r where r.cell_touchpoint_id = ct.id))
     and not exists (select 1 from public.cell_touchpoints x
                      where x.cell_id = p_cell_id and x.name is not null
                        and lower(x.name) = lower(tp.name));

  delete from public.cell_touchpoints ct
   using public.touchpoints tp
   where ct.touchpoint_id = tp.id
     and ct.cell_id = p_cell_id
     and tp.name not in (
       select w.name from jsonb_to_recordset(v_wanted) as w(name text, position int)
     );

  update public.cell_touchpoints ct
     set position = w.position,
         updated_at = now()
    from public.touchpoints tp,
         jsonb_to_recordset(v_wanted) as w(name text, position int)
   where ct.touchpoint_id = tp.id
     and ct.cell_id = p_cell_id
     and tp.name = w.name
     and ct.position is distinct from w.position;

  -- Name-only rows sit after the text's own, in the order they had.
  update public.cell_touchpoints ct
     set position = ranked.position,
         updated_at = now()
    from (
      select x.id,
             (select coalesce(max(position), -1) from public.cell_touchpoints y
               where y.cell_id = p_cell_id and y.touchpoint_id is not null)
             + row_number() over (order by x.position, x.name) as position
        from public.cell_touchpoints x
       where x.cell_id = p_cell_id and x.touchpoint_id is null
    ) ranked
   where ct.id = ranked.id
     and ct.position is distinct from ranked.position;

  insert into public.cell_touchpoints (cell_id, touchpoint_id, position, origin)
  select p_cell_id, tp.id, w.position, 'app'
    from jsonb_to_recordset(v_wanted) as w(name text, position int)
    join public.touchpoints tp
      on tp.name = w.name
   where not exists (
     select 1 from public.cell_touchpoints ct
      where ct.cell_id = p_cell_id and ct.touchpoint_id = tp.id
   );

  return jsonb_build_object('skipped', false, 'removed', v_removed);
end
$function$;

-- ── Choosing a registry id no longer scopes by service ─────────────────────

create or replace function public.set_placement_touchpoint(
  p_placement_id uuid,
  p_touchpoint_id uuid default null,
  p_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_row public.cell_touchpoints;
begin
  if not public.is_service_account() then
    raise exception 'only the service account names a placement''s touchpoint';
  end if;
  if (p_touchpoint_id is null) = (nullif(btrim(coalesce(p_name, '')), '') is null) then
    raise exception 'a placement names its touchpoint one way: a registry id or a name';
  end if;

  select ct.* into v_row from public.cell_touchpoints ct where ct.id = p_placement_id for update;
  if v_row.id is null then
    raise exception 'placement % does not exist', p_placement_id;
  end if;

  if p_touchpoint_id is not null then
    -- The catalog is the deployment's (ADR 0014): a touchpoint is in the
    -- registry or it is not — there is no service to scope the lookup by.
    if not exists (select 1 from public.touchpoints tp where tp.id = p_touchpoint_id) then
      raise exception 'that touchpoint is not in the registry';
    end if;
    if exists (select 1 from public.cell_touchpoints x
                where x.cell_id = v_row.cell_id and x.touchpoint_id = p_touchpoint_id and x.id <> v_row.id) then
      raise exception 'that cell already shows that touchpoint';
    end if;
  end if;

  update public.cell_touchpoints
     set touchpoint_id = p_touchpoint_id,
         name          = case when p_touchpoint_id is null then btrim(p_name) end,
         updated_at    = now()
   where id = p_placement_id;

  return jsonb_build_object('touchpoint_id', v_row.touchpoint_id, 'name', v_row.name);
end
$function$;

-- `create or replace` preserves the ACL, but the grant is re-emitted so the
-- posture is stated where the body is, exactly as 20260902190000 did.
revoke execute on function public.sync_cell_touchpoints(uuid, text[]) from public, anon;
grant execute on function public.sync_cell_touchpoints(uuid, text[]) to authenticated;
revoke execute on function public.set_placement_touchpoint(uuid, uuid, text) from public, anon;
grant execute on function public.set_placement_touchpoint(uuid, uuid, text) to authenticated;

-- ── Prove it ───────────────────────────────────────────────────────────────
--
-- Invariants, not a census. Each clause reads the same on an empty replay as on
-- production: the columns are gone, the deployment-wide unique is present, and
-- the service-scoped one is not.

do $proof$
declare
  bad int;
begin
  select count(*) into bad
    from information_schema.columns
   where table_schema = 'public'
     and table_name in ('touchpoints', 'stakeholders')
     and column_name = 'service_id';
  if bad <> 0 then
    raise exception 'service_id still on % of the two catalog tables', bad;
  end if;

  -- Exactly the deployment-wide unique on each, and none scoped by service.
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.touchpoints'::regclass
       and contype = 'u'
       and pg_get_constraintdef(oid) = 'UNIQUE (name)'
  ) then
    raise exception 'touchpoints has no deployment-wide unique (name)';
  end if;
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.stakeholders'::regclass
       and contype = 'u'
       and pg_get_constraintdef(oid) = 'UNIQUE (name)'
  ) then
    raise exception 'stakeholders has no deployment-wide unique (name)';
  end if;
  if exists (
    select 1 from pg_constraint
     where conrelid in ('public.touchpoints'::regclass, 'public.stakeholders'::regclass)
       and contype = 'u'
       and pg_get_constraintdef(oid) ~ 'service_id'
  ) then
    raise exception 'a service-scoped unique survives on a catalog table';
  end if;
end
$proof$;
