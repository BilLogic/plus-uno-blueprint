-- `create_phase` is executable by PUBLIC and anon in production, and has been
-- since 2026-08-21.
--
-- `20260821410000_the_last_lifecycle_is_a_parameter_name.sql` drops and
-- recreates the function to change a parameter name, then says, at line 77:
--
--     -- The drop takes the grants with it. Without this the RPC exists and
--     -- every caller gets 42501 instead — a different failure wearing the
--     -- same clothes.
--     grant execute on function public.create_phase(uuid, text, text) to authenticated;
--
-- The comment names the hazard and then restores half of what the drop
-- removed. `drop function` discards the explicit grants AND the earlier
-- `revoke ... from public, anon`; `create function` re-applies Postgres's
-- default EXECUTE TO PUBLIC. Re-granting `authenticated` leaves PUBLIC exactly
-- where the default put it.
--
-- One day earlier, 20260820160000 got it right — `revoke all ... from public,
-- anon` first, then the grant, then an assertion on the resulting ACL. Its
-- header even records the assertion catching this on its first run. The
-- assertion was written for one function, so it did not travel.
--
-- Nothing was exploitable. `create_phase` opens with
-- `if not public.is_service_account() then raise ... 42501`, and
-- `is_service_account()` reads `auth.jwt() -> 'app_metadata' ->> 'role'`, which
-- an anon key does not carry. Probed against production with the anon key on
-- 2026-08-26: `create_phase` answers "This account cannot edit the blueprint"
-- where every correctly-revoked write RPC answers "permission denied for
-- function". Same HTTP 401, same SQLSTATE, different sentence — the grant was
-- gone as a barrier and only the guard was left.
--
-- That distinction is the whole reason the invariant exists. The guard is
-- meant to be the second line. An edit that moves or renames it — the kind of
-- edit this repository has made twice this month — turns a defence-in-depth
-- gap into an open door with nothing else in the way.
--
-- This is the third time this estate has met the same mechanism. #67 raised it
-- for `rename_owner_tag`, fixed in 20260805170000 for that one function. #137
-- chased its ghost into a different project for three weeks. Each fix named a
-- function. None of them named the rule.
--
-- So the assertion below is not about `create_phase`. It is
-- docs/reference/schema-snapshot-queries.sql's fourth query — the one that file
-- calls "the invariant worth checking on every refresh" — moved out of a file a
-- human is trusted to run and into a place that fails. The query was never the
-- gap. Running it was.

revoke execute on function public.create_phase(uuid, text, text) from public, anon;

do $assert$
declare offenders text;
begin
  -- Every SECURITY DEFINER function in `public` must be unreachable by anon and
  -- by PUBLIC. `search_blueprint` is the one exception and it is deliberate:
  -- it is the read RPC uno-bot calls with the anon key, which ships inside the
  -- deployed bundle by design.
  --
  -- A bare `=X/` entry (no grantee before the `=`) is PUBLIC. A null proacl is
  -- also PUBLIC — it means nobody has ever touched the grants, so the default
  -- still stands.
  select string_agg(
           p.proname || ' -> ' || coalesce(array_to_string(p.proacl::text[], ' | '), 'DEFAULT (PUBLIC)'),
           E'\n  ' order by p.proname
         )
    into offenders
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prokind = 'f'
    and p.prosecdef
    and p.proname <> 'search_blueprint'
    and (
      p.proacl is null
      or exists (
        select 1 from unnest(p.proacl::text[]) a
        where a ~ '^=X/' or a like 'anon=X/%'
      )
    );

  if offenders is not null then
    raise exception E'SECURITY DEFINER functions reachable by PUBLIC or anon:\n  %', offenders;
  end if;
end
$assert$;

-- The authenticated grant is what 20260821410000 was protecting, and it is
-- still correct. Asserted separately so a future revoke sweep that goes too far
-- fails here rather than in the app.
do $assert$
declare acl text;
begin
  select array_to_string(p.proacl::text[], ' | ') into acl
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'create_phase';

  if acl not like '%authenticated=X%' then
    raise exception 'create_phase lost its authenticated grant: %', acl;
  end if;
end
$assert$;
