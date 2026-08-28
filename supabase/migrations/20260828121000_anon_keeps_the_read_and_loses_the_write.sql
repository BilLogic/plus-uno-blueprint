-- 20260828121000 — anon's write GRANTS go, and the last unset search_path.
--
-- Nothing here is exploitable today, and that is the point. A grant and a
-- policy are two independent gates and PostgREST needs both; `anon` holds
-- table-level INSERT/UPDATE/DELETE (and on eight of them TRUNCATE) on twelve
-- tables in `public`, and passes none of them because no PERMISSIVE write
-- policy names `anon` anywhere in the schema. Measured, not assumed:
--
--   select grantee, table_name, privilege_type
--     from information_schema.role_table_grants
--    where table_schema = 'public' and grantee = 'anon';
--
--   agent_messages  agent_sessions  cell_dependencies  cells  lanes
--   path_steps      paths           phases             scenarios
--   services        stakeholders    steps
--
-- TWELVE, not the eleven the audit reported — its ten named tables plus the two
-- agent tables is twelve, so the miscount is arithmetic rather than a table it
-- missed. Every one of them keeps SELECT, which is deliberate: the deployed
-- site reads the blueprint as `anon` and the `*_select` policies say
-- `to public using (true)` on purpose.
--
-- A THIRTEENTH RELATION, WHICH THE LIST DID MISS, and which the assertion below
-- found rather than a reader: `public.evidence_counts` is a VIEW and `anon`
-- holds TRUNCATE on it. The grant is inert — Postgres accepts it and then
-- refuses the operation, because a view has no storage to truncate — so nothing
-- is exploitable and nothing would ever have failed. It is here because the
-- post-condition below is written against the SCHEMA rather than against the
-- list, and it refused to pass while any anon write grant remained. A revoke
-- shaped like a list is a revoke that is complete only by luck; this is the
-- first draft of this file being wrong, caught by its own assertion.
--
-- THE RISK IS THE NEXT POLICY EDIT, not this one. `stakeholders` already shows
-- the shape that would trip it: its write policies are PERMISSIVE with
-- `is_service_account()` in the predicate rather than RESTRICTIVE companions,
-- so a policy written `to public` instead of `to authenticated` — one word —
-- turns a dormant grant into an open write. Removing the grant means that
-- mistake produces nothing rather than everything, and `scripts/check-rls-posture.mjs`
-- fails if either half comes back.
--
-- TRUNCATE goes with them. It bypasses RLS entirely, so for TRUNCATE the grant
-- is not one of two gates, it is the only one.
--
-- NOT TOUCHED, and named so the next reader knows it was seen rather than
-- missed: `anon` also holds REFERENCES and TRIGGER on these tables, and
-- `authenticated` holds TRUNCATE on nine of them, both agent tables included.
-- The second is the sharper one — TRUNCATE bypasses RLS, so on those nine the
-- grant is the only gate there is, and the ownership migration that lands
-- beside this file is not enforced against it. PostgREST cannot spell TRUNCATE,
-- which is why this has been survivable, but "the client we ship cannot say it"
-- is not an access control. Both are wider than this file's subject and each is
-- its own change; `scripts/check-rls-posture.mjs` names them under what it
-- deliberately does not assert, so they stay visible instead of forgotten.
--
-- THE SECOND SUBJECT is `lanes_owner_team_is_a_party`, the one function in
-- `public` with `proconfig` null. 34 of the 35 functions pin a search_path — 30
-- as `public, pg_catalog, pg_temp` and four as `pg_catalog, pg_temp` — and this
-- trigger, which fires on every lane insert and update, resolves
-- `public.stakeholders` against whatever the caller left in the path. The body
-- is schema-qualified so there is no live exploit; the missing SET is the
-- finding.

create temporary table anon_select_before as
select table_name
from information_schema.role_table_grants
where table_schema = 'public' and grantee = 'anon' and privilege_type = 'SELECT';

revoke insert, update, delete, truncate on
  public.agent_messages,
  public.agent_sessions,
  public.cell_dependencies,
  public.cells,
  public.lanes,
  public.path_steps,
  public.paths,
  public.phases,
  public.scenarios,
  public.services,
  public.stakeholders,
  public.steps
from anon;

-- The view. Separate statement, because `revoke truncate` is all it has and
-- listing it above would suggest it ever had the other three.
revoke truncate on public.evidence_counts from anon;

create or replace function public.lanes_owner_team_is_a_party()
returns trigger
language plpgsql
set search_path = public, pg_catalog, pg_temp
as $function$
begin
  if new.owner_team is not null
     and not exists (select 1 from public.stakeholders s where s.name = new.owner_team)
  then
    raise exception 'owner_team "%" is not a party in the registry', new.owner_team;
  end if;
  return new;
end $function$;

do $assert$
declare
  n int;
  leftovers text;
begin
  -- 1. No write grant to anon survives ANYWHERE in `public`, not merely on the
  -- twelve. Scoped to the schema rather than to the list because the list is
  -- what today looks like and the invariant is what tomorrow has to look like —
  -- a thirteenth table granted next month is exactly the case a list-shaped
  -- assertion would wave through.
  select count(*), string_agg(distinct table_name || ' ' || privilege_type, ', ' order by table_name || ' ' || privilege_type)
    into n, leftovers
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee = 'anon'
    and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');
  if n <> 0 then
    raise exception 'anon still holds % write grant(s) in public: %', n, leftovers;
  end if;

  -- 2. SELECT is EXACTLY what it was. The blueprint is anon-readable on
  -- purpose and a revoke list is one comma away from taking the read with the
  -- write — a failure that would not surface in this repository at all, because
  -- the deployed site is the only anon reader and nothing here signs in as one.
  -- The comparison is against a snapshot taken before the revoke, which is the
  -- only way to state "unchanged" rather than "plausible".
  select count(*), string_agg(table_name, ', ' order by table_name) into n, leftovers
  from (
    select table_name from anon_select_before
    except
    select table_name from information_schema.role_table_grants
    where table_schema = 'public' and grantee = 'anon' and privilege_type = 'SELECT'
  ) lost;
  if n <> 0 then
    raise exception 'the revoke took anon SELECT with it on: %', leftovers;
  end if;

  -- 3. The trigger function pins a search_path, and `public` is in it because
  -- the body reads `public.stakeholders`.
  select count(*) into n
  from pg_proc p
  join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public' and p.proname = 'lanes_owner_team_is_a_party'
    and p.proconfig is not null
    and exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%public%');
  if n <> 1 then
    raise exception 'lanes_owner_team_is_a_party still resolves its tables against the caller''s search_path';
  end if;

  -- 4. And nothing in `public` is left without one. This is the assertion that
  -- outlives the function above: it was written for one finding and it fails
  -- for the next one too.
  select count(*), string_agg(p.proname, ', ' order by p.proname) into n, leftovers
  from pg_proc p
  join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public'
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%');
  if n <> 0 then
    raise exception '% function(s) in public have no search_path pinned: %', n, leftovers;
  end if;

  -- 5. The guard the function exists for is still in the body. `create or
  -- replace` rewrites the whole thing, and a search_path fix that quietly
  -- dropped the check would leave a trigger that fires, compiles, and permits
  -- every owner_team — the failure this schema would notice last.
  select count(*) into n
  from pg_proc p
  join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public' and p.proname = 'lanes_owner_team_is_a_party'
    and position('from public.stakeholders s where s.name = new.owner_team' in p.prosrc) > 0
    and position('is not a party in the registry' in p.prosrc) > 0;
  if n <> 1 then
    raise exception 'lanes_owner_team_is_a_party no longer checks owner_team against the registry';
  end if;

  -- 6. And the trigger is still attached to it. A function nothing calls is a
  -- function that passes every assertion above and enforces nothing.
  select count(*) into n
  from pg_trigger t
  join pg_proc p on p.oid = t.tgfoid
  where not t.tgisinternal and p.proname = 'lanes_owner_team_is_a_party';
  if n < 1 then
    raise exception 'no trigger calls lanes_owner_team_is_a_party any more';
  end if;
end
$assert$;

drop table anon_select_before;
