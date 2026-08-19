export type ActiveCanvasCamera = {
  focusSlide: (slideId: string) => void
}

let activeCamera: ActiveCanvasCamera | null = null

export function registerActiveCanvasCamera(camera: ActiveCanvasCamera): () => void {
  activeCamera = camera
  return () => {
    if (activeCamera === camera) activeCamera = null
  }
}

/** Starts the camera before navigation's React reconciliation begins. */
export function focusActiveCanvasSlide(slideId: string): void {
  activeCamera?.focusSlide(slideId)
}
