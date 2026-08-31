/**
 * The blueprint's own vocabulary, defined once.
 *
 * One place, because the same word appears in a tab, a section heading and a
 * field label, and three copies of a definition is three chances to drift.
 */
export const PANEL_TERMS = {
  dependencies:
    'What has to happen before this cell, and what it sets off after. The arrows on the canvas are these.',
  evidence:
    'The sources behind this cell — a recording, a ticket, a line of code. A cell with none is an assumption, not a finding.',
  resources:
    'Links out: the screen, the card, the doc this cell refers to. Anything a reader would open to check it.',
  pathSummary:
    'The condition that puts someone on this route rather than one of its siblings.',
  authorNote:
    "The author's aside — an open question, provenance, working state. Not a fact about the service.",
  status:
    'How far along the thing this describes is, from proposed to live to on its way out.',
  touchpoint:
    'The tool or surface this moment happens through — an app screen, an email, a Zoom room.',
  paths: 'The routes through this scenario. Every scenario has one main route and may have variants and exceptions.',
  position:
    'Where this step sits in each route. A step can be third in one path and fifth in another.',
  storyboard: 'This moment’s strip — the frames drawn for it, one per actor lane.',
  summary: 'The tl;dr — what the detailed fields below add up to.',
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
