/**
 * Semantic lane roles — the stable contract between blueprint content and
 * rendering. A lane's display name (`lanes.name`) is free-form in any
 * language; its `lane_role` carries the rendering semantics (pill cells,
 * visual rows, divider-line anchoring). The vocabulary is extensible:
 * org-defined custom roles render as generic swimlanes, as does a null role
 * (e.g. actor lanes such as Student or Regular Tutor).
 */
export const CUSTOMER_ACTIONS_ROLE = 'customer_actions'
export const FRONTSTAGE_ACTIONS_ROLE = 'frontstage_actions'
export const BACKSTAGE_ACTIONS_ROLE = 'backstage_actions'
export const PARTNER_ACTIONS_ROLE = 'partner_actions'
export const FRONTSTAGE_TECH_ROLE = 'frontstage_tech'
export const BACKSTAGE_TECH_ROLE = 'backstage_tech'
export const SUPPORT_ACTIONS_ROLE = 'support_actions'
export const VISUAL_ROLE = 'visual'

/**
 * The vocabulary, and the whole of it.
 *
 * Held identical to the `lane_role` CHECK constraint by
 * `scripts/tests/lane-roles.test.mjs`. Three lists used to disagree with each
 * other and none agreed with the data: this one omitted `partner_actions`,
 * which three lanes use, and named `support_systems` and `step_visual`, which
 * no lane has ever used. Both are gone — retired unused, not renamed, since
 * nothing has to migrate off a value nothing holds.
 */
export const CANONICAL_LAYER_ROLES = [
  CUSTOMER_ACTIONS_ROLE,
  FRONTSTAGE_ACTIONS_ROLE,
  BACKSTAGE_ACTIONS_ROLE,
  PARTNER_ACTIONS_ROLE,
  FRONTSTAGE_TECH_ROLE,
  BACKSTAGE_TECH_ROLE,
  SUPPORT_ACTIONS_ROLE,
  VISUAL_ROLE,
] as const

export type CanonicalLayerRole = (typeof CANONICAL_LAYER_ROLES)[number]

/**
 * Legacy magic-name → role mapping for content that predates `lane_role`
 * (DB rows without the backfill and all hand-written TS fallbacks, which
 * carry no role). 'Regular Tutor' is the spine actor of the PLUS blueprints —
 * it plays the customer-actions role, so the interaction line draws after it.
 */
export const LEGACY_NAME_TO_ROLE: Readonly<Record<string, CanonicalLayerRole>> =
  {
    'Customer Actions': CUSTOMER_ACTIONS_ROLE,
    'Regular Tutor': CUSTOMER_ACTIONS_ROLE,
    'Front Stage Actions': FRONTSTAGE_ACTIONS_ROLE,
    'Frontstage Actions': FRONTSTAGE_ACTIONS_ROLE,
    'Back Stage Actions': BACKSTAGE_ACTIONS_ROLE,
    'Backstage Actions': BACKSTAGE_ACTIONS_ROLE,
    'Front Stage Tech': FRONTSTAGE_TECH_ROLE,
    'Back Stage Tech': BACKSTAGE_TECH_ROLE,
    'Support Actions': SUPPORT_ACTIONS_ROLE,
    'Tech Support Actions': SUPPORT_ACTIONS_ROLE,
    Visual: VISUAL_ROLE,
  }

/** Resolve a lane's semantic role: explicit role, else legacy name, else none. */
export function getLayerRole(lane: {
  name: string
  role?: string | null
}): string | null {
  return lane.role ?? LEGACY_NAME_TO_ROLE[lane.name] ?? null
}

/**
 * The role in words, for a human reading a lane's properties.
 *
 * The enum key is a rendering contract (`frontstage_actions` decides where the
 * visibility line draws); it is not an answer to "what is this row". The
 * sentences come from `references/lane-roles.md`, which is the same source the
 * agent reads, so the two never say different things about the same key.
 *
 * An unknown or absent role is not an error: a custom role and a null role
 * both render as a generic swimlane, which is exactly what this says.
 */
const LANE_ROLE_DESCRIPTIONS: Readonly<Record<string, string>> = {
  [CUSTOMER_ACTIONS_ROLE]:
    'Customer actions — the spine of the journey. The interaction line draws below it.',
  [FRONTSTAGE_ACTIONS_ROLE]:
    'Frontstage — staff actions the customer can see.',
  [BACKSTAGE_ACTIONS_ROLE]: 'Backstage — staff actions out of sight.',
  [FRONTSTAGE_TECH_ROLE]:
    'Frontstage technology — customer-facing systems, shown as pills.',
  [BACKSTAGE_TECH_ROLE]: 'Backstage technology — internal systems, shown as pills.',
  [SUPPORT_ACTIONS_ROLE]:
    'Support — teams, vendors and infrastructure behind the work.',
  [PARTNER_ACTIONS_ROLE]:
    'Partner — a body outside PLUS, acting where the tutor can see them.',
  [VISUAL_ROLE]: 'Storyboard — the pictures for each step, not text.',
}

export function describeLaneRole(role: string | null | undefined): string {
  if (!role) return 'A swimlane with no blueprint role.'
  return LANE_ROLE_DESCRIPTIONS[role] ?? `Custom role: ${role}.`
}

/**
 * The role as a CHIP — the name only, no explanation.
 *
 * The sentences above are one shape: "Name — what it means." A panel that
 * shows a generic "Lane" chip AND that whole sentence underneath says the
 * same thing twice at two sizes. So the chip takes the half before the dash
 * and the sentence moves behind a hint, which is where an explanation belongs
 * once the reader can see the answer.
 */
export function labelLaneRole(role: string | null | undefined): string {
  if (!role) return 'Lane'
  const described = LANE_ROLE_DESCRIPTIONS[role]
  if (!described) return 'Lane'
  return described.split('—')[0]!.trim()
}
