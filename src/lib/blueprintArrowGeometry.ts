import {
  BLUEPRINT_DISCOVERY_RAIL_CORRIDOR_MARGIN,
  BLUEPRINT_WRAP_CORRIDOR_MARGIN,
  isRegularTutorInLaneLoopTrigger,
  OVERHEAD_RAIL_REGULAR_TUTOR_CELL_PATTERN,
  STEP_COLUMN_GAP,
} from '@/lib/blueprintLayout'
import {
  isParallelSessionLeadBottomWrapTrigger,
  isParallelSessionOverheadWrapTrigger,
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
  'a0000000-0000-4000-8000-000000040803'
export const REGULAR_TUTOR_LOOP_TARGET_ID =
  'a0000000-0000-4000-8000-000000040103'

/** Arrowhead size (userSpaceOnUse) — Lucide-style filled tip. */
export const ARROW_CHEVRON_SIZE = 7
/** Half-height of the chevron base — smaller values read sharper. */
export const ARROW_CHEVRON_HALF_WIDTH = 2.5
export const ARROW_STROKE_WIDTH = 1.5
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

function isCrossLayerForwardTrigger(
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
 * Forward cross-column connector between different layer rows: exit the source
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
  const sourceMidY = sourceBox.top + sourceBox.height / 2
  const targetMidY = targetBox.top + targetBox.height / 2
  const bandTop = Math.min(sourceMidY, targetMidY)
  const bandBottom = Math.max(sourceMidY, targetMidY)

  const obstructing: HTMLElement[] = []
  root.querySelectorAll<HTMLElement>('[data-blueprint-cell]').forEach((el) => {
    if (el === sourceEl || el === targetEl) return
    if (parseStepIndex(el) !== stepIndex) return

    const box = getCellContentBox(el, root)
    const cellMidY = box.top + box.height / 2
    if (cellMidY <= bandTop || cellMidY >= bandBottom) return

    obstructing.push(el)
  })

  return obstructing
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

/** Mid-left anchors for same-column gutter detours. */
export function getVerticalGutterDetourAnchors(
  sourceEl: HTMLElement,
  targetEl: HTMLElement,
  root: HTMLElement,
): CellAnchor {
  const sourceBox = getCellContentBox(sourceEl, root)
  const targetBox = getCellContentBox(targetEl, root)

  return {
    source: {
      x: sourceBox.left,
      y: sourceBox.top + sourceBox.height / 2,
    },
    target: {
      x: targetBox.left,
      y: targetBox.top + targetBox.height / 2,
    },
  }
}

/**
 * Same-column connector routed through the left column gutter; exits and
 * enters at the vertical midpoint of each cell's left edge.
 */
export function buildVerticalGutterDetourPath(
  source: Point,
  target: Point,
  gutterX: number,
): string {
  const entryX = target.x - ARROW_CHEVRON_SIZE
  if (entryX <= gutterX) return ''

  return buildRoundedPolylinePath(
    [
      source,
      { x: gutterX, y: source.y },
      { x: gutterX, y: target.y },
      { x: entryX, y: target.y },
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

export function isWrapTrigger(
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

/** Layout box relative to the grid root (viewport-corrected for canvas zoom). */
export function getElementLayoutBox(
  el: HTMLElement,
  root: HTMLElement,
): LayoutBox {
  const elRect = el.getBoundingClientRect()
  const rootRect = root.getBoundingClientRect()
  const scaleX =
    root.offsetWidth > 0 ? rootRect.width / root.offsetWidth : 1
  const scaleY =
    root.offsetHeight > 0 ? rootRect.height / root.offsetHeight : 1

  return {
    left: (elRect.left - rootRect.left) / scaleX,
    right: (elRect.right - rootRect.left) / scaleX,
    top: (elRect.top - rootRect.top) / scaleY,
    height: elRect.height / scaleY,
  }
}

/** Inner content box — the visible cell card edge, not outer lane padding. */
export function getCellContentBox(
  cellEl: HTMLElement,
  root: HTMLElement,
): LayoutBox {
  const anchor = cellEl.querySelector<HTMLElement>(
    '[data-blueprint-cell-anchor]',
  )
  return getElementLayoutBox(anchor ?? cellEl, root)
}

/** Inset from the interaction line for loop-back horizontal segments. */
export const WRAP_LOOP_CORRIDOR_INSET = 10

/** Inset above cell tops for Regular Tutor loop-back horizontal segments. */
export const REGULAR_TUTOR_LOOP_TOP_INSET = 8

/** Backward loop on the Regular Tutor row (e.g. Set Goals step 11 → step 1). */
export function isRegularTutorInLaneWrapTrigger(
  sourceEl: HTMLElement,
  targetEl: HTMLElement,
  sourceCellId?: string,
  targetCellId?: string,
): boolean {
  if (
    sourceCellId &&
    targetCellId &&
    isParallelSessionLeadBottomWrapTrigger(sourceCellId, targetCellId)
  ) {
    return false
  }
  if (
    sourceCellId &&
    targetCellId &&
    isParallelSessionOverheadWrapTrigger(sourceCellId, targetCellId)
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
    return isRegularTutorInLaneLoopTrigger(
      resolveArrowLogicCellId(sourceCellId),
      resolveArrowLogicCellId(targetCellId),
    )
  }

  return true
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

  const sourceBox = getCellContentBox(sourceEl, root)
  const targetBox = getCellContentBox(targetEl, root)
  const cellTop = Math.min(sourceBox.top, targetBox.top)
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

  return buildRoundedPolylinePath(
    [
      source,
      { x: source.x, y: routeY },
      { x: target.x, y: routeY },
      { x: target.x, y: lineEndY },
    ],
    ARROW_CORNER_RADIUS,
  )
}


export type WrapCorridorBounds = {
  start: number
  end: number
}

/** Vertical span between a lane row bottom and the next wrap corridor or interaction line. */
export function getWrapCorridorBounds(
  sourceEl: HTMLElement,
  root: HTMLElement,
): WrapCorridorBounds | null {
  const sourceBox = getCellContentBox(sourceEl, root)
  const corridorStart = sourceBox.top + sourceBox.height

  const row = sourceEl.closest('[data-blueprint-row]')
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

/** Y center of the corridor between a layer row and the interaction line. */
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

/** Layout boxes for each tech pill inside a multi-pill cell. */
function getTechPillBoxes(
  cellEl: HTMLElement,
  root: HTMLElement,
): LayoutBox[] {
  const pills = cellEl.querySelectorAll<HTMLElement>(
    '[data-blueprint-tech-pill]',
  )
  return [...pills].map((pill) => {
    const anchor =
      pill.closest<HTMLElement>('[data-blueprint-cell-anchor]') ?? pill
    return getElementLayoutBox(anchor, root)
  })
}

/** Pill whose center is closest to a peer cell — for vertical connectors. */
function getNearestPillBox(
  cellEl: HTMLElement,
  root: HTMLElement,
  peerBox: LayoutBox,
): LayoutBox | null {
  const pillBoxes = getTechPillBoxes(cellEl, root)
  if (pillBoxes.length === 0) return null

  const peerCenterY = peerBox.top + peerBox.height / 2
  let nearest = pillBoxes[0]
  let nearestDistance = Math.abs(
    nearest.top + nearest.height / 2 - peerCenterY,
  )

  for (const box of pillBoxes.slice(1)) {
    const distance = Math.abs(box.top + box.height / 2 - peerCenterY)
    if (distance < nearestDistance) {
      nearest = box
      nearestDistance = distance
    }
  }

  return nearest
}

/** Connectors anchor to top/bottom edges when source and target share a step column. */
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

  const sourceAnchorBox =
    getNearestPillBox(sourceEl, root, targetBox) ?? sourceBox
  const targetAnchorBox =
    getNearestPillBox(targetEl, root, sourceBox) ?? targetBox
  const x =
    (sourceAnchorBox.left +
      sourceAnchorBox.right +
      targetAnchorBox.left +
      targetAnchorBox.right) /
    4

  if (targetAbove) {
    return {
      source: { x, y: sourceAnchorBox.top },
      target: { x, y: targetAnchorBox.top + targetAnchorBox.height },
    }
  }

  return {
    source: { x, y: sourceAnchorBox.top + sourceAnchorBox.height },
    target: { x, y: targetAnchorBox.top },
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

export type BidirectionalTriggerLink = {
  id: string
  source_cell_id: string
  target_cell_id: string
}

export type BidirectionalTriggerPair<T extends BidirectionalTriggerLink> = {
  first: T
  second: T
  cellAId: string
  cellBId: string
}

/** Pairs of triggers that connect the same two cells in opposite directions. */
export function findBidirectionalTriggerPairs<T extends BidirectionalTriggerLink>(
  triggers: T[],
): { pairs: BidirectionalTriggerPair<T>[]; remaining: T[] } {
  const pending = new Map<string, T>()
  const pairedIds = new Set<string>()
  const pairs: BidirectionalTriggerPair<T>[] = []

  for (const trigger of triggers) {
    const reverseKey = `${trigger.target_cell_id}->${trigger.source_cell_id}`
    const reverse = pending.get(reverseKey)
    if (reverse) {
      pairedIds.add(trigger.id)
      pairedIds.add(reverse.id)
      pairs.push({
        first: reverse,
        second: trigger,
        cellAId: reverse.source_cell_id,
        cellBId: reverse.target_cell_id,
      })
      pending.delete(reverseKey)
      continue
    }

    pending.set(
      `${trigger.source_cell_id}->${trigger.target_cell_id}`,
      trigger,
    )
  }

  return {
    pairs,
    remaining: triggers.filter((trigger) => !pairedIds.has(trigger.id)),
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

const INTEGRATED_CELL_ID_PATTERN =
  /^integrated-cell-[0-9a-f-]{36}-([0-9a-f-]{36})$/i

/** Map integrated overlay cell ids back to canonical blueprint cell ids for arrow rules. */
export function resolveArrowLogicCellId(cellId: string): string {
  const match = INTEGRATED_CELL_ID_PATTERN.exec(cellId)
  return match ? match[1]! : cellId
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

export function isRegularTutorRailTrigger(
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

/** @deprecated Use isRegularTutorRailTrigger. */
export function isApplicationRegularTutorRailTrigger(
  sourceEl: HTMLElement,
  targetEl: HTMLElement,
  sourceCellId?: string,
  targetCellId?: string,
): boolean {
  return isRegularTutorRailTrigger(
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
  const sourceBox = getCellContentBox(sourceEl, root)
  const targetBox = getCellContentBox(targetEl, root)
  return (
    Math.min(sourceBox.top, targetBox.top) -
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
 * Merged bus for multiple Regular Tutor forward triggers that share a target:
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
  branches: Array<{ triggerId: string; targetEl: HTMLElement }>
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

/** Trigger ids that share a source and fan out to multiple overhead-rail targets. */
export function collectOverheadRailFanOutTriggerIds<
  T extends DiscoveryRailTrigger,
>(triggers: readonly T[]): Set<string> {
  const bySource = new Map<string, T[]>()

  for (const trigger of triggers) {
    if (
      !isRegularTutorRailTriggerByCellId(
        trigger.source_cell_id,
        trigger.target_cell_id,
      )
    ) {
      continue
    }

    const list = bySource.get(trigger.source_cell_id) ?? []
    list.push(trigger)
    bySource.set(trigger.source_cell_id, list)
  }

  const fanOutIds = new Set<string>()
  for (const list of bySource.values()) {
    const targetIds = new Set(list.map((trigger) => trigger.target_cell_id))
    if (targetIds.size < 2) continue
    for (const trigger of list) {
      fanOutIds.add(trigger.id)
    }
  }

  return fanOutIds
}

export type DiscoveryRailTrigger = {
  id: string
  source_cell_id: string
  target_cell_id: string
}

/** Group overhead-rail triggers into merge buses and source fan-outs. */
export function groupDiscoveryRailTriggers<T extends DiscoveryRailTrigger>(
  triggers: T[],
  content: HTMLElement,
): {
  busGroups: {
    targetCellId: string
    triggerIds: string[]
    sourceEls: HTMLElement[]
    targetEl: HTMLElement
  }[]
  fanOutGroups: OverheadRailFanOutGroup[]
  remaining: T[]
} {
  const remaining: T[] = []
  const railEntries: Array<{
    trigger: T
    sourceEl: HTMLElement
    targetEl: HTMLElement
  }> = []

  for (const trigger of triggers) {
    if (
      !isRegularTutorRailTriggerByCellId(
        trigger.source_cell_id,
        trigger.target_cell_id,
      )
    ) {
      remaining.push(trigger)
      continue
    }

    const sourceEl = content.querySelector<HTMLElement>(
      `[data-blueprint-cell="${trigger.source_cell_id}"]`,
    )
    const targetEl = content.querySelector<HTMLElement>(
      `[data-blueprint-cell="${trigger.target_cell_id}"]`,
    )
    if (!sourceEl || !targetEl) continue

    railEntries.push({ trigger, sourceEl, targetEl })
  }

  const fanOutTriggerIds = collectOverheadRailFanOutTriggerIds(
    railEntries.map((entry) => entry.trigger),
  )
  const fanOutGroups: OverheadRailFanOutGroup[] = []
  const bySource = new Map<
    string,
    {
      sourceEl: HTMLElement
      branches: Array<{ triggerId: string; targetEl: HTMLElement }>
      targetIds: Set<string>
    }
  >()

  for (const entry of railEntries) {
    if (!fanOutTriggerIds.has(entry.trigger.id)) continue

    const existing = bySource.get(entry.trigger.source_cell_id)
    if (existing) {
      if (!existing.targetIds.has(entry.trigger.target_cell_id)) {
        existing.targetIds.add(entry.trigger.target_cell_id)
        existing.branches.push({
          triggerId: entry.trigger.id,
          targetEl: entry.targetEl,
        })
      }
    } else {
      bySource.set(entry.trigger.source_cell_id, {
        sourceEl: entry.sourceEl,
        branches: [
          { triggerId: entry.trigger.id, targetEl: entry.targetEl },
        ],
        targetIds: new Set([entry.trigger.target_cell_id]),
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
    { triggerIds: string[]; sourceEls: HTMLElement[]; targetEl: HTMLElement }
  >()

  for (const entry of railEntries) {
    if (fanOutTriggerIds.has(entry.trigger.id)) continue

    const existing = byTarget.get(entry.trigger.target_cell_id)
    if (existing) {
      existing.triggerIds.push(entry.trigger.id)
      existing.sourceEls.push(entry.sourceEl)
    } else {
      byTarget.set(entry.trigger.target_cell_id, {
        triggerIds: [entry.trigger.id],
        sourceEls: [entry.sourceEl],
        targetEl: entry.targetEl,
      })
    }
  }

  const busGroups = [...byTarget.entries()]
    .filter(([, group]) => group.sourceEls.length >= 2)
    .map(([targetCellId, group]) => ({
      targetCellId,
      triggerIds: group.triggerIds,
      sourceEls: group.sourceEls,
      targetEl: group.targetEl,
    }))

  for (const entry of railEntries) {
    if (fanOutTriggerIds.has(entry.trigger.id)) continue

    const busGroup = busGroups.find((group) =>
      group.triggerIds.includes(entry.trigger.id),
    )
    if (busGroup) continue

    remaining.push(entry.trigger)
  }

  return {
    busGroups,
    fanOutGroups,
    remaining,
  }
}

function isRegularTutorRailTriggerByCellId(
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
    isParallelSessionOverheadWrapTrigger(sourceCellId, targetCellId)
  ) {
    return buildOverheadWrapArrowPath(sourceEl, targetEl, root)
  }

  if (
    isRegularTutorInLaneWrapTrigger(
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
    isParallelSessionLeadBottomWrapTrigger(sourceCellId, targetCellId)
  const corridorY = isLeadTutorBottomWrap
    ? getWrapCorridorY(sourceEl, root)
    : getWrapLoopRouteY(sourceEl, root)

  // Wrap runs right → left; target must sit in an earlier column.
  if (target.x >= source.x) {
    return ''
  }

  const lineEndY = target.y + ARROW_CHEVRON_SIZE

  return buildRoundedPolylinePath(
    [
      source,
      { x: source.x, y: corridorY },
      { x: target.x, y: corridorY },
      { x: target.x, y: lineEndY },
    ],
    ARROW_CORNER_RADIUS,
  )
}

/** Forward gap arrow, same-column vertical connector, or backward wrap. */
export function buildArrowPath(
  sourceEl: HTMLElement,
  targetEl: HTMLElement,
  root: HTMLElement,
  sourceCellId?: string,
  targetCellId?: string,
): string {
  const sourceStep = parseStepIndex(sourceEl)
  const targetStep = parseStepIndex(targetEl)

  if (
    sourceStep !== null &&
    targetStep !== null &&
    sourceStep === targetStep
  ) {
    const anchors = getVerticalCellAnchors(sourceEl, targetEl, root)
    const obstructing = getSameColumnObstructingCells(
      sourceEl,
      targetEl,
      root,
    )
    if (obstructing.length > 0) {
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

  if (isWrapTrigger(sourceEl, targetEl, sourceCellId, targetCellId)) {
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
    isBeforeStudentsJoinColumnGapCell(targetCellId)
  ) {
    return buildSpanningColumnGapArrowPath(sourceEl, targetEl, root)
  }

  if (
    sourceStep !== null &&
    targetStep !== null &&
    targetStep === sourceStep + 1 &&
    getLayerRow(sourceEl) === getLayerRow(targetEl) &&
    !isRegularTutorRailTrigger(
      sourceEl,
      targetEl,
      sourceCellId,
      targetCellId,
    )
  ) {
    return buildAdjacentColumnGapArrowPath(sourceEl, targetEl, root)
  }

  if (
    isRegularTutorRailTrigger(
      sourceEl,
      targetEl,
      sourceCellId,
      targetCellId,
    )
  ) {
    return buildApplicationRegularTutorRailPath(sourceEl, targetEl, root)
  }

  if (isCrossLayerForwardTrigger(sourceEl, targetEl)) {
    const crossLayerPath = buildCrossLayerForwardArrowPath(
      sourceEl,
      targetEl,
      root,
    )
    if (crossLayerPath) return crossLayerPath
  }

  if (getSameRowObstructingCells(sourceEl, targetEl).length > 0) {
    return buildHorizontalGutterDetourPath(sourceEl, targetEl, root)
  }

  const anchors = getHorizontalCellAnchors(sourceEl, targetEl, root)
  return buildHorizontalArrowPath(anchors.source, anchors.target)
}
