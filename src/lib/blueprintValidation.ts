import type { LaneSetEntry, ViewType } from '@/lib/authoringRpc'

/**
 * What a new scenario needs before it is worth sending.
 *
 * Mirrors the checks `create_scenario` raises, for the same reason
 * `sliceValidation.ts` mirrors the slice tool: a rule enforced only in the
 * database is a rule the person meets by being rejected. These run as they
 * type; the database's copy stays as the authority.
 */

export const VIEW_TYPES: ViewType[] = ['single', 'stacked']

/**
 * Display names.
 *
 * The old comment here read "the stored values are hyphenated; nobody should
 * read those" — which was true of `side-by-side` and is the whole reason the
 * vocabulary collapsed. The stored token is now the token the UI names.
 */
export const VIEW_TYPE_LABELS: Record<ViewType, string> = {
  single: 'Single',
  stacked: 'Stacked',
}

/** What each view type is for, in the words someone choosing one would use. */
export const VIEW_TYPE_HINTS: Record<ViewType, string> = {
  single: 'One version at a time',
  stacked: 'Paths compared step by step',
}

/**
 * `merged` is deliberately absent: it is a per-session display chosen in the
 * compare control, not a property of the scenario. The CHECK constraint
 * rejects it, so offering it here would present a choice the write refuses.
 */

/**
 * The lanes a scenario starts with when nothing is copied.
 *
 * Deliberately the standard set rather than something minimal: an empty lane
 * rail invites inventing a private vocabulary, which is the drift copying
 * exists to prevent.
 *
 * Names, roles and order are all taken from what this database actually
 * contains, not from the generic service-blueprint diagram. Two things there
 * are easy to get wrong and are load-bearing:
 *
 * - The roles are `frontstage_tech`, not `front_stage_tech`. Every lane here
 *   carries one. That was not always true: this set gave Regular Tutor and
 *   Support Actions a null role while production gave them
 *   `customer_actions` and (since the divider migration) `support_actions`,
 *   so a scenario created from this template started life with two lanes
 *   whose dividers were drawn by name lookup rather than by role. Actor lanes
 *   BEYOND the spine — Teacher, Lead Tutor, Student, Supervisor — genuinely
 *   carry no role and are not in this set.
 * - **Touchpoints sit above actions**, which reverses the usual textbook order. That
 *   was a deliberate change — see the `stage_tech_before_actions_layer_order`
 *   migration — and a new blueprint that ordered them the other way would not
 *   line up against any existing one in the side-by-side view.
 */
export const DEFAULT_LANE_SET: LaneSetEntry[] = [
  { name: 'Storyboard', lane_role: 'storyboard', position: 0 },
  { name: 'Regular Tutor', lane_role: 'customer_actions', position: 1 },
  { name: 'Front Stage Touchpoints', lane_role: 'frontstage_touchpoints', position: 2 },
  { name: 'Front Stage Actions', lane_role: 'frontstage_actions', position: 3 },
  { name: 'Back Stage Touchpoints', lane_role: 'backstage_touchpoints', position: 4 },
  { name: 'Back Stage Actions', lane_role: 'backstage_actions', position: 5 },
  { name: 'Support Actions', lane_role: 'support_actions', position: 6 },
]

/** Columns beyond this read as a process map, not a blueprint. */
export const MAX_STEP_COUNT = 12
export const MIN_STEP_COUNT = 1

export type DraftBlueprint = {
  phaseId: string | null
  name: string
  viewType: ViewType
  /** Copy lanes from this version. Null means use `DEFAULT_LANE_SET`. */
  laneSourcePathId: string | null
  stepCount: number
  pathName: string
}

/**
 * Problems worth showing, in the order they should be fixed.
 *
 * Empty means it can be sent. Each string is a sentence a person can act on —
 * no field names, no constraint names.
 */
export function validateDraftBlueprint(draft: DraftBlueprint): string[] {
  const problems: string[] = []

  if (!draft.phaseId) {
    problems.push('Pick the phase this scenario belongs to.')
  }
  if (!draft.name.trim()) {
    problems.push('A scenario needs a name.')
  }
  if (!draft.pathName.trim()) {
    problems.push(
      // Not "Happy Path": a type is not a name, and the board stopped using
      // one as a name in Aug 2026. `kind` already carries the archetype.
      'The first version needs a name — say what the route is, e.g. "Signs up without conflicts".',
    )
  }
  if (!VIEW_TYPES.includes(draft.viewType)) {
    problems.push('Pick how the versions should be laid out.')
  }
  if (!Number.isInteger(draft.stepCount)) {
    problems.push('The number of columns must be a whole number.')
  } else if (draft.stepCount < MIN_STEP_COUNT) {
    problems.push('A scenario needs at least one step.')
  } else if (draft.stepCount > MAX_STEP_COUNT) {
    problems.push(
      `${MAX_STEP_COUNT} steps is the practical limit — past that it reads as a process map rather than a service blueprint. Add more later if the story needs them.`,
    )
  }

  return problems
}

/** The lane set a draft will actually be created with. */
export function laneSetFor(draft: DraftBlueprint): LaneSetEntry[] {
  return draft.laneSourcePathId ? [] : DEFAULT_LANE_SET
}
