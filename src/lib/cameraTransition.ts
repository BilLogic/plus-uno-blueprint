export type CameraTransform = {
  pan: { x: number; y: number }
  zoom: number
}

export type CameraTransitionResult =
  | { kind: 'completed'; transform: CameraTransform }
  | { kind: 'cancelled'; transform: CameraTransform }
  | { kind: 'superseded'; transform: CameraTransform }

/**
 * Changes camera scale while mapping one viewport point to another.
 *
 * A wheel zoom passes the same point twice, keeping the world beneath the
 * cursor stationary. A pinch passes the previous and current midpoint, so
 * midpoint drift and scale are solved in one transform instead of applying
 * the finger movement twice.
 */
export function transformCameraAroundPoint(
  from: CameraTransform,
  fromPoint: { x: number; y: number },
  toPoint: { x: number; y: number },
  nextZoom: number,
): CameraTransform {
  const fromZoom = Math.max(0.0001, from.zoom)
  const safeNextZoom = Math.max(0.0001, nextZoom)
  const world = {
    x: (fromPoint.x - from.pan.x) / fromZoom,
    y: (fromPoint.y - from.pan.y) / fromZoom,
  }

  return {
    pan: {
      x: toPoint.x - world.x * safeNextZoom,
      y: toPoint.y - world.y * safeNextZoom,
    },
    zoom: safeNextZoom,
  }
}

/**
 * Sine ease-in-out: a calm departure and landing without smootherstep's
 * long near-still endpoints and steep middle acceleration.
 */
export function easeCameraTransition(value: number): number {
  const t = Math.min(1, Math.max(0, value))
  if (t === 0 || t === 1) return t
  return -(Math.cos(Math.PI * t) - 1) / 2
}

/**
 * Returns transition progress measured from the first frame the browser can
 * actually draw. Work scheduled before requestAnimationFrame (notably React
 * reconciliation for a large canvas) may block the main thread; counting
 * that blocked time makes the first visible frame jump toward the target.
 */
export function createCameraTransitionClock(durationMs: number) {
  const duration = Math.max(1, durationMs)
  let firstFrameAt: number | null = null

  return (frameAt: number): number => {
    firstFrameAt ??= frameAt
    return Math.min(1, Math.max(0, (frameAt - firstFrameAt) / duration))
  }
}

/**
 * Interpolate the visible world rectangle, then derive its transform. This
 * keeps pan and zoom coupled: a destination never moves away before arriving.
 */
export function interpolateCameraTransform(
  from: CameraTransform,
  to: CameraTransform,
  viewport: { width: number; height: number },
  t: number,
): CameraTransform {
  const progress = Math.min(1, Math.max(0, t))
  if (progress === 0) return from
  if (progress === 1) return to
  const width = Math.max(1, viewport.width)
  const fromZoom = Math.max(0.0001, from.zoom)
  const toZoom = Math.max(0.0001, to.zoom)
  const fromRect = {
    x: -from.pan.x / fromZoom,
    y: -from.pan.y / fromZoom,
    width: width / fromZoom,
  }
  const toRect = {
    x: -to.pan.x / toZoom,
    y: -to.pan.y / toZoom,
    width: width / toZoom,
  }
  const rect = {
    x: fromRect.x + (toRect.x - fromRect.x) * progress,
    y: fromRect.y + (toRect.y - fromRect.y) * progress,
    width: fromRect.width + (toRect.width - fromRect.width) * progress,
  }
  const zoom = width / Math.max(0.0001, rect.width)
  return { pan: { x: -rect.x * zoom, y: -rect.y * zoom }, zoom }
}
