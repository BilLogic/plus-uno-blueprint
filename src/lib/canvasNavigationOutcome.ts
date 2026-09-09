import type { CameraTransitionResult } from '@/lib/cameraTransition'

type Waiter = (result: CameraTransitionResult) => void

const waiters = new Map<string, Set<Waiter>>()

/** Listen only for the next accepted camera intent for this semantic target. */
export function waitForCanvasNavigationOutcome(key: string): {
  promise: Promise<CameraTransitionResult>
  cancel: () => void
} {
  let waiter: Waiter | null = null
  const promise = new Promise<CameraTransitionResult>((resolve) => {
    waiter = resolve
    const listeners = waiters.get(key) ?? new Set<Waiter>()
    listeners.add(resolve)
    waiters.set(key, listeners)
  })
  return {
    promise,
    cancel: () => {
      if (!waiter) return
      const listeners = waiters.get(key)
      listeners?.delete(waiter)
      if (listeners?.size === 0) waiters.delete(key)
      waiter = null
    },
  }
}

export function publishCanvasNavigationOutcome(
  key: string,
  result: CameraTransitionResult,
) {
  const listeners = waiters.get(key)
  if (!listeners) return
  waiters.delete(key)
  for (const resolve of listeners) resolve(result)
}
