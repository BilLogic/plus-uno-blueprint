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
 */
export const CANVAS_HEADER_STATE = [
  'transition-colors duration-(--motion-micro)',
  'hover:bg-foreground/5',
  // Neutral, not the brand colour. A header is chrome — it names an axis; it
  // is not one of the coloured objects on the board. Borrowing the CELL's
  // teal selection ring put the loudest hue in the app on the quietest thing
  // in it, and two selected headers read as more important than the cells
  // they label. Ink at 30% says "this one" without competing.
  'aria-pressed:bg-foreground/[0.07] aria-pressed:ring-2 aria-pressed:ring-inset',
  'aria-pressed:ring-foreground/30',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50',
].join(' ')

/** The ⓘ: transparent at rest, full ink once the header is live or open. */
export const CANVAS_HEADER_HINT = [
  'size-3.5 shrink-0 text-muted-foreground/50 opacity-0',
  'transition-opacity duration-(--motion-micro)',
].join(' ')
