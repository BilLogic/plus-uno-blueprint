// Where the phone's cell sheet comes to rest.
//
// Its own file rather than a pair of exports from `panelShell.tsx`, for the
// reason `panelText.ts` and `panelTerms.ts` have theirs: a component module
// that also exports values breaks fast refresh, and `react-refresh` allows a
// literal but not an array.
/**
 * Where the phone's cell sheet comes to rest. Three points, because the sheet
 * has three jobs and one height served none of them: it opened at one height
 * and was dragged from there, so reading a long cell was always a drag and
 * glancing at a short one always wasted the screen (#133).
 *
 * - **peek** — the identity block and the first field. Enough to answer "which
 *   cell did I hit?" without giving up the board behind it, which is the whole
 *   reason a reader taps a cell on a canvas rather than opening a page.
 * - **half** — the reading posture, and the default.
 * - **full** — a long cell, read without fighting the drag.
 *
 * Peek is a LENGTH, not a fraction: it has to clear the identity block, whose
 * height is set by type and padding rather than by the phone. The other two are
 * fractions of the viewport, because "half the screen" is what they mean.
 *
 * A number in (0,1] is a fraction of viewport height and a string is a CSS
 * length — Base UI's `Drawer` contract, not ours.
 */
export const CELL_SHEET_SNAP_POINTS: (number | string)[] = ['12rem', 0.55, 1]

/**
 * HALF, not peek and not full.
 *
 * Peek would make every read start with a drag, which is the complaint. Full
 * would bury the board on every tap and make the sheet feel like navigation
 * rather than inspection. The middle point is the only one that costs at most
 * one drag in either direction.
 */
export const CELL_SHEET_DEFAULT_SNAP = CELL_SHEET_SNAP_POINTS[1]
