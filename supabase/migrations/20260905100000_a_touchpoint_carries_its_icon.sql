-- A touchpoint carries its icon.
--
-- The template added `touchpoints.icon_url` in `21000124000000`, and this is
-- the deployment taking the same column under its own version so the two
-- schemas agree (#326 slice S2, ADR 0013: the deployment imports the template).
-- The name, the type and the nullability are the template's exactly, because a
-- re-map has to round-trip: a column that differs here by so much as its
-- nullability makes the generic panel wrong on one of the two schemas.
--
-- What the column is for: a well-known tool shows a stock mark in the detail
-- panel — Zoom's logo, a form's glyph. Today the only route to such a mark is a
-- table baked into a TypeScript file and keyed on the tool's NAME, which is a
-- deployment's vocabulary wearing a code hat. That is precisely the coupling
-- Decision D4 unwinds: a value belongs in a row, not in a hook.
--
-- A touchpoint is a thing the DEPLOYMENT owns (`20260902230000`), and its icon
-- is a property of the thing rather than of any one placement — the same logo
-- at every moment the tool appears — so the column lands on the registry and
-- not on `cell_touchpoints`.
--
-- ── The reader is deliberately not in this file ──────────────────────────
--
-- Nothing reads `icon_url` after this migration, and nothing should until slice
-- S6. Adding a column and rewiring the surface that reads it in one change
-- makes the migration impossible to review: the schema question ("is this
-- column shaped right, and does it break an existing row?") and the render
-- question ("does the board still draw the same picture?") have different
-- reviewers and different evidence. S2 is columns; S6 is the read side.
--
-- No value is seeded here either. The URLs are this deployment's own asset
-- paths, which is a data decision rather than a schema one.
--
-- ── No new grant, and that is the point ─────────────────────────────────
--
-- The table-level SELECT policy and grant that arrived with the registry
-- already cover a column added to it, so anon reads this the moment it exists.
-- No UPDATE grant is added: `authenticated` holds no table-level UPDATE
-- anywhere, and a panel column is a line in `PANEL_COLUMNS`
-- (`scripts/check-rls-posture.mjs`) plus a migration of its own, written when
-- the editing surface arrives. A write surface with no writer would be a row
-- that check has to account for before any mutation touches the column. That is
-- the same split `20260902210000` and `20260902220000` drew for
-- `entity_examples`, and `20260902240000` drew again for `services.slug`.
--
-- ── Replaying against an empty database ─────────────────────────────────
--
-- One additive column, nullable, no default beyond NULL, `if not exists` so a
-- re-run is a no-op. It replays clean against an empty database and does not
-- join `docs/reference/migration-replay-baseline.json`.
--
-- The proof is an INVARIANT, never a census (ADR 0009): the column exists and
-- is nullable. That is vacuously true of an empty replay's zero rows, and on a
-- populated target it is the evidence that the add took and that no existing
-- touchpoint was forced to carry a URL it does not have.

alter table public.touchpoints
  add column if not exists icon_url text;

comment on column public.touchpoints.icon_url is
  'A stable URL for the touchpoint''s stock icon or logo — the mark a well-known tool shows in the detail panel. A property of the thing the deployment owns, authored once per name, never per placement. Blueprint data rather than app configuration: null draws nothing, and the renderer reads this row instead of matching a tool name against a table baked into code (#326 S2, Decision D4). Matches the template''s column of the same name (asb 21000124000000) so a re-map round-trips.';

do $proof$
begin
  if not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'touchpoints'
       and column_name = 'icon_url'
  ) then
    raise exception
      'proof: touchpoints.icon_url did not take';
  end if;

  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'touchpoints'
       and column_name = 'icon_url'
       and is_nullable = 'NO'
  ) then
    raise exception
      'proof: touchpoints.icon_url must be nullable — a touchpoint without a logo carries none, and the template''s column is nullable too';
  end if;
end
$proof$;
