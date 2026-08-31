-- The tech lanes were never only tech.
--
-- "Front Stage Tech" and "Back Stage Tech" hold a printed guide, a poster, a
-- phone line and a Zoom recording alongside the apps. The lane name is
-- narrower than its contents, and it has been pushing authors to file
-- non-software touchpoints somewhere else — which is how four authored
-- details ended up on Support Actions cells, found by the assertion in
-- 20260830140000.
--
-- Renames both lanes and both roles. Nothing about the rows changes except
-- what they are called.
--
-- ── This one is NOT safe to apply ahead of the code ────────────────────────
--
-- 20260830120000 was additive: it gave 36 lanes a role they did not have, and
-- an app that had never heard of `support_actions` carried on rendering them
-- as generic swimlanes. This migration is a RENAME. The moment it runs, every
-- deployed client still asking for `frontstage_tech` gets nothing back, the
-- touchpoint lanes stop rendering as pills, and the visibility line moves.
--
-- So it applies WITH the deploy, not before it. There is no expand-contract
-- dance here — one client, one deploy — but the ordering is not optional.
--
-- ── Why the constraint is rewritten rather than extended ───────────────────
--
-- Admitting both spellings for a transition window would leave the vocabulary
-- with two names for one role, which is the state this whole spec exists to
-- end, and nothing would force the second one out afterwards. A rename with a
-- deploy gate is the smaller and more honest cost.
--
-- `scripts/lane-roles.mjs` points `CONSTRAINT_MIGRATION` at whichever file
-- last defines the constraint. It moves to this one; the test that holds the
-- TypeScript constant, the constraint and the column comment to each other
-- fails loudly if it does not.

-- ── The roles ──────────────────────────────────────────────────────────────
--
-- The constraint is dropped first. Updating a value the current CHECK still
-- forbids would fail row by row, and the new spellings are exactly the values
-- 20260830120000 does not admit.

alter table public.lanes drop constraint if exists lanes_lane_role_check;

update public.lanes set lane_role = 'frontstage_touchpoints'
 where lane_role = 'frontstage_tech';

update public.lanes set lane_role = 'backstage_touchpoints'
 where lane_role = 'backstage_tech';

alter table public.lanes
  add constraint lanes_lane_role_check
  check (
    lane_role is null
    or lane_role in (
      'customer_actions',
      'frontstage_actions',
      'backstage_actions',
      'partner_actions',
      'frontstage_touchpoints',
      'backstage_touchpoints',
      'support_actions',
      'visual'
    )
  );

-- ── The names ──────────────────────────────────────────────────────────────
--
-- Matched on the role, not on the old name. The role is what this database
-- guarantees; the name is free-form, and a lane someone had already renamed
-- by hand would be missed by a name match — the failure mode 20260830120000
-- was written to remove.

update public.lanes set name = 'Front Stage Touchpoints'
 where lane_role = 'frontstage_touchpoints' and name = 'Front Stage Tech';

update public.lanes set name = 'Back Stage Touchpoints'
 where lane_role = 'backstage_touchpoints' and name = 'Back Stage Tech';

-- ── The prose ──────────────────────────────────────────────────────────────

comment on column public.lanes.lane_role is
  'Semantic role key that drives rendering (pill cells, visual rows, '
  'divider-line anchoring); the display name stays in lanes.name and is '
  'free-form in any language. Canonical values: customer_actions, '
  'frontstage_actions, backstage_actions, partner_actions, '
  'frontstage_touchpoints, backstage_touchpoints, support_actions, visual. '
  'Null = generic swimlane (e.g. actor lanes), and is permitted on purpose. '
  'Constrained by lanes_lane_role_check — a custom role is no longer allowed, '
  'because an unconstrained column is how 36 support lanes went unclassified.';

-- ── Prove it ───────────────────────────────────────────────────────────────
--
-- An invariant, not a census: this must replay against an empty database.
-- Nothing may be left wearing the retired spelling, which is vacuously true
-- on an empty table and means 80 rows moved on production.

do $do$
declare stragglers int;
begin
  select count(*) into stragglers
    from public.lanes
   where lane_role in ('frontstage_tech', 'backstage_tech');

  if stragglers <> 0 then
    raise exception '% lanes still carry a retired tech role', stragglers;
  end if;
end
$do$;
