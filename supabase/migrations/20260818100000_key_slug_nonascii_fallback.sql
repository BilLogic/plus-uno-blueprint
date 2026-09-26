-- key_slug: md5-fragment fallback for non-ASCII names.
--
-- Port of the template fix (agentic-service-blueprinting PR #12, 2026-08-18).
-- The original key_slug (20260731001000_blueprint_authoring_operations) slugs
-- through an [a-z0-9] filter, so a fully non-ASCII name (a CJK lane like
-- 运营协调员, a Cyrillic step) slugs to the empty string and the function
-- returns null. mint_cell_key builds keys with concat_ws, and concat_ws
-- silently DROPS null segments — so two differently-named CJK lanes in the
-- same slot could mint the SAME cell key, and the partial unique index on
-- cells(key) then errors the second upsert_cell.
--
-- Fix: when the ASCII slug comes out empty but the input was not, fall back
-- to 'x' || first 8 hex chars of md5(raw name) — deterministic, stable, and
-- distinct per name, so the segment stays present in the minted key. Truly
-- empty/null input still yields null (unchanged contract).
--
-- `create or replace` only — same signature, no grants change (key_slug is a
-- read-only immutable helper, open to anon by design).

/**
 * Slug for one key segment: lowercase, ASCII, hyphen-joined.
 *
 * Matches what the IR authors write by hand ("Check In" is keyed `check-in`).
 * Used only when *minting* a key for an app-created cell — never to guess an
 * imported cell's key, which is authored and cannot be derived.
 */
create or replace function public.key_slug(value text)
returns text
language sql immutable
set search_path = pg_catalog, pg_temp
as $$
  -- Non-ASCII names (CJK lanes, Cyrillic steps) slug to nothing under the
  -- [a-z0-9] filter; returning null there made concat_ws silently DROP the
  -- segment, so two differently-named lanes could mint the same cell key.
  -- Deterministic fallback: an md5 fragment of the raw name keeps the
  -- segment present, stable, and distinct per name. Truly empty input
  -- still yields null.
  select case
    when coalesce(value, '') = '' then null
    else coalesce(
      nullif(
        trim(both '-' from regexp_replace(lower(value), '[^a-z0-9]+', '-', 'g')),
        ''
      ),
      'x' || substr(md5(value), 1, 8)
    )
  end;
$$;
