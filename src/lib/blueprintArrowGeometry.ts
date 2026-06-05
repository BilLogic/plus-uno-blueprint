import { BLUEPRINT_WRAP_CORRIDOR_MARGIN } from '@/lib/blueprintLayout'

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

/** Chevron size (userSpaceOnUse) — keep in sync with BlueprintTriggerArrows marker. */
export const ARROW_CHEVRON_SIZE = 8
export const ARROW_STROKE_WIDTH = 2
/** refX/refY: chevron base attaches to path end; tip extends toward target. */
export const ARROW_MARKER_REF_X = 0
export const ARROW_MARKER_REF_Y = ARROW_CHEVRON_SIZE / 2

/** Rounded bend radius for orthogonal loop arrows. */
export const ARROW_CORNER_RADIUS = 8
/** Inset around chevron marker graphic so round caps are not clipped. */
export const ARROW_MARKER_PAD = Math.ceil(ARROW_STROKE_WIDTH / 2 + 1)
/** Bleed room around the grid overlay so strokes, chevrons, and bends are not clipped. */
export const ARROW_VIEWPORT_PAD = Math.ceil(
  ARROW_STROKE_WIDTH / 2 + ARROW_CHEVRON_SIZE + ARROW_CORNER_RADIUS / 2,
)

/** Target shorter than this fraction of source height → align to target center. */
export const ARROW_TARGET_MUCH_SMALLER_RATIO = 0.65

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
  const anchor = cellEl.querySelector<HTMLElement>('[data-blueprint-cell-anchor]')
  return getElementLayoutBox(anchor ?? cellEl, root)
}

/** Inset from the interaction line for loop-back horizontal segments. */
export const WRAP_LOOP_CORRIDOR_INSET = 10

export type WrapCorridorBounds = {
  start: number
  end: number
}

/** Vertical span between a lane row bottom and the interaction line. */
export function getWrapCorridorBounds(
  sourceEl: HTMLElement,
  root: HTMLElement,
): WrapCorridorBounds | null {
  const sourceBox = getCellContentBox(sourceEl, root)
  const corridorStart = sourceBox.top + sourceBox.height

  const row = sourceEl.closest('[data-blueprint-row]')
  if (row) {
    let sibling = row.nextElementSibling
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
 * Orthogonal wrap (e.g. step 8 → step 1): down from source bottom into the space
 * above the interaction line, across, then up into the target bottom.
 */
export function buildWrapArrowPath(
  sourceEl: HTMLElement,
  targetEl: HTMLElement,
  root: HTMLElement,
): string {
  const { source, target } = getWrapCellAnchors(sourceEl, targetEl, root)
  const corridorY = getWrapLoopRouteY(sourceEl, root)

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

/** Forward gap arrow or backward wrap, depending on step order. */
export function buildArrowPath(
  sourceEl: HTMLElement,
  targetEl: HTMLElement,
  root: HTMLElement,
  sourceCellId?: string,
  targetCellId?: string,
): string {
  const anchors = getHorizontalCellAnchors(sourceEl, targetEl, root)

  if (isWrapTrigger(sourceEl, targetEl, sourceCellId, targetCellId)) {
    return buildWrapArrowPath(sourceEl, targetEl, root)
  }

  return buildHorizontalArrowPath(anchors.source, anchors.target)
}
