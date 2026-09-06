-- A touchpoint carries its tone.
--
-- `src/lib/touchpointColors.ts` holds a literal of twenty-odd entries mapping a
-- tool's NAME to the colour family its face is drawn in: `Zoom` is indigo,
-- `Notion` is gold, `PLUS App` is yellow. The file's own header has said since
-- it was written that this is a stopgap — "a touchpoint's colour is meant to be
-- chosen by whoever owns the blueprint", and there was nowhere to store it
-- because a touchpoint was then a substring parsed out of `cells.content` with
-- no row to hang anything on. There has been a row since `20260830140000`, and
-- a deployment-owned one since `20260902230000`. This is the column.
--
-- ── Why the map cannot simply move upstream ─────────────────────────────
--
-- #396 Q48 settles the split: the MACHINERY — the alias resolution, the legacy
-- normalizer, the deterministic fallback for a name the map does not carry — is
-- generic and is reconciled into the template. The MAP LITERAL is not. Its keys
-- are `Handshake`, `Workday (Employer View)`, `PLUS App`: twenty names belonging
-- to one university tutoring service. Shipping them upstream would put this
-- deployment's vocabulary in every future deployment, so the values stay each
-- deployment's — sourced from a column rather than from code, which is what
-- this file provides. Without it `touchpointColors.ts` is a permanent fork and
-- #326's acceptance criterion — no PLUS tech vocabulary left in code — cannot
-- be met.
--
-- ── Why `tone`, and why no CHECK constraint ─────────────────────────────
--
-- `tone` is the word the code already uses: `TouchpointTone` in
-- `src/lib/blueprintCellStyle.ts`, `data-blueprint-tone` on the rendered face.
-- Naming the column anything else would mint a second word for one thing, which
-- is the failure `20260830190000` swept the board for.
--
-- The value names a palette FAMILY — `crimson`, `gold`, `indigo`, `purple`,
-- `red`, `tomato`, `yellow` — and not a colour. Which step of that family a
-- face is painted at is the renderer's decision and stays there.
--
-- No CHECK constraint enumerates those seven, deliberately. The tone vocabulary
-- belongs to the token model, which ADR 0001 makes the single test seam, and
-- the palette itself is moving to the template (#396 Q47). A CHECK here would
-- be a second copy of that list, in a place no test reads, free to drift from
-- the one the renderer compiles against — and a deployment that adds an eighth
-- family would have to ship a migration to use a colour. The column stores what
-- the author chose; the renderer decides what it can draw, and falls back
-- deterministically for anything it does not know, exactly as it already does
-- for a tool the map never named.
--
-- ── The reader is deliberately not in this file ─────────────────────────
--
-- `touchpointColors.ts` is untouched by this migration and no value is copied
-- into the column. S2 is the column; S6 is the read side. A migration that adds
-- a column and rewires its reader in one change cannot be reviewed as either.
--
-- ── No new grant ────────────────────────────────────────────────────────
--
-- The registry's table-level SELECT policy and grant already cover a new
-- column. No UPDATE grant: `authenticated` holds no table-level UPDATE, and the
-- editing surface brings its own migration and its `PANEL_COLUMNS` line when it
-- arrives — the split `20260902210000` and `20260902220000` drew.
--
-- ── Replaying against an empty database ─────────────────────────────────
--
-- One additive column, nullable, no default beyond NULL, `if not exists` so a
-- re-run is a no-op. It replays clean against an empty database and does not
-- join `docs/reference/migration-replay-baseline.json`.
--
-- The proof is an INVARIANT, never a census (ADR 0009): the column exists and
-- is nullable. Nullable is load-bearing rather than incidental — null means the
-- author expressed no preference, and that is the state every existing row is
-- in, so a NOT NULL column would either fail the add or invent a default
-- colour for twenty tools nobody had chosen one for.

alter table public.touchpoints
  add column if not exists tone text;

comment on column public.touchpoints.tone is
  'The palette family this touchpoint''s face is drawn in — the deployment''s own choice, one of the renderer''s tone names (crimson, gold, indigo, purple, red, tomato, yellow). A product fact ("Zoom is blue"), not a styling one, which is why it is a row and not a literal in touchpointColors.ts (#326 S2, #396 Q48). Deliberately unconstrained: the tone vocabulary belongs to the token model (ADR 0001) and a CHECK here would be a second copy of it, free to drift. Null means no preference — the renderer falls back deterministically, exactly as it does for a tool the old map never named.';

do $proof$
begin
  if not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'touchpoints'
       and column_name = 'tone'
  ) then
    raise exception
      'proof: touchpoints.tone did not take';
  end if;

  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'touchpoints'
       and column_name = 'tone'
       and is_nullable = 'NO'
  ) then
    raise exception
      'proof: touchpoints.tone must be nullable — null is "the author chose no colour", which is what every existing row means';
  end if;
end
$proof$;
