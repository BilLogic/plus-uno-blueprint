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
 * | gesture              | Figma (canvas)     | here                        |
 * | -------------------- | ------------------ | --------------------------- |
 * | click                | replace            | **toggle**                  |
 * | ⇧ click              | add / toggle       | **range** from the anchor   |
 * | ⌘ / ctrl click       | deep-select child  | **open the detail panel**   |
 * | double click         | enter/edit         | nothing (two toggles)       |
 * | ⇧ drag (marquee)     | add to selection   | add                         |
 * | drag (marquee)       | replace            | replace                     |
 * | click empty canvas   | clear              | **nothing**                 |
 *
 * The departures share one reason: this selection is a **set being
 * assembled** over minutes, with exactly one verb at the end of it — make a
 * slice. Figma's grammar assumes the opposite, a selection that is the
 * subject of the next of many verbs, held for seconds.
 *
 * - **Click toggles rather than replaces.** Replace-on-click means the set can
 *   never be built by clicking; it can only be built by holding a modifier for
 *   every cell after the first, which nothing tells you.
 * - **Empty canvas does not clear.** A miss between two cells would throw away
 *   minutes of work gathered across blueprints. The ✕ in the bar clears.
 * - **⌘-click opens the detail panel, and double-click means nothing.**
 *   Opening a cell needs a deliberate gesture while plain clicks pick, and
 *   double-click cannot be that gesture in a toggle grammar: click-in,
 *   click-out *is* a fast double-click, so the two are indistinguishable by
 *   construction — reading a cell kept flipping its membership. A held
 *   modifier cannot be produced by clicking fast. Right-click → "View cell
 *   detail" is the discoverable route to the same place.
 *
 * Unpicking is always the same gesture as picking: click a picked cell and it
 * leaves. `range` is the one mode that cannot unpick, which is correct — a
 * range is a reach, not a toggle, and Figma's shift-range does not unpick
 * either.
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

/**
 * True when this click asks to *read* the cell rather than pick it.
 * The one gesture that must not be producible by clicking fast.
 */
export function clickOpensDetail(event: ClickModifiers): boolean {
  return event.metaKey || event.ctrlKey
}

/** Marquee: a bare sweep says "these", shift says "these as well". */
export function pickModeForMarquee(event: { shiftKey: boolean }): PickMode {
  return event.shiftKey ? 'add' : 'replace'
}

/**
 * Does this click belong to the picker at all?
 *
 * In Design mode every plain or shift click picks; ⌘/ctrl never does — it is
 * the open-detail gesture and must not also touch the selection.
 */
export function clickPicks(
  event: ClickModifiers,
  plainClick: boolean,
): boolean {
  if (clickOpensDetail(event)) return false
  return plainClick || event.shiftKey
}
