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
  /** The thing itself: a cell's own words, an entity's name. */
  title: 'min-w-0 text-sm font-bold leading-snug tracking-tight text-foreground',
  /** Counts and relationships under the title. Never restates the title. */
  meta: 'text-2xs leading-tight text-muted-foreground',
  /** Names a field or a group. Always the same weight, size and colour. */
  sectionLabel: 'text-2xs font-medium text-muted-foreground',
  /** Authored prose — what the panel exists to show. */
  value: 'text-sm text-foreground/80',
} as const
