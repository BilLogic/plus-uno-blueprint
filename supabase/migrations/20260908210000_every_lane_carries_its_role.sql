-- Every lane carries its role.
--
-- Forty lanes in this deployment hold `lane_role is null`, and they are not
-- scattered: they are EXACTLY the lanes named after a person and not already
-- classified. 21 Lead Tutor, 16 Teacher, 2 Student, 1 Supervisor. Name a lane
-- after an actor and the role looks optional; name it after a job and nobody
-- forgets. The glossary now says so in the `lane` entry of CONTEXT.md — a
-- lane's name says who, or it says what, and either way it carries the role
-- that places it.
--
-- A role-less lane is a lane the dividers cannot place. It is painted by the
-- legacy name-keyed fallback or not at all, and the line of interaction, the
-- line of visibility and the line of internal interaction all read the role.
--
-- ── THIS FILE MUST NOT BE APPLIED BEFORE THE BAND RULE SHIPS ─────────────
--
-- Classifying Lead Tutor as `customer_actions` puts TWO customer-side lanes on
-- 21 boards. The renderer's old rule drew the line of interaction after every
-- customer-side lane, so applied on its own this file draws that line twice on
-- each of those boards. The rule it depends on — the line follows the LAST
-- customer-side lane, because the customer side is a band — ships in the same
-- change as this file, in `shouldShowInteractionLineAfter`. Deploy the
-- renderer first, then apply this. The order is not negotiable and there is no
-- assertion here that can catch getting it wrong, because the defect is on a
-- screen and not in the database.
--
-- ── THE ROSTER, AND WHY EACH ONE IS WHAT IT IS ──────────────────────────
--
-- `frontstage_actions` is "staff actions the customer can see", and staff
-- means PLUS staff. `partner_actions` is "a body outside PLUS, acting where
-- the tutor can see them". `customer_actions` is the spine.
--
--   Teacher      16  partner_actions   school staff, employed by the school,
--                                      acting where the tutor sees them
--   Lead Tutor   21  customer_actions  a Lead Tutor is a tutor, not PLUS
--                                      staff: not frontstage, not a partner,
--                                      the same population as the spine
--   Student       1  customer_actions  joins the band
--   Student       1  (lane deleted)    it holds no cell and never has
--   Supervisor    1  backstage_actions a tutor supervisor is a PLUS employee,
--                                      and program administration is "staff
--                                      actions out of sight"
--
-- Classifying a lane and placing a divider are different questions. The
-- dividers need a customer to be positioned against; the classification does
-- not. A staff lane is a staff lane whether or not a customer is drawn on that
-- board, which is why the Supervisor lane gets a role rather than keeping the
-- null that would have said "we do not know". We do know.
--
-- `lane_role` STAYS NULLABLE. The column comment says null is permitted on
-- purpose, and the board's own lane-insert control sends no role — a lane
-- created in the canvas is role-less until somebody picks one. Nothing here
-- adds a constraint.
--
-- ── THE SUPERVISOR BOARD IS SPLIT BY ACT ────────────────────────────────
--
-- Two of that board's six cells name a visible act and an invisible one in a
-- single sentence. The visible half moves into the board's existing, empty
-- Front Stage Actions lane, which is what every other board does with a
-- visible act. No lane is created for it.
--
-- Its `Front Stage Touchpoints` lane holds Tutors admin page, Sessions admin
-- and Students admin page — tools no customer ever sees, under a name that
-- says the opposite. This file first gave that lane `backstage_touchpoints`
-- and left the name alone, because renaming a lane is a decision about what a
-- reader is shown and it was not this file's to take. It has been taken, and
-- the answer is FOLD AND DELETE: the three cells move into the board's
-- existing Back Stage Touchpoints lane and the lane itself goes. That removes
-- the badly-named lane rather than renaming it, and removes the board's
-- duplicate `backstage_touchpoints` row along with it.
--
-- The cost is accepted knowingly. A supervisor's admin screens end up on the
-- same row as the platform's plumbing — the Slack bridge, the reconfirmation
-- fan-out, the group foreign key — and those are not the same kind of thing.
-- They are the same ROLE: the tools and artifacts staff use out of sight. One
-- honest row reads better than two rows where one is misnamed.
--
-- This is not the rename that was withdrawn. That withdrawal protects lanes
-- named after a person — Regular Tutor, Lead Tutor, Teacher — from being
-- renamed into job names, because this deployment names lanes both ways on
-- purpose and the glossary now says so. `Front Stage Touchpoints` is already a
-- job name. It names the wrong job.
--
-- ── AND THAT BOARD IS RESTACKED ─────────────────────────────────────────
--
-- Folding alone would leave the picture wrong. `Supervisor` is
-- `backstage_actions` by the roster above and sits at position 1, above the
-- board's only `frontstage_actions` lane — so with the roles assigned and the
-- fold done, two backstage rows stand above the line of visibility, which is
-- the one thing that line exists to prevent. It is the only board in the
-- deployment that would; the other thirty-nine draw no backstage row above
-- their line, before this file or after it. The order the roles ask for:
--
--     Storyboard
--     Front Stage Actions          the two visible halves
--     ──── line of visibility ────
--     Back Stage Touchpoints       the three admin screens and the plumbing
--     Supervisor                   backstage actions
--     Back Stage Actions
--     Support Actions
--
-- `Back Stage Actions` stays, and stays empty. Empty lanes are normal here —
-- a third of this deployment's lanes hold no cell, and this file adds five
-- more — and it is a standard lane rather than a duplicate actor, so the rule
-- that deletes the empty Student lane above does not reach it.
--
-- Two `backstage_actions` rows is the accepted outcome: `Supervisor` carrying
-- the cells, `Back Stage Actions` empty beneath it. An actor lane carrying a
-- machinery role is exactly what the glossary rule describes.
--
-- The restack is written against the six lane ids of that one named path
-- rather than against the roles, for the reason section 4 gives about its own
-- reorder: the board ends with two `backstage_actions` lanes, so a rule
-- phrased over roles alone has two rows to place and no way to tell them
-- apart.
--
-- ── FIVE LANES THAT WERE NEVER ADDED, AND FOUR STACKS BUILT UPSIDE DOWN ──
--
-- Four paths carry backstage actions with no support lane beneath, and they
-- are the SAME four that run `backstage_actions | backstage_touchpoints`
-- against the other thirty-five paths' `backstage_touchpoints |
-- backstage_actions`. One cause, two symptoms: the bottom of the stack was
-- authored ad hoc on three boards. A fifth path is missing its backstage
-- actions lane. All five are the late-authored cohort; every June-authored
-- scenario carries the full stack. The lanes are added EMPTY, which is normal
-- here — a third of the lanes in this deployment hold no cell.
--
-- The reorder is written against four NAMED paths rather than against the
-- roles alone, and that is load-bearing. Section 2 leaves the Supervisor board
-- with two `backstage_actions` lanes, so a swap phrased as "wherever backstage
-- actions sits above backstage touchpoints" reads that board through two
-- pairings and would act on whichever one happened to match — inside a stack
-- section 2 has just placed by hand.
--
-- ── REPLAYING AGAINST AN EMPTY DATABASE ─────────────────────────────────
--
-- Data only. Every statement is guarded and matches zero rows against an empty
-- database, and every proof below is vacuously true of zero rows, so this file
-- replays clean and does not join
-- `docs/reference/migration-replay-baseline.json`.
--
-- Idempotent: each update is guarded on the value it is changing, each insert
-- on the row not already being there. A second application changes nothing.

-- ── 1. The actor lanes take their roles ─────────────────────────────────

update public.lanes
   set lane_role = 'partner_actions'
 where name = 'Teacher'
   and lane_role is null;

update public.lanes
   set lane_role = 'customer_actions'
 where name = 'Lead Tutor'
   and lane_role is null;

update public.lanes
   set lane_role = 'backstage_actions'
 where name = 'Supervisor'
   and lane_role is null;

-- The two Student lanes are decided one at a time, because they are not the
-- same case: one holds a cell and joins the band, the other has never held
-- anything.
update public.lanes
   set lane_role = 'customer_actions'
 where id = 'f1000000-0000-4000-8000-000000000045'
   and lane_role is null;

delete from public.lanes
 where id = 'c1000000-0000-4000-8000-000000000012'
   and lane_role is null
   and not exists (
     select 1
       from public.cells c
      where c.lane_id = 'c1000000-0000-4000-8000-000000000012'
   );

-- ── 2. The supervisor's tools fold into the back stage ──────────────────
--
-- The cells move FIRST. `cells.lane_id` cascades on delete, so a lane dropped
-- while it still holds rows takes them with it silently, along with the three
-- touchpoint placements and four resources that hang off these three cells by
-- id. Moving rather than re-creating is what keeps those attached; the delete
-- is then guarded on the lane holding nothing, exactly as the Student delete
-- above is.
--
-- `cells_lane_step_slot_unique` is (lane_id, step_id, position), and two of
-- the three destinations are already taken at position 0 — Manage sessions and
-- Manage students each hold a plumbing cell there. So each moved cell takes
-- the next free slot in its own step. A step holding two cells is ordinary in
-- this deployment; the destination lane already does it on other boards.

update public.cells as c
   set lane_id = 'f1000000-0000-4000-8000-000000000008',
       position = coalesce(
         (select max(d.position) + 1
            from public.cells d
           where d.lane_id = 'f1000000-0000-4000-8000-000000000008'
             and d.step_id = c.step_id),
         0
       )
 where c.lane_id = 'f1000000-0000-4000-8000-000000000006';

delete from public.lanes
 where id = 'f1000000-0000-4000-8000-000000000006'
   and not exists (
     select 1
       from public.cells c
      where c.lane_id = 'f1000000-0000-4000-8000-000000000006'
   );

-- The restack. `lanes_path_position_unique` is deferrable and initially
-- deferred, so the six rows may hold one another's positions for the length of
-- the statement. If the delete above did not fire, the vacated position is
-- still occupied and this fails at commit rather than quietly leaving the
-- board half-restacked.
update public.lanes as l
   set position = restack.position
  from (values
    ('f1000000-0000-4000-8000-000000000004'::uuid, 0),  -- Storyboard
    ('f1000000-0000-4000-8000-000000000007'::uuid, 1),  -- Front Stage Actions
    ('f1000000-0000-4000-8000-000000000008'::uuid, 2),  -- Back Stage Touchpoints
    ('f1000000-0000-4000-8000-000000000005'::uuid, 3),  -- Supervisor
    ('f1000000-0000-4000-8000-000000000009'::uuid, 4),  -- Back Stage Actions
    ('f1000000-0000-4000-8000-00000000000a'::uuid, 5)   -- Support Actions
  ) as restack(id, position)
 where l.id = restack.id
   and l.position is distinct from restack.position;

-- ── 3. The two double-act cells are split by act ────────────────────────
--
-- The visible half first, so that a run interrupted between the two leaves the
-- sentence whole somewhere rather than losing it.

insert into public.cells (path_id, lane_id, step_id, content, position, origin)
select stage.path_id, stage.id, half.step_id, half.content, 0, 'app'
  from public.lanes as stage
  cross join (values
    ('f1000000-0000-4000-8000-000000000012'::uuid,
     'Joins a live session.'),
    ('f1000000-0000-4000-8000-000000000015'::uuid,
     'Broadcasts email to tutors.')
  ) as half(step_id, content)
 where stage.id = 'f1000000-0000-4000-8000-000000000007'
   and not exists (
     select 1
       from public.cells c
      where c.lane_id = stage.id
        and c.step_id = half.step_id
        and c.position = 0
   );

update public.cells
   set content = 'Reviews the session calendar; edits, cancels, or reverts sessions.'
 where lane_id = 'f1000000-0000-4000-8000-000000000005'
   and step_id = 'f1000000-0000-4000-8000-000000000012'
   and content = 'Reviews the session calendar; edits, cancels, or reverts sessions and can join a live session.';

update public.cells
   set content = 'Exports contacts, rosters, and reflections.'
 where lane_id = 'f1000000-0000-4000-8000-000000000005'
   and step_id = 'f1000000-0000-4000-8000-000000000015'
   and content = 'Broadcasts email to tutors and exports contacts, rosters, and reflections.';

-- ── 4. The four upside-down stacks are turned the right way up ──────────
--
-- `lanes_path_position_unique` is deferrable and initially deferred, so the
-- two rows may hold the same position for the length of the statement.

update public.lanes as l
   set position = case
         when l.lane_role = 'backstage_actions' then swap.touchpoints_position
         else swap.actions_position
       end
  from (
    select actions.path_id,
           actions.position as actions_position,
           touchpoints.position as touchpoints_position
      from public.lanes as actions
      join public.lanes as touchpoints
        on touchpoints.path_id = actions.path_id
       and touchpoints.lane_role = 'backstage_touchpoints'
     where actions.lane_role = 'backstage_actions'
       and actions.position < touchpoints.position
       and actions.path_id in (
         'c1000000-0000-4000-8000-000000000002',
         'c2000000-0000-4000-8000-000000000002',
         'c3000000-0000-4000-8000-000000000002',
         '17d54a45-65ab-4670-8035-fb7bc0a0b256'
       )
  ) as swap
 where l.path_id = swap.path_id
   and l.lane_role in ('backstage_actions', 'backstage_touchpoints');

-- ── 5. The five lanes that were never added ─────────────────────────────
--
-- Support actions closes the stack, so it goes below everything the path
-- already has.

insert into public.lanes (path_id, name, lane_role, position, origin)
select missing.path_id,
       'Support Actions',
       'support_actions',
       (select max(l.position) + 1
          from public.lanes l
         where l.path_id = missing.path_id),
       'app'
  from (values
    ('c1000000-0000-4000-8000-000000000002'::uuid),
    ('c2000000-0000-4000-8000-000000000002'::uuid),
    ('c3000000-0000-4000-8000-000000000002'::uuid),
    ('17d54a45-65ab-4670-8035-fb7bc0a0b256'::uuid)
  ) as missing(path_id)
 where exists (
         select 1 from public.paths p where p.id = missing.path_id
       )
   and not exists (
         select 1
           from public.lanes l
          where l.path_id = missing.path_id
            and l.lane_role = 'support_actions'
       );

-- Backstage actions belongs BETWEEN the backstage touchpoints lane and the
-- support lane, so the support lane makes room first.
update public.lanes
   set position = position + 1
 where path_id = 'f1000000-0000-4000-8000-000000000042'
   and lane_role = 'support_actions'
   and position = 6
   and not exists (
     select 1
       from public.lanes l
      where l.path_id = 'f1000000-0000-4000-8000-000000000042'
        and l.lane_role = 'backstage_actions'
   );

insert into public.lanes (path_id, name, lane_role, position, origin)
select 'f1000000-0000-4000-8000-000000000042',
       'Back Stage Actions',
       'backstage_actions',
       6,
       'app'
 where exists (
         select 1
           from public.paths p
          where p.id = 'f1000000-0000-4000-8000-000000000042'
       )
   and not exists (
         select 1
           from public.lanes l
          where l.path_id = 'f1000000-0000-4000-8000-000000000042'
            and l.lane_role = 'backstage_actions'
       );

-- ── Proof ───────────────────────────────────────────────────────────────
--
-- Invariants, never censuses (ADR 0009). Each is vacuously true of an empty
-- database and each names the thing that would be wrong, not a number that
-- goes stale the next time somebody adds a board.

do $proof$
declare
  v_unplaced text;
  v_inverted text;
  v_unsupported text;
  v_undivided text;
  v_dropped text;
  v_exposed text;
begin
  -- A lane named after a person still carries the role that places it. This
  -- is the rule the forty broke; if one of them was missed, it is named here.
  select string_agg(distinct l.name, ', ' order by l.name)
    into v_unplaced
    from public.lanes l
   where l.lane_role is null
     and l.name in ('Teacher', 'Lead Tutor', 'Student', 'Supervisor');

  if v_unplaced is not null then
    raise exception
      'proof: % still carries no lane_role, so the dividers cannot place it',
      v_unplaced;
  end if;

  -- The four repaired paths now stack the way the other thirty-five do.
  -- Scoped to those four on purpose: they are the paths this file reorders,
  -- and that order is this deployment's convention rather than a law of the
  -- table — a board that ran its backstage stack the other way deliberately
  -- would not be broken. Asserted over every path it would be claiming
  -- something this file did not do.
  select string_agg(distinct actions.path_id::text, ', ')
    into v_inverted
    from public.lanes as actions
    join public.lanes as touchpoints
      on touchpoints.path_id = actions.path_id
     and touchpoints.lane_role = 'backstage_touchpoints'
   where actions.lane_role = 'backstage_actions'
     and actions.position < touchpoints.position
     and actions.path_id in (
       'c1000000-0000-4000-8000-000000000002',
       'c2000000-0000-4000-8000-000000000002',
       'c3000000-0000-4000-8000-000000000002',
       '17d54a45-65ab-4670-8035-fb7bc0a0b256'
     );

  if v_inverted is not null then
    raise exception
      'proof: path(s) % still run backstage actions above backstage touchpoints',
      v_inverted;
  end if;

  -- No path carries backstage work with nothing to hand it off to. The
  -- internal interaction line is drawn between those two lanes, so a path
  -- missing the support lane is a path missing a divider.
  select string_agg(distinct p.id::text, ', ')
    into v_unsupported
    from public.paths p
   where exists (
           select 1 from public.lanes l
            where l.path_id = p.id and l.lane_role = 'backstage_actions'
         )
     and not exists (
           select 1 from public.lanes l
            where l.path_id = p.id and l.lane_role = 'support_actions'
         );

  if v_unsupported is not null then
    raise exception
      'proof: path(s) % carry backstage actions with no support lane beneath',
      v_unsupported;
  end if;

  -- The split leaves no cell naming a visible act and an invisible one in the
  -- same sentence. Text, not a count: if the content had drifted, the two
  -- updates above would have matched nothing and said so nowhere.
  select string_agg(c.id::text, ', ')
    into v_undivided
    from public.cells c
   where c.content in (
     'Reviews the session calendar; edits, cancels, or reverts sessions and can join a live session.',
     'Broadcasts email to tutors and exports contacts, rosters, and reflections.'
   );

  if v_undivided is not null then
    raise exception
      'proof: cell(s) % still name a front-stage act and a back-stage one together',
      v_undivided;
  end if;

  -- The fold moved the supervisor's three admin screens; it did not delete
  -- them with their lane. `cells.lane_id` cascades, so a delete that ran
  -- before the move would have taken all three and said nothing. Named by
  -- what they say, because that is what would be missing.
  select string_agg(gone.content, ', ' order by gone.content)
    into v_dropped
    from (values
      ('Tutors admin page'), ('Sessions admin'), ('Students admin page')
    ) as gone(content)
   where exists (
           select 1 from public.paths p
            where p.id = 'f1000000-0000-4000-8000-000000000003'
         )
     and not exists (
           select 1
             from public.cells c
            where c.lane_id = 'f1000000-0000-4000-8000-000000000008'
              and c.content = gone.content
         );

  if v_dropped is not null then
    raise exception
      'proof: the fold lost %, which its lane held before the delete',
      v_dropped;
  end if;

  -- No board draws a back-stage row above its line of visibility. The line
  -- follows a frontstage-actions lane, or a frontstage-touchpoints lane with
  -- no actions lane under it, which is `shouldShowVisibilityLineAfter` read in
  -- SQL. A backstage row above it is a row the board tells the reader the
  -- customer can see. This is what the restack in section 2 is for, and it is
  -- phrased over the whole table because it is true of every board.
  select string_agg(distinct exposed.path_id::text, ', ')
    into v_exposed
    from public.lanes as exposed
    join (
      select ordered.path_id, min(ordered.position) as line_position
        from (
          select l.path_id,
                 l.position,
                 l.lane_role,
                 lead(l.lane_role) over (
                   partition by l.path_id order by l.position
                 ) as next_role
            from public.lanes l
        ) as ordered
       where ordered.lane_role = 'frontstage_actions'
          or (ordered.lane_role = 'frontstage_touchpoints'
              and ordered.next_role is distinct from 'frontstage_actions')
       group by ordered.path_id
    ) as visibility
      on visibility.path_id = exposed.path_id
   where exposed.lane_role in (
           'backstage_touchpoints', 'backstage_actions', 'support_actions'
         )
     and exposed.position < visibility.line_position;

  if v_exposed is not null then
    raise exception
      'proof: path(s) % draw a back-stage lane above the line of visibility',
      v_exposed;
  end if;
end;
$proof$;
