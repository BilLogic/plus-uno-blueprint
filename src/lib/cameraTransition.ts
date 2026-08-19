export type CameraTransform = {
  pan: { x: number; y: number }
  zoom: number
}

export type CameraTransitionResult =
  | { kind: 'completed'; transform: CameraTransform }
  | { kind: 'cancelled'; transform: CameraTransform }
  | { kind: 'superseded'; transform: CameraTransform }

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

export function cameraTransitionDuration(
  from: CameraTransform,
  to: CameraTransform,
  viewport: { width: number; height: number },
): number {
  const diagonal = Math.max(1, Math.hypot(viewport.width, viewport.height))
  const screenTravel = Math.hypot(to.pan.x - from.pan.x, to.pan.y - from.pan.y)
  const zoomTravel = Math.abs(Math.log(Math.max(0.0001, to.zoom / from.zoom)))
  const weight = Math.min(1, screenTravel / diagonal / 1.5 + zoomTravel / 3)
  return Math.round(240 + (420 - 240) * weight)
}
