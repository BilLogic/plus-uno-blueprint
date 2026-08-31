/**
 * The panel type scale — four roles, named once.
 *
 * Five panels and three tabs had drifted into six treatments for four jobs: a
 * section label was `text-2xs font-medium text-muted-foreground` in the spec
 * sections and `text-3xs font-semibold uppercase tracking-wide` in the
 * dependency groups; a value was `text-sm text-foreground/80` in one place and
 * `text-xs text-muted-foreground` in another. Naming the roles is what makes
 * the repetition survive the next panel — a class list copied by hand drifts,
 * a constant does not.
 */
export const PANEL_TEXT = {
  /**
   * The thing itself: a cell's own words, an entity's name.
   *
   * `font-semibold`, not bold: at 14px in a narrow drawer, bold sets the title
   * shouting over the prose directly under it, which is what the panel exists
   * to show.
   *
   * And NOT `tracking-tight leading-snug`, which is what it carried until
   * 2026-08-21. Both are display-type devices — they exist to pull a large
   * heading back together, where default tracking reads loose. At 14px they do
   * the opposite, and this "title" is very often a whole sentence rather than
   * a short name ("Pings the assigned tutor if a late joiner has not been
   * moved to their breakout room."). Negative tracking plus 1.375 leading on a
   * semibold sentence is the worst of the available combinations: the letters
   * crowd and the lines crowd at once. Default tracking, normal leading.
   */
  title: 'min-w-0 text-sm font-semibold leading-normal text-foreground',
  /** Counts and relationships under the title. Never restates the title. */
  meta: 'text-2xs leading-tight text-muted-foreground',
  /** Names a field or a group. Always the same weight, size and colour. */
  sectionLabel: 'text-2xs font-medium text-muted-foreground',
  /** Authored prose — what the panel exists to show. */
  value: 'text-sm text-foreground/80',
} as const

/**
 * The cue an explained label wears, and the reason it is not an ⓘ.
 *
 * A dotted underline is the `<abbr>` idiom: it marks the WORD, it is drawn
 * without a pointer, and it survives on touch — where `cursor-help` says
 * nothing at all, because there is no cursor. An ⓘ would have said the other
 * thing this app's ⓘ means, and only ever means: opens the panel
 * (docs/reference/panel-affordances.md).
 *
 * `decoration-current/40` so the rule takes the label's own ink at 40% — a
 * lane label carries its role's colour and a path badge its path type's, and a
 * fixed underline colour would have been a second hue on both.
 */
export const DEFINED_LABEL_CUE =
  'underline decoration-dotted decoration-from-font underline-offset-4 decoration-current/40'
