-- The two queries that produce docs/reference/erd.mmd and
-- supabase/schema.reference.sql.
--
-- Both of those files are SNAPSHOTS of the live schema, and both had drifted
-- for five weeks before 2026-08-20 — each claimed to be "verified through
-- 20260716120000_layer_role.sql" while missing the entire analysis tier
-- (evidence, audit_findings, slices, slides, business_models) that shipped on
-- 2026-07-29, plus every name in the vocabulary refactor.
--
-- A July plan already flagged both as stale and asked for them to be generated
-- so they could not drift again. They drifted again. Shipping the queries next
-- to their output is the smallest version of that fix: refreshing is a re-run,
-- not a rewrite, and there is no separate tool to remember or keep working.
--
-- Run against the live database with a role that can read pg_catalog, then
-- rewrite the two files from the output and update their "regenerated on" date.

-- ── 1. Tables and columns ────────────────────────────────────────────────────
select c.relname as tbl,
       string_agg(
         a.attname || ' ' || format_type(a.atttypid, a.atttypmod)
           || case when a.attnotnull then ' NOT NULL' else '' end,
         E'\n' order by a.attnum
       ) as cols
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
where n.nspname = 'public' and c.relkind = 'r'
group by c.relname
order by c.relname;

-- ── 2. Foreign keys ──────────────────────────────────────────────────────────
select src.relname as from_tbl,
       tgt.relname as to_tbl,
       c.conname,
       (select string_agg(a.attname, ',' order by k.ord)
        from unnest(c.conkey) with ordinality k(attnum, ord)
        join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) as cols
from pg_constraint c
join pg_class src on src.oid = c.conrelid
join pg_class tgt on tgt.oid = c.confrelid
join pg_namespace n on n.oid = src.relnamespace
where n.nspname = 'public' and c.contype = 'f'
order by 1, 2;

-- ── 3. CHECK constraints, for the enum comments in both files ────────────────
select rel.relname as tbl, c.conname, pg_get_constraintdef(c.oid) as def
from pg_constraint c
join pg_class rel on rel.oid = c.conrelid
join pg_namespace n on n.oid = rel.relnamespace
where n.nspname = 'public' and c.contype = 'c'
order by 1, 2;

-- ── 4. The invariant — NOW ASSERTED BY MIGRATION, kept here as a diagnostic ──
-- Zero rows means no SECURITY DEFINER function is reachable by anon or PUBLIC
-- except search_blueprint, which is the read RPC uno-bot calls with the anon
-- key. A drop-and-recreate silently restores Postgres's default EXECUTE to
-- PUBLIC, which is exactly how this invariant was broken once already.
--
-- It was broken a SECOND time on 2026-08-21 and nobody saw it until 2026-08-26,
-- because this query was correct and sitting in a file a human was trusted to
-- run. The query was never the gap. Running it was. It now lives in
-- 20260826130000_the_invariant_that_only_ran_by_hand.sql, where every migration
-- application re-asserts it and a violation fails the push.
--
-- Kept here because a diagnostic you can paste into psql is worth having, and
-- because this is where someone regenerating the snapshots will look.
--
-- There is also an anon-reachable witness, useful when you have only the
-- publishable key: POST to /rest/v1/rpc/<write_fn>. A correctly-revoked
-- function answers "permission denied for function <name>"; one that kept the
-- PUBLIC grant answers with its own guard's message instead. Both are HTTP 401
-- and SQLSTATE 42501, so only the sentence tells them apart. Do NOT automate
-- that probe: when the invariant IS violated the call reaches the function
-- body, and a future write RPC without an internal guard would execute.
select p.proname, array_to_string(p.proacl::text[], ' | ') as acl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f' and p.prosecdef
  and p.proname <> 'search_blueprint'
  and (p.proacl is null
       or exists (select 1 from unnest(p.proacl::text[]) a
                  where a like '=X/%' or a like 'anon=X/%'));
