import type { PickMode } from '@/contexts/cellPickContext'

/**
 * What a modifier means when a cell is clicked.
 *
 * One function, so the answer cannot differ between the cell button, the
 * marquee and anything added later. It was previously spread across three
 * call sites with slightly different opinions, which is exactly how a
 * selection grammar becomes "messy": every gesture was individually
 * defensible and no two agreed.
 *
 * ## The grammar, and where it departs from Figma
 *
 * | gesture              | Figma (canvas)     | here                       |
 * | -------------------- | ------------------ | -------------------------- |
 * | click                | replace            | **toggle**                 |
 * | ⇧ click              | add / toggle       | **range** from the anchor  |
 * | ⌘ / ctrl click       | deep-select child  | **toggle** (same as click) |
 * | ⇧ drag (marquee)     | add to selection   | add                        |
 * | drag (marquee)       | replace            | replace                    |
 * | click empty canvas   | clear              | **nothing**                |
 *
 * Two deliberate departures, both for the same reason: this selection is a
 * **set being assembled** over minutes, with exactly one verb at the end of
 * it — make a slice. Figma's grammar assumes the opposite, a selection that is
 * the subject of the next of many verbs, held for seconds.
 *
 * - **Click toggles rather than replaces.** Replace-on-click means the set can
 *   never be built by clicking; it can only be built by holding a modifier for
 *   every cell after the first, which nothing tells you.
 * - **Empty canvas does not clear.** A miss between two cells would throw away
 *   minutes of work gathered across blueprints. The ✕ in the bar clears.
 *
 * ⌘-click matching plain click is not laziness: Figma's ⌘-click means
 * "select the child under the pointer", and there is no nesting here to
 * descend into. Making it toggle means the modifier people reach for out of
 * habit does the harmless, expected thing instead of nothing.
 *
 * Unpicking is therefore always available and always the same gesture: click a
 * picked cell (with or without ⌘) and it leaves. `range` is the one mode that
 * cannot unpick, which is correct — a range is a reach, not a toggle, and
 * Figma's shift-range does not unpick either.
 */
export type ClickModifiers = {
  shiftKey: boolean
  metaKey: boolean
  ctrlKey: boolean
}

export function pickModeForClick(
  event: ClickModifiers,
  /** A picker that is not gathering has no run to reach across. */
  gathers: boolean,
): PickMode {
  if (event.shiftKey) return gathers ? 'range' : 'toggle'
  return 'toggle'
}

/** Marquee: a bare sweep says "these", shift says "these as well". */
export function pickModeForMarquee(event: { shiftKey: boolean }): PickMode {
  return event.shiftKey ? 'add' : 'replace'
}

/**
 * Does this click belong to the picker at all?
 *
 * In Design mode every plain click picks. Outside it, only a modified click
 * does — ordinary reading of a blueprint must stay ordinary.
 */
export function clickPicks(
  event: ClickModifiers,
  plainClick: boolean,
): boolean {
  return plainClick || event.shiftKey || event.metaKey || event.ctrlKey
}
