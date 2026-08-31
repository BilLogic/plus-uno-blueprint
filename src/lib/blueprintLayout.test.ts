/**
 * The dividers, and the one thing they must never read.
 *
 * `lanes.name` is documented as free-form in any language. For as long as the
 * internal interaction line was decided by matching that name against the
 * string `'Support Actions'`, renaming or translating a lane deleted a
 * divider from the board, silently — and 36 of the 40 support lanes in
 * production carried no role at all, so the match was doing the whole job.
 *
 * Every case below is stated twice: once for the role, and once for the same
 * lane wearing a name nobody thought of. The second half is the point. A
 * divider suite that only ever passes English lane names cannot tell a role
 * lookup from a string comparison, which is how this survived.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import {
  shouldShowInteractionLineAfter,
  shouldShowInternalInteractionLineAfter,
  shouldShowVisibilityLineAfter,
} from '@/lib/blueprintLayout'
import {
  BACKSTAGE_ACTIONS_ROLE,
  BACKSTAGE_TOUCHPOINTS_ROLE,
  CUSTOMER_ACTIONS_ROLE,
  FRONTSTAGE_ACTIONS_ROLE,
  FRONTSTAGE_TOUCHPOINTS_ROLE,
  SUPPORT_ACTIONS_ROLE,
} from '@/lib/laneRoles'
import type { BlueprintLane } from '@/types/blueprint'

/** A lane, named however the caller likes. */
function lane(
  role: string | null,
  name = 'whatever this lane is called',
  position = 0,
): BlueprintLane {
  return { id: `lane-${role ?? 'none'}-${position}`, name, role, position }
}

/** The PLUS lane order, roles only, as production has it. */
function board(supportName = 'Support Actions'): BlueprintLane[] {
  return [
    lane(CUSTOMER_ACTIONS_ROLE, 'Regular Tutor', 0),
    lane(FRONTSTAGE_TOUCHPOINTS_ROLE, 'Front Stage Tech', 1),
    lane(FRONTSTAGE_ACTIONS_ROLE, 'Front Stage Actions', 2),
    lane(BACKSTAGE_ACTIONS_ROLE, 'Back Stage Actions', 3),
    lane(SUPPORT_ACTIONS_ROLE, supportName, 4),
  ]
}

test('the interaction line follows the spine actor', () => {
  assert.equal(shouldShowInteractionLineAfter(lane(CUSTOMER_ACTIONS_ROLE)), true)
  assert.equal(shouldShowInteractionLineAfter(lane(BACKSTAGE_ACTIONS_ROLE)), false)
  assert.equal(shouldShowInteractionLineAfter(lane(null)), false)
})

test('the visibility line follows the frontstage actions lane', () => {
  const lanes = board()
  assert.equal(shouldShowVisibilityLineAfter(lanes[2]!, lanes), true)
  assert.equal(shouldShowVisibilityLineAfter(lanes[3]!, lanes), false)
})

test('a frontstage tech lane above frontstage actions does not take the line', () => {
  const lanes = board()
  assert.equal(shouldShowVisibilityLineAfter(lanes[1]!, lanes), false)
})

test('the internal interaction line draws before a support lane', () => {
  const lanes = board()
  assert.equal(shouldShowInternalInteractionLineAfter(lanes[3]!, lanes), true)
})

test('the internal interaction line survives renaming the support lane', () => {
  // The regression. A support lane called anything at all still anchors the
  // divider, because the role says what it is and the name never did.
  for (const name of ['Ondersteuningsacties', '支援アクション', 'Ops', '']) {
    const lanes = board(name)
    assert.equal(
      shouldShowInternalInteractionLineAfter(lanes[3]!, lanes),
      true,
      `a support lane named "${name}" lost the internal interaction line`,
    )
  }
})

test('an explicit role beats the name it happens to carry', () => {
  // The other half of the same rule. The bespoke comparison in the layout
  // module fired on the name alone, so a lane whose role said one thing and
  // whose label said another drew a divider its role gave it no claim to.
  const lanes = [
    lane(BACKSTAGE_ACTIONS_ROLE, 'Back Stage Actions', 0),
    lane(BACKSTAGE_TOUCHPOINTS_ROLE, 'Support Actions', 1),
  ]
  assert.equal(shouldShowInternalInteractionLineAfter(lanes[0]!, lanes), false)
})

test('role-less fallback content still gets its divider', () => {
  // 23 lanes across the hand-written fallback blueprints are named
  // 'Support Actions' and carry no role, because that data predates
  // `lane_role` entirely — every lane in it resolves through
  // LEGACY_NAME_TO_ROLE, not just this one. That map is the single, declared
  // place where a name may still stand in for a missing role, and moving the
  // lookup into it is the point: the divider itself now reads only a role,
  // and the rows in the database all have one.
  const lanes = [
    lane(BACKSTAGE_ACTIONS_ROLE, 'Back Stage Actions', 0),
    lane(null, 'Support Actions', 1),
  ]
  assert.equal(shouldShowInternalInteractionLineAfter(lanes[0]!, lanes), true)
})

test('the internal interaction line needs a backstage actions lane before it', () => {
  const lanes = [
    lane(FRONTSTAGE_ACTIONS_ROLE, 'Front Stage Actions', 0),
    lane(SUPPORT_ACTIONS_ROLE, 'Support Actions', 1),
  ]
  assert.equal(shouldShowInternalInteractionLineAfter(lanes[0]!, lanes), false)
})

test('the last lane never draws an internal interaction line', () => {
  const lanes = [lane(BACKSTAGE_ACTIONS_ROLE, 'Back Stage Actions', 0)]
  assert.equal(shouldShowInternalInteractionLineAfter(lanes[0]!, lanes), false)
})
