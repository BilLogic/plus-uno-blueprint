/**
 * One treatment for both canvas header axes.
 *
 * The row header (a lane's name) and the column header (a step's name) are the
 * same kind of object — the label of an axis, and the way into what that axis
 * describes — and they had drifted into two: 11px bold ink-coloured in a
 * `px-1 py-0.5` box on one axis, 12px medium muted in a `px-2 pb-1.5` box on
 * the other, with different gaps to their icons and a selected state that
 * looked exactly like hover.
 *
 * What stays different is what is actually different: a row label reads from
 * the top-left of a tall row, a column label is centred over its column, and
 * each keeps its own ink (a lane carries its role's colour; a step is chrome).
 */

/** Size, weight and tracking — identical on both axes. */
export const CANVAS_HEADER_TEXT = 'text-xs font-semibold tracking-tight'

/** The box: one radius, one padding, one gap to the ⓘ. */
export const CANVAS_HEADER_BOX = 'rounded-md px-2 py-1.5 gap-1.5'

/**
 * Rest → hover → selected, as three distinguishable states.
 *
 * Hover and selected were the same wash, so an open panel gave the canvas no
 * way to say which label it belonged to. Selected is the deeper wash plus the
 * ring a SELECTED CELL wears — one selection vocabulary on one canvas.
 *
 * `ring-inset` on both rings, and this is the whole fix for the cut-off
 * header: an outset ring is painted OUTSIDE the element's box, and both
 * headers sit inside a clipping parent — the label rail is `overflow-hidden`
 * and the column header row is a fixed-height track. A ring drawn outside a
 * box that fills its container has nowhere to go, so it came back sheared off
 * along whichever edge it met. Drawn inside, it is always whole.
 *
 * Worn by the BOX since #140, not by the button inside it. The header now
 * holds two targets — the name, which explains what kind of row or column
 * this is, and everything else, which opens the panel — so the wash and the
 * selected ring belong to the block they share rather than to one of them.
 * `data-open` replaces `aria-pressed` for the same reason: the state is the
 * header's, and `aria-pressed` stays on the button that actually toggles.
 */
export const CANVAS_HEADER_STATE = [
  'relative transition-colors duration-(--motion-micro)',
  'hover:bg-foreground/5',
  // Neutral, not the brand colour. A header is chrome — it names an axis; it
  // is not one of the coloured objects on the board. Borrowing the CELL's
  // teal selection ring put the loudest hue in the app on the quietest thing
  // in it, and two selected headers read as more important than the cells
  // they label. Ink at 30% says "this one" without competing.
  'data-open:bg-foreground/[0.07] data-open:ring-2 data-open:ring-inset',
  'data-open:ring-foreground/30',
  'has-[button:focus-visible]:ring-2 has-[button:focus-visible]:ring-inset',
  'has-[button:focus-visible]:ring-ring/50',
].join(' ')

/**
 * The ⓘ: always visible, because it is the mark of a control.
 *
 * It was transparent until the header was hovered, which meant that on touch —
 * where nothing is ever hovered — the one signal that a header opens anything
 * was never drawn. #140 Q11: ⓘ means "opens the panel" everywhere, and an
 * affordance a touch reader cannot see is not an affordance.
 */
export const CANVAS_HEADER_HINT = [
  'size-3.5 shrink-0 text-muted-foreground/60',
  'transition-colors duration-(--motion-micro)',
].join(' ')

/**
 * The header's name: the word, and what that kind of thing IS.
 *
 * Focusable on its own, separately from the box around it — the definition is
 * a fact about the word, so the word is where it hangs
 * (docs/reference/panel-affordances.md).
 *
 * Not CUED, since #243. The dotted rule and the `cursor-help` that used to sit
 * here announced that the word carries a definition; nothing announces it now.
 * The focus ring is not that announcement — it is how a keyboard reader gets
 * to the definition at all.
 */
export const CANVAS_HEADER_NAME = [
  'relative z-10 w-fit rounded-sm outline-none',
  'focus-visible:ring-2 focus-visible:ring-ring/50',
].join(' ')

/** The invisible full-block target that opens the panel. */
export const CANVAS_HEADER_OPENER =
  'absolute inset-0 rounded-md outline-none'

/**
 * The horizontal inset of one column of the board — the lane label and the
 * cell slot beside it, one value.
 *
 * The rail carried `pl-5 pr-3` while the slot carried `px-3.5`, so the label
 * started 6px further in than the cells it names and stopped 2px short of
 * them on the other edge. Nothing enforced the relationship; the two numbers
 * were set in separate files and drifted. Reading them from here is what
 * makes the rail sit on the grid's rhythm rather than near it.
 */
export const BLUEPRINT_SLOT_INSET = 'px-3.5'

/** The same inset at compact density. */
export const BLUEPRINT_SLOT_INSET_COMPACT = 'px-3'

/**
 * The left half of the same inset, for a row that only has a left edge to
 * honour — the divider caption, which runs off toward the board and lets its
 * rule cross the outline rather than stopping at it.
 *
 * It was `pl-5`, so the "LINE OF …" captions started 6px left of the lane
 * labels stacked directly above them and the column read as two columns.
 */
export const BLUEPRINT_SLOT_INSET_LEFT = 'pl-3.5'
