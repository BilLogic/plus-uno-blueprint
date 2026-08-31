-- A lane's role decides the divider. Its name never should have.
--
-- `lanes.name` is documented as free-form in any language, and until now the
-- internal interaction line was drawn by comparing it against the English
-- string 'Support Actions'. Rename that lane, or translate it, and a divider
-- left the board with nothing reporting it.
--
-- The name match was load-bearing because the role was missing: all 36
-- "Support Actions" lanes carry `lane_role = NULL`. And they were allowed to,
-- because `lane_role` is the ONLY classifier column in this schema with no
-- CHECK constraint. Every sibling has one — `paths.path_type`,
-- `scenarios.view_type`, `slices.slice_type`, six `origin` columns, five
-- `kind` columns, `findings.severity`, `findings.source`, `findings.status`.
-- So the drift had no way to be noticed, and it wasn't.
--
-- Measured before writing this (2026-08-30, production):
--   backstage_tech 40 · frontstage_tech 40 · visual 40
--   customer_actions 39 · frontstage_actions 39 · backstage_actions 39
--   partner_actions 3 · NULL 76
--
-- The 76 NULLs are two different things, and only one of them is a defect:
--   36  "Support Actions"                              → the bug, backfilled below
--   40  Lead Tutor 21 · Teacher 16 · Student 2 · Supervisor 1
--                                                      → correct, left alone
--
-- ── Why NULL stays legal ───────────────────────────────────────────────────
--
-- `src/lib/laneRoles.ts` states it: "a custom role and a null role both render
-- as a generic swimlane". Those 40 actor lanes are named for the person in
-- them and carry no blueprint role by design. A NOT NULL here would not fail
-- a test — it would fail this migration, against rows that are right.
--
-- ── Why the new role is `support_actions` and not `support_systems` ────────
--
-- `support_systems` already exists in TypeScript and has never existed in
-- data. It is also a PILL role: cells under it render as inline pills. The
-- 36 lanes being backfilled render as plain text cells today, and
-- `blueprintLayout.ts` says so out loud — the null-role lane "must still
-- anchor the divider without picking up support_systems pill-cell rendering".
-- Backfilling onto `support_systems` would fix the divider and change how 36
-- lanes' cells look, which is not what this ticket is for. So the role is
-- named for the lane it describes, and `support_systems` is retired unused.
--
-- The 36 lanes keep the fill they already had: `ROLE_STYLES.support_actions`
-- is the same `support`/backstage pair that `LAYER_STYLES['Support Actions']`
-- was resolving to by name. That is only true for this one name. The earlier
-- draft of this migration also matched 'Tech Support Actions', whose
-- name-keyed style is `backstage-action`, so a lane called that WOULD have
-- recoloured — roles beat names in `getBlueprintLayerStyle`. No such lane
-- exists in this database or in the fallback data, so the match bought
-- nothing and cost a claim that was not true. It is gone.
--
-- ── What this migration deliberately does NOT do ───────────────────────────
--
-- `frontstage_tech`, `backstage_tech` and `visual` are all misnamed and are
-- all renamed by later work (#178, #179). They are admitted here under their
-- current spellings so that this migration is about the divider and nothing
-- else. A constraint that renamed three roles in passing would have to be
-- reverted as a whole if the backfill were wrong.

-- ── 1. The role ────────────────────────────────────────────────────────────

update public.lanes
   set lane_role = 'support_actions'
 where lane_role is null
   and name = 'Support Actions';

-- ── 2. The constraint ──────────────────────────────────────────────────────
--
-- Written as `is null or in (...)` rather than a bare `in (...)`: a NULL
-- inside `in` evaluates to NULL, which a CHECK treats as satisfied, so the
-- bare form would permit NULL by accident rather than on purpose. The
-- difference is invisible in behaviour and total in intent, and the next
-- person tightening this needs to see that the NULL is a decision.

alter table public.lanes
  drop constraint if exists lanes_lane_role_check;

alter table public.lanes
  add constraint lanes_lane_role_check
  check (
    lane_role is null
    or lane_role in (
      'customer_actions',
      'frontstage_actions',
      'backstage_actions',
      'partner_actions',
      'frontstage_tech',
      'backstage_tech',
      'support_actions',
      'visual'
    )
  );

-- ── 3. Say what the roles are, where the schema keeps its prose ────────────
--
-- The column comment is a FOURTH list, and it was the one nobody checked: it
-- still named `support_systems` and `step_visual` and had never heard of
-- `partner_actions`. `check-retired-identifiers.mjs` treats pg_description as
-- a trusted prose surface, so leaving it stale would be the same defect this
-- migration exists to fix, one layer down. `scripts/tests/lane-roles.test.mjs`
-- holds it to the constraint above.

comment on column public.lanes.lane_role is
  'Semantic role key that drives rendering (pill cells, visual rows, '
  'divider-line anchoring); the display name stays in lanes.name and is '
  'free-form in any language. Canonical values: customer_actions, '
  'frontstage_actions, backstage_actions, partner_actions, frontstage_tech, '
  'backstage_tech, support_actions, visual. Null = generic swimlane (e.g. '
  'actor lanes), and is permitted on purpose. Constrained by '
  'lanes_lane_role_check — a custom role is no longer allowed, because an '
  'unconstrained column is how 36 support lanes went unclassified.';

-- ── 4. Prove the backfill matched what it claimed ──────────────────────────
--
-- An UPDATE that matched no rows succeeds, so the backfill needs an
-- assertion. What it must NOT be is a census: this file has to replay against
-- an empty database, and `docs/reference/migration-replay-baseline.json` is
-- explicit that a new failing entry means "a migration written against an
-- apply path that does not work". An earlier draft asserted 36 and 40 —
-- production's counts — and would have failed on every empty replay forever.
--
-- So the assertion is the invariant instead: nothing that should have been
-- backfilled was left behind. Vacuously true on an empty table, and exactly
-- as strong on production, where 36 rows had to move for it to hold.
--
-- The vocabulary needs no assertion here. ADD CONSTRAINT validates every
-- existing row as it is added, so a bad role would already have aborted this
-- migration several statements ago.

do $do$
declare stragglers int;
begin
  select count(*) into stragglers
    from public.lanes
   where lane_role is null
     and name = 'Support Actions';

  if stragglers <> 0 then
    raise exception
      '% lanes named Support Actions still carry no role', stragglers;
  end if;
end
$do$;
