-- A service slug is a column again, not a derivation.
--
-- The `slug` column existed in the very first schema
-- (`20250602160000_initial.sql`: `slug text not null unique`) and was dropped
-- from production out of band long ago — no migration in the series drops it,
-- which is why an empty replay's `services` still carries it while production's
-- does not (`20260830180000` builds its fixtures around exactly that
-- asymmetry). #335 shipped routing as a stopgap by DERIVING the slug from the
-- service name at read time (`src/lib/serviceSlug.ts`), and named the two
-- weaknesses that stopgap keeps: a rename silently moves the URL, and two
-- names that slugify alike collide with nothing to stop them. This file
-- (#341, parent #303) re-adds the real column so the slug is a service's own
-- identity — stable across renames, unique by constraint.
--
-- ── Nullable, backfilled, then made unique ─────────────────────────────────
--
-- The table is populated (one service on production), so the column cannot
-- arrive NOT NULL with no default. It lands nullable, every existing row is
-- backfilled from the same name-derived slug #335 computes, and only then does
-- the unique constraint go on — a populated column a constraint can trust.
--
-- It STAYS nullable on purpose. The seam that reads it keeps deriving from the
-- name as a defensive fallback for a row whose slug is null, so a deployer who
-- clears the slug gets the name-derived route back rather than a broken one.
-- That fallback is only meaningful if null is reachable, so the column is not
-- narrowed to NOT NULL here.
--
-- ── The backfill reuses key_slug, the database's own slugifier ──────────────
--
-- `public.key_slug` (20260731001000, hardened in 20260818100000) is the
-- function `src/lib/serviceSlug.ts` documents itself as mirroring:
-- `trim('-', regexp_replace(lower(value), '[^a-z0-9]+', '-'))`. Reusing it
-- keeps the backfill in step with the app's derivation rather than minting a
-- third copy of the slug rule. For every ASCII name the two are identical —
-- `PLUS Tutoring` -> `plus-tutoring` on both sides — which is the production
-- row and the only one that exists. `coalesce(..., id::text)` supplies the
-- id fallback for the pathological all-non-ASCII name (where the app falls back
-- to the row id and key_slug to an md5 fragment); either is stable, unique and
-- resolvable, and no such row exists to tell them apart. The result is that the
-- one service keeps the exact slug #335 put in its URL.
--
-- ── The editable grant is deliberately NOT here ────────────────────────────
--
-- Letting the deployer EDIT the slug is a panel write, and a later ticket — the
-- same split `20260902210000` (add `entity_examples`) and `20260902220000`
-- (grant the panel its UPDATE) already drew. Routing only READS the slug, so
-- this file adds no `grant update (slug)`: a write surface with no writer would
-- be a row `check:rls-posture` (`PANEL_COLUMNS`) has to account for before any
-- mutation touches the column. When the edit panel arrives it adds the grant
-- and the `PANEL_COLUMNS` entry together, exactly as the examples panel did.
--
-- ── Replaying against an empty database ────────────────────────────────────
--
-- An empty replay's `services` already has `slug text not null unique` and the
-- `services_slug_key` constraint from the initial migration, so every step is
-- written to be a no-op there: `add column if not exists` skips the add, the
-- backfill matches zero rows, and the constraint is dropped-if-exists before it
-- is re-added so it does not collide with the one already present. On
-- production — no column, no constraint — the add, the backfill and the fresh
-- constraint all take. The file replays clean and does not join the ratchet.
--
-- The proof is an INVARIANT, never a census (ADR 0009): after this file every
-- service row has a slug and all slugs are distinct. That is vacuously true on
-- an empty replay's zero rows and is the evidence on production that the
-- backfill reached the one row and the constraint has something to guard.

-- ── 1. The column, nullable ────────────────────────────────────────────────

alter table public.services
  add column if not exists slug text;

comment on column public.services.slug is
  'A service''s stable route slug: `/<slug>` opens it (#303/#341). Its own identity, not derived from the name — a rename does not move the URL, and the unique constraint stops two services colliding. Backfilled from the name-derived slug (public.key_slug) when re-added; nullable so a cleared slug falls back to the name-derived route in the app. Editable by the deployer through a later panel write, which adds the UPDATE grant then.';

-- ── 2. Backfill every existing row from its name-derived slug ───────────────
--
-- Scoped to `slug is null` so it is idempotent and touches nothing an empty
-- replay (or a re-run) has already filled.

update public.services
   set slug = coalesce(public.key_slug(name), id::text)
 where slug is null;

-- ── 3. The unique constraint, once the column is populated ──────────────────
--
-- Dropped-if-exists first so this is idempotent and survives the empty replay,
-- where the initial migration's `services_slug_key` is already present.

alter table public.services
  drop constraint if exists services_slug_key;
alter table public.services
  add constraint services_slug_key unique (slug);

comment on constraint services_slug_key on public.services is
  'One slug per service, per deployment. Guarantees the uniqueness the name-derived stopgap (#335) could not: two services whose names slugify alike are refused rather than colliding on a shared route.';

-- ── 4. Prove it ────────────────────────────────────────────────────────────
--
-- Invariants, not a census. Zero rows on an empty replay satisfy both; the one
-- production row is the case they exist to check.

do $proof$
declare
  v_missing  integer;
  v_total    integer;
  v_distinct integer;
begin
  select count(*) into v_missing
    from public.services
   where slug is null;
  if v_missing <> 0 then
    raise exception
      'proof: % service row(s) have a null slug after backfill; the backfill did not reach every row', v_missing;
  end if;

  select count(*), count(distinct slug) into v_total, v_distinct
    from public.services;
  if v_total <> v_distinct then
    raise exception
      'proof: % service rows carry only % distinct slugs; the unique constraint has a collision to reject', v_total, v_distinct;
  end if;
end
$proof$;
