import type { CameraTransform } from '@/lib/cameraTransition'

const views = new Map<string, CameraTransform>()

const validTransform = (value: CameraTransform) =>
  Number.isFinite(value.pan.x) &&
  Number.isFinite(value.pan.y) &&
  Number.isFinite(value.zoom) &&
  value.zoom > 0

export function readCanvasViewState(key: string): CameraTransform | undefined {
  const value = views.get(key)
  if (!value || !validTransform(value)) return undefined
  return { pan: { ...value.pan }, zoom: value.zoom }
}

export function writeCanvasViewState(key: string, value: CameraTransform) {
  if (!validTransform(value)) return
  views.set(key, { pan: { ...value.pan }, zoom: value.zoom })
}

export function deleteCanvasViewState(key: string) {
  views.delete(key)
}

export function deleteCanvasViewStatesForTab(tabKey: string) {
  deleteCanvasViewState(`desktop:${tabKey}`)
  deleteCanvasViewState(`mobile:${tabKey}`)
}
