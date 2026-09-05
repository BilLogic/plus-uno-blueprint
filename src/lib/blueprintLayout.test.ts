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
  laneHasInLaneLoopCorridor,
  laneHasOverheadArrowCorridor,
  laneHasWrapCorridorBelow,
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
import type { BlueprintData, BlueprintLane } from '@/types/blueprint'

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
    lane(CUSTOMER_ACTIONS_ROLE, 'The person the service is for', 0),
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

/*
  The corridors, and the one thing THEY must never read.

  A lane used to get arrow headroom because of what it was called: three
  names — a tutor, a teacher, a discovery rail — were written into the layout
  module, and any other lane's spanning or backward arrow drew straight over
  its own cells. The rule below is the whole rule, stated on the data: which
  lane a cell sits in, and which column its step occupies. Every case is
  therefore posed on lanes named nothing in particular, because a name is not
  an input.
*/

/** A four-column board of `laneCount` lanes, one cell per lane per column. */
function board2(laneCount: number): { lanes: BlueprintLane[]; data: BlueprintData } {
  const lanes = Array.from({ length: laneCount }, (_, index) =>
    lane(null, `lane ${index}`, index),
  )
  const steps = [0, 1, 2, 3].map((position) => ({ id: `s${position}`, position }))
  const cells = lanes.flatMap((entry) =>
    steps.map((step) => ({
      id: `${entry.id}:${step.id}`,
      lane_id: entry.id,
      step_id: step.id,
    })),
  )
  return {
    lanes,
    data: { lanes, steps, cells, dependencies: [] } as unknown as BlueprintData,
  }
}

function withDependencies(
  data: BlueprintData,
  ...pairs: Array<[string, string]>
): BlueprintData {
  return {
    ...data,
    dependencies: pairs.map(([source_cell_id, target_cell_id]) => ({
      source_cell_id,
      target_cell_id,
    })),
  } as unknown as BlueprintData
}

test('a forward in-lane dependency clearing a column reserves the overhead rail', () => {
  const { lanes, data } = board2(3)
  // Same lane, columns 0 -> 2: one cell is skipped, so the arrow cannot run
  // along the row and needs the strip above it.
  const board = withDependencies(data, ['lane-none-1:s0', 'lane-none-1:s2'])
  assert.equal(laneHasOverheadArrowCorridor(lanes[1]!, board), true)
  // and on no other lane
  assert.equal(laneHasOverheadArrowCorridor(lanes[0]!, board), false)
  assert.equal(laneHasOverheadArrowCorridor(lanes[2]!, board), false)
})

test('the overhead rail is reserved on ANY lane, not on three named ones', () => {
  // The regression. The same shape, moved from lane to lane, must reserve the
  // same corridor every time — the previous rule answered `true` only for
  // lanes called 'Regular Tutor' or 'Teacher'.
  for (const index of [0, 1, 2]) {
    const { lanes, data } = board2(3)
    const board = withDependencies(data, [
      `lane-none-${index}:s1`,
      `lane-none-${index}:s3`,
    ])
    assert.equal(
      laneHasOverheadArrowCorridor(lanes[index]!, board),
      true,
      `lane ${index} lost its overhead corridor`,
    )
  }
})

test('a neighbouring-column dependency needs no corridor', () => {
  const { lanes, data } = board2(2)
  // 0 -> 1 clears nothing: the arrow fits in the gap between the two cells.
  const board = withDependencies(data, ['lane-none-0:s0', 'lane-none-0:s1'])
  assert.equal(laneHasOverheadArrowCorridor(lanes[0]!, board), false)
  assert.equal(laneHasInLaneLoopCorridor(lanes[0]!, board), false)
})

test('a dependency that leaves the lane is not the lane\'s corridor to reserve', () => {
  const { lanes, data } = board2(2)
  const board = withDependencies(data, ['lane-none-0:s0', 'lane-none-1:s3'])
  assert.equal(laneHasOverheadArrowCorridor(lanes[0]!, board), false)
  assert.equal(laneHasOverheadArrowCorridor(lanes[1]!, board), false)
})

test('a backward in-lane dependency reserves the loop corridor above its row', () => {
  const { lanes, data } = board2(3)
  const board = withDependencies(data, ['lane-none-2:s3', 'lane-none-2:s1'])
  assert.equal(laneHasInLaneLoopCorridor(lanes[2]!, board), true)
  assert.equal(laneHasOverheadArrowCorridor(lanes[2]!, board), false)
  assert.equal(laneHasInLaneLoopCorridor(lanes[0]!, board), false)
})

test('a backward loop one column wide still reserves the loop corridor', () => {
  const { lanes, data } = board2(1)
  const board = withDependencies(data, ['lane-none-0:s2', 'lane-none-0:s1'])
  assert.equal(laneHasInLaneLoopCorridor(lanes[0]!, board), true)
})

test('a lane with neither shape reserves nothing', () => {
  const { lanes, data } = board2(2)
  assert.equal(laneHasOverheadArrowCorridor(lanes[0]!, data), false)
  assert.equal(laneHasInLaneLoopCorridor(lanes[0]!, data), false)
  assert.equal(laneHasWrapCorridorBelow(lanes[0]!), false)
})

test('only the spine actor gets a corridor BELOW its row', () => {
  // The routing decision this change accepts from the template: a backward
  // loop reserves headroom ABOVE its own row, wherever it is. The band below
  // belongs to the row the line of interaction follows, and to no other —
  // there is no second lane holding one by name.
  const spine = lane(CUSTOMER_ACTIONS_ROLE, 'whoever this service is for', 0)
  const other = lane(null, 'somebody else', 1)
  assert.equal(laneHasWrapCorridorBelow(spine), true)
  assert.equal(laneHasWrapCorridorBelow(other), false)
})
