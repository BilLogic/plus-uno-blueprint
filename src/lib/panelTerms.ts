/**
 * The words this app made up, defined once.
 *
 * TWO, and that is the point of #244. There were eleven, and nine of them were
 * ordinary English on a form label — `Status`, `Summary`, `Position`, `Paths`,
 * `Dependencies`, `Resources`. A definition on every label teaches a reader
 * that hovering is worth doing about eleven times before it teaches anything,
 * and the words that genuinely needed explaining were the ones that got lost
 * in it.
 *
 * What survives is what a reader could not guess from English: a STORYBOARD is
 * not a story, and a TOUCHPOINT is not a point. Both render as badges — the
 * shape this app gives a word drawn from a vocabulary rather than typed by an
 * author — which is what makes the rule checkable rather than tasteful
 * (`scripts/tests/a-definition-hangs-off-a-badge.test.mjs`).
 *
 * `evidence` was listed to survive too (#244), on the belief that it was
 * already a badge. It was a TAB, beside Dependencies and Resources, and a tab
 * is a label — so all three lost theirs together rather than one of them being
 * singled out for a definition its neighbours could not have.
 *
 * Each entry is a card SECTION's body, under an eyebrow that already prints
 * the term, so neither opens by naming the term again.
 */
export const PANEL_TERMS = {
  touchpoint:
    'The tool or surface this moment happens through — an app screen, an email, a Zoom room.',
  storyboard: 'The frames drawn for this moment, one per actor lane.',
} as const

/**
 * What a phase, a scenario, a path, a step, a lane and a service ARE.
 *
 * The entity kinds are the one vocabulary the app never defined. `PANEL_TERMS`
 * above explains the words INSIDE a panel — `Dependencies`, `Evidence` — on the
 * assumption that a reader who opened the panel knows what kind of thing they
 * opened it on. #140 is that assumption failing: a panel full of a lane's
 * contents answers "what is in this lane" and never "what is a lane".
 *
 * These hang off the entity's own label ON THE BOARD, not off the panel badge.
 * A reader who does not know what a lane is has that question while looking at
 * the board, before anything is opened — and an explanation that arrives only
 * after the click is an explanation for somebody who no longer needs it.
 *
 * `label` is the word as the popover prints it; `definition` is the sentence.
 * One entry per kind and no exemptions: a reader learns the shape once — kind
 * above the rule, this instance below it — and it never varies.
 */
export const ENTITY_KIND_DEFINITIONS = {
  service: {
    label: 'Service',
    definition:
      'The whole thing this blueprint maps. Every phase, scenario, lane and step below it describes one service.',
  },
  phase: {
    label: 'Phase',
    definition:
      'A stretch of the service in time. The board runs left to right through the phases, and each one holds the scenarios that can happen while it lasts.',
  },
  scenario: {
    label: 'Scenario',
    definition:
      'One situation the service has to handle inside a phase. A scenario has a board of its own: the same lanes, its own steps, and one or more paths through them.',
  },
  path: {
    label: 'Path',
    definition:
      'One route through a scenario. Every scenario has a main route; variants and exceptions are the other ways the same stretch can go.',
  },
  step: {
    label: 'Step',
    definition:
      'One column of the board: a single moment in the scenario, read down every lane at once. The same step can sit at a different position in each path.',
  },
  lane: {
    label: 'Lane',
    definition:
      'One row of the board: a kind of participant, or a place the work happens — the customer, staff in front of them, staff out of sight, the tools each uses. A lane runs across every step, so reading one row tells you what that participant does from beginning to end.',
  },
} as const

/** The six kinds that carry a definition. `path` is the one that is not a panel. */
export type EntityKindTerm = keyof typeof ENTITY_KIND_DEFINITIONS

/** What a description slot says when nobody has written one yet. */
export const INSTANCE_DESCRIPTION_PLACEHOLDER =
  'Description needs to be added to database.'

/**
 * An instance's own description, or the prompt to write one.
 *
 * The placeholder is not filler: it is the only place the app admits a field
 * is empty, and it is what has got several of them filled in.
 */
export function instanceDescriptionText(
  description: string | null | undefined,
): string {
  const trimmed = description?.trim()
  return trimmed || INSTANCE_DESCRIPTION_PLACEHOLDER
}
