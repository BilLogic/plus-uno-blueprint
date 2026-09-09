-- Five functions on the authoring surface are executable by `anon`, and the
-- check that was meant to notice returned an empty list for every one of them.
--
-- #572 named two, found beside a function someone happened to be editing. A
-- sweep of the catalogue on 2026-09-09 found five, and the difference between
-- the two numbers is the whole reason the issue asked for a sweep first:
--
--   create_path             SECURITY DEFINER          anon=X
--   create_scenario         SECURITY DEFINER          anon=X
--   duplicate_path          SECURITY DEFINER          anon=X
--   update_cell_dependency  SECURITY DEFINER          anon=X
--   rename_touchpoint       SECURITY INVOKER, writes  anon=X and PUBLIC
--
-- `set_cell_dependency`, which #572's table lists as an offender, is not one
-- any more: `20260909070000` dropped and recreated it and restored the anon
-- revoke with the rest. `upsert_cell` was repaired the same way an hour later
-- by `20260909080000`. Both were fixed by hand, one function at a time, by
-- someone who happened to be looking — which is the failure mode, not the fix.
--
-- ── WHY IT KEEPS HAPPENING ────────────────────────────────────────────────
--
-- A Supabase project carries default privileges on `public`:
--
--   postgres | public | f | {postgres=X/postgres, anon=X/postgres,
--                            authenticated=X/postgres, service_role=X/postgres}
--
-- So a function CREATED in `public` arrives already granted to `anon`. And
-- `revoke all on function … from public` — the line every one of these five
-- migrations wrote — takes away PUBLIC's own grant and leaves `anon`'s
-- untouched beside it. It reads like a revoke of everything and is a revoke of
-- one role.
--
-- That makes it structural rather than five stale rows. A return type cannot
-- change without `drop function`, a drop discards the ACL, and the recreate
-- picks the default back up. Every one of the five above was written by
-- someone who knew about the `public` revoke and wrote it.
--
-- ── NOT EXPLOITABLE, AND THAT IS NOT THE POINT ────────────────────────────
--
-- The four SECURITY DEFINER functions all open with `is_service_account()` and
-- answer an anon caller with 42501. `rename_touchpoint` runs as its caller, so
-- an anon session reaching it gets anon's own rights on `public.touchpoints`,
-- which are none. The grant lets an anon session CALL these; the function, or
-- the table, still says no.
--
-- The guard is meant to be the second line. `20260826130000` made this exact
-- argument about `create_phase` and wrote the invariant that was supposed to
-- stop it recurring. It ran once, when it was applied, and nothing has re-run
-- it since — four of the five above were created or recreated afterwards.
--
-- ── THE HALF THAT MATTERS ─────────────────────────────────────────────────
--
-- The static counterpart of that invariant has existed the whole time, in
-- `check:identifiers`, and it passed. Its subject was right and the model
-- underneath it was wrong: `materialise()` in `scripts/migration-replay.mjs`
-- called a freshly created function PUBLIC-only, so `revoke … from public`
-- cleared the modelled ACL outright and the modelled surface was clean while
-- production's was not. `scripts/replay-prelude.sql` had the same hole from the
-- other side — it modelled the platform's default privileges for tables and
-- sequences and not for functions, so a local replay could not reproduce the
-- grant either.
--
-- Both are fixed in the same change as this file, and with them the check
-- names all five and the local replay reproduces all five. This migration is
-- the smaller half: it repairs today. The check is what stops the sixth.
--
-- NOTHING IS DROPPED HERE. These are grant statements only — no function is
-- recreated, so no ACL has to be restored, and no body changes.

revoke execute on function public.create_path(uuid, text, text, uuid) from anon;
revoke execute on function public.create_scenario(uuid, text, text, uuid, jsonb, integer, text) from anon;
revoke execute on function public.duplicate_path(uuid, text, text, boolean, boolean) from anon;
revoke execute on function public.update_cell_dependency(uuid, text, uuid, text) from anon;

-- `rename_touchpoint` holds PUBLIC as well as `anon` — it is the one of the
-- five whose migration wrote no revoke at all. PUBLIC has to go with it or the
-- revoke above changes nothing: `anon` is a member of PUBLIC, so a grant to
-- PUBLIC reaches it by another road.
revoke execute on function public.rename_touchpoint(uuid, text) from public, anon;

-- ── WHAT THIS FILE MAKES TRUE ─────────────────────────────────────────────
--
-- Asked with `has_function_privilege` rather than by reading `proacl` text,
-- because that is the question: it follows PUBLIC and role membership, so a
-- grant reaching `anon` by any road answers yes here.

do $revoked$
declare offenders text;
begin
  select string_agg(p.proname, ', ' order by p.proname) into offenders
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('create_path', 'create_scenario', 'duplicate_path',
                      'update_cell_dependency', 'rename_touchpoint')
    and has_function_privilege('anon', p.oid, 'EXECUTE');

  if offenders is not null then
    raise exception 'still reachable by anon after the revoke: %', offenders;
  end if;
end
$revoked$;

-- The invariant itself, restated over the whole surface rather than over the
-- five names above — the five are what this file changed, this is what it
-- leaves true. `20260826130000` wrote the first clause for SECURITY DEFINER
-- functions; the second is #572's addition, and it is the clause that makes
-- `rename_touchpoint` a finding: it escalates nothing, running as its caller,
-- but it is an authoring RPC and it changes rows, so the revoke on this
-- surface is about it too.
--
-- The static half in `scripts/migration-replay.mjs` asks the same two
-- questions of the replayed files, and the two must agree.

do $surface$
declare offenders text;
begin
  select string_agg(p.proname || ' (' ||
           case when p.prosecdef then 'SECURITY DEFINER' else 'writes rows as its caller' end ||
           ')', E'\n  ' order by p.proname)
    into offenders
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prokind = 'f'
    and p.proname <> 'search_blueprint'
    and (
      p.prosecdef
      or pg_get_functiondef(p.oid) ~* '(insert\s+into|update\s+(only\s+)?[\w."]+\s+set|delete\s+from)'
    )
    and has_function_privilege('anon', p.oid, 'EXECUTE');

  if offenders is not null then
    raise exception E'authoring-surface functions reachable by anon:\n  %', offenders;
  end if;
end
$surface$;

-- And the grants these functions are supposed to keep. Asserted separately so
-- a future revoke sweep that goes too far fails here rather than in the app —
-- the same reason `20260826130000` asserts `create_phase`'s authenticated
-- grant one block after revoking PUBLIC's.

do $kept$
declare missing text;
begin
  select string_agg(p.proname, ', ' order by p.proname) into missing
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('create_path', 'create_scenario', 'duplicate_path',
                      'update_cell_dependency', 'rename_touchpoint')
    and not has_function_privilege('authenticated', p.oid, 'EXECUTE');

  if missing is not null then
    raise exception 'the revoke reached authenticated too: %', missing;
  end if;
end
$kept$;
