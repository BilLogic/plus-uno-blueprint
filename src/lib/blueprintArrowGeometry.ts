import {
  BLUEPRINT_DISCOVERY_RAIL_CORRIDOR_MARGIN,
  BLUEPRINT_WRAP_CORRIDOR_MARGIN,
  isRegularTutorInLaneLoopDependency,
  OVERHEAD_RAIL_REGULAR_TUTOR_CELL_PATTERN,
  STEP_COLUMN_GAP,
} from '@/lib/blueprintLayout'
import { resolveBlueprintCellId } from '@/lib/resolveBlueprintCellId'
import {
  isParallelSessionLeadBottomWrapDependency,
  isParallelSessionOverheadWrapDependency,
} from '@/data/parallelSessionPartnerLead'

export type Point = { x: number; y: number }

export type LayoutBox = {
  left: number
  right: number
  top: number
  height: number
}

export type CellAnchor = {
  source: Point
  target: Point
}

/** Regular Tutor step 8 → step 1 loop (stable IDs). */
export const REGULAR_TUTOR_LOOP_SOURCE_ID =
  'a0000000-0000-4000-8000-000000040903'
export const REGULAR_TUTOR_LOOP_TARGET_ID =
  'a0000000-0000-4000-8000-000000040103'

/** Arrowhead size (userSpaceOnUse) — Lucide-style filled tip. */
export const ARROW_CHEVRON_SIZE = 16
/** Half-height of the chevron base — keeps the UI-improvement 0.375 width ratio at the larger size. */
export const ARROW_CHEVRON_HALF_WIDTH = 6
export const ARROW_STROKE_WIDTH = 3
/** refX/refY: chevron base attaches to path end; tip extends toward target. */
export const ARROW_MARKER_REF_X = 0
export const ARROW_MARKER_REF_Y = ARROW_CHEVRON_SIZE / 2

/** Rounded bend radius for orthogonal loop arrows. */
export const ARROW_CORNER_RADIUS = 6
/** Inset around chevron marker graphic so round caps are not clipped. */
export const ARROW_MARKER_PAD = Math.ceil(ARROW_STROKE_WIDTH / 2 + 1)
/** Bleed room around the grid overlay so strokes, chevrons, and bends are not clipped. */
export const ARROW_VIEWPORT_PAD = Math.ceil(
  ARROW_STROKE_WIDTH / 2 + ARROW_CHEVRON_SIZE + ARROW_CORNER_RADIUS / 2,
)

/** Minimum clearance when detouring around obstructing cells. */
export const ARROW_DETOUR_CLEARANCE = 8

/** Target shorter than this fraction of source height → align to target center. */
export const ARROW_TARGET_MUCH_SMALLER_RATIO = 0.65

function isCrossLayerForwardDependency(
  sourceEl: HTMLElement,
  targetEl: HTMLElement,
): boolean {
  const sourceStep = parseStepIndex(sourceEl)
  const targetStep = parseStepIndex(targetEl)
  if (sourceStep === null || targetStep === null) return false
  if (targetStep <= sourceStep) return false

  const sourceRow = getLayerRow(sourceEl)
  const targetRow = getLayerRow(targetEl)
  return Boolean(sourceRow && targetRow && sourceRow !== targetRow)
}

/**
 * Forward cross-column connector between different lane rows: exit the source
 * horizontally, travel in the column gap, then rise or drop into the target.
 */
export function buildCrossLayerForwardArrowPath(
  sourceEl: HTMLElement,
  targetEl: HTMLElement,
  root: HTMLElement,
): string {
  const sourceBox = getCellContentBox(sourceEl, root)
  const targetBox = getCellContentBox(targetEl, root)
  const sourceY = sourceBox.top + sourceBox.height / 2
  const targetY = targetBox.top + targetBox.height / 2
  const lineEndX = targetBox.left - ARROW_CHEVRON_SIZE

  const sourceStep = parseStepIndex(sourceEl)
  const routeX =
    getPreTargetGapCenterX(root, sourceEl, targetEl) ??
    (sourceStep !== null ? getStepGapCenterX(root, sourceStep) : null) ??
    (sourceBox.right + targetBox.left) / 2

  if (lineEndX <= sourceBox.right) return ''

  return buildRoundedPolylinePath(
    [
      { x: sourceBox.right, y: sourceY },
      { x: routeX, y: sourceY },
      { x: routeX, y: targetY },
      { x: lineEndX, y: targetY },
    ],
    ARROW_CORNER_RADIUS,
  )
}

function getLayerRow(el: HTMLElement): HTMLElement | null {
  return el.closest('[data-blueprint-row]')
}

/** Center X of the column gap after step column `gapIndex`. */
export function getStepGapCenterX(
  root: HTMLElement,
  gapIndex: number,
): number | null {
  const gapEl = root.querySelector<HTMLElement>(
    `[data-step-gap="${gapIndex}"]`,
  )
  if (!gapEl) return null

  const box = getElementLayoutBox(gapEl, root)
  return (box.left + box.right) / 2
}

/** Gutter to the left of a step column. */
export function getVerticalRouteGutterX(
  root: HTMLElement,
  stepIndex: number,
  sourceEl: HTMLElement,
): number {
  if (stepIndex > 0) {
    const leftGap = getStepGapCenterX(root, stepIndex - 1)
    if (leftGap !== null) return leftGap
  }

  const sourceBox = getCellContentBox(sourceEl, root)
  return sourceBox.left - STEP_COLUMN_GAP / 2
}

/** Gutter to the right of a step column. */
export function getVerticalRouteRightGutterX(
  root: HTMLElement,
  stepIndex: number,
  sourceEl: HTMLElement,
): number {
  const rightGap = getStepGapCenterX(root, stepIndex)
  if (rightGap !== null) return rightGap

  const sourceBox = getCellContentBox(sourceEl, root)
  return sourceBox.right + STEP_COLUMN_GAP / 2
}

/** Center of the column gap immediately before the target step. */
export function getPreTargetGapCenterX(
  root: HTMLElement,
  sourceEl: HTMLElement,
  targetEl: HTMLElement,
): number | null {
  const targetIdx = parseStepIndex(targetEl)
  if (targetIdx === null || targetIdx <= 0) return null

  const layerRow = getLayerRow(sourceEl)
  if (!layerRow) return null

  const leftEl = layerRow.querySelector<HTMLElement>(
    `[data-blueprint-cell][data-step-index="${targetIdx - 1}"]`,
  )

  if (leftEl) {
    const leftBox = getCellContentBox(leftEl, root)
    const targetBox = getCellContentBox(targetEl, root)
    return (leftBox.right + targetBox.left) / 2
  }

  const targetBox = getCellContentBox(targetEl, root)
  return targetBox.left - STEP_COLUMN_GAP / 2
}

/** Cells in the same step column strictly between source and target vertically. */
export function getSameColumnObstructingCells(
  sourceEl: HTMLElement,
  targetEl: HTMLElement,
  root: HTMLElement,
): HTMLElement[] {
  const stepIndex = parseStepIndex(sourceEl)
  if (stepIndex === null || parseStepIndex(targetEl) !== stepIndex) {
    return []
  }

  const sourceBox = getCellContentBox(sourceEl, root)
  const targetBox = getCellContentBox(targetEl, root)
  const targetAbove =
    targetBox.top + targetBox.height / 2 <
    sourceBox.top + sourceBox.height / 2
  const gapTop = targetAbove
    ? targetBox.top + targetBox.height
    : sourceBox.top + sourceBox.height
  const gapBottom = targetAbove ? sourceBox.top : targetBox.top

  if (gapBottom <= gapTop) return []

  const columnLeft = Math.min(sourceBox.left, targetBox.left)
  const columnRight = Math.max(sourceBox.right, targetBox.right)

  const obstructing: HTMLElement[] = []
  for (const el of queryBlueprintCells(root, root)) {
    if (el === sourceEl || el === targetEl) continue
    if (parseStepIndex(el) !== stepIndex) continue

    const box = getCellContentBox(el, root)
    if (box.right <= columnLeft || box.left >= columnRight) continue
    if (box.top >= gapBottom || box.top + box.height <= gapTop) continue

    obstructing.push(el)
  }

  return obstructing
}

/**
 * Cells whose card overlaps a rectangle, ignoring the arrow's own endpoints.
 *
 * The step-index-keyed helpers above answer "what sits between these two
 * cells"; this one answers "is this stretch of the canvas actually empty",
 * which is what a route needs before it commits to travelling through a
 * column. The merged compare canvas made the distinction matter: a slot
 * stacks one sub-cell per path, so the space below a cell inside its own
 * column is no longer reliably free.
 */
export function getCellsOverlappingRect(
  root: HTMLElement,
  rect: { left: number; right: number; top: number; bottom: number },
  exclude: readonly HTMLElement[],
): HTMLElement[] {
  if (rect.bottom <= rect.top || rect.right <= rect.left) return []

  const overlapping: HTMLElement[] = []
  for (const el of queryBlueprintCells(root, root)) {
    if (
      exclude.some(
        (other) => other === el || other.contains(el) || el.contains(other),
      )
    ) {
      continue
    }

    const box = getCellContentBox(el, root)
    if (box.right <= rect.left || box.left >= rect.right) continue
    if (box.top >= rect.bottom || box.top + box.height <= rect.top) continue

    overlapping.push(el)
  }

  return overlapping
}

/** Cells in the same lane row whose columns sit strictly between source and target. */
export function getSameRowObstructingCells(
  sourceEl: HTMLElement,
  targetEl: HTMLElement,
): HTMLElement[] {
  const sourceIdx = parseStepIndex(sourceEl)
  const targetIdx = parseStepIndex(targetEl)
  if (sourceIdx === null || targetIdx === null) return []

  const lo = Math.min(sourceIdx, targetIdx) + 1
  const hi = Math.max(sourceIdx, targetIdx) - 1
  if (lo > hi) return []

  const layerRow = getLayerRow(sourceEl)
  if (!layerRow) return []

  const obstructing: HTMLElement[] = []
  layerRow.querySelectorAll<HTMLElement>('[data-blueprint-cell]').forEach((el) => {
    const idx = parseStepIndex(el)
    if (idx === null || idx < lo || idx > hi) return
    obstructing.push(el)
  })

  return obstructing
}

/**
 * Anchors for same-column gutter detours: exit at the source's top/bottom
 * center, but enter horizontally at the target's left edge, vertically
 * centered on the target's own card. The detour's final segment approaches
 * from the gutter side, so a top/bottom-center (vertical-entry) anchor would
 * leave the chevron riding along the target's top edge — for stacked pill
 * targets that puts the head in the gap between neighbouring pills.
 */
export function getVerticalGutterDetourAnchors(
  sourceEl: HTMLElement,
  targetEl: HTMLElement,
  root: HTMLElement,
): CellAnchor {
  const { source } = getVerticalCellAnchors(sourceEl, targetEl, root)
  const targetBox = getCellContentBox(targetEl, root)

  return {
    source,
    target: {
      // Inset so the chevron tip sits on the target's left edge, not through it.
      x: targetBox.left - ARROW_CHEVRON_SIZE,
      y: targetBox.top + targetBox.height / 2,
    },
  }
}

/** Which column gutter a same-column connector brackets through. */
export type SameColumnSide = 'left' | 'right'

export type SameColumnSideRoute = {
  side: SameColumnSide
  gutterX: number
}

/**
 * Is the whole bracket — both side stubs and the gutter run between them —
 * clear of every other card? Each leg is tested as a band `ARROW_DETOUR_CLEARANCE`
 * either side of the drawn line, so a route that merely grazes a card is
 * rejected too.
 */
function isSameColumnSideRouteClear(
  root: HTMLElement,
  side: SameColumnSide,
  gutterX: number,
  legs: readonly { box: LayoutBox; y: number }[],
  exclude: readonly HTMLElement[],
): boolean {
  for (const leg of legs) {
    const stubRect =
      side === 'left'
        ? { left: gutterX, right: leg.box.left }
        : { left: leg.box.right, right: gutterX }
    if (
      getCellsOverlappingRect(
        root,
        {
          ...stubRect,
          top: leg.y - ARROW_DETOUR_CLEARANCE,
          bottom: leg.y + ARROW_DETOUR_CLEARANCE,
        },
        exclude,
      ).length > 0
    ) {
      return false
    }
  }

  const ys = legs.map((leg) => leg.y)
  return (
    getCellsOverlappingRect(
      root,
      {
        left: gutterX - ARROW_DETOUR_CLEARANCE,
        right: gutterX + ARROW_DETOUR_CLEARANCE,
        top: Math.min(...ys) - ARROW_DETOUR_CLEARANCE,
        bottom: Math.max(...ys) + ARROW_DETOUR_CLEARANCE,
      },
      exclude,
    ).length === 0
  )
}

const SAME_COLUMN_SIDE_TIE_BREAK: Record<SameColumnSide, number> = {
  left: 0,
  right: 1,
}

type RememberedSideRoute = {
  side: SameColumnSide
  cellAEl: HTMLElement
  cellBEl: HTMLElement
}

/**
 * The side each connected pair settled on, so a pair that already has one keeps
 * it. See `resolveSameColumnSideRoute` for why.
 */
const rememberedSideRoutes = new Map<string, RememberedSideRoute>()

/** Order-independent key for a pair of cells. */
function getSameColumnPairKey(
  cellAEl: HTMLElement,
  cellBEl: HTMLElement,
): string | null {
  const idA = cellAEl.getAttribute('data-blueprint-cell')
  const idB = cellBEl.getAttribute('data-blueprint-cell')
  if (!idA || !idB) return null
  return idA <= idB ? `${idA}->${idB}` : `${idB}->${idA}`
}

/**
 * Forget pairs whose cells have left the DOM — a collapsed lane, a switched
 * scenario, a re-rendered board. Without this the memory would both pin a stale
 * side onto a cell id that came back in a different place and hold detached
 * nodes alive.
 */
function pruneRememberedSideRoutes(): void {
  for (const [key, entry] of rememberedSideRoutes) {
    if (!entry.cellAEl.isConnected || !entry.cellBEl.isConnected) {
      rememberedSideRoutes.delete(key)
    }
  }
}

/** Drop every remembered side — for tests and hard board resets. */
export function clearRememberedSameColumnSideRoutes(): void {
  rememberedSideRoutes.clear()
}

/**
 * The gutter a pair of same-column cells can be bracketed through, or null when
 * neither side is usable. Both gutters are considered; the nearer one wins so
 * the detour stays short, and left breaks a tie.
 *
 * Deliberately symmetric in its two cells — every input is a min/max over the
 * pair, never "the source's" anything — so a pair resolves to the same side
 * whichever end is the source, and the shape is stable across renders.
 *
 * The choice is also *sticky*. Clearance is a step function over every
 * neighbour's box: a card sliding a pixel across the clearance band flips the
 * preference, and this runs from a ResizeObserver, so a fold toggle or a font
 * settle would swing the connector from one gutter to the other and back
 * mid-relayout. So a pair that already has a side keeps it for as long as that
 * side is still clear, and the "which is nearer" preference is only ever
 * consulted for a pair that has no side yet. Hysteresis, not debouncing: the
 * arrow still moves the instant its gutter is genuinely blocked.
 */
export function resolveSameColumnSideRoute(
  cellAEl: HTMLElement,
  cellBEl: HTMLElement,
  root: HTMLElement,
): SameColumnSideRoute | null {
  const boxA = getCellContentBox(cellAEl, root)
  const boxB = getCellContentBox(cellBEl, root)
  const stepA = parseStepIndex(cellAEl)
  const stepB = parseStepIndex(cellBEl)
  const stepIndex =
    stepA !== null && stepB !== null
      ? Math.min(stepA, stepB)
      : (stepA ?? stepB ?? 0)
  const legs = [
    { box: boxA, y: boxA.top + boxA.height / 2 },
    { box: boxB, y: boxB.top + boxB.height / 2 },
  ]
  const exclude = [cellAEl, cellBEl]

  const cardLeft = Math.min(boxA.left, boxB.left)
  const cardRight = Math.max(boxA.right, boxB.right)
  const leftmostEl = boxA.left <= boxB.left ? cellAEl : cellBEl
  const rightmostEl = boxA.right >= boxB.right ? cellAEl : cellBEl

  const candidates: (SameColumnSideRoute & { reach: number })[] = []

  const leftGutterX = getVerticalRouteGutterX(root, stepIndex, leftmostEl)
  if (leftGutterX < cardLeft - ARROW_CHEVRON_SIZE) {
    candidates.push({
      side: 'left',
      gutterX: leftGutterX,
      reach: cardLeft - leftGutterX,
    })
  }

  const rightGutterX = getVerticalRouteRightGutterX(
    root,
    stepIndex,
    rightmostEl,
  )
  if (rightGutterX > cardRight + ARROW_CHEVRON_SIZE) {
    candidates.push({
      side: 'right',
      gutterX: rightGutterX,
      reach: rightGutterX - cardRight,
    })
  }

  candidates.sort(
    (a, b) =>
      a.reach - b.reach ||
      SAME_COLUMN_SIDE_TIE_BREAK[a.side] - SAME_COLUMN_SIDE_TIE_BREAK[b.side],
  )

  const isClear = (candidate: SameColumnSideRoute) =>
    isSameColumnSideRouteClear(
      root,
      candidate.side,
      candidate.gutterX,
      legs,
      exclude,
    )

  const pairKey = getSameColumnPairKey(cellAEl, cellBEl)
  const remembered = pairKey
    ? rememberedSideRoutes.get(pairKey)?.side
    : undefined

  if (remembered !== undefined) {
    const held = candidates.find(
      (candidate) => candidate.side === remembered,
    )
    if (held && isClear(held)) {
      return { side: held.side, gutterX: held.gutterX }
    }
  }

  for (const candidate of candidates) {
    if (isClear(candidate)) {
      if (pairKey) {
        rememberedSideRoutes.set(pairKey, {
          side: candidate.side,
          cellAEl,
          cellBEl,
        })
      }
      return { side: candidate.side, gutterX: candidate.gutterX }
    }
  }

  return null
}

/** The x a side route's stub meets a card on, chevron-inset for arrival ends. */
function getSameColumnSideStubX(
  box: LayoutBox,
  side: SameColumnSide,
  arrival: boolean,
): number {
  const inset = arrival ? ARROW_CHEVRON_SIZE : 0
  return side === 'left' ? box.left - inset : box.right + inset
}

/**
 * The bracket itself: out of one card's left (or right) edge, along the column
 * gutter, into the other card's matching edge. `fromIsArrival` is the only
 * difference between the one-way and double-headed forms — an arriving end is
 * chevron-inset off the card, a departing end sits on it.
 */
function buildSameColumnBracketPath(
  fromEl: HTMLElement,
  toEl: HTMLElement,
  root: HTMLElement,
  fromIsArrival: boolean,
  route: SameColumnSideRoute | null,
): string {
  if (!route) return ''

  const fromBox = getCellContentBox(fromEl, root)
  const toBox = getCellContentBox(toEl, root)
  const fromY = fromBox.top + fromBox.height / 2
  const toY = toBox.top + toBox.height / 2

  return buildRoundedPolylinePath(
    [
      {
        x: getSameColumnSideStubX(fromBox, route.side, fromIsArrival),
        y: fromY,
      },
      { x: route.gutterX, y: fromY },
      { x: route.gutterX, y: toY },
      { x: getSameColumnSideStubX(toBox, route.side, true), y: toY },
    ],
    ARROW_CORNER_RADIUS,
  )
}

/**
 * Two cells in one column, connected side-on through whichever column gutter
 * has room. Nothing between the two cards is crossed, and both ends read as
 * arrivals because each head sits on a card edge.
 *
 * Returns '' when neither gutter is clear (an edge column of a one-column
 * board, or a gutter another card leans into): no arrow at all beats one
 * drawn through a cell's text.
 *
 * `route` is optional so a caller that has already resolved the pair's side can
 * hand it down instead of paying for the clearance sweeps twice.
 */
export function buildSameColumnGutterDetourPath(
  upperEl: HTMLElement,
  lowerEl: HTMLElement,
  root: HTMLElement,
  route: SameColumnSideRoute | null = resolveSameColumnSideRoute(
    upperEl,
    lowerEl,
    root,
  ),
): string {
  return buildSameColumnBracketPath(upperEl, lowerEl, root, true, route)
}

/**
 * One-way version of the same bracket: a short stub out of the *side* of the
 * source card, down (or up) the adjacent gutter, and into the matching side of
 * the target. Preferred over the top/bottom gutter detour for same-column
 * connectors, which had to leave through a cell edge that another card was
 * often sitting against and so swung far out into the gutter to get around it.
 *
 * Returns '' when no side is clear, so callers can fall back.
 */
export function buildSameColumnSideAttachedPath(
  sourceEl: HTMLElement,
  targetEl: HTMLElement,
  root: HTMLElement,
  route: SameColumnSideRoute | null = resolveSameColumnSideRoute(
    sourceEl,
    targetEl,
    root,
  ),
): string {
  return buildSameColumnBracketPath(sourceEl, targetEl, root, false, route)
}

/**
 * Same-column connector routed through the left column gutter; exits at the
 * source's top/bottom center and enters the target's left edge.
 */
export function buildVerticalGutterDetourPath(
  source: Point,
  target: Point,
  gutterX: number,
): string {
  if (gutterX >= Math.min(source.x, target.x)) return ''

  return buildRoundedPolylinePath(
    [
      source,
      { x: gutterX, y: source.y },
      { x: gutterX, y: target.y },
      target,
    ],
    ARROW_CORNER_RADIUS,
  )
}

/** Horizontal connector detours above skipped cells via column gutters. */
export function buildHorizontalGutterDetourPath(
  sourceEl: HTMLElement,
  targetEl: HTMLElement,
  root: HTMLElement,
): string {
  const sourceBox = getCellContentBox(sourceEl, root)
  const targetBox = getCellContentBox(targetEl, root)
  const routeY = getArrowCenterY(sourceEl, targetEl, root)
  const entryX = targetBox.left - ARROW_CHEVRON_SIZE
  const sourceStep = parseStepIndex(sourceEl)
  if (sourceStep === null) return ''

  const obstructing = getSameRowObstructingCells(sourceEl, targetEl)
  let detourY = routeY
  for (const el of obstructing) {
    const box = getCellContentBox(el, root)
    detourY = Math.min(detourY, box.top - ARROW_DETOUR_CLEARANCE)
  }

  const exitGapX =
    getStepGapCenterX(root, sourceStep) ??
    sourceBox.right + STEP_COLUMN_GAP / 2
  const riseX =
    getPreTargetGapCenterX(root, sourceEl, targetEl) ??
    entryX - Math.max(28, ARROW_CORNER_RADIUS * 2.5)

  return buildRoundedPolylinePath(
    [
      { x: sourceBox.right, y: routeY },
      { x: exitGapX, y: routeY },
      { x: exitGapX, y: detourY },
      { x: riseX, y: detourY },
      { x: riseX, y: routeY },
      { x: entryX, y: routeY },
    ],
    ARROW_CORNER_RADIUS,
  )
}

export function parseStepIndex(cellEl: HTMLElement): number | null {
  const raw = cellEl.dataset.stepIndex
  if (raw === undefined) return null
  const index = Number.parseInt(raw, 10)
  return Number.isFinite(index) ? index : null
}

export function isWrapDependency(
  sourceEl: HTMLElement,
  targetEl: HTMLElement,
  sourceCellId?: string,
  targetCellId?: string,
): boolean {
  if (
    sourceCellId === REGULAR_TUTOR_LOOP_SOURCE_ID &&
    targetCellId === REGULAR_TUTOR_LOOP_TARGET_ID
  ) {
    return true
  }

  const sourceStep = parseStepIndex(sourceEl)
  const targetStep = parseStepIndex(targetEl)
  return (
    sourceStep !== null &&
    targetStep !== null &&
    targetStep < sourceStep
  )
}

type RootMetrics = {
  left: number
  top: number
  scaleX: number
  scaleY: number
}

type MeasurementPass = {
  root: HTMLElement | null
  rootMetrics: RootMetrics | null
  elementBoxes: Map<HTMLElement, LayoutBox>
  contentBoxes: Map<HTMLElement, LayoutBox>
  cellsByScope: Map<Element, HTMLElement[]>
}

let activeMeasurementPass: MeasurementPass | null = null

/**
 * One overlay update resolves every arrow on the band, and the routers overlap
 * heavily in what they measure: a route-clearance test alone sweeps every card
 * on the board three times per candidate gutter, and each sweep used to call
 * `getBoundingClientRect` per anchor plus once for the root. Every one of those
 * is a forced reflow.
 *
 * Wrapping an update in a pass makes each element measured exactly once for the
 * duration. Safe because a pass only ever reads layout — nothing inside mutates
 * the DOM, so no cached box can go stale mid-pass. Passes nest (the two arrow
 * lanes each run their own) and a pass that sees a different root than the one
 * it started on drops its caches rather than mixing two coordinate spaces.
 */
export function runArrowMeasurementPass<T>(run: () => T): T {
  const previous = activeMeasurementPass
  activeMeasurementPass = {
    root: null,
    rootMetrics: null,
    elementBoxes: new Map(),
    contentBoxes: new Map(),
    cellsByScope: new Map(),
  }
  pruneRememberedSideRoutes()
  try {
    return run()
  } finally {
    activeMeasurementPass = previous
  }
}

/** The active pass, with its caches reset if the root coordinate space changed. */
function getMeasurementPass(root: HTMLElement): MeasurementPass | null {
  const pass = activeMeasurementPass
  if (!pass) return null
  if (pass.root !== root) {
    pass.root = root
    pass.rootMetrics = null
    pass.elementBoxes.clear()
    pass.contentBoxes.clear()
    pass.cellsByScope.clear()
  }
  return pass
}

function measureRoot(root: HTMLElement): RootMetrics {
  const rootRect = root.getBoundingClientRect()
  return {
    left: rootRect.left,
    top: rootRect.top,
    scaleX: root.offsetWidth > 0 ? rootRect.width / root.offsetWidth : 1,
    scaleY: root.offsetHeight > 0 ? rootRect.height / root.offsetHeight : 1,
  }
}

/** Cell elements under a scope (the root, or one lane row), once per pass. */
function queryBlueprintCells(
  scope: Element,
  root: HTMLElement,
): readonly HTMLElement[] {
  const pass = getMeasurementPass(root)
  const cached = pass?.cellsByScope.get(scope)
  if (cached) return cached

  const cells = Array.from(
    scope.querySelectorAll<HTMLElement>('[data-blueprint-cell]'),
  )
  pass?.cellsByScope.set(scope, cells)
  return cells
}

/** Layout box relative to the grid root (viewport-corrected for canvas zoom). */
export function getElementLayoutBox(
  el: HTMLElement,
  root: HTMLElement,
): LayoutBox {
  const pass = getMeasurementPass(root)
  const cached = pass?.elementBoxes.get(el)
  if (cached) return cached

  const elRect = el.getBoundingClientRect()
  const rootMetrics =
    pass?.rootMetrics ?? measureRoot(root)
  if (pass) pass.rootMetrics = rootMetrics

  const box = {
    left: (elRect.left - rootMetrics.left) / rootMetrics.scaleX,
    right: (elRect.right - rootMetrics.left) / rootMetrics.scaleX,
    top: (elRect.top - rootMetrics.top) / rootMetrics.scaleY,
    height: elRect.height / rootMetrics.scaleY,
  }
  pass?.elementBoxes.set(el, box)
  return box
}

/** Inner content box — union of visible cell card edges in the lane. */
export function getCellContentBox(
  cellEl: HTMLElement,
  root: HTMLElement,
): LayoutBox {
  const pass = getMeasurementPass(root)
  const cached = pass?.contentBoxes.get(cellEl)
  if (cached) return cached

  const box = measureCellContentBox(cellEl, root)
  pass?.contentBoxes.set(cellEl, box)
  return box
}

function measureCellContentBox(
  cellEl: HTMLElement,
  root: HTMLElement,
): LayoutBox {
  const anchors = cellEl.querySelectorAll<HTMLElement>(
    '[data-blueprint-cell-anchor]',
  )
  if (anchors.length === 0) {
    return getElementLayoutBox(cellEl, root)
  }
  if (anchors.length === 1) {
    return getElementLayoutBox(anchors[0]!, root)
  }

  let left = Infinity
  let right = -Infinity
  let top = Infinity
  let bottom = -Infinity

  for (const anchor of anchors) {
    const box = getElementLayoutBox(anchor, root)
    left = Math.min(left, box.left)
    right = Math.max(right, box.right)
    top = Math.min(top, box.top)
    bottom = Math.max(bottom, box.top + box.height)
  }

  return { left, right, top, height: bottom - top }
}

/** Inset from the interaction line for loop-back horizontal segments. */
export const WRAP_LOOP_CORRIDOR_INSET = 10

/** Inset above cell tops for Regular Tutor loop-back horizontal segments. */
export const REGULAR_TUTOR_LOOP_TOP_INSET = 8

/** Backward loop on the Regular Tutor row (e.g. Set Goals step 11 → step 1). */
export function isRegularTutorInLaneWrapDependency(
  sourceEl: HTMLElement,
  targetEl: HTMLElement,
  sourceCellId?: string,
  targetCellId?: string,
): boolean {
  if (
    sourceCellId &&
    targetCellId &&
    isParallelSessionLeadBottomWrapDependency(sourceCellId, targetCellId)
  ) {
    return false
  }
  if (
    sourceCellId &&
    targetCellId &&
    isParallelSessionOverheadWrapDependency(sourceCellId, targetCellId)
  ) {
    return false
  }

  const sourceStep = parseStepIndex(sourceEl)
  const targetStep = parseStepIndex(targetEl)
  if (sourceStep === null || targetStep === null || targetStep >= sourceStep) {
    return false
  }

  const sourceRow = getLayerRow(sourceEl)
  const targetRow = getLayerRow(targetEl)
  if (!sourceRow || !targetRow || sourceRow !== targetRow) return false

  if (sourceCellId && targetCellId) {
    return isRegularTutorInLaneLoopDependency(
      resolveArrowLogicCellId(sourceCellId),
      resolveArrowLogicCellId(targetCellId),
    )
  }

  return false
}

/** Horizontal lane for Regular Tutor loop arrows — centered in the in-lane corridor. */
export function getRegularTutorInLaneLoopRouteY(
  sourceEl: HTMLElement,
  targetEl: HTMLElement,
  root: HTMLElement,
): number {
  const row = getLayerRow(sourceEl)
  if (row) {
    const loopCorridor = row.querySelector<HTMLElement>(
      '[data-blueprint-loop-corridor="above"]',
    )
    if (loopCorridor) {
      const corridorBox = getElementLayoutBox(loopCorridor, root)
      return corridorBox.top + corridorBox.height / 2
    }
  }

  const cellTop = Math.min(
    getLaneContentTop(sourceEl, root),
    getLaneContentTop(targetEl, root),
  )
  return cellTop - REGULAR_TUTOR_LOOP_TOP_INSET
}

/**
 * Regular Tutor loop-back: up from source top, across inside the swimlane,
 * then down into the target top (e.g. Set Goals step 11 → step 1).
 */
export function buildRegularTutorInLaneTopWrapPath(
  sourceEl: HTMLElement,
  targetEl: HTMLElement,
  root: HTMLElement,
): string {
  const source = getCellTopCenter(sourceEl, root)
  const target = getCellTopCenter(targetEl, root)
  const routeY = getRegularTutorInLaneLoopRouteY(sourceEl, targetEl, root)

  // Wrap runs right → left; target must sit in an earlier column.
  if (target.x >= source.x) return ''

  if (routeY >= source.y) return ''

  const lineEndY = target.y - ARROW_CHEVRON_SIZE
  if (lineEndY <= routeY) return ''

  const exitLeg = buildWrapColumnLeg(sourceEl, root, routeY, 'exit', 'above')
  const enterLeg = buildWrapColumnLeg(targetEl, root, routeY, 'enter', 'above')
  if (!exitLeg || !enterLeg) return ''

  return buildRoundedPolylinePath(
    [...exitLeg, ...enterLeg],
    ARROW_CORNER_RADIUS,
  )
}


export type WrapCorridorBounds = {
  start: number
  end: number
}

/** Bottom edge of the lowest cell card in a lane row (the source's own if alone). */
function getLaneContentBottom(
  row: Element | null,
  root: HTMLElement,
  sourceEl: HTMLElement,
  sourceBox: LayoutBox,
): number {
  let bottom = sourceBox.top + sourceBox.height
  if (!row) return bottom
  for (const el of queryBlueprintCells(row, root)) {
    if (el === sourceEl || el.contains(sourceEl) || sourceEl.contains(el)) {
      continue
    }
    const box = getCellContentBox(el, root)
    bottom = Math.max(bottom, box.top + box.height)
  }
  return bottom
}

/**
 * Top edge of the highest cell card in a cell's lane row — the mirror of
 * `getLaneContentBottom`, for the rails that run ABOVE a lane. A stacked slot
 * makes a lower sub-cell's own top useless as a rail reference: the rail has
 * to clear the sub-cells above it too.
 */
function getLaneContentTop(cellEl: HTMLElement, root: HTMLElement): number {
  const box = getCellContentBox(cellEl, root)
  const row = getLayerRow(cellEl)
  let top = box.top
  if (!row) return top
  for (const el of queryBlueprintCells(row, root)) {
    if (el === cellEl || el.contains(cellEl) || cellEl.contains(el)) continue
    top = Math.min(top, getCellContentBox(el, root).top)
  }
  return top
}

/** Vertical span between a lane row bottom and the next wrap corridor or interaction line. */
export function getWrapCorridorBounds(
  sourceEl: HTMLElement,
  root: HTMLElement,
): WrapCorridorBounds | null {
  const sourceBox = getCellContentBox(sourceEl, root)
  const row = sourceEl.closest('[data-blueprint-row]')
  /*
    The corridor starts below EVERY cell in the lane, not just below the
    source. A wrap runs the width of the lane, so any cell it passes over
    bounds it — and in the merged compare canvas a slot stacks one sub-cell
    per path, so the source's own bottom edge is routinely mid-lane, with
    another path's sub-cell sitting under it. Reading the source alone put
    the loop-back straight through that sub-cell's text.
  */
  const corridorStart = getLaneContentBottom(row, root, sourceEl, sourceBox)

  if (row) {
    const inlineCorridor = row.querySelector<HTMLElement>(
      '[data-blueprint-wrap-corridor="below"]',
    )
    if (inlineCorridor) {
      const corridorBox = getElementLayoutBox(inlineCorridor, root)
      const corridorBottom = corridorBox.top + corridorBox.height
      if (corridorBottom > corridorStart) {
        return { start: corridorStart, end: corridorBottom }
      }
    }

    let sibling = row.nextElementSibling
    while (sibling) {
      if (
        sibling instanceof HTMLElement &&
        sibling.dataset.blueprintWrapCorridor === 'below'
      ) {
        const corridorBox = getElementLayoutBox(sibling, root)
        const corridorBottom = corridorBox.top + corridorBox.height
        if (corridorBottom > corridorStart) {
          return { start: corridorStart, end: corridorBottom }
        }
      }
      sibling = sibling.nextElementSibling
    }

    sibling = row.nextElementSibling
    while (sibling) {
      if (
        sibling instanceof HTMLElement &&
        sibling.dataset.blueprintRow !== undefined
      ) {
        const nextRowBox = getElementLayoutBox(sibling, root)
        if (nextRowBox.top > corridorStart) {
          return { start: corridorStart, end: nextRowBox.top }
        }
        break
      }
      sibling = sibling.nextElementSibling
    }

    sibling = row.nextElementSibling
    while (sibling) {
      if (
        sibling instanceof HTMLElement &&
        sibling.dataset.blueprintDivider === 'interaction'
      ) {
        const dividerBox = getElementLayoutBox(sibling, root)
        const corridorEnd = dividerBox.top
        if (corridorEnd > corridorStart) {
          return { start: corridorStart, end: corridorEnd }
        }
        return {
          start: corridorStart,
          end: dividerBox.top + dividerBox.height,
        }
      }
      if (
        sibling instanceof HTMLElement &&
        sibling.dataset.blueprintDivider !== undefined
      ) {
        break
      }
      sibling = sibling.nextElementSibling
    }
  }

  return {
    start: corridorStart,
    end: corridorStart + BLUEPRINT_WRAP_CORRIDOR_MARGIN,
  }
}

/** Y center of the corridor between a lane row and the interaction line. */
export function getWrapCorridorY(
  sourceEl: HTMLElement,
  root: HTMLElement,
): number {
  const bounds = getWrapCorridorBounds(sourceEl, root)
  if (bounds) {
    return (bounds.start + bounds.end) / 2
  }

  const sourceBox = getCellContentBox(sourceEl, root)
  return sourceBox.top + sourceBox.height + BLUEPRINT_WRAP_CORRIDOR_MARGIN / 2
}

/** Horizontal lane for loop-back arrows — kept low in the corridor. */
export function getWrapLoopRouteY(
  sourceEl: HTMLElement,
  root: HTMLElement,
): number {
  const bounds = getWrapCorridorBounds(sourceEl, root)
  if (!bounds) {
    return getWrapCorridorY(sourceEl, root)
  }

  const height = bounds.end - bounds.start
  const inset = Math.min(WRAP_LOOP_CORRIDOR_INSET, height * 0.35)
  return bounds.end - inset
}

/**
 * Arrow Y: source cell center by default; target center when target is much shorter.
 */
export function getArrowCenterY(
  sourceEl: HTMLElement,
  targetEl: HTMLElement,
  root: HTMLElement,
): number {
  const sourceBox = getCellContentBox(sourceEl, root)
  const targetBox = getCellContentBox(targetEl, root)
  const sourceCenterY = sourceBox.top + sourceBox.height / 2
  const targetCenterY = targetBox.top + targetBox.height / 2

  if (
    targetBox.height <
    sourceBox.height * ARROW_TARGET_MUCH_SMALLER_RATIO
  ) {
    return targetCenterY
  }

  return sourceCenterY
}

/** Loop arrows exit the source bottom and enter the target bottom (horizontal center). */
export function getWrapCellAnchors(
  sourceEl: HTMLElement,
  targetEl: HTMLElement,
  root: HTMLElement,
): CellAnchor {
  const sourceBox = getCellContentBox(sourceEl, root)
  const targetBox = getCellContentBox(targetEl, root)

  return {
    source: {
      x: (sourceBox.left + sourceBox.right) / 2,
      y: sourceBox.top + sourceBox.height,
    },
    target: {
      x: (targetBox.left + targetBox.right) / 2,
      y: targetBox.top + targetBox.height,
    },
  }
}

/** Connectors anchor to top/bottom center when source and target share a step column. */
export function getVerticalCellAnchors(
  sourceEl: HTMLElement,
  targetEl: HTMLElement,
  root: HTMLElement,
): CellAnchor {
  const sourceBox = getCellContentBox(sourceEl, root)
  const targetBox = getCellContentBox(targetEl, root)
  const sourceMidY = sourceBox.top + sourceBox.height / 2
  const targetMidY = targetBox.top + targetBox.height / 2
  const targetAbove = targetMidY < sourceMidY
  const sourceCenterX = (sourceBox.left + sourceBox.right) / 2
  const targetCenterX = (targetBox.left + targetBox.right) / 2
  const x = (sourceCenterX + targetCenterX) / 2

  if (targetAbove) {
    return {
      source: { x, y: sourceBox.top },
      target: { x, y: targetBox.top + targetBox.height },
    }
  }

  return {
    source: { x, y: sourceBox.top + sourceBox.height },
    target: { x, y: targetBox.top },
  }
}

/**
 * Straight line between vertically aligned cells in the same step column;
 * chevron tip sits on the target edge.
 */
export function buildVerticalArrowPath(
  source: Point,
  target: Point,
): string {
  const goingUp = target.y < source.y
  if (goingUp) {
    const lineEndY = target.y + ARROW_CHEVRON_SIZE
    if (lineEndY >= source.y) return ''
    return `M ${source.x} ${source.y} L ${source.x} ${lineEndY}`
  }

  const lineEndY = target.y - ARROW_CHEVRON_SIZE
  if (lineEndY <= source.y) return ''
  return `M ${source.x} ${source.y} L ${source.x} ${lineEndY}`
}

export type BidirectionalDependencyLink = {
  id: string
  source_cell_id: string
  target_cell_id: string
}

export type BidirectionalDependencyPair<T extends BidirectionalDependencyLink> = {
  first: T
  second: T
  cellAId: string
  cellBId: string
}

/** Pairs of dependencies that connect the same two cells in opposite directions. */
export function findBidirectionalDependencyPairs<T extends BidirectionalDependencyLink>(
  dependencies: T[],
): { pairs: BidirectionalDependencyPair<T>[]; remaining: T[] } {
  const pending = new Map<string, T>()
  const pairedIds = new Set<string>()
  const pairs: BidirectionalDependencyPair<T>[] = []

  for (const dependency of dependencies) {
    const reverseKey = `${dependency.target_cell_id}->${dependency.source_cell_id}`
    const reverse = pending.get(reverseKey)
    if (reverse) {
      pairedIds.add(dependency.id)
      pairedIds.add(reverse.id)
      pairs.push({
        first: reverse,
        second: dependency,
        cellAId: reverse.source_cell_id,
        cellBId: reverse.target_cell_id,
      })
      pending.delete(reverseKey)
      continue
    }

    pending.set(
      `${dependency.source_cell_id}->${dependency.target_cell_id}`,
      dependency,
    )
  }

  return {
    pairs,
    remaining: dependencies.filter((dependency) => !pairedIds.has(dependency.id)),
  }
}

/**
 * Double-headed vertical connector between two cells in the same step column.
 * The stroke is inset so arrowheads sit on the cell edges, not through them.
 */
export function buildBidirectionalVerticalArrowPath(
  cellAEl: HTMLElement,
  cellBEl: HTMLElement,
  root: HTMLElement,
): string {
  const boxA = getCellContentBox(cellAEl, root)
  const boxB = getCellContentBox(cellBEl, root)
  const aAbove =
    boxA.top + boxA.height / 2 <= boxB.top + boxB.height / 2
  const upperEl = aAbove ? cellAEl : cellBEl
  const lowerEl = aAbove ? cellBEl : cellAEl
  const anchors = getVerticalCellAnchors(upperEl, lowerEl, root)

  // A cell between the two (merged stacks a sub-cell per path inside one
  // slot) means the straight run would strike through its text. Detour
  // through a column gutter instead, entering both cards side-on so each
  // head still lands on the cell it belongs to.
  if (getSameColumnObstructingCells(upperEl, lowerEl, root).length > 0) {
    return buildSameColumnGutterDetourPath(upperEl, lowerEl, root)
  }

  const y1 = anchors.source.y + ARROW_CHEVRON_SIZE
  const y2 = anchors.target.y - ARROW_CHEVRON_SIZE
  if (y2 <= y1) return ''
  return `M ${anchors.source.x} ${y1} L ${anchors.source.x} ${y2}`
}

export function buildBidirectionalArrowPath(
  cellAEl: HTMLElement,
  cellBEl: HTMLElement,
  root: HTMLElement,
): string {
  const stepA = parseStepIndex(cellAEl)
  const stepB = parseStepIndex(cellBEl)
  if (stepA === null || stepB === null || stepA !== stepB) return ''

  const rowA = getLayerRow(cellAEl)
  const rowB = getLayerRow(cellBEl)
  if (!rowA || !rowB || rowA === rowB) return ''

  return buildBidirectionalVerticalArrowPath(cellAEl, cellBEl, root)
}

/** Map integrated overlay cell ids back to canonical blueprint cell ids for arrow rules. */
export function resolveArrowLogicCellId(cellId: string): string {
  return resolveBlueprintCellId(cellId)
}

const SAME_STEP_FRONT_STAGE_TECH_TO_REGULAR_TUTOR_PATTERN =
  /(\d{2})06$/

/** Same-column Front Stage Tech → Regular Tutor (e.g. Reporting an Issue step 4). */
export function isSameStepFrontStageTechToRegularTutorDependency(
  sourceCellId?: string,
  targetCellId?: string,
): boolean {
  if (!sourceCellId || !targetCellId) return false

  const source = resolveArrowLogicCellId(sourceCellId)
  const target = resolveArrowLogicCellId(targetCellId)
  const sourceMatch = source.match(SAME_STEP_FRONT_STAGE_TECH_TO_REGULAR_TUTOR_PATTERN)
  if (!sourceMatch) return false

  const targetMatch = target.match(/(\d{2})03$/)
  if (!targetMatch) return false

  return sourceMatch[1] === targetMatch[1]
}

/** Same-column Front Stage Tech → Lead Tutor (e.g. Reporting an Issue step 4). */
export function isSameStepFrontStageTechToLeadTutorDependency(
  sourceCellId?: string,
  targetCellId?: string,
): boolean {
  if (!sourceCellId || !targetCellId) return false

  const source = resolveArrowLogicCellId(sourceCellId)
  const target = resolveArrowLogicCellId(targetCellId)
  const sourceMatch = source.match(SAME_STEP_FRONT_STAGE_TECH_TO_REGULAR_TUTOR_PATTERN)
  if (!sourceMatch) return false

  const targetMatch = target.match(/(\d{2})02$/)
  if (!targetMatch) return false

  return sourceMatch[1] === targetMatch[1]
}

const REPORTING_AN_ISSUE_FST_TO_REGULAR_TUTOR_TRIGGER_ID =
  'a0000000-0000-4000-8000-000000098073'
const REPORTING_AN_ISSUE_FST_TO_LEAD_TUTOR_TRIGGER_ID =
  'a0000000-0000-4000-8000-000000098075'

const INTEGRATED_TRIGGER_ID_PATTERN =
  /^integrated-trigger-[0-9a-f-]{36}-([0-9a-f-]{36})$/i

/** Map integrated overlay dependency ids back to canonical dependency ids. */
export function resolveArrowLogicDependencyId(dependencyId: string): string {
  const match = INTEGRATED_TRIGGER_ID_PATTERN.exec(dependencyId)
  return match ? match[1]! : dependencyId
}

export function isReportingAnIssueFrontStageTechToRegularTutorDependency(
  dependencyId?: string,
  _sourceCellId?: string,
  _targetCellId?: string,
): boolean {
  if (!dependencyId) return false

  return (
    resolveArrowLogicDependencyId(dependencyId) ===
    REPORTING_AN_ISSUE_FST_TO_REGULAR_TUTOR_TRIGGER_ID
  )
}

export function isReportingAnIssueFrontStageTechToLeadTutorDependency(
  dependencyId?: string,
  _sourceCellId?: string,
  _targetCellId?: string,
): boolean {
  if (!dependencyId) return false

  return (
    resolveArrowLogicDependencyId(dependencyId) ===
    REPORTING_AN_ISSUE_FST_TO_LEAD_TUTOR_TRIGGER_ID
  )
}

const REPORTING_AN_ISSUE_TUTOR_TO_FST_STEP_1_TRIGGER_IDS = new Set([
  'a0000000-0000-4000-8000-000000098070',
  'a0000000-0000-4000-8000-000000098074',
])

export function isReportingAnIssueTutorToFrontStageTechStep1Dependency(
  dependencyId?: string,
  _sourceCellId?: string,
  _targetCellId?: string,
): boolean {
  if (!dependencyId) return false

  return REPORTING_AN_ISSUE_TUTOR_TO_FST_STEP_1_TRIGGER_IDS.has(
    resolveArrowLogicDependencyId(dependencyId),
  )
}

/**
 * Reporting an Issue step 1 — Lead/Regular Tutor → Front Stage Tech: exit and
 * enter at the vertical center of each cell's left edge, routed through the
 * left column gutter when another cell sits between source and target.
 */
export function buildReportingAnIssueTutorToFrontStageTechSameStepPath(
  sourceEl: HTMLElement,
  targetEl: HTMLElement,
  root: HTMLElement,
): string {
  const sourceBox = getCellContentBox(sourceEl, root)
  const targetBox = getCellContentBox(targetEl, root)
  const exitX = sourceBox.left
  const exitY = sourceBox.top + sourceBox.height / 2
  const entryX = targetBox.left
  const entryY = targetBox.top + targetBox.height / 2

  const sourceStep = parseStepIndex(sourceEl)
  const gutterX =
    sourceStep !== null
      ? getVerticalRouteGutterX(root, sourceStep, sourceEl)
      : exitX - STEP_COLUMN_GAP / 2
  const routeX = Math.min(gutterX, exitX, entryX)
  const lineEndX = entryX - ARROW_CHEVRON_SIZE
  if (lineEndX <= routeX) return ''

  const points: Point[] = [{ x: exitX, y: exitY }]

  if (Math.abs(routeX - exitX) > 0.5) {
    points.push({ x: routeX, y: exitY })
  }

  if (Math.abs(entryY - exitY) > 0.5) {
    points.push({ x: routeX, y: entryY })
  }

  points.push({ x: lineEndX, y: entryY })

  return buildRoundedPolylinePath(points, ARROW_CORNER_RADIUS)
}

const SESSION_SIGN_UP_FST_TO_BSA_STEP_1_TRIGGER_ID =
  'a0000000-0000-4000-8000-000000092001'
const SESSION_SIGN_UP_FST_STEP_1_CELL_ID_SUFFIX = '000000130106'
const SESSION_SIGN_UP_BSA_STEP_1_CELL_ID_SUFFIX = '000000130107'

/** Session Sign Up step 1 — Front Stage Tech → Back Stage Actions. */
export function isSessionSignUpFrontStageTechToBackStageActionStep1Dependency(
  dependencyId?: string,
  sourceCellId?: string,
  targetCellId?: string,
): boolean {
  if (
    dependencyId &&
    resolveArrowLogicDependencyId(dependencyId) ===
      SESSION_SIGN_UP_FST_TO_BSA_STEP_1_TRIGGER_ID
  ) {
    return true
  }

  if (!sourceCellId || !targetCellId) return false

  const source = resolveArrowLogicCellId(sourceCellId)
  const target = resolveArrowLogicCellId(targetCellId)
  return (
    source.endsWith(SESSION_SIGN_UP_FST_STEP_1_CELL_ID_SUFFIX) &&
    target.endsWith(SESSION_SIGN_UP_BSA_STEP_1_CELL_ID_SUFFIX)
  )
}

const FILL_IN_REQUEST_FST_TO_BSA_STEP_1_TRIGGER_ID =
  'a0000000-0000-4000-8000-000000094009'
const FILL_IN_REQUEST_FST_STEP_1_CELL_ID_SUFFIX = '000000150106'
const FILL_IN_REQUEST_BSA_STEP_1_CELL_ID_SUFFIX = '000000150107'

/** Fill-in Request step 1 — Front Stage Tech → Back Stage Actions. */
export function isFillInRequestFrontStageTechToBackStageActionStep1Dependency(
  dependencyId?: string,
  sourceCellId?: string,
  targetCellId?: string,
): boolean {
  if (
    dependencyId &&
    resolveArrowLogicDependencyId(dependencyId) ===
      FILL_IN_REQUEST_FST_TO_BSA_STEP_1_TRIGGER_ID
  ) {
    return true
  }

  if (!sourceCellId || !targetCellId) return false

  const source = resolveArrowLogicCellId(sourceCellId)
  const target = resolveArrowLogicCellId(targetCellId)
  return (
    source.endsWith(FILL_IN_REQUEST_FST_STEP_1_CELL_ID_SUFFIX) &&
    target.endsWith(FILL_IN_REQUEST_BSA_STEP_1_CELL_ID_SUFFIX)
  )
}

const REPORTING_HOURS_LEAD_TUTOR_TO_FST_STEP_1_TRIGGER_ID =
  'a0000000-0000-4000-8000-000000098091'
const REPORTING_HOURS_LEAD_TUTOR_STEP_1_CELL_ID_SUFFIX = '0000001e0102'
const REPORTING_HOURS_FST_STEP_1_CELL_ID_SUFFIX = '0000001e0106'

export function isReportingHoursLeadTutorToFrontStageTechStep1Dependency(
  dependencyId?: string,
  sourceCellId?: string,
  targetCellId?: string,
): boolean {
  if (
    dependencyId &&
    resolveArrowLogicDependencyId(dependencyId) ===
      REPORTING_HOURS_LEAD_TUTOR_TO_FST_STEP_1_TRIGGER_ID
  ) {
    return true
  }

  if (!sourceCellId || !targetCellId) return false

  const source = resolveArrowLogicCellId(sourceCellId)
  const target = resolveArrowLogicCellId(targetCellId)
  return (
    source.endsWith(REPORTING_HOURS_LEAD_TUTOR_STEP_1_CELL_ID_SUFFIX) &&
    target.endsWith(REPORTING_HOURS_FST_STEP_1_CELL_ID_SUFFIX)
  )
}

export const REPORTING_HOURS_FST_STEP_1_TO_BSA_STEP_2_TRIGGER_ID =
  'a0000000-0000-4000-8000-000000098094'
const REPORTING_HOURS_BSA_STEP_2_CELL_ID_SUFFIX = '0000001e0307'

export function isReportingHoursFrontStageTechStep1ToBackStageActionStep2Connection(
  dependencyId?: string,
  sourceCellId?: string,
  targetCellId?: string,
): boolean {
  if (
    dependencyId &&
    resolveArrowLogicDependencyId(dependencyId) ===
      REPORTING_HOURS_FST_STEP_1_TO_BSA_STEP_2_TRIGGER_ID
  ) {
    return true
  }

  if (!sourceCellId || !targetCellId) return false

  const source = resolveArrowLogicCellId(sourceCellId)
  const target = resolveArrowLogicCellId(targetCellId)
  return (
    source.endsWith(REPORTING_HOURS_FST_STEP_1_CELL_ID_SUFFIX) &&
    target.endsWith(REPORTING_HOURS_BSA_STEP_2_CELL_ID_SUFFIX)
  )
}

const CALL_OFF_FSA_STEP_3_TO_BSA_STEP_5_TRIGGER_ID =
  'a0000000-0000-4000-8000-000000095012'
const CALL_OFF_FSA_STEP_3_CELL_ID_SUFFIX = '000000170304'
const CALL_OFF_BSA_STEP_5_CELL_ID_SUFFIX = '000000170507'

/** Call-off Request — Front Stage Actions step 3 → Back Stage Actions step 5. */
export function isCallOffFrontStageActionStep3ToBackStageActionStep5Connection(
  dependencyId?: string,
  sourceCellId?: string,
  targetCellId?: string,
): boolean {
  if (
    dependencyId &&
    resolveArrowLogicDependencyId(dependencyId) ===
      CALL_OFF_FSA_STEP_3_TO_BSA_STEP_5_TRIGGER_ID
  ) {
    return true
  }

  if (!sourceCellId || !targetCellId) return false

  const source = resolveArrowLogicCellId(sourceCellId)
  const target = resolveArrowLogicCellId(targetCellId)
  return (
    source.endsWith(CALL_OFF_FSA_STEP_3_CELL_ID_SUFFIX) &&
    target.endsWith(CALL_OFF_BSA_STEP_5_CELL_ID_SUFFIX)
  )
}

/**
 * Reporting Hours — Front Stage Tech step 1 → Back Stage Actions step 2:
 * L-shape (down from bottom center, rounded corner, right into left edge).
 */
export function buildReportingHoursFrontStageTechStep1ToBackStageActionStep2Path(
  sourceEl: HTMLElement,
  targetEl: HTMLElement,
  root: HTMLElement,
): string {
  return buildReportingAnIssueFrontStageActionStep1ToResolvePath(
    sourceEl,
    targetEl,
    root,
  )
}

export const REPORTING_HOURS_FST_STEP_3_TO_LEAD_TUTOR_TRIGGER_ID =
  'a0000000-0000-4000-8000-000000098092'
const REPORTING_HOURS_FST_STEP_3_CELL_ID_SUFFIX = '0000001e0206'
const REPORTING_HOURS_LEAD_TUTOR_STEP_3_CELL_ID_SUFFIX = '0000001e0202'

export function isReportingHoursFrontStageTechStep3ToLeadTutorConnection(
  dependencyId?: string,
  sourceCellId?: string,
  targetCellId?: string,
): boolean {
  if (
    dependencyId &&
    resolveArrowLogicDependencyId(dependencyId) ===
      REPORTING_HOURS_FST_STEP_3_TO_LEAD_TUTOR_TRIGGER_ID
  ) {
    return true
  }

  if (!sourceCellId || !targetCellId) return false

  const source = resolveArrowLogicCellId(sourceCellId)
  const target = resolveArrowLogicCellId(targetCellId)
  return (
    source.endsWith(REPORTING_HOURS_FST_STEP_3_CELL_ID_SUFFIX) &&
    target.endsWith(REPORTING_HOURS_LEAD_TUTOR_STEP_3_CELL_ID_SUFFIX)
  )
}

/**
 * Reporting Hours step 3 — Front Stage Tech → Lead Tutor: exit and enter at
 * the vertical center of each cell's right edge, routed through the right
 * column gutter when another cell sits between source and target.
 */
export function buildReportingHoursFrontStageTechStep3ToLeadTutorPath(
  sourceEl: HTMLElement,
  targetEl: HTMLElement,
  root: HTMLElement,
): string {
  const sourceBox = getCellContentBox(sourceEl, root)
  const targetBox = getCellContentBox(targetEl, root)
  const exitX = sourceBox.right
  const exitY = sourceBox.top + sourceBox.height / 2
  const entryX = targetBox.right
  const entryY = targetBox.top + targetBox.height / 2

  const sourceStep = parseStepIndex(sourceEl)
  const gutterX =
    sourceStep !== null
      ? getVerticalRouteRightGutterX(root, sourceStep, sourceEl)
      : exitX + STEP_COLUMN_GAP / 2
  const routeX = Math.max(gutterX, exitX, entryX)
  const lineEndX = entryX + ARROW_CHEVRON_SIZE
  if (lineEndX >= routeX) return ''

  const points: Point[] = [{ x: exitX, y: exitY }]

  if (Math.abs(routeX - exitX) > 0.5) {
    points.push({ x: routeX, y: exitY })
  }

  if (Math.abs(entryY - exitY) > 0.5) {
    points.push({ x: routeX, y: entryY })
  }

  points.push({ x: lineEndX, y: entryY })

  return buildRoundedPolylinePath(points, ARROW_CORNER_RADIUS)
}

const REPORTING_AN_ISSUE_FSA_TO_FST_TRIGGER_ID =
  'a0000000-0000-4000-8000-000000098077'

export const REPORTING_AN_ISSUE_FSA_STEP_1_TO_RESOLVE_TRIGGER_ID =
  'a0000000-0000-4000-8000-000000098081'

const REPORTING_AN_ISSUE_FSA_STEP_1_CELL_ID_SUFFIX = '0000001d0104'
const REPORTING_AN_ISSUE_RESOLVE_BSA_CELL_ID_SUFFIX = '0000001d0207'

export function isReportingAnIssueFrontStageActionStep1ToResolveConnection(
  dependencyId?: string,
  sourceCellId?: string,
  targetCellId?: string,
): boolean {
  if (
    dependencyId &&
    resolveArrowLogicDependencyId(dependencyId) ===
      REPORTING_AN_ISSUE_FSA_STEP_1_TO_RESOLVE_TRIGGER_ID
  ) {
    return true
  }

  if (!sourceCellId || !targetCellId) return false

  const source = resolveArrowLogicCellId(sourceCellId)
  const target = resolveArrowLogicCellId(targetCellId)
  return (
    source.endsWith(REPORTING_AN_ISSUE_FSA_STEP_1_CELL_ID_SUFFIX) &&
    target.endsWith(REPORTING_AN_ISSUE_RESOLVE_BSA_CELL_ID_SUFFIX)
  )
}

const REPORTING_AN_ISSUE_SPANNING_TO_TOP_ENTRY_TRIGGER_IDS = new Set([
  'a0000000-0000-4000-8000-000000098079',
  'a0000000-0000-4000-8000-000000098080',
])

export function isReportingAnIssueSpanningToTopEntryDependency(
  dependencyId?: string,
): boolean {
  if (!dependencyId) return false

  return REPORTING_AN_ISSUE_SPANNING_TO_TOP_ENTRY_TRIGGER_IDS.has(
    resolveArrowLogicDependencyId(dependencyId),
  )
}

/**
 * Reporting an Issue — forward cross-column connectors that span one or more
 * gaps (tutor/FSA → Back Stage Actions): exit right, route each gap at source
 * center Y, then drop into the target top center.
 */
export function buildReportingAnIssueSpanningToTopEntryPath(
  sourceEl: HTMLElement,
  targetEl: HTMLElement,
  root: HTMLElement,
): string {
  const sourceBox = getCellContentBox(sourceEl, root)
  const targetBox = getCellContentBox(targetEl, root)
  const sourceStep = parseStepIndex(sourceEl)
  const targetStep = parseStepIndex(targetEl)

  if (sourceStep === null || targetStep === null || targetStep <= sourceStep) {
    return ''
  }

  const exitX = sourceBox.right
  const exitY = sourceBox.top + sourceBox.height / 2
  const entryX = (targetBox.left + targetBox.right) / 2
  const lineEndY = targetBox.top - ARROW_CHEVRON_SIZE

  const points: Point[] = [{ x: exitX, y: exitY }]

  for (let gapIndex = sourceStep; gapIndex < targetStep; gapIndex++) {
    const gapX = getStepGapCenterX(root, gapIndex)
    if (gapX !== null) {
      points.push({ x: gapX, y: exitY })
    }
  }

  const last = points[points.length - 1]!
  if (Math.abs(entryX - last.x) > 0.5) {
    points.push({ x: entryX, y: exitY })
  }

  points.push({ x: entryX, y: lineEndY })

  return buildRoundedPolylinePath(points, ARROW_CORNER_RADIUS)
}

export function isReportingAnIssueFrontStageActionToFrontStageTechDependency(
  dependencyId?: string,
  _sourceCellId?: string,
  _targetCellId?: string,
): boolean {
  if (!dependencyId) return false

  return (
    resolveArrowLogicDependencyId(dependencyId) ===
    REPORTING_AN_ISSUE_FSA_TO_FST_TRIGGER_ID
  )
}

export function isReportingAnIssueFrontStageActionStep1ToResolveDependency(
  dependencyId?: string,
  sourceCellId?: string,
  targetCellId?: string,
): boolean {
  return isReportingAnIssueFrontStageActionStep1ToResolveConnection(
    dependencyId,
    sourceCellId,
    targetCellId,
  )
}

/**
 * Reporting an Issue — Front Stage Actions step 1 → Resolve concern: simple
 * L-shape (down from bottom center, rounded corner, right into left edge).
 */
export function buildReportingAnIssueFrontStageActionStep1ToResolvePath(
  sourceEl: HTMLElement,
  targetEl: HTMLElement,
  root: HTMLElement,
): string {
  const sourceBox = getCellContentBox(sourceEl, root)
  const targetBox = getCellContentBox(targetEl, root)

  const exitX = (sourceBox.left + sourceBox.right) / 2
  const exitY = sourceBox.top + sourceBox.height
  const entryY = targetBox.top + targetBox.height / 2
  const lineEndX = targetBox.left - ARROW_CHEVRON_SIZE

  if (lineEndX <= exitX) return ''

  const points: Point[] = [
    { x: exitX, y: exitY },
    { x: exitX, y: entryY },
    { x: lineEndX, y: entryY },
  ]

  return buildRoundedPolylinePath(points, ARROW_CORNER_RADIUS)
}

export function partitionReportingAnIssueFsaStep1ToResolveDependencies<
  T extends {
    id: string
    source_cell_id: string
    target_cell_id: string
  },
>(dependencies: T[]): { resolveDependencies: T[]; otherDependencies: T[] } {
  const resolveDependencies: T[] = []
  const otherDependencies: T[] = []

  for (const dependency of dependencies) {
    if (
      isReportingAnIssueFrontStageActionStep1ToResolveConnection(
        dependency.id,
        dependency.source_cell_id,
        dependency.target_cell_id,
      )
    ) {
      resolveDependencies.push(dependency)
    } else {
      otherDependencies.push(dependency)
    }
  }

  return { resolveDependencies, otherDependencies }
}

/**
 * Reporting an Issue — Front Stage Actions → Front Stage Tech (adjacent columns):
 * route through the column gap and enter at the bottom center of the tech cell.
 */
export function buildReportingAnIssueFrontStageActionToFrontStageTechPath(
  sourceEl: HTMLElement,
  targetEl: HTMLElement,
  root: HTMLElement,
): string {
  const sourceBox = getCellContentBox(sourceEl, root)
  const targetBox = getCellContentBox(targetEl, root)
  const exitX = sourceBox.right
  const exitY = sourceBox.top + sourceBox.height / 2
  const entryX = (targetBox.left + targetBox.right) / 2
  const entryY = targetBox.top + targetBox.height
  const lineEndY = entryY + ARROW_CHEVRON_SIZE

  const sourceStep = parseStepIndex(sourceEl)
  const routeX =
    getPreTargetGapCenterX(root, sourceEl, targetEl) ??
    (sourceStep !== null ? getStepGapCenterX(root, sourceStep) : null) ??
    (sourceBox.right + targetBox.left) / 2

  if (routeX <= exitX) return ''

  const points: Point[] = [
    { x: exitX, y: exitY },
    { x: routeX, y: exitY },
  ]

  if (Math.abs(entryX - routeX) > 0.5) {
    points.push({ x: entryX, y: exitY })
  }

  points.push({ x: entryX, y: lineEndY })

  return buildRoundedPolylinePath(points, ARROW_CORNER_RADIUS)
}

const DISCOVERY_FSA_TO_REGULAR_TUTOR_TRIGGER_IDS = new Set([
  'a0000000-0000-4000-8000-000000078001',
  'a0000000-0000-4000-8000-000000078006',
  'a0000000-0000-4000-8000-000000728001',
  'a0000000-0000-4000-8000-000000728006',
])

const DISCOVERY_FSA_TO_REGULAR_TUTOR_STEP_1_TRIGGER_IDS = new Set([
  'a0000000-0000-4000-8000-000000078001',
  'a0000000-0000-4000-8000-000000728001',
])

const DISCOVERY_FSA_TO_REGULAR_TUTOR_STEP_4_TRIGGER_IDS = new Set([
  'a0000000-0000-4000-8000-000000078006',
  'a0000000-0000-4000-8000-000000728006',
])

export function isDiscoveryFrontStageActionToRegularTutorDependency(
  dependencyId?: string,
  _sourceCellId?: string,
  _targetCellId?: string,
): boolean {
  if (!dependencyId) return false

  return DISCOVERY_FSA_TO_REGULAR_TUTOR_TRIGGER_IDS.has(
    resolveArrowLogicDependencyId(dependencyId),
  )
}

/**
 * Discovery step 1 — Front Stage Actions → Regular Tutor: exit top-center,
 * enter bottom-center (straight vertical when unobstructed).
 */
function buildDiscoveryFrontStageActionToRegularTutorStep1Path(
  sourceEl: HTMLElement,
  targetEl: HTMLElement,
  root: HTMLElement,
): string {
  const sourceBox = getCellContentBox(sourceEl, root)
  const targetBox = getCellContentBox(targetEl, root)
  const sourceCenterX = (sourceBox.left + sourceBox.right) / 2
  const targetCenterX = (targetBox.left + targetBox.right) / 2
  const source: Point = { x: sourceCenterX, y: sourceBox.top }
  const targetBottom = targetBox.top + targetBox.height
  const lineEndY = targetBottom + ARROW_CHEVRON_SIZE

  if (lineEndY >= source.y) return ''

  const obstructing = getSameColumnObstructingCells(
    sourceEl,
    targetEl,
    root,
  )

  if (obstructing.length > 0) {
    const sourceStep = parseStepIndex(sourceEl)
    const gutterX =
      sourceStep !== null
        ? getVerticalRouteGutterX(root, sourceStep, sourceEl)
        : Math.min(sourceBox.left, targetBox.left) - STEP_COLUMN_GAP / 2

    if (gutterX >= Math.min(sourceCenterX, targetCenterX)) return ''

    return buildRoundedPolylinePath(
      [
        source,
        { x: gutterX, y: source.y },
        { x: gutterX, y: lineEndY },
        { x: targetCenterX, y: lineEndY },
      ],
      ARROW_CORNER_RADIUS,
    )
  }

  if (Math.abs(sourceCenterX - targetCenterX) < 0.5) {
    return buildVerticalArrowPath(source, { x: targetCenterX, y: targetBottom })
  }

  const midY = (source.y + targetBottom) / 2
  return buildRoundedPolylinePath(
    [
      source,
      { x: sourceCenterX, y: midY },
      { x: targetCenterX, y: midY },
      { x: targetCenterX, y: lineEndY },
    ],
    ARROW_CORNER_RADIUS,
  )
}

/**
 * Discovery step 4 — Front Stage Actions → Regular Tutor: exit at the vertical
 * center of the source left edge, enter at the vertical center of the target
 * left edge, routed through the left column gutter around Front Stage Tech.
 */
function buildDiscoveryFrontStageActionToRegularTutorStep4Path(
  sourceEl: HTMLElement,
  targetEl: HTMLElement,
  root: HTMLElement,
): string {
  const sourceBox = getCellContentBox(sourceEl, root)
  const targetBox = getCellContentBox(targetEl, root)
  const exitX = sourceBox.left
  const exitY = sourceBox.top + sourceBox.height / 2
  const entryY = targetBox.top + targetBox.height / 2

  const sourceStep = parseStepIndex(sourceEl)
  const gutterX =
    sourceStep !== null
      ? getVerticalRouteGutterX(root, sourceStep, sourceEl)
      : exitX - STEP_COLUMN_GAP / 2
  const routeX = Math.min(gutterX, exitX)
  const lineEndX = targetBox.left - ARROW_CHEVRON_SIZE
  if (lineEndX <= routeX) return ''

  const points: Point[] = [{ x: exitX, y: exitY }]

  if (Math.abs(routeX - exitX) > 0.5) {
    points.push({ x: routeX, y: exitY })
  }

  if (Math.abs(entryY - exitY) > 0.5) {
    points.push({ x: routeX, y: entryY })
  }

  points.push({ x: lineEndX, y: entryY })

  return buildRoundedPolylinePath(points, ARROW_CORNER_RADIUS)
}

/**
 * Discovery — Front Stage Actions → Regular Tutor: left-edge exit and entry,
 * routed around same-column Front Stage Tech.
 */
export function buildDiscoveryFrontStageActionToRegularTutorSameStepPath(
  sourceEl: HTMLElement,
  targetEl: HTMLElement,
  root: HTMLElement,
  dependencyId?: string,
): string {
  if (
    dependencyId &&
    DISCOVERY_FSA_TO_REGULAR_TUTOR_STEP_1_TRIGGER_IDS.has(
      resolveArrowLogicDependencyId(dependencyId),
    )
  ) {
    return buildDiscoveryFrontStageActionToRegularTutorStep1Path(
      sourceEl,
      targetEl,
      root,
    )
  }

  if (
    dependencyId &&
    DISCOVERY_FSA_TO_REGULAR_TUTOR_STEP_4_TRIGGER_IDS.has(
      resolveArrowLogicDependencyId(dependencyId),
    )
  ) {
    return buildDiscoveryFrontStageActionToRegularTutorStep4Path(
      sourceEl,
      targetEl,
      root,
    )
  }

  const sourceBox = getCellContentBox(sourceEl, root)
  const targetBox = getCellContentBox(targetEl, root)
  const exitX = sourceBox.left
  const entryX = targetBox.left
  const sourceY = sourceBox.top
  const entryY = targetBox.top + targetBox.height + ARROW_CHEVRON_SIZE

  if (entryY >= sourceY) return ''

  const points: Point[] = [{ x: exitX, y: sourceY }]

  if (Math.abs(entryX - exitX) > 0.5) {
    points.push({ x: entryX, y: sourceY })
    points.push({ x: entryX, y: entryY })
  } else {
    points.push({ x: entryX, y: entryY })
  }

  return buildRoundedPolylinePath(points, ARROW_CORNER_RADIUS)
}

/**
 * Reporting an Issue step 3 — Front Stage Tech → Lead/Regular Tutor: separate
 * left-edge connectors (exit FST left, enter tutor left via the column gutter)
 * so they do not overlap outgoing tutor → Resolve concern arrows on the right.
 */
export function buildReportingAnIssueFrontStageTechToTutorSameStepPath(
  sourceEl: HTMLElement,
  targetEl: HTMLElement,
  root: HTMLElement,
): string {
  const sourceBox = getCellContentBox(sourceEl, root)
  const targetBox = getCellContentBox(targetEl, root)
  const exitX = sourceBox.left
  const exitY = sourceBox.top + sourceBox.height / 2
  const entryX = targetBox.left
  const entryY = targetBox.top + targetBox.height / 2

  const sourceStep = parseStepIndex(sourceEl)
  const gutterX =
    sourceStep !== null
      ? getVerticalRouteGutterX(root, sourceStep, sourceEl)
      : exitX - STEP_COLUMN_GAP / 2
  const routeX = Math.min(gutterX, exitX, entryX)
  const lineEndX = entryX - ARROW_CHEVRON_SIZE
  if (lineEndX <= routeX) return ''

  const points: Point[] = [{ x: exitX, y: exitY }]

  if (Math.abs(routeX - exitX) > 0.5) {
    points.push({ x: routeX, y: exitY })
  }

  if (Math.abs(entryY - exitY) > 0.5) {
    points.push({ x: routeX, y: entryY })
  }

  points.push({ x: lineEndX, y: entryY })

  return buildRoundedPolylinePath(points, ARROW_CORNER_RADIUS)
}

const IN_SESSION_COLUMN_GAP_CELL_PATTERN =
  /000000(?:04|1[89abc])\d{2}(01|02|03)$/

function isBeforeStudentsJoinColumnGapCell(
  cellId: string | undefined,
): boolean {
  if (!cellId) return false
  return IN_SESSION_COLUMN_GAP_CELL_PATTERN.test(
    resolveArrowLogicCellId(cellId),
  )
}

function isRegularTutorRailCell(cellId: string | undefined): boolean {
  if (!cellId) return false
  return OVERHEAD_RAIL_REGULAR_TUTOR_CELL_PATTERN.test(
    resolveArrowLogicCellId(cellId),
  )
}

function parseRegularTutorStepFromCellId(cellId: string): number | null {
  const match = OVERHEAD_RAIL_REGULAR_TUTOR_CELL_PATTERN.exec(
    resolveArrowLogicCellId(cellId),
  )
  if (!match) return null
  const step = Number.parseInt(match[1], 10)
  return Number.isFinite(step) ? step : null
}

/** Horizontal discovery rail above the Regular Tutor row. */
export const DISCOVERY_RAIL_CLEARANCE = 10

export function isRegularTutorRailDependency(
  sourceEl: HTMLElement,
  targetEl: HTMLElement,
  sourceCellId?: string,
  targetCellId?: string,
): boolean {
  if (
    isBeforeStudentsJoinColumnGapCell(sourceCellId) ||
    isBeforeStudentsJoinColumnGapCell(targetCellId)
  ) {
    return false
  }

  if (!isRegularTutorRailCell(sourceCellId) || !isRegularTutorRailCell(targetCellId)) {
    return false
  }

  const sourceStep = parseStepIndex(sourceEl)
  const targetStep = parseStepIndex(targetEl)
  if (sourceStep === null || targetStep === null) return false
  if (targetStep <= sourceStep) return false
  // Adjacent hops normally use the column gap; exceptions use the overhead rail.
  if (targetStep === sourceStep + 1) {
    if (sourceStep === 0 || sourceStep === 4) return true
    return false
  }
  return true
}

/** @deprecated Use isRegularTutorRailDependency. */
export function isApplicationRegularTutorRailDependency(
  sourceEl: HTMLElement,
  targetEl: HTMLElement,
  sourceCellId?: string,
  targetCellId?: string,
): boolean {
  return isRegularTutorRailDependency(
    sourceEl,
    targetEl,
    sourceCellId,
    targetCellId,
  )
}

/** Top-center anchor on the visible cell card. */
export function getCellTopCenter(
  cellEl: HTMLElement,
  root: HTMLElement,
): Point {
  const box = getCellContentBox(cellEl, root)
  return {
    x: (box.left + box.right) / 2,
    y: box.top,
  }
}

/** Y of the shared discovery rail above the Regular Tutor row. */
export function getDiscoveryRailY(
  sourceEl: HTMLElement,
  targetEl: HTMLElement,
  root: HTMLElement,
): number {
  // Lane-wide tops, not the two cards' own: a merged slot stacks a sub-cell
  // per path, so a rail measured off a lower sub-cell would run through the
  // ones above it.
  return (
    Math.min(getLaneContentTop(sourceEl, root), getLaneContentTop(targetEl, root)) -
    BLUEPRINT_DISCOVERY_RAIL_CORRIDOR_MARGIN / 2
  )
}

/**
 * Single discovery-rail connector: up from source top-center, across the
 * overhead rail, then down into the target top-center.
 */
export function buildApplicationRegularTutorRailPath(
  sourceEl: HTMLElement,
  targetEl: HTMLElement,
  root: HTMLElement,
): string {
  const source = getCellTopCenter(sourceEl, root)
  const target = getCellTopCenter(targetEl, root)
  const railY = getDiscoveryRailY(sourceEl, targetEl, root)
  const lineEndY = target.y - ARROW_CHEVRON_SIZE

  if (lineEndY <= railY) return ''

  return buildRoundedPolylinePath(
    [
      source,
      { x: source.x, y: railY },
      { x: target.x, y: railY },
      { x: target.x, y: lineEndY },
    ],
    ARROW_CORNER_RADIUS,
  )
}

/**
 * Merged bus for multiple Regular Tutor forward dependencies that share a target:
 * the leftmost source rises to the rail, the trunk runs to the target column,
 * intermediate sources get vertical taps, and the path ends with a downward
 * arrow into the target.
 */
export function buildApplicationRegularTutorRailBusPath(
  sourceEls: HTMLElement[],
  targetEl: HTMLElement,
  root: HTMLElement,
): string {
  if (sourceEls.length === 0) return ''

  const sorted = [...sourceEls].sort(
    (a, b) => (parseStepIndex(a) ?? 0) - (parseStepIndex(b) ?? 0),
  )
  const firstEl = sorted[0]
  const first = getCellTopCenter(firstEl, root)
  const target = getCellTopCenter(targetEl, root)
  const railY = getDiscoveryRailY(firstEl, targetEl, root)
  const lineEndY = target.y - ARROW_CHEVRON_SIZE

  if (lineEndY <= railY) return ''

  const mainPath = buildRoundedPolylinePath(
    [
      first,
      { x: first.x, y: railY },
      { x: target.x, y: railY },
      { x: target.x, y: lineEndY },
    ],
    ARROW_CORNER_RADIUS,
  )

  const tapPaths = sorted.slice(1).map((el) => {
    const cell = getCellTopCenter(el, root)
    return `M ${cell.x} ${railY} L ${cell.x} ${cell.y}`
  })

  // Taps first so markerEnd lands on the main trunk's downward segment at step 6.
  return [...tapPaths, mainPath].filter(Boolean).join(' ')
}

export type OverheadRailFanOutGroup = {
  sourceCellId: string
  sourceEl: HTMLElement
  branches: Array<{ dependencyId: string; targetEl: HTMLElement }>
}

/** Shared trunk: up from the source, then across above all branch targets. */
export function buildOverheadRailFanOutTrunkPath(
  sourceEl: HTMLElement,
  targetEls: HTMLElement[],
  root: HTMLElement,
): string {
  if (targetEls.length === 0) return ''

  const source = getCellTopCenter(sourceEl, root)
  const sortedTargets = [...targetEls].sort(
    (a, b) => (parseStepIndex(a) ?? 0) - (parseStepIndex(b) ?? 0),
  )
  const lastTarget = sortedTargets[sortedTargets.length - 1]!
  const railY = getDiscoveryRailY(sourceEl, lastTarget, root)
  const rightX = Math.max(
    ...sortedTargets.map((el) => getCellTopCenter(el, root).x),
  )

  return buildRoundedPolylinePath(
    [source, { x: source.x, y: railY }, { x: rightX, y: railY }],
    ARROW_CORNER_RADIUS,
  )
}

/** Vertical drop from the overhead rail into a branch target. */
export function buildOverheadRailFanOutDropPath(
  sourceEl: HTMLElement,
  targetEl: HTMLElement,
  root: HTMLElement,
): string {
  const target = getCellTopCenter(targetEl, root)
  const railY = getDiscoveryRailY(sourceEl, targetEl, root)
  const lineEndY = target.y - ARROW_CHEVRON_SIZE
  if (lineEndY <= railY) return ''
  return `M ${target.x} ${railY} L ${target.x} ${lineEndY}`
}

/** Dependency ids that share a source and fan out to multiple overhead-rail targets. */
export function collectOverheadRailFanOutDependencyIds<
  T extends DiscoveryRailDependency,
>(dependencies: readonly T[]): Set<string> {
  const bySource = new Map<string, T[]>()

  for (const dependency of dependencies) {
    if (
      !isRegularTutorRailDependencyByCellId(
        dependency.source_cell_id,
        dependency.target_cell_id,
      )
    ) {
      continue
    }

    const list = bySource.get(dependency.source_cell_id) ?? []
    list.push(dependency)
    bySource.set(dependency.source_cell_id, list)
  }

  const fanOutIds = new Set<string>()
  for (const list of bySource.values()) {
    const targetIds = new Set(list.map((dependency) => dependency.target_cell_id))
    if (targetIds.size < 2) continue
    for (const dependency of list) {
      fanOutIds.add(dependency.id)
    }
  }

  return fanOutIds
}

export type DiscoveryRailDependency = {
  id: string
  source_cell_id: string
  target_cell_id: string
}

/** Group overhead-rail dependencies into merge buses and source fan-outs. */
export function groupDiscoveryRailDependencies<T extends DiscoveryRailDependency>(
  dependencies: T[],
  content: HTMLElement,
): {
  busGroups: {
    targetCellId: string
    dependencyIds: string[]
    sourceEls: HTMLElement[]
    targetEl: HTMLElement
  }[]
  fanOutGroups: OverheadRailFanOutGroup[]
  remaining: T[]
} {
  const remaining: T[] = []
  const railEntries: Array<{
    dependency: T
    sourceEl: HTMLElement
    targetEl: HTMLElement
  }> = []

  for (const dependency of dependencies) {
    if (
      !isRegularTutorRailDependencyByCellId(
        dependency.source_cell_id,
        dependency.target_cell_id,
      )
    ) {
      remaining.push(dependency)
      continue
    }

    const sourceEl = content.querySelector<HTMLElement>(
      `[data-blueprint-cell="${dependency.source_cell_id}"]`,
    )
    const targetEl = content.querySelector<HTMLElement>(
      `[data-blueprint-cell="${dependency.target_cell_id}"]`,
    )
    if (!sourceEl || !targetEl) continue

    railEntries.push({ dependency, sourceEl, targetEl })
  }

  const fanOutDependencyIds = collectOverheadRailFanOutDependencyIds(
    railEntries.map((entry) => entry.dependency),
  )
  const fanOutGroups: OverheadRailFanOutGroup[] = []
  const bySource = new Map<
    string,
    {
      sourceEl: HTMLElement
      branches: Array<{ dependencyId: string; targetEl: HTMLElement }>
      targetIds: Set<string>
    }
  >()

  for (const entry of railEntries) {
    if (!fanOutDependencyIds.has(entry.dependency.id)) continue

    const existing = bySource.get(entry.dependency.source_cell_id)
    if (existing) {
      if (!existing.targetIds.has(entry.dependency.target_cell_id)) {
        existing.targetIds.add(entry.dependency.target_cell_id)
        existing.branches.push({
          dependencyId: entry.dependency.id,
          targetEl: entry.targetEl,
        })
      }
    } else {
      bySource.set(entry.dependency.source_cell_id, {
        sourceEl: entry.sourceEl,
        branches: [
          { dependencyId: entry.dependency.id, targetEl: entry.targetEl },
        ],
        targetIds: new Set([entry.dependency.target_cell_id]),
      })
    }
  }

  for (const [sourceCellId, group] of bySource) {
    fanOutGroups.push({
      sourceCellId,
      sourceEl: group.sourceEl,
      branches: [...group.branches].sort(
        (a, b) =>
          (parseStepIndex(a.targetEl) ?? 0) - (parseStepIndex(b.targetEl) ?? 0),
      ),
    })
  }

  const byTarget = new Map<
    string,
    { dependencyIds: string[]; sourceEls: HTMLElement[]; targetEl: HTMLElement }
  >()

  for (const entry of railEntries) {
    if (fanOutDependencyIds.has(entry.dependency.id)) continue

    const existing = byTarget.get(entry.dependency.target_cell_id)
    if (existing) {
      existing.dependencyIds.push(entry.dependency.id)
      existing.sourceEls.push(entry.sourceEl)
    } else {
      byTarget.set(entry.dependency.target_cell_id, {
        dependencyIds: [entry.dependency.id],
        sourceEls: [entry.sourceEl],
        targetEl: entry.targetEl,
      })
    }
  }

  const busGroups = [...byTarget.entries()]
    .filter(([, group]) => group.sourceEls.length >= 2)
    .map(([targetCellId, group]) => ({
      targetCellId,
      dependencyIds: group.dependencyIds,
      sourceEls: group.sourceEls,
      targetEl: group.targetEl,
    }))

  for (const entry of railEntries) {
    if (fanOutDependencyIds.has(entry.dependency.id)) continue

    const busGroup = busGroups.find((group) =>
      group.dependencyIds.includes(entry.dependency.id),
    )
    if (busGroup) continue

    remaining.push(entry.dependency)
  }

  return {
    busGroups,
    fanOutGroups,
    remaining,
  }
}

function isRegularTutorRailDependencyByCellId(
  sourceCellId: string,
  targetCellId: string,
): boolean {
  if (
    isBeforeStudentsJoinColumnGapCell(sourceCellId) ||
    isBeforeStudentsJoinColumnGapCell(targetCellId)
  ) {
    return false
  }

  if (!isRegularTutorRailCell(sourceCellId) || !isRegularTutorRailCell(targetCellId)) {
    return false
  }

  const sourceStep = parseRegularTutorStepFromCellId(sourceCellId)
  const targetStep = parseRegularTutorStepFromCellId(targetCellId)
  if (sourceStep === null || targetStep === null) return false
  if (targetStep <= sourceStep) return false
  if (targetStep === sourceStep + 1) {
    if (sourceStep === 1 || sourceStep === 5) return true
    return false
  }
  return true
}

/** Top-edge rail above the row for Application Regular Tutor forward connectors. */
export function getApplicationRegularTutorRailAnchors(
  sourceEl: HTMLElement,
  targetEl: HTMLElement,
  root: HTMLElement,
): CellAnchor {
  const sourceBox = getCellContentBox(sourceEl, root)
  const targetBox = getCellContentBox(targetEl, root)
  const y =
    Math.min(sourceBox.top, targetBox.top) -
    BLUEPRINT_DISCOVERY_RAIL_CORRIDOR_MARGIN / 2

  return {
    source: { x: sourceBox.right, y },
    target: { x: targetBox.left, y },
  }
}

/** Connectors anchor to the outer edges of the visible cell cards. */
export function getHorizontalCellAnchors(
  sourceEl: HTMLElement,
  targetEl: HTMLElement,
  root: HTMLElement,
): CellAnchor {
  const sourceBox = getCellContentBox(sourceEl, root)
  const targetBox = getCellContentBox(targetEl, root)
  const y = getArrowCenterY(sourceEl, targetEl, root)

  return {
    source: {
      x: sourceBox.right,
      y,
    },
    target: {
      x: targetBox.left,
      y,
    },
  }
}

/**
 * Straight line from source cell right edge to target cell left edge;
 * chevron tip sits on the target edge.
 */
export function buildHorizontalArrowPath(
  source: Point,
  target: Point,
): string {
  const lineEndX = target.x - ARROW_CHEVRON_SIZE
  if (lineEndX <= source.x) {
    return ''
  }

  return `M ${source.x} ${source.y} L ${lineEndX} ${source.y}`
}

/**
 * Forward connector between adjacent step columns on the same row, routed
 * through the center of the column gap (e.g. Regular Tutor step 3 → 4).
 */
export function buildAdjacentColumnGapArrowPath(
  sourceEl: HTMLElement,
  targetEl: HTMLElement,
  root: HTMLElement,
): string {
  const sourceBox = getCellContentBox(sourceEl, root)
  const targetBox = getCellContentBox(targetEl, root)
  const y = getArrowCenterY(sourceEl, targetEl, root)
  const sourceStep = parseStepIndex(sourceEl)
  const gapX =
    (sourceStep !== null ? getStepGapCenterX(root, sourceStep) : null) ??
    (sourceBox.right + targetBox.left) / 2
  const entryX = targetBox.left - ARROW_CHEVRON_SIZE

  if (entryX <= sourceBox.right) return ''

  return buildRoundedPolylinePath(
    [
      { x: sourceBox.right, y },
      { x: gapX, y },
      { x: entryX, y },
    ],
    ARROW_CORNER_RADIUS,
  )
}

/**
 * Forward connector across one or more step columns on the Regular Tutor row,
 * routed through each column gap (e.g. Before Students Join step 3 → 5).
 */
export function buildSpanningColumnGapArrowPath(
  sourceEl: HTMLElement,
  targetEl: HTMLElement,
  root: HTMLElement,
): string {
  const sourceBox = getCellContentBox(sourceEl, root)
  const targetBox = getCellContentBox(targetEl, root)
  const y = getArrowCenterY(sourceEl, targetEl, root)
  const sourceStep = parseStepIndex(sourceEl)
  const targetStep = parseStepIndex(targetEl)
  const entryX = targetBox.left - ARROW_CHEVRON_SIZE

  if (sourceStep === null || targetStep === null || targetStep <= sourceStep) {
    return ''
  }

  if (entryX <= sourceBox.right) return ''

  const points: Point[] = [{ x: sourceBox.right, y }]

  for (let gapIndex = sourceStep; gapIndex < targetStep; gapIndex++) {
    const gapX = getStepGapCenterX(root, gapIndex)
    if (gapX !== null) {
      points.push({ x: gapX, y })
    }
  }

  points.push({ x: entryX, y })

  return buildRoundedPolylinePath(points, ARROW_CORNER_RADIUS)
}

/** Rounded corners at each interior vertex of an axis-aligned polyline. */
export function buildRoundedPolylinePath(
  points: Point[],
  radius: number,
): string {
  if (points.length < 2) return ''
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`
  }

  const parts = [`M ${points[0].x} ${points[0].y}`]

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]
    const corner = points[i]
    const next = points[i + 1]

    const inLen = Math.hypot(corner.x - prev.x, corner.y - prev.y)
    const outLen = Math.hypot(next.x - corner.x, next.y - corner.y)
    if (inLen === 0 || outLen === 0) {
      parts.push(`L ${corner.x} ${corner.y}`)
      continue
    }

    const cornerRadius = Math.min(radius, inLen / 2, outLen / 2)
    if (cornerRadius <= 0) {
      parts.push(`L ${corner.x} ${corner.y}`)
      continue
    }

    const inUx = (corner.x - prev.x) / inLen
    const inUy = (corner.y - prev.y) / inLen
    const outUx = (next.x - corner.x) / outLen
    const outUy = (next.y - corner.y) / outLen

    parts.push(
      `L ${corner.x - inUx * cornerRadius} ${corner.y - inUy * cornerRadius}`,
    )
    parts.push(
      `Q ${corner.x} ${corner.y} ${corner.x + outUx * cornerRadius} ${corner.y + outUy * cornerRadius}`,
    )
  }

  const end = points[points.length - 1]
  parts.push(`L ${end.x} ${end.y}`)
  return parts.join(' ')
}

/**
 * Orthogonal wrap above the lane (Partner Action loop): up from source top into
 * the corridor above the row, across, then down into the target top.
 */
export function buildOverheadWrapArrowPath(
  sourceEl: HTMLElement,
  targetEl: HTMLElement,
  root: HTMLElement,
): string {
  const source = getCellTopCenter(sourceEl, root)
  const target = getCellTopCenter(targetEl, root)
  const railY = getDiscoveryRailY(sourceEl, targetEl, root)
  const lineEndY = target.y - ARROW_CHEVRON_SIZE

  if (lineEndY <= railY) return ''

  // Wrap runs right → left; target must sit in an earlier column.
  if (target.x >= source.x) return ''

  const exitLeg = buildWrapColumnLeg(sourceEl, root, railY, 'exit', 'above')
  const enterLeg = buildWrapColumnLeg(targetEl, root, railY, 'enter', 'above')
  if (!exitLeg || !enterLeg) return ''

  return buildRoundedPolylinePath(
    [...exitLeg, ...enterLeg],
    ARROW_CORNER_RADIUS,
  )
}

/**
 * Orthogonal wrap (e.g. step 8 → step 1): down from source bottom into the space
 * above the interaction line, across, then up into the target bottom.
 */
export function buildWrapArrowPath(
  sourceEl: HTMLElement,
  targetEl: HTMLElement,
  root: HTMLElement,
  sourceCellId?: string,
  targetCellId?: string,
): string {
  if (
    sourceCellId &&
    targetCellId &&
    isParallelSessionOverheadWrapDependency(sourceCellId, targetCellId)
  ) {
    return buildOverheadWrapArrowPath(sourceEl, targetEl, root)
  }

  if (
    isRegularTutorInLaneWrapDependency(
      sourceEl,
      targetEl,
      sourceCellId,
      targetCellId,
    )
  ) {
    return buildRegularTutorInLaneTopWrapPath(sourceEl, targetEl, root)
  }

  const { source, target } = getWrapCellAnchors(sourceEl, targetEl, root)
  const isLeadTutorBottomWrap =
    sourceCellId !== undefined &&
    targetCellId !== undefined &&
    isParallelSessionLeadBottomWrapDependency(sourceCellId, targetCellId)
  const corridorY = isLeadTutorBottomWrap
    ? getWrapCorridorY(sourceEl, root)
    : getWrapLoopRouteY(sourceEl, root)

  // Wrap runs right → left; target must sit in an earlier column.
  if (target.x >= source.x) {
    return ''
  }

  /*
    The drop to the corridor and the rise back out both travel INSIDE a step
    column, which the merged canvas no longer guarantees is empty below a
    card: a divergent slot stacks one sub-cell per path, so a wrap leaving the
    upper sub-cell used to descend straight through the lower one's text.
    Where that happens the vertical leg moves into the column's gutter and
    meets the card side-on instead.
  */
  const exitLeg = buildWrapColumnLeg(sourceEl, root, corridorY, 'exit')
  const enterLeg = buildWrapColumnLeg(targetEl, root, corridorY, 'enter')
  // No clear leg on one side (a blocked column with no usable gutter — an
  // edge column of a one-column board). Drawing the straight leg anyway
  // would strike through the sub-cell under the card, so drop the arrow.
  if (!exitLeg || !enterLeg) return ''

  return buildRoundedPolylinePath(
    [...exitLeg, ...enterLeg],
    ARROW_CORNER_RADIUS,
  )
}

/**
 * One end of a wrap: the points that take the route between a card and the
 * corridor it runs along — `below` the lane for a loop under it, `above` for
 * an overhead rail. Straight up or down the column when that stretch of the
 * column is clear, otherwise out of the card's side, into the gutter, and
 * along there.
 *
 * A wrap runs right → left, so the source leaves by its left edge and the
 * target is met on its right edge — the detour never doubles back.
 */
export function buildWrapColumnLeg(
  cellEl: HTMLElement,
  root: HTMLElement,
  corridorY: number,
  end: 'exit' | 'enter',
  side: 'below' | 'above' = 'below',
): Point[] | null {
  const box = getCellContentBox(cellEl, root)
  const centerX = (box.left + box.right) / 2
  const edgeY = side === 'below' ? box.top + box.height : box.top
  const blocked =
    getCellsOverlappingRect(
      root,
      {
        left: box.left,
        right: box.right,
        top: Math.min(edgeY, corridorY),
        bottom: Math.max(edgeY, corridorY),
      },
      [cellEl],
    ).length > 0

  if (!blocked) {
    const tipY =
      side === 'below' ? edgeY + ARROW_CHEVRON_SIZE : edgeY - ARROW_CHEVRON_SIZE
    return end === 'exit'
      ? [
          { x: centerX, y: edgeY },
          { x: centerX, y: corridorY },
        ]
      : [
          { x: centerX, y: corridorY },
          { x: centerX, y: tipY },
        ]
  }

  const stepIndex = parseStepIndex(cellEl) ?? 0
  const midY = box.top + box.height / 2
  if (end === 'exit') {
    const gutterX = getVerticalRouteGutterX(root, stepIndex, cellEl)
    const entryX = box.left - ARROW_CHEVRON_SIZE
    if (gutterX >= entryX) return null
    return [
      { x: entryX, y: midY },
      { x: gutterX, y: midY },
      { x: gutterX, y: corridorY },
    ]
  }

  const gutterX = getVerticalRouteRightGutterX(root, stepIndex, cellEl)
  const entryX = box.right + ARROW_CHEVRON_SIZE
  if (gutterX <= entryX) return null
  return [
    { x: gutterX, y: corridorY },
    { x: gutterX, y: midY },
    { x: entryX, y: midY },
  ]
}

/** Forward gap arrow, same-column vertical connector, or backward wrap. */
export function buildArrowPath(
  sourceEl: HTMLElement,
  targetEl: HTMLElement,
  root: HTMLElement,
  sourceCellId?: string,
  targetCellId?: string,
  dependencyId?: string,
): string {
  if (
    isReportingAnIssueFrontStageActionStep1ToResolveConnection(
      dependencyId,
      sourceCellId,
      targetCellId,
    )
  ) {
    return buildReportingAnIssueFrontStageActionStep1ToResolvePath(
      sourceEl,
      targetEl,
      root,
    )
  }

  if (
    isReportingHoursFrontStageTechStep1ToBackStageActionStep2Connection(
      dependencyId,
      sourceCellId,
      targetCellId,
    ) ||
    isCallOffFrontStageActionStep3ToBackStageActionStep5Connection(
      dependencyId,
      sourceCellId,
      targetCellId,
    )
  ) {
    return buildReportingHoursFrontStageTechStep1ToBackStageActionStep2Path(
      sourceEl,
      targetEl,
      root,
    )
  }

  const sourceStep = parseStepIndex(sourceEl)
  const targetStep = parseStepIndex(targetEl)

  if (
    sourceStep !== null &&
    targetStep !== null &&
    sourceStep === targetStep
  ) {
    if (
      isReportingAnIssueTutorToFrontStageTechStep1Dependency(
        dependencyId,
        sourceCellId,
        targetCellId,
      )
    ) {
      return buildReportingAnIssueTutorToFrontStageTechSameStepPath(
        sourceEl,
        targetEl,
        root,
      )
    }

    if (
      isSessionSignUpFrontStageTechToBackStageActionStep1Dependency(
        dependencyId,
        sourceCellId,
        targetCellId,
      ) ||
      isFillInRequestFrontStageTechToBackStageActionStep1Dependency(
        dependencyId,
        sourceCellId,
        targetCellId,
      )
    ) {
      return buildReportingAnIssueTutorToFrontStageTechSameStepPath(
        sourceEl,
        targetEl,
        root,
      )
    }

    if (
      isReportingHoursLeadTutorToFrontStageTechStep1Dependency(
        dependencyId,
        sourceCellId,
        targetCellId,
      )
    ) {
      return buildReportingAnIssueTutorToFrontStageTechSameStepPath(
        sourceEl,
        targetEl,
        root,
      )
    }

    if (
      isReportingHoursFrontStageTechStep3ToLeadTutorConnection(
        dependencyId,
        sourceCellId,
        targetCellId,
      )
    ) {
      return buildReportingHoursFrontStageTechStep3ToLeadTutorPath(
        sourceEl,
        targetEl,
        root,
      )
    }

    if (
      isReportingAnIssueFrontStageTechToRegularTutorDependency(
        dependencyId,
        sourceCellId,
        targetCellId,
      ) ||
      isReportingAnIssueFrontStageTechToLeadTutorDependency(
        dependencyId,
        sourceCellId,
        targetCellId,
      )
    ) {
      return buildReportingAnIssueFrontStageTechToTutorSameStepPath(
        sourceEl,
        targetEl,
        root,
      )
    }

    if (
      isDiscoveryFrontStageActionToRegularTutorDependency(
        dependencyId,
        sourceCellId,
        targetCellId,
      )
    ) {
      return buildDiscoveryFrontStageActionToRegularTutorSameStepPath(
        sourceEl,
        targetEl,
        root,
        dependencyId,
      )
    }

    const anchors = getVerticalCellAnchors(sourceEl, targetEl, root)
    const obstructing = getSameColumnObstructingCells(
      sourceEl,
      targetEl,
      root,
    )
    if (obstructing.length > 0) {
      // Side-on first: a stub out of the card's own left/right edge and a run
      // down the adjacent gutter hugs the column, where leaving through the
      // top/bottom edge has to swing around whatever is stacked against it.
      const sideRoute = resolveSameColumnSideRoute(sourceEl, targetEl, root)
      if (sideRoute) {
        return buildSameColumnSideAttachedPath(
          sourceEl,
          targetEl,
          root,
          sideRoute,
        )
      }

      const gutterX = getVerticalRouteGutterX(root, sourceStep, sourceEl)
      const detourAnchors = getVerticalGutterDetourAnchors(
        sourceEl,
        targetEl,
        root,
      )
      return buildVerticalGutterDetourPath(
        detourAnchors.source,
        detourAnchors.target,
        gutterX,
      )
    }
    return buildVerticalArrowPath(anchors.source, anchors.target)
  }

  if (isWrapDependency(sourceEl, targetEl, sourceCellId, targetCellId)) {
    return buildWrapArrowPath(
      sourceEl,
      targetEl,
      root,
      sourceCellId,
      targetCellId,
    )
  }

  if (
    sourceStep !== null &&
    targetStep !== null &&
    targetStep > sourceStep &&
    isBeforeStudentsJoinColumnGapCell(sourceCellId) &&
    isBeforeStudentsJoinColumnGapCell(targetCellId) &&
    // This route runs at one Y straight through every column it spans, which
    // only reads as a skip because the columns it skips are empty in that
    // lane. Merged fills them (each path contributes a sub-cell), so hand it
    // back to the generic detour when anything is actually in the way.
    getSameRowObstructingCells(sourceEl, targetEl).length === 0
  ) {
    return buildSpanningColumnGapArrowPath(sourceEl, targetEl, root)
  }

  if (
    sourceStep !== null &&
    targetStep !== null &&
    targetStep === sourceStep + 1 &&
    getLayerRow(sourceEl) === getLayerRow(targetEl) &&
    !isRegularTutorRailDependency(
      sourceEl,
      targetEl,
      sourceCellId,
      targetCellId,
    )
  ) {
    return buildAdjacentColumnGapArrowPath(sourceEl, targetEl, root)
  }

  if (
    isRegularTutorRailDependency(
      sourceEl,
      targetEl,
      sourceCellId,
      targetCellId,
    )
  ) {
    return buildApplicationRegularTutorRailPath(sourceEl, targetEl, root)
  }

  if (
    isReportingAnIssueFrontStageActionToFrontStageTechDependency(
      dependencyId,
      sourceCellId,
      targetCellId,
    )
  ) {
    return buildReportingAnIssueFrontStageActionToFrontStageTechPath(
      sourceEl,
      targetEl,
      root,
    )
  }

  if (isReportingAnIssueSpanningToTopEntryDependency(dependencyId)) {
    return buildReportingAnIssueSpanningToTopEntryPath(
      sourceEl,
      targetEl,
      root,
    )
  }

  if (
    isCrossLayerForwardDependency(sourceEl, targetEl) &&
    !isReportingAnIssueFrontStageActionStep1ToResolveConnection(
      dependencyId,
      sourceCellId,
      targetCellId,
    ) &&
    !isReportingHoursFrontStageTechStep1ToBackStageActionStep2Connection(
      dependencyId,
      sourceCellId,
      targetCellId,
    ) &&
    !isCallOffFrontStageActionStep3ToBackStageActionStep5Connection(
      dependencyId,
      sourceCellId,
      targetCellId,
    )
  ) {
    const crossLayerPath = buildCrossLayerForwardArrowPath(
      sourceEl,
      targetEl,
      root,
    )
    return crossLayerPath
  }

  if (getSameRowObstructingCells(sourceEl, targetEl).length > 0) {
    return buildHorizontalGutterDetourPath(sourceEl, targetEl, root)
  }

  const anchors = getHorizontalCellAnchors(sourceEl, targetEl, root)
  return buildHorizontalArrowPath(anchors.source, anchors.target)
}
