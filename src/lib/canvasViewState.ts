import type { CameraTransform } from '@/lib/cameraTransition'

const views = new Map<string, CameraTransform>()
const discarded = new Set<string>()

const validTransform = (value: CameraTransform) =>
  Number.isFinite(value.pan.x) &&
  Number.isFinite(value.pan.y) &&
  Number.isFinite(value.zoom) &&
  value.zoom > 0

export function readCanvasViewState(key: string): CameraTransform | undefined {
  if (discarded.delete(key)) return undefined
  const value = views.get(key)
  if (!value || !validTransform(value)) return undefined
  return { pan: { ...value.pan }, zoom: value.zoom }
}

export function writeCanvasViewState(key: string, value: CameraTransform) {
  // Closing a mounted tab deletes first and React unmount cleanup writes
  // afterward. Consume that one stale cleanup instead of resurrecting state
  // the close explicitly discarded.
  if (discarded.delete(key)) return
  if (!validTransform(value)) return
  views.set(key, { pan: { ...value.pan }, zoom: value.zoom })
}

export function deleteCanvasViewState(key: string) {
  views.delete(key)
  discarded.add(key)
}

export function deleteCanvasViewStatesForTab(tabKey: string) {
  deleteCanvasViewState(`desktop:${tabKey}`)
  deleteCanvasViewState(`mobile:${tabKey}`)
}
