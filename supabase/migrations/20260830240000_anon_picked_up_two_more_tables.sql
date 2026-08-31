-- `anon` got write grants on the two touchpoint tables, and nobody wrote them.
--
-- `20260828121000_anon_keeps_the_read_and_loses_the_write.sql` swept twelve
-- tables and a view, and its post-condition was written against the SCHEMA
-- rather than against a list precisely so it could not pass while any anon
-- write grant remained. It held. Then `20260830140000` created two tables and
-- the count went from zero back to eight:
--
--   select grantee, table_name, privilege_type
--     from information_schema.role_table_grants
--    where table_schema = 'public' and grantee = 'anon'
--      and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE');
--
--   anon  cell_touchpoints  DELETE INSERT TRUNCATE UPDATE
--   anon  touchpoints       DELETE INSERT TRUNCATE UPDATE
--
-- Eight rows, two tables, four privileges each.
--
-- ── The part that matters more than the revoke ─────────────────────────────
--
-- `20260830140000` grants `select on public.touchpoints to anon, authenticated`
-- and nothing else to anon. Read it and you will not find the write grants,
-- because it did not write them. They arrive with the table: the platform
-- grants the API roles on relations created in `public`, and every table in
-- this schema has them from birth. That is why the earlier sweep found twelve
-- — not twelve mistakes, one mechanism, twelve times.
--
-- So this file is not the fix. It is the second instance of a repair that has
-- to happen once per new table forever, and the fix is
-- `scripts/check-new-table-grants.mjs`, which fails a migration that creates a
-- table in `public` without revoking anon's writes on it in the same file.
-- The check is static — it reads the series, needs no database, and runs in
-- `gates.yml` — because the live posture check that WOULD have caught this
-- (`check:rls-posture:live`) needs a service-role connection and therefore
-- does not run in CI. It was red on production for the whole time these two
-- tables existed and no one was looking.
--
-- ── What was and was not exposed ───────────────────────────────────────────
--
-- Nothing was exposed. A grant and a policy are two independent gates and
-- PostgREST needs both. Both tables have RLS enabled and their only anon
-- policies are `*_select_anon … using (true)`; no PERMISSIVE write policy in
-- this schema names `anon`, so every anon write was refused at the policy.
--
-- TRUNCATE is the exception and the reason this is not merely tidiness. It
-- bypasses RLS entirely, so for TRUNCATE the grant was not one of two gates,
-- it was the only one. PostgREST cannot spell TRUNCATE, which is what made it
-- survivable — but "the client we ship cannot say it" is not an access
-- control, and that sentence is quoted from the file this one is repeating.

revoke insert, update, delete, truncate on public.touchpoints from anon;
revoke insert, update, delete, truncate on public.cell_touchpoints from anon;

-- SELECT stays. The deployed site reads the blueprint as `anon` and the
-- `*_select_anon` policies say so on purpose.

-- ── The post-condition, written against the schema and not against a list ──
--
-- Same shape as its predecessor's, and for the same reason: a revoke shaped
-- like a list is complete only by luck. This one asks the catalog whether ANY
-- anon write grant survives anywhere in `public`, so it fails on a table this
-- file has never heard of.
--
-- Vacuously true on an empty database, where the schema holds nothing to
-- grant, and exactly as strong on production, where eight rows had to go for
-- it to hold.

do $do$
declare surviving int;
begin
  select count(*) into surviving
    from information_schema.role_table_grants
   where table_schema = 'public'
     and grantee = 'anon'
     and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');

  if surviving <> 0 then
    raise exception
      'anon still holds % write grants in public', surviving;
  end if;
end
$do$;
