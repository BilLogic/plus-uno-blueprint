import type { DependencyKind } from '@/lib/authoringRpc'

/**
 * Dependency rules, checked before the round trip.
 *
 * Mirrors what `set_cell_dependency` raises. The database stays the authority
 * — two people can connect the same cells at once — but a rule you meet by
 * being rejected is a rule you have to guess at first.
 */

export const DEPENDENCY_KINDS: DependencyKind[] = ['leads_to', 'enables']

/**
 * What each kind means, and — the part that matters — whether it draws.
 *
 * Every relationship being an arrow is what makes a blueprint unreadable.
 * Most "this depends on that" facts are not handoffs: they are constraints
 * worth recording and not worth drawing. `enables` is where those go.
 *
 * Both kinds read SOURCE-FIRST and upstream-first, which is the whole reason
 * this pair replaced `sets_off` / `depends_on`: those two put the source cell
 * at opposite ends, so an edge's direction could not be read without first
 * checking its kind.
 *
 *   "Creates breakout rooms"  sets off  "Reminds tutors to go through rooms"
 *   "Roster has loaded"       enables   "Greets the student"
 *
 * Makes it HAPPEN versus makes it POSSIBLE. A loaded roster does not set off a
 * greeting — the student arriving does — but nothing works without it.
 */
export const DEPENDENCY_KIND_HINTS: Record<DependencyKind, string> = {
  leads_to: 'One step hands off to the next. Draws an arrow.',
  enables: 'Makes the next step possible, without causing it.',
}

/*
  DISPLAY WORDING — 2026-08-20.

  The stored key stays `leads_to`; the words a reader sees are "Leads to" and
  "Follows". "Leads to" reads as an alarm going off rather than as one moment
  handing to the next, and the panel's own headings ("SET OFF BY" / "SETS
  OFF") were the clearest place it showed. `enables` needs no translation —
  it is already the plain word for what it means.

  Renaming the COLUMN would be a third rename of the same enum plus a
  cross-repo deploy for a wording preference; the label is where the wording
  belongs, and the key is what the arrows, the RPC and uno-bot all agree on.

  The cross-repo relationship: docs/connectors/plus-uno.md.
*/

/** The stored value IS the label, minus the underscore — that is the point of
 *  the rename. These match the Dependencies tab's group headings. */
export const DEPENDENCY_KIND_LABELS: Record<DependencyKind, string> = {
  leads_to: 'Leads to',
  enables: 'Enables',
}

/** The two directions, for a panel that groups edges by which way they point. */
export const DEPENDENCY_DIRECTION_LABELS = {
  /** Edges arriving at this cell — what came before it. */
  incoming: 'Follows',
  /** Edges leaving it — what it hands to. */
  outgoing: 'Leads to',
} as const

/**
 * The words the dependency editor is made of, held beside the vocabulary they
 * describe rather than inside the component that renders them.
 *
 * ONE PROSE FIELD, AND IT IS `note` (#550). The editor used to offer `Name
 * (optional)` over `cell_dependencies.name`, documented as the word drawn on
 * the arrow. Measured in production on 2026-09-09: 434 rows, 8 with a name, 0
 * with a note — and not one of the 8 is a word on an arrow. Every one is a
 * sentence about the edge ("All lessons complete → badge claimable"). Authors
 * wrote notes into the name field because it was the only prose field there
 * was, so `name` is retired and `note` is the field it was being used as.
 *
 * The label is `Note` and the copy is deliberately WIDE. "Why this edge exists"
 * was the first draft and it is too narrow — it tells an author their sentence
 * is unwelcome unless it is a justification. A note on a dependency is the same
 * kind of thing as a note on a piece of evidence: whatever is worth recording.
 */
export const DEPENDENCY_EDIT_TEXT = {
  /** The field's name. The word "optional" is rendered beside it, not in it. */
  noteLabel: 'Note',
  noteOptional: true,
  notePlaceholder: 'Anything worth knowing about this dependency',
  /** Verb first: names the action, not the widget. */
  connectTo: 'Connect to…',
  add: 'Add a dependency',
  /** Edit mode with nothing yet to edit. */
  empty: 'Nothing depends on this cell yet.',
} as const

/** The draft row's id — not a dependency id, and never sent anywhere. */
export const DEPENDENCY_DRAFT_ROW = 'draft'

export type DraftDependency = {
  sourceCellId: string
  targetCellId: string | null
  kind: DependencyKind
  /** Anything worth knowing about it — `cell_dependencies.note`. */
  note: string
}

/** Enough about the other end to check a draft without another read. */
export type DependencyEndpoint = {
  cellId: string
  pathId: string
  label: string
}

/**
 * Problems worth showing, in the order they should be fixed.
 *
 * The same-version rule is the one people hit. An arrow between two versions
 * of a journey would render as a line leaving the grid it belongs to — the
 * versions are alternatives, not stages, so a handoff between them describes
 * something that cannot happen.
 */
export function validateDraftDependency(
  draft: DraftDependency,
  source: DependencyEndpoint,
  target: DependencyEndpoint | null,
  existing: Array<{ targetCellId: string; kind: string }>,
): string[] {
  const problems: string[] = []

  if (!draft.targetCellId || !target) {
    problems.push('Pick the cell this one connects to.')
    return problems
  }

  if (draft.targetCellId === draft.sourceCellId) {
    problems.push('A cell cannot depend on itself.')
  }

  if (target.pathId !== source.pathId) {
    problems.push(
      'Both cells must be on the same path — paths are alternatives, so a handoff between them cannot happen.',
    )
  }

  if (
    existing.some(
      (entry) =>
        entry.targetCellId === draft.targetCellId && entry.kind === draft.kind,
    )
  ) {
    problems.push('That connection already exists.')
  }

  if (!DEPENDENCY_KINDS.includes(draft.kind)) {
    problems.push('Pick whether this is a handoff or a dependency.')
  }

  return problems
}
