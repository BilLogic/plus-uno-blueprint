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
